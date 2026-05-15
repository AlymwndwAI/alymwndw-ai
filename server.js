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
// LOAD PRODUCTS BRAIN
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
  console.log("NO PRODUCTS BRAIN FOUND");
}

// =========================
// SMART SEARCH
// =========================

function searchProducts(message, products) {
  const msg = message.toLowerCase();

  const keywords = msg
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 1);

  const scoredProducts = products.map((p) => {
    const searchable = `
      ${p.title || ""}
      ${p.description || ""}
      ${p.type || ""}
      ${p.product_type || ""}
      ${p.tags?.join(" ") || ""}
      ${p.materials?.join(" ") || ""}
      ${p.stones?.join(" ") || ""}
      ${p.colors?.join(" ") || ""}
    `.toLowerCase();

    let score = 0;

    keywords.forEach((word) => {
      // TYPE MATCH
      if (
        p.type &&
        p.type.toLowerCase().includes(word)
      ) {
        score += 10;
      }

      // TITLE MATCH
      if (
        p.title &&
        p.title.toLowerCase().includes(word)
      ) {
        score += 8;
      }

      // GENERAL MATCH
      if (searchable.includes(word)) {
        score += 3;
      }
    });

    return {
      ...p,
      score,
    };
  });

  return scoredProducts
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
}

// =========================
// HOME
// =========================

app.get("/", (req, res) => {
  res.send("ALYMWNDW AI RUNNING");
});

// =========================
// CHAT API
// =========================

app.post("/chat", async (req, res) => {
  try {
    const userMessage =
      req.body.message || "";

    // SEARCH PRODUCTS
    const matchedProducts =
      searchProducts(
        userMessage,
        products
      ).slice(0, 4);

    // NO PRODUCTS
    if (matchedProducts.length === 0) {
      return res.json({
        reply:
          "No matching luxury jewellery found ✨",
        products: [],
      });
    }

    // CLEAN PRODUCTS FOR AI
    const cleanProducts =
      matchedProducts.map((p) => ({
        title: p.title,
        type: p.type,
        materials: p.materials,
        stones: p.stones,
        colors: p.colors,
        price: p.price,
      }));

    // AI RESPONSE
    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",

        temperature: 0,

        messages: [
          {
            role: "system",
            content: `
You are Alymwndw Jewellery AI.

RULES:
- Speak same language as customer.
- Keep replies short.
- Sound luxurious and elegant.
- NEVER invent products.
- ONLY recommend products from AVAILABLE PRODUCTS.
- Maximum 2 short sentences.
- Focus on selling luxury jewellery.

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
      completion.choices[0].message.content;

    // RETURN RESPONSE
    res.json({
      reply: aiReply,
      products: matchedProducts,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      reply: "Server error",
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
