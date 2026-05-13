const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let cache = [];

// ================= SAFE FALLBACK =================
function ensureFallback() {
  if (!cache || cache.length === 0) {
    cache = [
      {
        title: "Luxury Diamond Ring (Demo)",
        images: [],
        variants: [{ price: "4999" }]
      }
    ];
  }
}

// ================= SHOPIFY SYNC (FIXED) =================
async function syncProducts() {
  try {
    let all = [];
    let page = 1;

    while (page <= 5) {
      const url = `https://${SHOPIFY_STORE}/products.json?limit=250&page=${page}`;
      const res = await axios.get(url);

      const products = res.data.products;

      if (!products || products.length === 0) break;

      all.push(...products);
      page++;
    }

    cache = all;

    console.log("💎 PRODUCTS LOADED:", cache.length);

  } catch (err) {
    console.log("❌ SHOPIFY ERROR:", err.message);
  }
}

// ================= DEBUG =================
app.get("/debug", (req, res) => {
  res.json({
    products: cache.length,
    working: cache.length > 0,
    sample: cache[0] || null
  });
});

// ================= PRODUCTS API =================
app.get("/products", (req, res) => {

  ensureFallback();

  const result = cache.map(p => {

    const prices = (p.variants || [])
      .map(v => parseFloat(v.price))
      .filter(Boolean);

    return {
      title: p.title,
      image: p.images?.[0]?.src || "https://via.placeholder.com/300",
      price_min: Math.min(...prices),
      price_max: Math.max(...prices)
    };
  });

  res.json(result);
});

// ================= CHAT AI =================
app.post("/chat", async (req, res) => {

  try {

    ensureFallback();

    const message = req.body.message;

    const products = cache.slice(0, 15).map(p => ({
      title: p.title,
      price: p.variants?.[0]?.price
    }));

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are Alymwndw AI luxury jewelry sales expert."
          },
          {
            role: "user",
            content: `
Pick ONE product and sell it like Cartier.

Products:
${JSON.stringify(products)}

User:
${message}
`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      reply: response.data.choices[0].message.content
    });

  } catch (err) {
    console.log("CHAT ERROR:", err.message);
    res.status(500).json({ error: "Chat failed" });
  }
});

// ================= IMAGE =================
app.post("/generate-image", async (req, res) => {

  try {

    const prompt = req.body.prompt;

    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: "gpt-image-1",
        prompt: `Luxury jewelry studio photo, ultra realistic, Alymwndw style: ${prompt}`,
        size: "1024x1024"
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      image: response.data.data?.[0]?.url
    });

  } catch (err) {
    console.log("IMAGE ERROR:", err.message);
    res.status(500).json({ error: "Image failed" });
  }
});

// ================= START =================
app.listen(PORT, () => {
  console.log("💎 Alymwndw AI RUNNING:", PORT);
  syncProducts();
});
