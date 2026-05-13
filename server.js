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

// ================= PRODUCTS SYNC =================
async function syncProducts() {
  try {
    let all = [];
    let page = 1;

    while (true) {
      const url = `https://${SHOPIFY_STORE}/products.json?limit=250&page=${page}`;
      const res = await axios.get(url);

      if (!res.data.products || res.data.products.length === 0) break;

      all.push(...res.data.products);
      page++;
    }

    cache = all;
    console.log("💎 PRODUCTS LOADED:", cache.length);

  } catch (err) {
    console.log("SHOPIFY ERROR:", err.message);
  }
}

// ================= HOME TEST =================
app.get("/", (req, res) => {
  res.send("Alymwndw AI Running 💎");
});

// ================= PRODUCTS API =================
app.get("/products", (req, res) => {

  const products = cache.map(p => {

    const prices = (p.variants || [])
      .map(v => parseFloat(v.price))
      .filter(Boolean);

    return {
      title: p.title,
      image: p.images?.[0]?.src || "",
      price_min: Math.min(...prices),
      price_max: Math.max(...prices)
    };
  });

  res.json(products);
});

// ================= CHAT AI (FIXED) =================
app.post("/chat", async (req, res) => {

  try {

    const message = req.body.message;

    if (!message) {
      return res.status(400).json({ error: "No message" });
    }

    const products = cache.slice(0, 20).map(p => ({
      title: p.title,
      price: p.variants?.[0]?.price
    }));

    const prompt = `
You are Alymwndw AI 💎 luxury jewelry sales expert.

Rules:
- Recommend ONE product only
- Luxury tone (Cartier style)
- Max 6 lines
- Always AED currency
- Be persuasive

Products:
${JSON.stringify(products)}

User:
${message}
`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
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
    console.log(err.response?.data || err.message);
    res.status(500).json({ error: "Chat failed" });
  }
});

// ================= IMAGE GENERATION =================
app.post("/generate-image", async (req, res) => {

  try {

    const prompt = req.body.prompt;

    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: "gpt-image-1",
        prompt: `Luxury jewelry product, ultra realistic studio lighting, Alymwndw style: ${prompt}`,
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
    console.log(err.response?.data || err.message);
    res.status(500).json({ error: "Image failed" });
  }
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log("💎 Alymwndw AI Running on port", PORT);
  syncProducts();
});
