const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

let cache = [];

// 🛡️ حماية من الكراش
process.on("uncaughtException", (err) => {
  console.log("CRASH:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR:", err.message);
});

// 🔥 جلب المنتجات بطريقة آمنة
async function syncProducts() {
  try {
    console.log("🔄 Sync started...");

    let all = [];
    let since_id = 0;

    while (true) {
      const url = `https://${SHOPIFY_STORE}/products.json?limit=250&since_id=${since_id}`;

      const res = await axios.get(url, { timeout: 20000 });
      const products = res?.data?.products || [];

      if (!products.length) break;

      all.push(...products);

      since_id = products[products.length - 1].id;

      console.log(`📦 Got: ${products.length} | Total: ${all.length}`);
    }

    cache = all;

    console.log("✅ FINAL PRODUCTS:", cache.length);

  } catch (err) {
    console.log("SYNC ERROR:", err.message);
  }
}

// 🚀 API المنتجات
app.get("/products", (req, res) => {
  try {
    const data = cache.map(p => ({
      id: p.id,
      title: p.title,
      image: p.images?.[0]?.src || "",

      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,

        // 💎 AED price
        price: `${parseFloat(v.price || 0).toFixed(2)} AED`,

        // 🪙 Options (Metal / Stone / Size)
        metal: v.option1,
        stone: v.option2,
        size: v.option3
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

// 🔄 manual sync
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.json({ ok: true, total: cache.length });
});

// 🟢 health
app.get("/", (req, res) => {
  res.send("🚀 AI Jewelry Store Running");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on", PORT);
});
