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
// STEP 1: ROUGH FILTER - TOP 30
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
      if (word.length > 2 && text.includes(word)) {
        score += 10;
      }
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

    // =====================================
    // CATEGORY PENALTY
    // =====================================

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
// STEP 2: AI SELECTS BEST 4
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

The customer is looking for jewelry. Choose the 4 most relevant products from the list.

Rules:
- Match category EXACTLY (if customer wants ring, only pick rings)
- Match metal if mentioned
- Match style and occasion if mentioned
- Pick DIFFERENT products (no duplicates)
- Return ONLY a JSON array of 4 index numbers like: [2, 7, 15, 23]
- No extra text, just the JSON array
          `,
        },

        {
          role: "user",
          content: `
Customer request: "${userMessage}"

Available products:
${JSON.stringify(candidateList, null, 2)}

Return the 4 best index numbers as JSON array.
          `,
        },

      ],

    });

    const raw =
      completion.choices[0].message.content
        .replace(/```json|```/g, "")
        .trim();

    const indices = JSON.parse(raw);

    return indices
      .filter((i) => i >= 0 && i < candidates.length)
      .slice(0, 4)
      .map((i) => candidates[i]);

  } catch (err) {

    console.log("AI SELECTION FAILED:", err.message);

    // fallback: return top 4 from candidates
    return candidates.slice(0, 4);

  }

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

    if (email) {
      sessionEmails[sessionId] = email;
    }

    if (count >= 3) {

      return res.json({
        blocked: true,
        message: "Maximum image generations reached for this session.",
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

    res.status(500).json({
      error: "Image generation failed.",
    });

  }

});

// =====================================
// CHAT API
// =====================================

app.post("/chat", async (req, res) => {

  try {

    const userMessage =
      req.body.message || "";

    const sessionId =
      req.body.sessionId ||
      crypto.randomUUID();

    const normalizedMessage =
      normalizeText(userMessage);

    // =====================================
    // INIT MEMORY
    // =====================================

    if (!conversations[sessionId]) {
      conversations[sessionId] = [];
    }

    sessionTimestamps[sessionId] =
      Date.now();

    // =====================================
    // SAVE USER MESSAGE
    // =====================================

    conversations[sessionId].push({
      role: "user",
      content: userMessage,
    });

    // =====================================
    // CLEAN MEMORY
    // =====================================

    if (conversations[sessionId].length > 20) {
      conversations[sessionId] =
        conversations[sessionId].slice(-10);
    }

    // =====================================
    // MEMORY SUMMARY
    // =====================================

    if (conversations[sessionId].length > 10) {

      const summaryCompletion =
        await openai.chat.completions.create({

          model: "gpt-4.1-mini",

          temperature: 0.2,

          messages: [

            {
              role: "system",
              content: `
Summarize this luxury jewelry customer profile.
Keep: style preferences, jewelry taste, gifting needs, favorite materials, budget signals.
Be concise.
              `,
            },

            {
              role: "user",
              content: JSON.stringify(
                conversations[sessionId]
              ),
            },

          ],

        });

      summaries[sessionId] =
        summaryCompletion.choices[0].message.content;

    }

    // =====================================
    // PRODUCT SEARCH
    // =====================================

    let matchedProducts = [];

    if (shouldSearchProducts(normalizedMessage)) {

      // STEP 1: rough filter top 30
      const candidates =
        roughFilter(normalizedMessage, products);

      // STEP 2: AI picks best 4
      if (candidates.length > 0) {
        matchedProducts =
          await aiSelectProducts(userMessage, candidates);
      }

    }

    // =====================================
    // AI PRODUCTS FOR PROMPT (LIGHT)
    // =====================================

    const aiProductsForPrompt =
      matchedProducts.map((p) => ({

        title: p.title,
        category: p.aiFeatures?.category || "",
        collection: p.aiFeatures?.collection || "",
        price: p.variants?.[0]?.price || p.price || "",

        variants: p.variants?.slice(0, 3)?.map((v) => ({
          title: v.title,
          price: v.price,
          available: v.available ?? true,
          metal: v.metal || "",
          shape: v.shape || "",
          stoneColor: v.stoneColor || "",
        })) || [],

      }));

    // =====================================
    // AI PRODUCTS FOR FRONTEND (FULL)
    // =====================================

    const aiProductsForFrontend =
      matchedProducts.map((p) => {

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
          searchKeywords: p.aiFeatures?.searchKeywords || [],
          intent: p.aiFeatures?.intent || [],
          price: p.variants?.[0]?.price || p.price || "",
          rawPrice: p.variants?.[0]?.rawPrice || p.rawPrice || 0,
          currency: p.currency || "AED",

          variants: p.variants?.slice(0, 20)?.map((v) => {

            const variantImage =
              v.mappedImage || v.image || resolvedImage || "";

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

      });

    // =====================================
    // AI CHAT
    // =====================================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.5,

        messages: [

          {
            role: "system",
            content: `

You are Alymwndw AI.

You are a luxury jewelry AI sales expert.

IMPORTANT:
- Sound human, premium, and elegant.
- Keep replies concise.
- Be emotionally intelligent.
- NEVER invent products, prices, or variants.
- Recommend products naturally.
- Focus on emotional luxury selling.
- Frontend already shows products separately.

Customer Memory:
${summaries[sessionId] || "No history yet."}

AVAILABLE PRODUCTS:
${JSON.stringify(aiProductsForPrompt)}

`,
          },

          ...conversations[sessionId].slice(-6),

        ],

      });

    const aiReply =
      completion.choices[0].message.content;

    // =====================================
    // SAVE AI RESPONSE
    // =====================================

    conversations[sessionId].push({
      role: "assistant",
      content: aiReply,
    });

    // =====================================
    // RESPONSE
    // =====================================

    res.json({
      reply: aiReply,
      products: aiProductsForFrontend,
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
  console.log(
    `ALYMWNDW AI RUNNING ON PORT ${PORT}`
  );
});
