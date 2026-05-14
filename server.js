import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// =========================
// MEMORY
// =========================

let STORE_PRODUCTS = [];
let LAST_UPDATE = 0;

const conversations = {};

// =========================
// LOAD PRODUCTS
// =========================

async function loadProducts() {

  try {

    console.log("Loading Shopify products...");

    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/products.json?limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    STORE_PRODUCTS = (data.products || []).map((p) => ({

      id: p.id,

      title: p.title || "",

      description:
        p.body_html
          ?.replace(/<[^>]*>/g, " ")
          ?.replace(/\s+/g, " ")
          ?.trim() || "",

      tags: p.tags || "",

      type: p.product_type || "",

      vendor: p.vendor || "",

      price: p.variants?.[0]?.price || "",

      image: p.images?.[0]?.src || "",

      handle: p.handle || "",

      url: `https://${SHOP}/products/${p.handle}`,

      searchable: `
${p.title}
${p.body_html}
${p.tags}
${p.product_type}
${p.vendor}
      `
        .toLowerCase()
        .replace(/<[^>]*>/g, " "),

    }));

    LAST_UPDATE = Date.now();

    console.log(
      `Loaded ${STORE_PRODUCTS.length} products`
    );

  } catch (error) {

    console.log("SHOPIFY ERROR");

    console.log(error);

  }

}

// =========================
// SMART SEARCH
// =========================

function searchProducts(userMessage) {

  const q = userMessage.toLowerCase();

  const scored = [];

  for (const p of STORE_PRODUCTS) {

    let score = 0;

    // direct match
    if (
      p.searchable.includes(q)
    ) {
      score += 100;
    }

    // silver
    if (
      q.includes("فضه") ||
      q.includes("فضة") ||
      q.includes("silver")
    ) {

      if (
        p.searchable.includes("silver") ||
        p.searchable.includes("925")
      ) {
        score += 50;
      }

    }

    // gold
    if (
      q.includes("ذهب") ||
      q.includes("gold")
    ) {

      if (
        p.searchable.includes("gold") ||
        p.searchable.includes("18k")
      ) {
        score += 50;
      }

    }

    // moissanite
    if (
      q.includes("موزنايت") ||
      q.includes("moissanite")
    ) {

      if (
        p.searchable.includes("moissanite")
      ) {
        score += 50;
      }

    }

    // ring
    if (
      q.includes("خاتم") ||
      q.includes("ring")
    ) {

      if (
        p.searchable.includes("ring")
      ) {
        score += 30;
      }

    }

    // earrings
    if (
      q.includes("قرط") ||
      q.includes("earring")
    ) {

      if (
        p.searchable.includes("earring")
      ) {
        score += 30;
      }

    }

    // necklace
    if (
      q.includes("عقد") ||
      q.includes("necklace")
    ) {

      if (
        p.searchable.includes("necklace")
      ) {
        score += 30;
      }

    }

    // bracelet
    if (
      q.includes("اسوره") ||
      q.includes("سوار") ||
      q.includes("bracelet")
    ) {

      if (
        p.searchable.includes("bracelet")
      ) {
        score += 30;
      }

    }

    // luxury
    if (
      q.includes("luxury") ||
      q.includes("فاخر")
    ) {
      score += 10;
    }

    // recommendation
    if (
      q.includes("اقتراح") ||
      q.includes("recommend")
    ) {
      score += 10;
    }

    // new
    if (
      q.includes("جديد") ||
      q.includes("new")
    ) {
      score += 10;
    }

    if (score > 0) {

      scored.push({
        ...p,
        score,
      });

    }

  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 5);

}

// =========================
// CHAT
// =========================

app.post("/chat", async (req, res) => {

  try {

    const message =
      req.body.message || "";

    const sessionId =
      req.body.sessionId || "default";

    // load products
    if (STORE_PRODUCTS.length === 0) {
      await loadProducts();
    }

    // refresh every 15 mins
    if (
      Date.now() - LAST_UPDATE >
      1000 * 60 * 15
    ) {
      await loadProducts();
    }

    // create memory
    if (!conversations[sessionId]) {
      conversations[sessionId] = [];
    }

    // save user msg
    conversations[sessionId].push({
      role: "user",
      content: message,
    });

    // search products
    let matchedProducts =
      searchProducts(message);

    // fallback
    if (matchedProducts.length === 0) {

      matchedProducts =
        STORE_PRODUCTS.slice(0, 5);

    }

    // limit memory
    conversations[sessionId] =
      conversations[sessionId].slice(-8);

    // system prompt
    const systemPrompt = `
You are Alymwndw AI.

You are an elite luxury jewellery sales assistant.

You are NOT robotic.

You speak naturally and intelligently.

You deeply understand:
- Gold jewellery
- 18k gold
- Silver jewellery
- 925 silver
- Diamonds
- Moissanite
- Platinum
- Engagement rings
- Luxury jewelry
- Fashion jewelry
- Gifts

Your personality:
- Elegant
- Smart
- Luxury
- Friendly
- Human-like
- Professional

IMPORTANT RULES:

- Never invent fake products.
- Always recommend real products only.
- Always use relevant products list.
- Never say store is empty.
- Recommend products naturally.
- Upsell elegantly.
- Understand customer intent.
- Keep answers smart and clean.
- Arabic => Arabic reply.
- English => English reply.
- Do not repeat yourself.
- Sound premium.

Relevant products:
${JSON.stringify(matchedProducts)}
`;

    // OPENAI
    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.4,

        messages: [

          {
            role: "system",
            content: systemPrompt,
          },

          ...conversations[sessionId],

        ],

      });

    const aiReply =
      completion.choices[0]
      .message.content;

    // save ai msg
    conversations[sessionId].push({

      role: "assistant",

      content: aiReply,

    });

    res.json({

      reply: aiReply,

      products: matchedProducts,

    });

  } catch (error) {

    console.log(error);

    res.json({

      reply:
        "Alymwndw AI temporarily unavailable.",

    });

  }

});

// =========================
// START SERVER
// =========================

loadProducts();

app.listen(PORT, () => {

  console.log(
    `ALYMWNDW AI RUNNING ON ${PORT}`
  );

});
