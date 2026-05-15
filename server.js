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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==============================
// LOAD PRODUCT BRAIN
// ==============================

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
  console.log("NO PRODUCT BRAIN FOUND");
}

// ==============================
// SEARCH PRODUCTS
// ==============================

function searchProducts(message, products) {
  const msg = message.toLowerCase();

  return products.filter((p) => {
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

    const words = msg
      .split(" ")
      .map((w) => w.trim())
      .filter((w) => w.length > 1);

    return words.some((word) =>
      searchable.includes(word)
    );
  });
}

// ==============================
// HOME
// ==============================

app.get("/", (req, res) => {
  res.send("ALYMWNDW AI RUNNING");
});

// ==============================
// CHAT API
// ==============================

app.post("/chat", async (req, res) => {
  try {
    const userMessage =
      req.body.message || "";

    // SEARCH PRODUCTS
    const matchedProducts =
      searchProducts(
        userMessage,
        products
      ).slice(0, 6);

    // NO PRODUCTS
    if (matchedProducts.length === 0) {
      return res.json({
        reply:
          "No matching products found",
        products: [],
      });
    }

    // SHORT PRODUCT DATA FOR AI
    const cleanProducts =
      matchedProducts.map((p) => ({
        title: p.title,
        price: p.price,
        type: p.type,
        materials: p.materials,
        stones: p.stones,
        colors: p.colors,
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
- Be luxurious and elegant.
- Never invent products.
- Only recommend available products.
- Maximum 2 short sentences.

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

    // RETURN
    res.json({
      reply: aiReply,
      products: matchedProducts,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      reply: "Server error",
    });
  }
});

// ==============================
// START SERVER
// ==============================

app.listen(PORT, () => {
  console.log(
    `ALYMWNDW AI RUNNING ON ${PORT}`
  );
});
