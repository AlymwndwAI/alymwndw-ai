const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

let cache = [];

/* =========================
   SAFETY
========================= */
process.on("uncaughtException", (err) => {
  console.log("CRASH:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR:", err.message);
});

/* =========================
   SHOPIFY SYNC
========================= */
async function syncProducts() {
  try {
    console.log("🔄 Starting sync...");

    let all = [];
    let since_id = 0;

    while (true) {
      const url = `https://${SHOPIFY_STORE}/products.json?limit=250&since_id=${since_id}`;

      const res = await axios.get(url, {
        timeout: 20000,
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      const products = res?.data?.products || [];

      if (!products.length) break;

      all.push(...products);

      since_id = products[products.length - 1].id;

      console.log(`📦 Got: ${products.length} | Total: ${all.length}`);

      // 🔥 small delay to avoid 429
      await new Promise(r => setTimeout(r, 300));
    }

    cache = all;

    console.log("✅ SYNC COMPLETE:", cache.length);

  } catch (err) {
    console.log("SYNC ERROR:", err.message);

    if (err.response?.status === 429) {
      console.log("⏳ Rate limit hit → retrying in 5s...");
      await new Promise(r => setTimeout(r, 5000));
      return syncProducts();
    }
  }
}

/* =========================
   API: PRODUCTS
========================= */
app.get("/products", (req, res) => {
  try {
    if (!cache.length) {
      return res.json([]);
    }

    const data = cache.map(p => ({
      id: p.id,
      title: p.title,
      image: p.images?.[0]?.src || "",

      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,
        price: `${parseFloat(v.price || 0).toFixed(2)} AED`,
        metal: v.option1 || null,
        stone: v.option2 || null,
        size: v.option3 || null
      }))
    }));

    res.json(data);

  } catch (err) {
    res.status(500).json({
      error: "products_error",
      message: err.message
    });
  }
});

/* =========================
   MANUAL SYNC
========================= */
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.json({ ok: true, total: cache.length });
});

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.send("🚀 AI Jewelry Store Running");
});

/* =========================
   START SERVER (IMPORTANT FIX)
========================= */
app.listen(PORT, "0.0.0.0", async () => {
  console.log("🚀 Server running on", PORT);

  // 🔥 AUTO SYNC ON START
  await syncProducts();
});
