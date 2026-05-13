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

// ================= FETCH PRODUCTS =================
async function syncProducts() {
  try {
    if (!SHOPIFY_STORE) throw new Error("SHOPIFY_STORE missing");

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
    console.log("✅ PRODUCTS LOADED:", cache.length);

  } catch (err) {
    console.log("❌ SHOPIFY ERROR:", err.message);
  }
}

// ================= PRODUCTS API =================
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

// ================= CHAT AI =================
app.post("/chat", async (req, res) => {
  try {

    const userMessage = req.body.message;

    const productContext = cache.slice(0, 60).map(p => ({
      title: p.title,
      variants: p.variants?.map(v =>
        `${v.title} - ${v.price} AED`
      )
    }));

    const prompt = `
You are a luxury jewelry sales assistant.

Rules:
- Reply in AED only
- Recommend real products
- Be short, premium, sales-focused

Products:
${JSON.stringify(productContext)}

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
      reply: response.data.choices[0].message.content
    });

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
  console.log("🚀 Running on", PORT);
  syncProducts();
});
