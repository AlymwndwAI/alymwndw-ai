import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import crypto from "crypto";

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
// MEMORY
// =====================================

const conversations = {};
const summaries = {};
const sessionTimestamps = {};
const sessionProducts = {}; // products queue per session

// =====================================
// IMAGE GENERATION TRACKING
// =====================================

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

  const raw = fs.readFileSync(
    "./public/products-brain.json",
    "utf8"
  );

  products = JSON.parse(raw);

  console.log(
    `PRODUCT BRAIN LOADED: ${products.length}`
  );

} catch (err) {

  console.log(
    "NO PRODUCTS BRAIN FOUND"
  );

}

// =====================================
// NORMALIZE TEXT
// =====================================

function normalizeText(text = "") {

  return text

    .toLowerCase()

    .replaceAll("أ", "ا")
    .replaceAll("إ", "ا")
    .replaceAll("آ", "ا")
    .replaceAll("ة", "ه")
    .replaceAll("ى", "ي")

    .replaceAll("خاتم خطوبه", "engagement ring")
    .replaceAll("خاتم خطوبة", "engagement ring")
    .replaceAll("سلسله اسم", "name necklace")
    .replaceAll("سلسلة اسم", "name necklace")
    .replaceAll("سلسله حرف", "initial necklace")
    .replaceAll("سلسلة حرف", "initial necklace")
    .replaceAll("روز جولد", "rose gold")
    .replaceAll("خاتم", "ring")
    .replaceAll("دبله", "ring")
    .replaceAll("محبس", "ring")
    .replaceAll("عقد", "necklace")
    .replaceAll("سلسله", "necklace")
    .replaceAll("سلسلة", "necklace")
    .replaceAll("اسوره", "bracelet")
    .replaceAll("أسوارة", "bracelet")
    .replaceAll("حلق", "earring")
    .replaceAll("حلقان", "earring")
    .replaceAll("ذهب", "gold")
    .replaceAll("فضه", "silver")
    .replaceAll("فضة", "silver")
    .replaceAll("بلاتين", "platinum")
    .replaceAll("الماس", "diamond")
    .replaceAll("موزانيت", "moissanite")
    .replaceAll("مويسانيت", "moissanite")
    .replaceAll("موزنايت", "moissanite")
    .replaceAll("روز", "rose gold")
    .replaceAll("اصفر", "yellow gold")
    .replaceAll("ابيض", "white gold")
    .replaceAll("هديه", "gift jewelry")
    .replaceAll("هدية", "gift jewelry");

}

// =====================================
// SHOULD SEARCH PRODUCTS
// =====================================

function shouldSearchProducts(message) {

  const msg = normalizeText(message);

  const keywords = [
    "ring", "necklace", "bracelet", "earring",
    "diamond", "gold", "silver", "platinum",
    "rose gold", "moissanite", "pearl",
    "gift", "luxury", "bridal", "wedding", "engagement",
    "show", "recommend", "suggest", "products",
    "romantic", "elegant", "minimal", "classic",
    "anniversary", "birthday", "love",
    "هديه", "ذكري", "عيد", "جميل", "انيق", "فاخر",
  ];

  return keywords.some((w) =>
    msg.includes(normalizeText(w))
  );

}

// =====================================
// SHOULD SHOW NEXT PRODUCT
// =====================================

function shouldShowNext(message) {

  const msg = normalizeText(message).toLowerCase();

  const keywords = [
    "next", "another", "more", "different",
    "show me more", "other", "else",
    "تاني", "غيره", "واحد تاني", "ورني تاني",
    "مش عاجبني", "مش عارفني", "غير",
    "كمان", "وغيره", "شوف تاني",
  ];

  return keywords.some((w) => msg.includes(w));

}

// =====================================
// ROUGH FILTER - TOP 30
// =====================================

function roughFilter(userMessage, products) {

  const msg = normalizeText(userMessage);
  const words = msg.split(" ");

  let scoredProducts = products.map((p) => {

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
    `);

    let score = 0;

    words.forEach((word) => {
      if (word.length > 2 && text.includes(word)) score += 10;
    });

    if (msg.includes("ring") && text.includes("ring")) score += 80;
    if (msg.includes("necklace") && text.includes("necklace")) score += 80;
    if (msg.includes("bracelet") && text.includes("bracelet")) score += 80;
    if (msg.includes("earring") && text.includes("earring")) score += 80;
    if (msg.includes("rose gold") && text.includes("rose gold")) score += 150;
    if (msg.includes("yellow gold") && text.includes("yellow gold")) score += 150;
    if (msg.includes("white gold") && text.includes("white gold")) score += 150;
    if (msg.includes("platinum") && text.includes("platinum")) score += 150;
    if (msg.includes("moissanite") && text.includes("moissanite")) score += 200;
    if (msg.includes("diamond") && text.includes("diamond")) score += 150;
    if (msg.includes("pearl") && text.includes("pearl")) score += 150;
    if (msg.includes("wedding") && text.includes("wedding")) score += 120;
    if (msg.includes("engagement") && text.includes("engagement")) score += 120;

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
// AI SELECTS BEST PRODUCTS
// =====================================

async function aiSelectProducts(userMessage, candidates) {

  try {

    const candidateList = candidates.map((p, i) => ({
      index: i,
      id: p.handle,
      title: p.title,
      category: p.aiFeatures?.category || "",
      collection: p.aiFeatures?.collection || "",
      metal: p.aiFeatures?.variantMetalColors?.join(", ") || "",
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
Choose the 6 most relevant products from the list.
Rules:
- Match category EXACTLY
- Match metal if mentioned
- Match style and occasion if mentioned
- Pick DIFFERENT products (no duplicates)
- Return ONLY a JSON array of 6 index numbers like: [2, 7, 15, 23, 5, 11]
- No extra text
          `,
        },
        {
          role: "user",
          content: `Customer: "${userMessage}"\n\nProducts:\n${JSON.stringify(candidateList, null, 2)}\n\nReturn 6 best index numbers as JSON array.`,
        },
      ],

    });

    const raw = completion.choices[0].message.content
      .replace(/```json|```/g, "").trim();

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

  const metals = p.aiFeatures?.variantMetalColors || [];
  const shapes = p.aiFeatures?.diamondShapes || [];
  const sizes = p.aiFeatures?.variantStoneSizes || [];
  const stones = p.aiFeatures?.variantStoneColors || [];
  const certifications = p.aiFeatures?.certifications || [];

  const priceList = [...new Set(
    (p.variants || []).map((v) => v.price).filter(Boolean)
  )];

  return {
    title: p.title,
    category: p.aiFeatures?.category || "",
    collection: p.aiFeatures?.collection || "",
    metals,
    shapes,
    stoneSizes: sizes,
    stoneColors: stones,
    certifications,
    priceRange: priceList.length > 1
      ? `${priceList[0]} - ${priceList[priceList.length - 1]}`
      : priceList[0] || p.price || "",
    styles: p.aiFeatures?.styles || [],
    emotionalTriggers: p.aiFeatures?.emotionalTriggers || [],
    description: (p.description || "").slice(0, 200),
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

    if (!sessionImageCount[sessionId]) {
      sessionImageCount[sessionId] = 0;
    }

    const count = sessionImageCount[sessionId];

    if (count >= 2 && !sessionEmails[sessionId]) {
      return res.json({
        requireEmail: true,
        message: "Please enter your email to continue.",
      });
    }

    if (email) sessionEmails[sessionId] = email;

    if (count >= 3) {
      return res.json({
        blocked: true,
        message: "Maximum image generations reached.",
      });
    }

    const prompt = `
      Luxury jewelry product photo.
      ${productTitle}.
      ${productDescription.slice(0, 100)}.
      High-end jewelry photography.
      White background.
      Professional studio lighting.
      Ultra detailed. 8K quality.
    `;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data[0].url;
    sessionImageCount[sessionId]++;

    res.json({
      imageUrl,
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

    // INIT
    if (!conversations[sessionId]) conversations[sessionId] = [];
    if (!sessionProducts[sessionId]) sessionProducts[sessionId] = [];
    sessionTimestamps[sessionId] = Date.now();

    // SAVE USER MESSAGE
    conversations[sessionId].push({
      role: "user",
      content: userMessage,
    });

    // CLEAN MEMORY
    if (conversations[sessionId].length > 20) {
      conversations[sessionId] = conversations[sessionId].slice(-10);
    }

    // MEMORY SUMMARY
    if (conversations[sessionId].length > 10) {

      const summaryCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `Summarize this luxury jewelry customer profile. Keep: style, taste, materials, budget. Be concise.`,
          },
          {
            role: "user",
            content: JSON.stringify(conversations[sessionId]),
          },
        ],
      });

      summaries[sessionId] = summaryCompletion.choices[0].message.content;

    }

    // =====================================
    // PRODUCT LOGIC
    // =====================================

    let currentProduct = null;
    let isNewSearch = false;

    if (shouldShowNext(normalizedMessage) && sessionProducts[sessionId].length > 0) {

      // POP NEXT PRODUCT FROM QUEUE
      currentProduct = sessionProducts[sessionId].shift();

    } else if (shouldSearchProducts(normalizedMessage)) {

      // NEW SEARCH
      isNewSearch = true;

      const candidates = roughFilter(normalizedMessage, products);

      if (candidates.length > 0) {

        const selected = await aiSelectProducts(userMessage, candidates);

        sessionProducts[sessionId] = selected;
        currentProduct = sessionProducts[sessionId].shift();

      }

    }

    // =====================================
    // BUILD PRODUCT FOR FRONTEND
    // =====================================

    let aiProductForFrontend = null;
    let aiProductDetails = null;
    const hasMoreProducts = sessionProducts[sessionId].length > 0;

    if (currentProduct) {

      const resolvedImage = currentProduct.image || "";

      aiProductForFrontend = {
        id: currentProduct.id || "",
        title: currentProduct.title || "",
        handle: currentProduct.handle || "",
        description: currentProduct.description || "",
        type: currentProduct.type || "",
        vendor: currentProduct.vendor || "",
        image: resolvedImage,
        images: currentProduct.images || [],
        url: currentProduct.url || `https://alymwndw.com/products/${currentProduct.handle}`,
        reviewRating: currentProduct.reviewRating ?? 4.9,
        reviewCount: currentProduct.reviewCount ?? 120,
        category: currentProduct.aiFeatures?.category || "",
        collection: currentProduct.aiFeatures?.collection || "",
        styles: currentProduct.aiFeatures?.styles || [],
        emotionalTriggers: currentProduct.aiFeatures?.emotionalTriggers || [],
        price: currentProduct.variants?.[0]?.price || currentProduct.price || "",
        rawPrice: currentProduct.variants?.[0]?.rawPrice || currentProduct.rawPrice || 0,
        currency: currentProduct.currency || "AED",

        variants: currentProduct.variants?.slice(0, 20)?.map((v) => {
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

      aiProductDetails = buildProductDetails(currentProduct);

    }

    // =====================================
    // AI CHAT
    // =====================================

    const completion = await openai.chat.completions.create({

      model: "gpt-4.1-mini",
      temperature: 0.6,

      messages: [

        {
          role: "system",
          content: `

You are Alymwndw AI — an elite luxury jewelry sales concierge.

YOUR PERSONALITY:
- Warm, elegant, emotionally intelligent
- You SELL with passion — you make the customer FALL IN LOVE with the piece
- You speak like a luxury boutique expert, not a chatbot
- Keep responses concise but impactful

YOUR JOB WHEN SHOWING A PRODUCT:
1. Open with an emotional hook about the piece
2. Describe the metals available and why each one is special
3. Mention stones/shapes/sizes if available and make them sound desirable
4. Give the price naturally as "starting from X AED"
5. End with ONE question to engage the customer OR offer to show another piece

${hasMoreProducts ? 'Say at the end: "هل تريد أن أريك قطعة أخرى مميزة؟" or "Would you like to see another stunning piece?"' : ''}

RULES:
- NEVER invent products, prices, or details
- NEVER list products — describe ONE piece at a time with passion
- Respond in the same language as the customer
- Frontend shows the product card separately — don't repeat all details

Customer Memory:
${summaries[sessionId] || "New customer."}

${aiProductDetails ? `
CURRENT PRODUCT TO SELL:
${JSON.stringify(aiProductDetails, null, 2)}
` : ""}

`,
        },

        ...conversations[sessionId].slice(-6),

      ],

    });

    const aiReply = completion.choices[0].message.content;

    // SAVE AI RESPONSE
    conversations[sessionId].push({
      role: "assistant",
      content: aiReply,
    });

    // RESPONSE
    res.json({
      reply: aiReply,
      products: aiProductForFrontend ? [aiProductForFrontend] : [],
      hasMore: hasMoreProducts,
      sessionId,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      reply: "Server error",
      products: [],
    });
  }

});

// =====================================
// START SERVER
// =====================================

app.listen(PORT, () => {
  console.log(`ALYMWNDW AI RUNNING ON PORT ${PORT}`);
});
