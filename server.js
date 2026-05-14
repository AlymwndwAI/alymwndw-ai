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

// MEMORY
let STORE_PRODUCTS = [];
let LAST_UPDATE = 0;

// =============================
// LOAD PRODUCTS
// =============================
async function loadProducts() {

  console.log("LOADING SHOPIFY PRODUCTS...");

  try {

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

    console.log("PRODUCTS LOADED:", STORE_PRODUCTS.length);

  } catch (err) {

    console.log("SHOPIFY LOAD ERROR");

    console.log(err);

  }
}

// =============================
// SMART SEARCH
// =============================
function searchProducts(userMessage) {

  const q = userMessage.toLowerCase();

  const scored = [];

  for (const p of STORE_PRODUCTS) {

    let score = 0;

    // direct matching
    if (p.searchable.includes(q)) score += 100;

    // Arabic matching
    if (
      q.includes("فضه") ||
      q.includes("فضة") ||
      q.includes("silver")
    ) {
      if (
        p.searchable.includes("silver") ||
        p.searchable.includes("925")
      ) score += 50;
    }

    if (
      q.includes("ذهب") ||
      q.includes("gold")
    ) {
      if (
        p.searchable.includes("gold") ||
        p.searchable.includes("18k")
      ) score += 50;
    }

    if (
      q.includes("موزنايت") ||
      q.includes("moissanite")
    ) {
      if (
        p.searchable.includes("moissanite")
      ) score += 50;
    }

    if (
      q.includes("خاتم") ||
      q.includes("ring")
    ) {
      if (
        p.searchable.includes("ring")
      ) score += 30;
    }

    if (
      q.includes("قرط") ||
      q.includes("earring")
    ) {
      if (
        p.searchable.includes("earring")
      ) score += 30;
    }

    if (
      q.includes("عقد") ||
      q.includes("necklace")
    ) {
      if (
        p.searchable.includes("necklace")
      ) score += 30;
    }

    if (
      q.includes("اسوره") ||
      q.includes("سوار") ||
      q.includes("bracelet")
    ) {
      if (
        p.searchable.includes("bracelet")
      ) score += 30;
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

// =============================
// CHAT
// =============================
app.post("/chat", async (req, res) => {

  try {

    const message = req.body.message || "";

    // auto refresh products every 15 mins
    if (
      Date.now() - LAST_UPDATE >
      1000 * 60 * 15
    ) {
      await loadProducts();
    }

    const matchedProducts =
      searchProducts(message);

    const prompt = `
You are Alymwndw Jewellery AI.

You are an elite luxury jewellery sales assistant.

You understand:
- Gold jewellery
- 18K gold
- Silver jewellery
- 925 silver
- Diamonds
- Moissanite
- Platinum
- Luxury jewelry
- Engagement rings
- Fashion jewelry

VERY IMPORTANT RULES:

- NEVER invent products.
- ONLY recommend products from the provided list.
- Speak naturally and professionally.
- If user speaks Arabic answer Arabic.
- If user speaks English answer English.
- Be short and smart.
- Sell elegantly like a luxury jewelry expert.
- Upsell carefully.
- Mention price naturally.
- Understand customer intent.

Relevant products:
${JSON.stringify(matchedProducts)}

Customer:
${message}
`;

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.7,

        messages: [
          {
            role: "system",
            content: prompt,
          },
          {
            role: "user",
            content: message,
          },
        ],

      });

    res.json({

      reply:
        completion.choices[0]
          .message.content,

      products: matchedProducts,

    });

  } catch (error) {

    console.log(error);

    res.json({
      reply:
        "Sorry, Alymwndw AI is temporarily unavailable.",
    });

  }

});

// =============================
// START SERVER
// =============================
loadProducts();

app.listen(PORT, () => {

  console.log(
    "ALYMWNDW AI RUNNING"
  );

});
