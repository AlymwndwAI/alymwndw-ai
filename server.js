const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || "";

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
   SMART SHOPIFY SYNC (FIXED 429)
========================= */
async function syncProducts() {
  try {

    if (!SHOPIFY_STORE) {
      console.log("❌ SHOPIFY_STORE missing");
      cache = [];
      return;
    }

    let all = [];
    let since_id = 0;
    let loopCount = 0;

    while (true) {

      loopCount++;

      const url = `https://${SHOPIFY_STORE}/products.json?limit=250&since_id=${since_id}`;

      const res = await axios.get(url, { timeout: 20000 });

      const products = res?.data?.products || [];

      if (!products.length) break;

      all.push(...products);

      since_id = products[products.length - 1].id;

      console.log(`📦 Batch ${loopCount}: ${products.length} | Total: ${all.length}`);

      /* =========================
         FIX 429 RATE LIMIT
      ========================= */
      await new Promise(r => setTimeout(r, 900));
    }

    cache = all;

    console.log("✅ FINAL PRODUCTS LOADED:", cache.length);

  } catch (err) {
    console.log("SYNC ERROR:", err.message);
  }
}

/* =========================
   PRODUCTS API (CLEAN FIX)
========================= */
app.get("/products", (req, res) => {

  try {

    const data = (cache || []).map(p => ({

      id: p.id,
      title: p.title || "No Title",

      image: p.images?.[0]?.src || "https://via.placeholder.com/300",

      variants: (p.variants || []).map(v => ({
        id: v.id,

        title: v.title || "variant",

        price: Number(v.price || 0),

        metal: v.option1 || "Unknown Metal",
        stone: v.option2 || "Unknown Stone",
        size: v.option3 || "Unknown Size"
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
  res.json({
    ok: true,
    total: cache.length
  });
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("🚀 Alymwndw AI Running Successfully");
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on", PORT);

  // auto sync on start
  syncProducts();
});
