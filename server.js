import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import crypto from "crypto";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

const conversations = {};
const summaries = {};
const sessionTimestamps = {};
const sessionProducts = {};
const sessionImageCount = {};
const sessionEmails = {};

setInterval(() => {
  const now = Date.now();
  Object.keys(sessionTimestamps).forEach((id) => {
    if (now - sessionTimestamps[id] > 3600000) {
      delete conversations[id];
      delete summaries[id];
      delete sessionTimestamps[id];
      delete sessionImageCount[id];
      delete sessionEmails[id];
      delete sessionProducts[id];
    }
  });
}, 3600000);

let products = [];

try {
  const raw = fs.readFileSync("./public/products-brain.json", "utf8");
  products = JSON.parse(raw);
  console.log(`PRODUCT BRAIN LOADED: ${products.length}`);
} catch (err) {
  console.log("NO PRODUCTS BRAIN FOUND");
}

async function shopifyQuery(query) {
  try {
    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": TOKEN,
        },
        body: JSON.stringify({ query }),
      }
    );
    return response.json();
  } catch (err) {
    return null;
  }
}

async function getActiveDiscounts() {
  try {
    const data = await shopifyQuery(`
      {
        discountNodes(first: 10) {
          edges {
            node {
              discount {
                ... on DiscountCodeBasic {
                  title
                  status
                  codes(first: 3) {
                    edges { node { code } }
                  }
                  customerGets {
                    value {
                      ... on DiscountPercentage { percentage }
                      ... on DiscountAmount { amount { amount currencyCode } }
                    }
                  }
                }
                ... on DiscountAutomaticBasic {
                  title
                  status
                  customerGets {
                    value {
                      ... on DiscountPercentage { percentage }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);
    if (!data?.data?.discountNodes?.edges) return [];
    return data.data.discountNodes.edges
      .map((e) => e.node.discount)
      .filter((d) => d?.status === "ACTIVE");
  } catch (err) {
    return [];
  }
}

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replaceAll("أ", "ا").replaceAll("إ", "ا").replaceAll("آ", "ا")
    .replaceAll("ة", "ه").replaceAll("ى", "ي")
    .replaceAll("خاتم خطوبه", "engagement ring")
    .replaceAll("خاتم خطوبة", "engagement ring")
    .replaceAll("سلسله اسم", "name necklace")
    .replaceAll("سلسلة اسم", "name necklace")
    .replaceAll("سلسله حرف", "initial necklace")
    .replaceAll("سلسلة حرف", "initial necklace")
    .replaceAll("روز جولد", "rose gold")
    .replaceAll("خاتم", "ring").replaceAll("دبله", "ring").replaceAll("محبس", "ring")
    .replaceAll("عقد", "necklace").replaceAll("سلسله", "necklace").replaceAll("سلسلة", "necklace")
    .replaceAll("اسوره", "bracelet").replaceAll("أسوارة", "bracelet")
    .replaceAll("حلق", "earring").replaceAll("حلقان", "earring")
    .replaceAll("ذهب", "gold").replaceAll("فضه", "silver").replaceAll("فضة", "silver")
    .replaceAll("بلاتين", "platinum")
    .replaceAll("الماس", "diamond")
    .replaceAll("موزانيت", "moissanite").replaceAll("مويسانيت", "moissanite").replaceAll("موزنايت", "moissanite")
    .replaceAll("روز", "rose gold")
    .replaceAll("اصفر", "yellow gold").replaceAll("ابيض", "white gold")
    .replaceAll("هديه", "gift jewelry").replaceAll("هدية", "gift jewelry")
    .replaceAll("اسم", "name").replaceAll("حرف", "initial")
    .replaceAll("قلاده", "necklace").replaceAll("قلادة", "necklace")
    .replaceAll("دلايه", "pendant").replaceAll("دلاية", "pendant")
    .replaceAll("رجالي", "men").replaceAll("رجال", "men")
    .replaceAll("اطفال", "kids").replaceAll("أطفال", "kids")
    .replaceAll("خصم", "discount").replaceAll("تخفيض", "discount")
    .replaceAll("زوجين", "couple").replaceAll("زوجي", "couple")
    .replaceAll("هدية", "gift").replaceAll("هديه", "gift");
}

function detectLanguage(message) {
  return /[\u0600-\u06FF]/.test(message) ? "arabic" : "english";
}

async function extractIntent(userMessage) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a jewelry search intent extractor.
Extract the customer's jewelry search intent and return ONLY a JSON object.

Return format:
{
  "category": "ring|necklace|bracelet|earring|pendant|chain|",
  "metal": "rose gold|yellow gold|white gold|silver|platinum|",
  "stone": "moissanite|diamond|pearl|",
  "shape": "oval|pear|round|emerald|princess|radiant|marquise|cushion|heart|asscher|",
  "occasion": "wedding|engagement|gift|anniversary|birthday|",
  "style": "men|kids|couple|custom|name|initial|tennis|",
  "keywords": ["keyword1", "keyword2"]
}

Only fill fields that are clearly mentioned. Leave others empty.
Return ONLY the JSON, no extra text.
          `,
        },
        { role: "user", content: userMessage },
      ],
    });
    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function shouldSearchProducts(message) {
  const msg = normalizeText(message);
  const keywords = [
    "ring", "necklace", "bracelet", "earring", "pendant", "chain",
    "name", "initial", "letter", "custom", "personalized",
    "diamond", "gold", "silver", "platinum", "rose gold", "moissanite", "pearl",
    "gift", "luxury", "bridal", "wedding", "engagement",
    "oval", "pear", "round", "emerald", "princess", "radiant", "heart",
    "men", "kids", "couple", "tennis",
    "show", "recommend", "suggest", "find", "want", "buy",
    "هديه", "هدية", "ذكري", "عيد", "مجوهرات", "جواهر", "رجالي", "زوجين",
  ];
  return keywords.some((w) => msg.includes(normalizeText(w)));
}

function shouldShowNext(message) {
  const msg = message.toLowerCase();
  const keywords = [
    "next", "another", "more", "different", "other", "else",
    "تاني", "غيره", "غيرها", "واحد تاني", "ورني تاني",
    "قطعه اخره", "قطعة اخرى", "قطعه اخري", "قطعة أخرى",
    "اخري", "اخره", "اخرى", "مش عاجبني", "غير",
    "كمان", "شوف تاني", "ورني غيره", "حاجة تانية",
  ];
  return keywords.some((w) => msg.includes(w));
}

function shouldAskDiscount(message) {
  const msg = normalizeText(message);
  return msg.includes("discount") || msg.includes("sale") ||
    msg.includes("offer") || msg.includes("promo") || msg.includes("code");
}

function roughFilter(userMessage, intent, products) {
  const msg = normalizeText(userMessage);
  const words = msg.split(" ").filter((w) => w.length > 2);
  const intentWords = [
    intent?.category, intent?.metal, intent?.stone, intent?.shape,
    intent?.occasion, intent?.style, ...(intent?.keywords || []),
  ].filter(Boolean).map((w) => normalizeText(w));

  let scoredProducts = products.map((p) => {
    const collectionText = (p.aiFeatures?.collections || []).join(" ").toLowerCase();
    const text = normalizeText(`
      ${p.title || ""} ${p.description || ""} ${p.type || ""}
      ${p.tags?.join(" ") || ""} ${p.aiFeatures?.category || ""}
      ${p.aiFeatures?.collection || ""} ${p.aiFeatures?.productType || ""}
      ${p.aiFeatures?.styles?.join(" ") || ""} ${p.aiFeatures?.intent?.join(" ") || ""}
      ${p.aiFeatures?.searchKeywords?.join(" ") || ""} ${p.aiFeatures?.materials?.join(" ") || ""}
      ${p.aiFeatures?.variantMetalColors?.join(" ") || ""} ${p.aiFeatures?.diamondShapes?.join(" ") || ""}
      ${collectionText}
    `);
    let score = 0;
    words.forEach((word) => { if (text.includes(word)) score += 10; });
    intentWords.forEach((word) => { if (word && text.includes(word)) score += 40; });
    if (intent?.category && text.includes(intent.category)) score += 100;
    if (intent?.metal && text.includes(intent.metal)) score += 150;
    if (intent?.stone && text.includes(intent.stone)) score += 200;
    if (intent?.shape && text.includes(intent.shape)) score += 150;
    if (intent?.occasion && text.includes(intent.occasion)) score += 120;
    if (intent?.style && text.includes(intent.style)) score += 100;
    if (intent?.category) {
      if (!text.includes(intent.category)) score -= 200;
    } else {
      if (msg.includes("ring") && !text.includes("ring")) score -= 150;
      if (msg.includes("necklace") && !text.includes("necklace")) score -= 150;
      if (msg.includes("bracelet") && !text.includes("bracelet")) score -= 150;
      if (msg.includes("earring") && !text.includes("earring")) score -= 150;
    }
    return { ...p, score };
  });

  return scoredProducts.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 30);
}

async function aiSelectProducts(userMessage, intent, candidates) {
  try {
    const candidateList = candidates.map((p, i) => ({
      index: i, title: p.title,
      category: p.aiFeatures?.category || "",
      collections: (p.aiFeatures?.collections || []).slice(0, 5),
      productType: p.aiFeatures?.productType || "",
      metals: p.aiFeatures?.variantMetalColors?.join(", ") || "",
      shapes: p.aiFeatures?.diamondShapes?.join(", ") || "",
      stones: p.aiFeatures?.variantStoneColors?.join(", ") || "",
      styles: p.aiFeatures?.styles?.join(", ") || "",
      intent: p.aiFeatures?.intent?.join(", ") || "",
      price: p.variants?.[0]?.price || p.price || "",
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini", temperature: 0,
      messages: [
        { role: "system", content: `You are a luxury jewelry product selector. Choose the 8 most relevant AND DIVERSE products. CATEGORY IS MANDATORY. Return ONLY a JSON array of index numbers.` },
        { role: "user", content: `Customer: "${userMessage}"\nIntent: ${JSON.stringify(intent)}\nProducts:\n${JSON.stringify(candidateList, null, 2)}\nReturn 8 diverse best index numbers as JSON array.` },
      ],
    });

    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    const indices = JSON.parse(raw);
    return indices.filter((i) => i >= 0 && i < candidates.length).slice(0, 8).map((i) => candidates[i]);
  } catch (err) {
    return candidates.slice(0, 8);
  }
}

function​​​​​​​​​​​​​​​​
