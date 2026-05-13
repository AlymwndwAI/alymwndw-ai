const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

let cache = [];

// 🧠 حماية من الكراش
process.on("uncaughtException", (err) => {
  console.log("CRASH:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR:", err.message);
});

// 🔥 تحميل المنتجات (Lazy Safe)
async function syncProducts() {
  try {
    let all = [];
    let seen = new Set();
    let since_id = 0;

    while (true) {
      const url = `https://${SHOPIFY_STORE}/products.json?limit=250&since_id=${since_id}`;

      const res = await axios.get(url, { timeout: 20000 });
      const products = res?.data?.products || [];

      if (!products.length) break;

      for (let p of products) {
        if (!seen.has(p.id)) {
          seen.add(p.id);

          all.push(p);
        }
      }

      since_id = products[products.length - 1].id;

      console.log(`Got: ${products.length} | Total: ${all.length}`);
    }

    cache = all;
    console.log("✅ FINAL PRODUCTS:", cache.length);

  } catch (err) {
    console.log("SYNC ERROR:", err.message);
  }
}

// 🚀 API Products (FIXED)
app.get("/products", (req, res) => {
  try {
    const result = cache.map(p => ({
      id: p.id,
      title: p.title,
      image: p.images?.[0]?.src || "",

      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,

        // 💎 السعر AED ثابت
        price: `${parseFloat(v.price || 0).toFixed(2)} AED`,

        option1: v.option1, // Metal
        option2: v.option2, // Stone
        option3: v.option3  // Size
      }))
    }));

    res.json(result);

  } catch (err) {
    res.status(500).json({
      error: "failed_products",
      message: err.message
    });
  }
});

// 🔥 manual sync (بدل التشغيل التلقائي)
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.json({ ok: true, total: cache.length });
});

// 🟢 health check
app.get("/", (req, res) => {
  res.send("🚀 AI Jewelry Store Running");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on", PORT);
});
