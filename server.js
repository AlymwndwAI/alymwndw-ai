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
// AI INTENT ANALYZER
// =========================

async function analyzeIntent(message) {

  const completion =
    await openai.chat.completions.create({

      model: "gpt-4o-mini",

      temperature: 0,

      response_format: {
        type: "json_object",
      },

      messages: [

        {
          role: "system",

          content: `
You are Alymwndw AI intent analyzer.

Analyze customer message.

Extract:
- language
- productType
- category
- stone
- metal
- style
- occasion
- personalization
- luxuryLevel
- searchTerms

Return ONLY valid JSON.
`,
        },

        {
          role: "user",
          content: message,
        },

      ],

    });

  return JSON.parse(
    completion.choices[0]
      .message.content
  );
}

// =========================
// SMART SEARCH
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

          score += 12;

        }

        // GENERAL MATCH
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

      // LUXURY BOOST
      if (
        intent.style === "luxury"
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
    // ANALYZE USER INTENT
    // =========================

    const intent =
      await analyzeIntent(
        userMessage
      );

    console.log(
      "AI INTENT:",
      intent
    );

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

        aiFeatures:
          p.aiFeatures,

        variants:
          p.variants?.slice(0, 5),

      }));

    // =========================
    // AI SALES RESPONSE
    // =========================

    const completion =
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
- Be luxurious and elegant.
- Sound like premium jewelry consultant.
- NEVER invent products.
- ONLY recommend from AVAILABLE PRODUCTS.
- Focus on emotional luxury selling.
- Recommend best matching pieces.
- Mention personalization when relevant.
- Keep response short.

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
      completion.choices[0]
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
