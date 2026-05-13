const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 مهم جدًا عشان الـ frontend
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let cache = [];

// ================= ROOT PAGE FIX =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= SHOPIFY SYNC =================
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
    console.log("SHOPIFY ERROR:", err.message);
  }
}

// ================= PRODUCTS =================
app.get("/products", (req, res) => {

  const data = cache.map(p => {

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

  res.json(data);
});

// ================= CHAT AI =================
app.post("/chat", async (req, res) => {

  try {

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
            content: "You are Alymwndw AI luxury jewelry sales assistant."
          },
          {
            role: "user",
            content: `
Pick ONE jewelry product and sell it like luxury Cartier advisor.

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
  console.log("💎 Alymwndw AI RUNNING ON", PORT);
  syncProducts();
});
