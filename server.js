const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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

      const products = res.data.products;
      if (!products || products.length === 0) break;

      all.push(...products);
      page++;
    }

    cache = all;
    console.log("💎 Alymwndw Loaded:", cache.length);

  } catch (err) {
    console.log("ERROR:", err.message);
  }
}

// ================= PRODUCTS =================
app.get("/products", (req, res) => {
  res.json(
    cache.map(p => ({
      title: p.title,
      image: p.images?.[0]?.src || "",
      variants: p.variants?.map(v => ({
        title: v.title,
        price: v.price
      })) || []
    }))
  );
});

// ================= AI CHAT =================
app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    const context = cache.slice(0, 50).map(p => ({
      title: p.title,
      variants: p.variants?.map(v => `${v.title} - ${v.price} AED`)
    }));

    const prompt = `
You are "Alymwndw AI", luxury jewelry sales expert.

Rules:
- Recommend ONE product only
- Luxury tone (Cartier style)
- Max 5 lines
- Always AED
- Persuasive sales tone

Products:
${JSON.stringify(context)}

User:
${userMessage}
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
      reply: response.data.choices[0].message.content,
      brand: "Alymwndw 💎"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= 🖼️ IMAGE GENERATION =================
app.post("/generate-image", async (req, res) => {

  try {

    const prompt = req.body.prompt;

    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: "gpt-image-1",
        prompt: `
Luxury jewelry product photo for Alymwndw brand.
Ultra realistic studio lighting, 8k, high detail.

${prompt}
        `,
        size: "1024x1024"
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const image = response.data.data[0].url;

    res.json({ image });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= SYNC =================
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.json({ ok: true, total: cache.length });
});

// ================= START =================
app.listen(PORT, () => {
  console.log("💎 Alymwndw AI FULL STORE RUNNING");
  syncProducts();
});
