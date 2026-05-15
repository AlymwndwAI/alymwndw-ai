import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

// =========================
// OPENAI
// =========================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =========================
// LOAD PRODUCT BRAIN
// =========================

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

// =========================
// AI SEARCH
// =========================

function searchProducts(intent, products) {

  const searchTerms = [

    ...(intent.searchTerms || []),

    intent.productType,
    intent.category,
    intent.stone,
    intent.metal,
    intent.style,

  ]
    .filter(Boolean)
    .map((t) =>
      String(t).toLowerCase()
    );

  const scoredProducts =
    products.map((p) => {

      const ai =
        p.aiFeatures || {};

      const searchable = `
        ${p.title || ""}
        ${p.description || ""}
        ${p.type || ""}
        ${p.tags?.join(" ") || ""}
        ${JSON.stringify(ai)}
      `.toLowerCase();

      let score = 0;

      searchTerms.forEach((term) => {

        if (!term) return;

        // TITLE MATCH
        if (
          p.title
            ?.toLowerCase()
            .includes(term)
        ) {

          score += 15;

        }

        // TYPE MATCH
        if (
          p.type
            ?.toLowerCase()
            .includes(term)
        ) {

          score += 10;

        }

        // AI FEATURES
        if (
          searchable.includes(term)
        ) {

          score += 5;

        }

      });

      // PERSONALIZATION BOOST
      if (
        intent.personalization &&
        searchable.includes(
          "personalized"
        )
      ) {

        score += 20;

      }

      // ROMANTIC BOOST
      if (
        intent.romantic
      ) {

        score += 3;

      }

      // GIFT BOOST
      if (
        intent.gifting
      ) {

        score += 3;

      }

      return {
        ...p,
        score,
      };

    });

  return scoredProducts
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

}

// =========================
// HOME
// =========================

app.get("/", (req, res) => {

  res.send(
    "ALYMWNDW AI RUNNING"
  );

});

// =========================
// CHAT API
// =========================

app.post("/chat", async (req, res) => {

  try {

    const userMessage =
      req.body.message || "";

    // =========================
    // AI INTENT ANALYZER
    // =========================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        temperature: 0.2,

        response_format: {
          type: "json_object",
        },

        messages: [

          {
            role: "system",

            content: `

You are Alymwndw AI intent analyzer.

Understand customer intent deeply.

Classify message into:

- greeting
- shopping
- recommendation
- question
- customization
- luxury advice

Detect:
- language
- mood
- jewelry category
- product type
- style
- metal
- stone
- personalization
- luxury level
- romantic intent
- gifting intent

Return ONLY JSON.

Example:

{
  "intentType": "shopping",
  "language": "arabic",
  "category": "moissanite",
  "productType": "ring",
  "style": "luxury",
  "stone": "moissanite",
  "metal": "gold",
  "personalization": false,
  "romantic": true,
  "gifting": true,
  "searchTerms": [
    "moissanite ring",
    "gold",
    "luxury"
  ]
}

`,
          },

          {
            role: "user",
            content: userMessage,
          },

        ],

      });

    const intent = JSON.parse(
      completion.choices[0]
        .message.content
    );

    console.log(
      "AI INTENT:",
      intent
    );

    // =========================
    // GREETING MODE
    // =========================

    if (
      intent.intentType ===
      "greeting"
    ) {

      const greetingReply =
        intent.language ===
        "arabic"

          ? "أهلاً بك في Alymwndw ✨ كيف أستطيع مساعدتك في اختيار قطعة فاخرة اليوم؟"

          : "Welcome to Alymwndw ✨ How may I help you discover the perfect luxury piece today?";

      return res.json({

        reply:
          greetingReply,

        products: [],

      });

    }

    // =========================
    // SEARCH PRODUCTS
    // =========================

    const matchedProducts =
      searchProducts(
        intent,
        products
      );

    // =========================
    // NO PRODUCTS
    // =========================

    if (
      matchedProducts.length === 0
    ) {

      return res.json({

        reply:

          intent.language ===
          "arabic"

            ? "لم أجد قطعة مطابقة حالياً ✨"

            : "No matching luxury jewellery found ✨",

        products: [],

      });

    }

    // =========================
    // CLEAN PRODUCTS
    // =========================

    const cleanProducts =
      matchedProducts.map((p) => ({

        title:
          p.title,

        type:
          p.type,

        description:
          p.description,

        image:
          p.image,

        aiFeatures:
          p.aiFeatures,

        // PRICE
        price:

          p.variants?.[0]?.price ||

          p.price ||

          "N/A",

        // VARIANTS
        variants:

          p.variants?.slice(0, 10).map((v) => ({

            title:
              v.title,

            price:
              v.price,

            available:
              v.available,

            image:
              v.image,

            options:
              v.options,

          })),

      }));

    // =========================
    // AI SALES RESPONSE
    // =========================

    const salesCompletion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        temperature: 0.7,

        messages: [

          {
            role: "system",

            content: `

You are Alymwndw AI,
a luxury jewelry sales assistant.

IMPORTANT RULES:

- Speak SAME language as customer.
- Arabic customer = Arabic only.
- English customer = English only.
- Sound luxurious and elegant.
- Sound like premium jewelry consultant.
- NEVER invent products.
- ONLY recommend from AVAILABLE PRODUCTS.
- Mention prices naturally.
- Focus on emotional luxury selling.
- Recommend best matching pieces.
- Mention personalization when relevant.
- Keep response concise.

AVAILABLE PRODUCTS:

${JSON.stringify(cleanProducts)}

`,
          },

          {
            role: "user",
            content: userMessage,
          },

        ],

      });

    const aiReply =
      salesCompletion.choices[0]
        .message.content;

    // =========================
    // RESPONSE
    // =========================

    res.json({

      reply: aiReply,

      products:
        matchedProducts,

      intent,

    });

  } catch (err) {

    console.log(err);

    res.status(500).json({

      reply:
        "Server error",

      products: [],

    });

  }

});

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {

  console.log(
    `ALYMWNDW AI RUNNING ON PORT ${PORT}`
  );

});
