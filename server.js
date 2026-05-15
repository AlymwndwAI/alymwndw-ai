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
// CLEAN OLD SESSIONS EVERY HOUR
// =====================================

setInterval(() => {

  const now = Date.now();

  Object.keys(sessionTimestamps).forEach((id) => {

    if (now - sessionTimestamps[id] > 3600000) {

      delete conversations[id];
      delete summaries[id];
      delete sessionTimestamps[id];

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

    "ring",
    "necklace",
    "bracelet",
    "earring",

    "diamond",
    "gold",
    "silver",
    "platinum",
    "rose gold",
    "moissanite",
    "pearl",

    "gift",
    "luxury",
    "bridal",
    "wedding",
    "engagement",

    "show",
    "recommend",
    "suggest",
    "products",

  ];

  return keywords.some((w) =>
    msg.includes(normalizeText(w))
  );

}

// =====================================
// SEARCH PRODUCTS
// =====================================

function searchProducts(userMessage, products) {

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
      ${p.aiFeatures?.materials?.join(" ") || ""}
      ${p.aiFeatures?.variantMetalColors?.join(" ") || ""}
      ${p.aiFeatures?.variantStoneColors?.join(" ") || ""}
      ${p.aiFeatures?.diamondShapes?.join(" ") || ""}

    `);

    let score = 0;

    // =====================================
    // WORD MATCH
    // =====================================

    words.forEach((word) => {
      if (word.length > 2 && text.includes(word)) {
        score += 10;
      }
    });

    // =====================================
    // CATEGORY BOOST
    // =====================================

    if (msg.includes("ring") && text.includes("ring")) {
      score += 80;
    }

    if (msg.includes("necklace") && text.includes("necklace")) {
      score += 80;
    }

    if (msg.includes("bracelet") && text.includes("bracelet")) {
      score += 80;
    }

    if (msg.includes("earring") && text.includes("earring")) {
      score += 80;
    }

    // =====================================
    // METAL BOOST
    // =====================================

    if (msg.includes("rose gold") && text.includes("rose gold")) {
      score += 200;
    }

    if (msg.includes("yellow gold") && text.includes("yellow gold")) {
      score += 200;
    }

    if (msg.includes("white gold") && text.includes("white gold")) {
      score += 200;
    }

    if (msg.includes("platinum") && text.includes("platinum")) {
      score += 220;
    }

    // =====================================
    // STONE BOOST
    // =====================================

    if (msg.includes("moissanite") && text.includes("moissanite")) {
      score += 250;
    }

    if (msg.includes("diamond") && text.includes("diamond")) {
      score += 200;
    }

    if (msg.includes("pearl") && text.includes("pearl")) {
      score += 200;
    }

    // =====================================
    // COLLECTION BOOST
    // =====================================

    if (msg.includes("wedding") && text.includes("wedding")) {
      score += 150;
    }

    if (msg.includes("engagement") && text.includes("engagement")) {
      score += 150;
    }

    return { ...p, score };

  });

  scoredProducts = scoredProducts
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return scoredProducts;

}

// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {
  res.send("ALYMWNDW AI RUNNING");
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

      matchedProducts = searchProducts(
        normalizedMessage,
        products
      );

    }

    // =====================================
    // AI PRODUCTS FOR PROMPT (LIGHT)
    // =====================================

    const aiProductsForPrompt =
      matchedProducts.map((p) => ({

        title:
          p.title,

        category:
          p.aiFeatures?.category || "",

        collection:
          p.aiFeatures?.collection || "",

        price:
          p.variants?.[0]?.price ||
          p.price ||
          "",

        variants:
          p.variants?.slice(0, 3)?.map((v) => ({
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

        const resolvedImage =
          p.image || "";

        return {

          id:
            p.id || "",

          title:
            p.title || "",

          handle:
            p.handle || "",

          description:
            p.description || "",

          type:
            p.type || "",

          vendor:
            p.vendor || "",

          image:
            resolvedImage,

          images:
            p.images || [],

          url:
            p.url ||
            `https://alymwndw.com/products/${p.handle}`,

          reviewRating:
            p.reviewRating ?? 4.9,

          reviewCount:
            p.reviewCount ?? 120,

          category:
            p.aiFeatures?.category || "",

          collection:
            p.aiFeatures?.collection || "",

          styles:
            p.aiFeatures?.styles || [],

          emotionalTriggers:
            p.aiFeatures?.emotionalTriggers || [],

          searchKeywords:
            p.aiFeatures?.searchKeywords || [],

          intent:
            p.aiFeatures?.intent || [],

          price:
            p.variants?.[0]?.price ||
            p.price ||
            "",

          rawPrice:
            p.variants?.[0]?.rawPrice ||
            p.rawPrice ||
            0,

          currency:
            p.currency || "AED",

          variants:
            p.variants?.slice(0, 20)?.map((v) => {

              const variantImage =
                v.mappedImage ||
                v.image ||
                resolvedImage ||
                "";

              return {

                id:
                  v.id || "",

                title:
                  v.title || "",

                sku:
                  v.sku || "",

                available:
                  v.available ?? true,

                price:
                  v.price || "",

                rawPrice:
                  v.rawPrice || 0,

                currency:
                  v.currency || "AED",

                image:
                  variantImage,

                mappedImage:
                  variantImage,

                metal:
                  v.metal || "",

                stoneColor:
                  v.stoneColor || "",

                shape:
                  v.shape || "",

                stoneSize:
                  v.stoneSize || "",

                options:
                  v.options || [],

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
- Frontend already shows products separately, so don't list them in detail.

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

      reply:
        aiReply,

      products:
        aiProductsForFrontend,

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
