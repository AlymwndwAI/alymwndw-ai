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
    return null;
  }
}

// =====================================
// GET ACTIVE DISCOUNTS
// =====================================

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
    .replaceAll("زوجين", "couple").replaceAll("زوجي", "couple")
    .replaceAll("هدية", "gift").replaceAll("هديه", "gift");
}

// =====================================
// DETECT LANGUAGE
// =====================================

function detectLanguage(message) {
  return /[\u0600-\u06FF]/.test(message) ? "arabic" : "english";
}

// =====================================
// EXTRACT INTENT VIA OPENAI
// =====================================

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

    const raw = completion.choices[0].message.content
      .replace(/```json|```/g, "").trim();

    return JSON.parse(raw);

  } catch (err) {
    return null;
  }
}

// =====================================
// SHOULD SEARCH PRODUCTS
// =====================================

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
    "كمان", "شوف تاني", "ورني غيره", "حاجة تانية",
  ];
  return keywords.some((w) => msg.includes(w));
}

// =====================================
// SHOULD ASK ABOUT DISCOUNT
// =====================================

function shouldAskDiscount(message) {
  const msg = normalizeText(message);
  return msg.includes("discount") || msg.includes("sale") ||
    msg.includes("offer") || msg.includes("promo") || msg.includes("code");
}

// =====================================
// ROUGH FILTER - TOP 30
// =====================================

function roughFilter(userMessage, intent, products) {

  const msg = normalizeText(userMessage);
  const words = msg.split(" ").filter((w) => w.length > 2);

  // Intent keywords
  const intentWords = [
    intent?.category,
    intent?.metal,
    intent?.stone,
    intent?.shape,
    intent?.occasion,
    intent?.style,
    ...(intent?.keywords || []),
  ].filter(Boolean).map((w) => normalizeText(w));

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
      ${p.aiFeatures?.materials?.join(" ") || ""}
      ${p.aiFeatures?.variantMetalColors?.join(" ") || ""}
      ${p.aiFeatures?.diamondShapes?.join(" ") || ""}
      ${collectionText}
    `);

    let score = 0;

    // Word matching
    words.forEach((word) => {
      if (text.includes(word)) score += 10;
    });

    // Intent matching - higher boost
    intentWords.forEach((word) => {
      if (word && text.includes(word)) score += 40;
    });

    // Category exact match
    if (intent?.category && text.includes(intent.category)) score += 100;

    // Metal exact match
    if (intent?.metal && text.includes(intent.metal)) score += 150;

    // Stone match
    if (intent?.stone && text.includes(intent.stone)) score += 200;

    // Shape match
    if (intent?.shape && text.includes(intent.shape)) score += 150;

    // Occasion match
    if (intent?.occasion && text.includes(intent.occasion)) score += 120;

    // Style match
    if (intent?.style && text.includes(intent.style)) score += 100;

    // Category penalties
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

  return scoredProducts
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

}

// =====================================
// AI SELECTS BEST 8 PRODUCTS
// =====================================

async function aiSelectProducts(userMessage, intent, candidates) {

  try {

    const candidateList = candidates.map((p, i) => ({
      index: i,
      title: p.title,
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
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a luxury jewelry product selector.
Choose the 8 most relevant AND DIVERSE products from the list.

Rules:
- Match product type EXACTLY (ring → rings only)
- Match collection/type keywords precisely
- Match metal if mentioned
- Match shape if mentioned
- Pick DIFFERENT products - no similar duplicates
- Ensure VARIETY in the selection
- Return ONLY a JSON array of 8 index numbers
- No extra text
          `,
        },
        {
          role: "user",
          content: `
Customer: "${userMessage}"
Intent: ${JSON.stringify(intent)}

Products:
${JSON.stringify(candidateList, null, 2)}

Return 8 diverse best index numbers as JSON array.
          `,
        },
      ],
    });

    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    const indices = JSON.parse(raw);

    return indices
      .filter((i) => i >= 0 && i < candidates.length)
      .slice(0, 8)
      .map((i) => candidates[i]);

  } catch (err) {
    console.log("AI SELECTION FAILED:", err.message);
    return candidates.slice(0, 8);
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
    collections: (p.aiFeatures?.collections || []).slice(0, 5),
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
    if (!sessionProducts[sessionId]) {
      sessionProducts[sessionId] = {
        queue: [],
        lastSearch: "",
        lastIntent: null,
      };
    }
    sessionTimestamps[sessionId] = Date.now();

    const isGreeting = userMessage === "__greeting__";

    if (!isGreeting) {
      conversations[sessionId].push({ role: "user", content: userMessage });
    }

    if (conversations[sessionId].length > 20) {
      conversations[sessionId] = conversations[sessionId].slice(-10);
    }

    // MEMORY SUMMARY
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
    // SHOPIFY REAL-TIME DISCOUNTS
    // =====================================

    let discountContext = "";

    if (shouldAskDiscount(userMessage)) {
      const discounts = await getActiveDiscounts();
      discountContext = discounts.length > 0
        ? `ACTIVE DISCOUNTS: ${JSON.stringify(discounts, null, 2)}`
        : "No active discounts right now.";
    }

    // =====================================
    // PRODUCT LOGIC
    // =====================================

    let currentProduct = null;
    const isNextRequest = shouldShowNext(userMessage);
    const isNewSearch = !isGreeting && shouldSearchProducts(normalizedMessage) && !isNextRequest;

    if (isNextRequest) {

      if (sessionProducts[sessionId].queue.length > 0) {

        // POP NEXT FROM QUEUE
        currentProduct = sessionProducts[sessionId].queue.shift();

      } else if (sessionProducts[sessionId].lastSearch) {

        // QUEUE EMPTY - RE-SEARCH WITH SAME INTENT
        const candidates = roughFilter(
          sessionProducts[sessionId].lastSearch,
          sessionProducts[sessionId].lastIntent,
          products
        );

        if (candidates.length > 0) {
          const selected = await aiSelectProducts(
            sessionProducts[sessionId].lastSearch,
            sessionProducts[sessionId].lastIntent,
            candidates
          );
          sessionProducts[sessionId].queue = selected;
          currentProduct = sessionProducts[sessionId].queue.shift();
        }

      }

    } else if (isNewSearch) {

      // EXTRACT INTENT FIRST
      const intent = await extractIntent(userMessage);
      sessionProducts[sessionId].lastIntent = intent;

      // ROUGH FILTER
      const candidates = roughFilter(normalizedMessage, intent, products);

      if (candidates.length > 0) {

        // AI SELECTS BEST 8
        const selected = await aiSelectProducts(userMessage, intent, candidates);

        sessionProducts[sessionId].queue = selected;
        sessionProducts[sessionId].lastSearch = normalizedMessage;
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
      ? "CRITICAL: Respond ENTIRELY in Arabic only. Zero English words."
      : "CRITICAL: Respond ENTIRELY in English only. Zero Arabic words.";

    const completion = await openai.chat.completions.create({

      model: "gpt-4.1-mini",
      temperature: 0.4,

      messages: [

        {
          role: "system",
          content: `
You are Alymwndw AI — elite luxury jewelry sales concierge for Alymwndw Jewellery UAE.

PERSONALITY:
- Warm, elegant, passionate
- Make customers fall in love with every piece
- Concise but impactful — max 4 sentences per response
- Sound like a luxury boutique expert, not a chatbot

${languageInstruction}

STRICT RULES:
- NEVER invent products, metals, stones, prices
- NEVER mention price unless from CURRENT PRODUCT startingPrice
- NEVER use markdown like **bold** or *italic*
- NEVER mix Arabic and English
- If customer asks about something off-topic, gently redirect to jewelry

${isGreeting ? `
GREETING MODE:
Welcome customer warmly to Alymwndw Jewellery.
Ask what they're looking for — type, occasion, or preference.
Short, warm, luxurious. No products or prices.
` : ""}

${!aiProductDetails && !isGreeting ? `
NO PRODUCT MODE:
No product available. Don't invent anything.
Ask customer questions to understand their preference better.
` : ""}

${aiProductDetails ? `
SELLING MODE — Current product to present:
${JSON.stringify(aiProductDetails, null, 2)}

YOUR TASK:
1. Emotional hook — why this piece is special
2. Describe metals available and their unique appeal
3. Mention stones/shapes/sizes naturally
4. Price EXACTLY: "${aiProductDetails.startingPrice}"
5. One engaging question

${hasMore ? `End: "هل تريد أن أريك قطعة أخرى؟" or "Want to see another piece?"` : ""}
` : ""}

${discountContext ? `DISCOUNT INFO: ${discountContext}` : ""}

Customer Memory: ${summaries[sessionId] || "New customer."}
          `,
        },

        ...(isGreeting
          ? [{ role: "user", content: "greeting" }]
          : conversations[sessionId].slice(-8)
        ),

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
