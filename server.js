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

// =====================================
// OPENAI
// =====================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =====================================
// SHOPIFY
// =====================================

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// =====================================
// MEMORY
// =====================================

const conversations = {};
const summaries = {};
const sessionTimestamps = {};
const sessionProducts = {};
const sessionImageCount = {};
const sessionEmails = {};

// =====================================
// CLEAN OLD SESSIONS EVERY HOUR
// =====================================

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

// =====================================
// LOAD PRODUCT BRAIN
// =====================================

let products = [];

try {
  const raw = fs.readFileSync("./public/products-brain.json", "utf8");
  products = JSON.parse(raw);
  console.log(`PRODUCT BRAIN LOADED: ${products.length}`);
} catch (err) {
  console.log("NO PRODUCTS BRAIN FOUND");
}

// =====================================
// SHOPIFY GRAPHQL
// =====================================

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
    console.log("SHOPIFY QUERY ERROR:", err.message);
    return null;
  }
}

// =====================================
// GET ACTIVE DISCOUNTS FROM SHOPIFY
// =====================================

async function getActiveDiscounts() {
  try {
    const data = await shopifyQuery(`
      {
        discountNodes(first: 10) {
          edges {
            node {
              id
              discount {
                ... on DiscountCodeBasic {
                  title
                  status
                  codes(first: 5) {
                    edges {
                      node {
                        code
                      }
                    }
                  }
                  customerGets {
                    value {
                      ... on DiscountPercentage {
                        percentage
                      }
                      ... on DiscountAmount {
                        amount {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
                ... on DiscountAutomaticBasic {
                  title
                  status
                  customerGets {
                    value {
                      ... on DiscountPercentage {
                        percentage
                      }
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
      .filter((d) => d.status === "ACTIVE");

  } catch (err) {
    return [];
  }
}

// =====================================
// GET PRODUCT INVENTORY FROM SHOPIFY
// =====================================

async function getProductInventory(handle) {
  try {
    const data = await shopifyQuery(`
      {
        productByHandle(handle: "${handle}") {
          title
          variants(first: 20) {
            edges {
              node {
                title
                availableForSale
                price
              }
            }
          }
        }
      }
    `);

    return data?.data?.productByHandle || null;

  } catch (err) {
    return null;
  }
}

// =====================================
// NORMALIZE TEXT
// =====================================

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
    .replaceAll("متاح", "available").replaceAll("موجود", "available");
}

// =====================================
// DETECT LANGUAGE
// =====================================

function detectLanguage(message) {
  return /[\u0600-\u06FF]/.test(message) ? "arabic" : "english";
}

// =====================================
// SHOULD SEARCH PRODUCTS
// =====================================

function shouldSearchProducts(message) {

  const msg = normalizeText(message);

  const keywords = [
    // JEWELRY TYPES
    "ring", "necklace", "bracelet", "earring", "pendant",
    "bangle", "choker", "anklet", "chain",
    // NAME / INITIAL
    "name", "initial", "letter", "custom", "personalized",
    // MATERIALS
    "diamond", "gold", "silver", "platinum", "rose gold",
    "moissanite", "pearl", "gemstone",
    // COLLECTIONS
    "moissanite", "lab grown", "lab diamond", "make for you",
    "wedding", "engagement", "pearl", "men", "kids",
    "oval", "pear", "round", "emerald", "princess", "radiant",
    "marquise", "cushion", "asscher", "heart shape",
    // OCCASIONS
    "gift", "luxury", "bridal", "anniversary", "birthday", "valentine",
    // INTENT
    "show", "recommend", "suggest", "find", "looking", "want", "buy",
    // ARABIC
    "هديه", "هدية", "ذكري", "عيد", "جميل", "انيق", "فاخر",
    "دبله", "مجوهرات", "جواهر", "رجالي",
  ];

  return keywords.some((w) => msg.includes(normalizeText(w)));

}

// =====================================
// SHOULD SHOW NEXT PRODUCT
// =====================================

function shouldShowNext(message) {
  const msg = message.toLowerCase();
  const keywords = [
    "next", "another", "more", "different", "other", "else",
    "تاني", "غيره", "غيرها", "واحد تاني", "ورني تاني",
    "قطعه اخره", "قطعة اخرى", "قطعه اخري", "قطعة أخرى",
    "اخري", "اخره", "اخرى", "مش عاجبني", "غير",
    "كمان", "وغيره", "شوف تاني", "ورني غيره", "ورني غيرها",
    "شيء آخر", "حاجة تانية", "حاجه تانيه",
  ];
  return keywords.some((w) => msg.includes(w));
}

// =====================================
// SHOULD ASK ABOUT DISCOUNT
// =====================================

function shouldAskDiscount(message) {
  const msg = normalizeText(message);
  return (
    msg.includes("discount") ||
    msg.includes("sale") ||
    msg.includes("offer") ||
    msg.includes("promo") ||
    msg.includes("code")
  );
}

// =====================================
// SHOULD ASK ABOUT AVAILABILITY
// =====================================

function shouldAskAvailability(message) {
  const msg = normalizeText(message);
  return (
    msg.includes("available") ||
    msg.includes("in stock") ||
    msg.includes("متاح") ||
    msg.includes("موجود")
  );
}

// =====================================
// ROUGH FILTER - TOP 30
// =====================================

function roughFilter(userMessage, products) {

  const msg = normalizeText(userMessage);
  const words = msg.split(" ");

  let scoredProducts = products.map((p) => {

    const collectionText = (p.aiFeatures?.collections || []).join(" ").toLowerCase();

    const text = normalizeText(`
      ${p.title || ""}
      ${p.description || ""}
      ${p.type || ""}
      ${p.tags?.join(" ") || ""}
      ${p.aiFeatures?.category || ""}
      ${p.aiFeatures?.collection || ""}
      ${p.aiFeatures?.productType || ""}
      ${p.aiFeatures?.styles?.join(" ") || ""}
      ${p.aiFeatures?.intent?.join(" ") || ""}
      ${p.aiFeatures?.searchKeywords?.join(" ") || ""}
      ${p.aiFeatures?.emotionalTriggers?.join(" ") || ""}
      ${p.aiFeatures?.materials?.join(" ") || ""}
      ${p.aiFeatures?.variantMetalColors?.join(" ") || ""}
      ${p.aiFeatures?.diamondShapes?.join(" ") || ""}
      ${collectionText}
    `);

    let score = 0;

    words.forEach((word) => {
      if (word.length > 2 && text.includes(word)) score += 10;
    });

    // CATEGORY BOOSTS
    if (msg.includes("ring") && text.includes("ring")) score += 80;
    if (msg.includes("necklace") && text.includes("necklace")) score += 80;
    if (msg.includes("bracelet") && text.includes("bracelet")) score += 80;
    if (msg.includes("earring") && text.includes("earring")) score += 80;
    if (msg.includes("pendant") && text.includes("pendant")) score += 80;
    if (msg.includes("chain") && text.includes("chain")) score += 80;

    // NAME / INITIAL
    if (msg.includes("name") && text.includes("name")) score += 120;
    if (msg.includes("initial") && text.includes("initial")) score += 120;

    // METAL BOOSTS
    if (msg.includes("rose gold") && text.includes("rose gold")) score += 150;
    if (msg.includes("yellow gold") && text.includes("yellow gold")) score += 150;
    if (msg.includes("white gold") && text.includes("white gold")) score += 150;
    if (msg.includes("platinum") && text.includes("platinum")) score += 180;

    // STONE BOOSTS
    if (msg.includes("moissanite") && text.includes("moissanite")) score += 200;
    if (msg.includes("diamond") && text.includes("diamond")) score += 150;
    if (msg.includes("pearl") && text.includes("pearl")) score += 150;

    // SHAPE BOOSTS
    const shapes = ["oval", "pear", "round", "emerald", "princess", "radiant", "marquise", "cushion", "heart", "asscher"];
    shapes.forEach((shape) => {
      if (msg.includes(shape) && text.includes(shape)) score += 120;
    });

    // OCCASION BOOSTS
    if (msg.includes("wedding") && text.includes("wedding")) score += 150;
    if (msg.includes("engagement") && text.includes("engagement")) score += 150;
    if (msg.includes("men") && text.includes("men")) score += 100;
    if (msg.includes("kids") && text.includes("kids")) score += 100;

    // CATEGORY PENALTIES
    if (msg.includes("ring") && !text.includes("ring")) score -= 150;
    if (msg.includes("necklace") && !text.includes("necklace")) score -= 150;
    if (msg.includes("bracelet") && !text.includes("bracelet")) score -= 150;
    if (msg.includes("earring") && !text.includes("earring")) score -= 150;

    return { ...p, score };

  });

  return scoredProducts
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

}

// =====================================
// AI SELECTS BEST 6 PRODUCTS
// =====================================

async function aiSelectProducts(userMessage, candidates) {

  try {

    const candidateList = candidates.map((p, i) => ({
      index: i,
      id: p.handle,
      title: p.title,
      category: p.aiFeatures?.category || "",
      collections: p.aiFeatures?.collections || [],
      productType: p.aiFeatures?.productType || "",
      metal: p.aiFeatures?.variantMetalColors?.join(", ") || "",
      shapes: p.aiFeatures?.diamondShapes?.join(", ") || "",
      styles: p.aiFeatures?.styles?.join(", ") || "",
      intent: p.aiFeatures?.intent?.join(", ") || "",
      searchKeywords: p.aiFeatures?.searchKeywords?.join(", ") || "",
      price: p.variants?.[0]?.price || p.price || "",
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a luxury jewelry product selector.
Choose the 6 most relevant products from the list.
Rules:
- Match product type EXACTLY
- Match collection keywords (e.g. "name pendant" → name/initial collections)
- Match metal if mentioned
- Match shape if mentioned (oval, pear, round, etc.)
- Pick DIFFERENT products
- Return ONLY a JSON array of 6 index numbers like: [2, 7, 15, 23, 5, 11]
          `,
        },
        {
          role: "user",
          content: `Customer: "${userMessage}"\n\nProducts:\n${JSON.stringify(candidateList, null, 2)}\n\nReturn 6 best index numbers as JSON array.`,
        },
      ],
    });

    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    const indices = JSON.parse(raw);

    return indices
      .filter((i) => i >= 0 && i < candidates.length)
      .slice(0, 6)
      .map((i) => candidates[i]);

  } catch (err) {
    console.log("AI SELECTION FAILED:", err.message);
    return candidates.slice(0, 6);
  }

}

// =====================================
// BUILD PRODUCT DETAILS FOR AI
// =====================================

function buildProductDetails(p) {

  const rawPrices = (p.variants || [])
    .map((v) => v.rawPrice)
    .filter(Boolean)
    .sort((a, b) => a - b);

  return {
    title: p.title,
    category: p.aiFeatures?.category || "",
    collections: p.aiFeatures?.collections || [],
    metals: p.aiFeatures?.variantMetalColors || [],
    shapes: p.aiFeatures?.diamondShapes || [],
    stoneSizes: p.aiFeatures?.variantStoneSizes || [],
    stoneColors: p.aiFeatures?.variantStoneColors || [],
    certifications: p.aiFeatures?.certifications || [],
    startingPrice: rawPrices.length > 0 ? `${rawPrices[0]} AED` : p.price || "",
    styles: p.aiFeatures?.styles || [],
    emotionalTriggers: p.aiFeatures?.emotionalTriggers || [],
    description: (p.description || "").slice(0, 200),
  };

}

// =====================================
// BUILD PRODUCT FOR FRONTEND
// =====================================

function buildProductForFrontend(p) {

  const resolvedImage = p.image || "";

  return {
    id: p.id || "",
    title: p.title || "",
    handle: p.handle || "",
    description: p.description || "",
    type: p.type || "",
    vendor: p.vendor || "",
    image: resolvedImage,
    images: p.images || [],
    url: p.url || `https://alymwndw.com/products/${p.handle}`,
    reviewRating: p.reviewRating ?? 4.9,
    reviewCount: p.reviewCount ?? 120,
    category: p.aiFeatures?.category || "",
    collection: p.aiFeatures?.collection || "",
    styles: p.aiFeatures?.styles || [],
    emotionalTriggers: p.aiFeatures?.emotionalTriggers || [],
    price: p.variants?.[0]?.price || p.price || "",
    rawPrice: p.variants?.[0]?.rawPrice || p.rawPrice || 0,
    currency: p.currency || "AED",
    variants: p.variants?.slice(0, 20)?.map((v) => {
      const variantImage = v.mappedImage || v.image || resolvedImage || "";
      return {
        id: v.id || "",
        title: v.title || "",
        sku: v.sku || "",
        available: v.available ?? true,
        price: v.price || "",
        rawPrice: v.rawPrice || 0,
        currency: v.currency || "AED",
        image: variantImage,
        mappedImage: variantImage,
        metal: v.metal || "",
        stoneColor: v.stoneColor || "",
        shape: v.shape || "",
        stoneSize: v.stoneSize || "",
        options: v.options || [],
      };
    }) || [],
  };

}

// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {
  res.send("ALYMWNDW AI RUNNING");
});

// =====================================
// GENERATE IMAGE API
// =====================================

app.post("/generate-image", async (req, res) => {

  try {

    const sessionId = req.body.sessionId || "";
    const productTitle = req.body.productTitle || "";
    const productDescription = req.body.productDescription || "";
    const email = req.body.email || "";

    if (!sessionImageCount[sessionId]) sessionImageCount[sessionId] = 0;

    const count = sessionImageCount[sessionId];

    if (count >= 2 && !sessionEmails[sessionId]) {
      return res.json({ requireEmail: true });
    }

    if (email) sessionEmails[sessionId] = email;

    if (count >= 3) {
      return res.json({ blocked: true });
    }

    const prompt = `Luxury jewelry product photo. ${productTitle}. ${productDescription.slice(0, 100)}. White background. Professional studio lighting. Ultra detailed. 8K quality.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    sessionImageCount[sessionId]++;

    res.json({
      imageUrl: response.data[0].url,
      count: sessionImageCount[sessionId],
      remaining: Math.max(0, 3 - sessionImageCount[sessionId]),
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Image generation failed." });
  }

});

// =====================================
// CHAT API
// =====================================

app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message || "";
    const sessionId = req.body.sessionId || crypto.randomUUID();
    const normalizedMessage = normalizeText(userMessage);
    const language = detectLanguage(userMessage);

    // INIT
    if (!conversations[sessionId]) conversations[sessionId] = [];
    if (!sessionProducts[sessionId]) sessionProducts[sessionId] = { queue: [], lastSearch: "" };
    sessionTimestamps[sessionId] = Date.now();

    const isGreeting = userMessage === "__greeting__";

    if (!isGreeting) {
      conversations[sessionId].push({ role: "user", content: userMessage });
    }

    if (conversations[sessionId].length > 20) {
      conversations[sessionId] = conversations[sessionId].slice(-10);
    }

    if (conversations[sessionId].length > 10) {
      const summaryCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "Summarize this luxury jewelry customer profile. Keep: style, taste, materials, budget. Be concise." },
          { role: "user", content: JSON.stringify(conversations[sessionId]) },
        ],
      });
      summaries[sessionId] = summaryCompletion.choices[0].message.content;
    }

    // =====================================
    // SHOPIFY REAL-TIME DATA
    // =====================================

    let discountContext = "";
    let inventoryContext = "";

    if (shouldAskDiscount(userMessage)) {
      const discounts = await getActiveDiscounts();
      if (discounts.length > 0) {
        discountContext = `
ACTIVE DISCOUNTS FROM SHOPIFY:
${JSON.stringify(discounts, null, 2)}
        `;
      } else {
        discountContext = "No active discounts right now.";
      }
    }

    // =====================================
    // PRODUCT LOGIC
    // =====================================

    let currentProduct = null;
    const isNextRequest = shouldShowNext(userMessage);
    const isNewSearch = !isGreeting && shouldSearchProducts(normalizedMessage) && !isNextRequest;

    if (isNextRequest && sessionProducts[sessionId].queue.length > 0) {

      currentProduct = sessionProducts[sessionId].queue.shift();

    } else if (isNewSearch) {

      const candidates = roughFilter(normalizedMessage, products);

      if (candidates.length > 0) {
        const selected = await aiSelectProducts(userMessage, candidates);
        sessionProducts[sessionId].queue = selected;
        sessionProducts[sessionId].lastSearch = userMessage;
        currentProduct = sessionProducts[sessionId].queue.shift();
      }

    }

    const hasMore = sessionProducts[sessionId].queue.length > 0;
    const aiProductForFrontend = currentProduct ? buildProductForFrontend(currentProduct) : null;
    const aiProductDetails = currentProduct ? buildProductDetails(currentProduct) : null;

    // =====================================
    // AI CHAT
    // =====================================

    const languageInstruction = language === "arabic"
      ? "CRITICAL: Respond ENTIRELY in Arabic only. No English words at all."
      : "CRITICAL: Respond ENTIRELY in English only. No Arabic words at all.";

    const completion = await openai.chat.completions.create({

      model: "gpt-4.1-mini",
      temperature: 0.4,

      messages: [

        {
          role: "system",
          content: `
You are Alymwndw AI — an elite luxury jewelry sales concierge for Alymwndw Jewellery UAE.

YOUR PERSONALITY:
- Warm, elegant, passionate about jewelry
- Make customers FALL IN LOVE with every piece
- Speak like a high-end boutique expert
- Concise but impactful responses

${languageInstruction}

STRICT RULES:
- NEVER invent products, metals, stones, or prices
- NEVER mention any price unless it comes EXACTLY from CURRENT PRODUCT startingPrice
- NEVER mix Arabic and English in the same response
- NEVER use markdown formatting like **bold** or *italic*
- If no product shown, guide customer with questions only

${isGreeting ? `
This is the opening greeting.
Welcome the customer warmly to Alymwndw Jewellery.
Ask what they are looking for — jewelry type, occasion, or preference.
Keep it short, warm, and luxurious.
Do NOT mention any product or price.
` : ""}

${!aiProductDetails && !isGreeting ? `
No product available right now.
Do NOT invent any product, metal, price, or detail.
Engage warmly and ask about preferences.
` : ""}

${aiProductDetails ? `
YOUR JOB:
1. Open with an emotional luxurious hook about this specific piece
2. Describe the available metals and why each is special
3. Mention stones/shapes/sizes if available
4. Give the price EXACTLY as: "${aiProductDetails.startingPrice}" — never change it
5. End with ONE engaging question

${hasMore ? `End with: "هل تريد أن أريك قطعة أخرى مميزة؟" (Arabic) or "Would you like to see another stunning piece?" (English)` : ""}

CURRENT PRODUCT:
${JSON.stringify(aiProductDetails, null, 2)}
` : ""}

${discountContext ? `
DISCOUNT INFO:
${discountContext}
` : ""}

Customer Memory:
${summaries[sessionId] || "New customer."}
          `,
        },

        ...(isGreeting ? [{ role: "user", content: "greeting" }] : conversations[sessionId].slice(-6)),

      ],

    });

    const aiReply = completion.choices[0].message.content;

    if (!isGreeting) {
      conversations[sessionId].push({ role: "assistant", content: aiReply });
    }

    res.json({
      reply: aiReply,
      products: aiProductForFrontend ? [aiProductForFrontend] : [],
      hasMore,
      sessionId,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ reply: "Server error", products: [] });
  }

});

// =====================================
// START SERVER
// =====================================

app.listen(PORT, () => {
  console.log(`ALYMWNDW AI RUNNING ON PORT ${PORT}`);
});
