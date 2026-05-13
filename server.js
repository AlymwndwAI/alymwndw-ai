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

// ================= LOAD PRODUCTS =================
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
    console.log("Shopify error:", err.message);
  }
}

// ================= SMART DETECT =================
function detectMetal(text) {
  text = text.toLowerCase();
  if (text.includes("gold")) return "gold";
  if (text.includes("silver")) return "silver";
  if (text.includes("platinum")) return "platinum";
  return null;
}

function detectStone(text) {
  text = text.toLowerCase();
  if (text.includes("diamond")) return "diamond";
  if (text.includes("ruby")) return "ruby";
  if (text.includes("sapphire")) return "sapphire";
  if (text.includes("moissanite")) return "moissanite";
  return null;
}

function matchProduct(p, f) {
  const text = (p.title + JSON.stringify(p.variants)).toLowerCase();

  if (f.metal && !text.includes(f.metal)) return false;
  if (f.stone && !text.includes(f.stone)) return false;

  if (f.maxPrice) {
    const prices = (p.variants || []).map(v => parseFloat(v.price));
    const min = Math.min(...prices);
    if (min > f.maxPrice) return false;
  }

  return true;
}

// ================= PRODUCTS API =================
app.get("/products", (req, res) => {
  res.json(
    cache.map(p => {
      const prices = (p.variants || []).map(v => parseFloat(v.price)).filter(Boolean);

      return {
        title: p.title,
        image: p.images?.[0]?.src || "",
        price_min: Math.min(...prices),
        price_max: Math.max(...prices),
      };
    })
  );
});

// ================= CHAT (AUTO SALES AI) =================
app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    // 🧠 extract filters
    const filterPrompt = `
Extract jewelry filters JSON:
{
  "metal": "gold/silver/platinum/null",
  "stone": "diamond/ruby/sapphire/null",
  "maxPrice": number or null
}

User:
${userMessage}
`;

    const filterRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: filterPrompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let filters = {};

    try {
      filters = JSON.parse(filterRes.data.choices[0].message.content);
    } catch {}

    // 🔍 filter products
    let filtered = cache.filter(p => matchProduct(p, filters));

    if (filtered.length === 0) {
      filtered = cache.slice(0, 5);
    }

    const context = filtered.slice(0, 10).map(p => ({
      name: p.title,
      price: p.variants?.[0]?.price,
    }));

    // 💎 sales prompt
    const prompt = `
You are "Alymwndw AI" 💎 luxury jewelry sales expert.

Rules:
- Recommend ONLY ONE product
- Speak like Cartier / Tiffany advisor
- Max 6 lines
- Always AED
- Close the sale (urgency + luxury tone)

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

// ================= IMAGE GENERATION =================
app.post("/generate-image", async (req, res) => {

  try {

    const prompt = req.body.prompt;

    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: "gpt-image-1",
        prompt: `Luxury jewelry product, studio lighting, ultra realistic, 8k, Alymwndw style: ${prompt}`,
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
    res.status(500).json({ error: "Image generation failed" });
  }
});

// ================= SYNC =================
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.json({ ok: true, total: cache.length });
});

// ================= START =================
app.listen(PORT, () => {
  console.log("💎 Alymwndw AI FULL SYSTEM RUNNING");
  syncProducts();
});
