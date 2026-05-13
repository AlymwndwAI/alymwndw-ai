const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

/* =========================
   MEMORY CACHE
========================= */
let cache = [];

/* =========================
   SAFE HANDLERS
========================= */
process.on("uncaughtException", (err) => {
  console.log("CRASH:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR:", err.message);
});

/* =========================
   UTILS
========================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* =========================
   SHOPIFY SYNC (FIXED 429)
========================= */
async function syncProducts() {
  try {
    console.log("🔄 Sync started...");

    let all = [];
    let since_id = 0;
    let retries = 0;

    while (true) {
      const url = `https://${SHOPIFY_STORE}/products.json?limit=250&since_id=${since_id}`;

      let res;

      try {
        res = await axios.get(url, { timeout: 20000 });
        retries = 0; // reset retries on success
      } catch (err) {
        const status = err.response?.status;

        // 🚨 RATE LIMIT HANDLING
        if (status === 429) {
          console.log("⛔ 429 Rate limit hit → waiting 5s...");
          await sleep(5000);
          continue;
        }

        retries++;

        if (retries < 3) {
          console.log("⚠️ retry request...");
          await sleep(2000);
          continue;
        }

        throw err;
      }

      const products = res?.data?.products || [];

      if (!products.length) break;

      all.push(...products);

      since_id = products[products.length - 1].id;

      console.log(`📦 Got: ${products.length} | Total: ${all.length}`);

      // ⛔ IMPORTANT: throttle requests
      await sleep(800);
    }

    cache = all;

    console.log("✅ SYNC COMPLETE:", cache.length);

  } catch (err) {
    console.log("SYNC ERROR:", err.message);
  }
}

/* =========================
   API: PRODUCTS (FAST)
========================= */
app.get("/products", (req, res) => {
  try {
    if (!cache.length) {
      return res.json({ success: true, products: [] });
    }

    const data = cache.map((p) => ({
      id: p.id,
      title: p.title,
      image: p.images?.[0]?.src || "",
      variants: (p.variants || []).map((v) => ({
        id: v.id,
        title: v.title,
        price: `${parseFloat(v.price || 0).toFixed(2)} AED`,
        metal: v.option1 || null,
        stone: v.option2 || null,
        size: v.option3 || null,
      })),
    }));

    res.json({
      success: true,
      count: data.length,
      products: data,
    });

  } catch (err) {
    res.status(500).json({
      error: "products_error",
      message: err.message,
    });
  }
});

/* =========================
   MANUAL SYNC
========================= */
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.json({
    success: true,
    message: "sync done",
    total: cache.length,
  });
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("🚀 Alymwndw AI Server Running");
});

/* =========================
   AUTO SYNC ON START
========================= */
setTimeout(() => {
  syncProducts();
}, 3000);

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port:", PORT);
});
