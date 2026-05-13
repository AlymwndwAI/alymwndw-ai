const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   CACHE
========================= */
let cache = [];

/* =========================
   UTIL
========================= */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* =========================
   FETCH ALL PRODUCTS (FULL VARIANTS FIX)
========================= */
async function fetchAllProducts() {

  let all = [];
  let page = 1;

  try {

    while (true) {

      const listUrl = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250&page=${page}`;

      const listRes = await axios.get(listUrl, { timeout: 15000 });

      const products = listRes?.data?.products || [];

      if (!products.length) break;

      // 🔥 أهم جزء: نجيب كل منتج كامل عشان variants
      for (let p of products) {

        try {

          const fullUrl = `https://${process.env.SHOPIFY_STORE}/products/${p.handle}.json`;

          const fullRes = await axios.get(fullUrl, { timeout: 15000 });

          const fullProduct = fullRes?.data?.product;

          if (fullProduct?.variants?.length) {
            all.push(fullProduct);
          }

          await sleep(300); // ضد 429

        } catch (err) {
          console.log("skip:", p.handle);
        }
      }

      console.log(`📦 Page ${page} | Total: ${all.length}`);

      page++;

      await sleep(1000);
    }

    console.log("✅ FINAL PRODUCTS:", all.length);

    return all;

  } catch (err) {
    console.log("❌ Fatal error:", err.message);
    return [];
  }
}

/* =========================
   SYNC
========================= */
async function syncProducts() {

  console.log("🔄 Sync started...");

  const products = await fetchAllProducts();

  cache = products || [];

  console.log("💾 Cached:", cache.length);
}

/* =========================
   PRODUCTS API (FULL VARIANTS)
========================= */
app.get("/products", (req, res) => {

  if (!cache.length) {
    return res.json({ error: "No products - run /sync" });
  }

  const formatted = cache.map(p => {

    const v = p.variants?.[0];
    const price = parseFloat(v?.price || 0);

    return {
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || "",

      price: `${price.toFixed(2)} AED`,

      // 💎 FULL VARIANTS (REAL SHOPIFY DATA)
      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,
        price: `${parseFloat(v.price || 0).toFixed(2)} AED`,

        // 🪙 REAL DATA FROM SHOPIFY
        option1: v.option1,
        option2: v.option2,
        option3: v.option3
      }))
    };
  });

  res.json(formatted);
});

/* =========================
   SYNC ENDPOINT
========================= */
app.get("/sync", async (req, res) => {

  cache = [];

  await syncProducts();

  res.json({
    success: true,
    total: cache.length
  });
});

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.send("🚀 AI Jewelry Store RUNNING");
});

/* =========================
   AUTO SYNC
========================= */
setInterval(async () => {
  console.log("🔄 Auto sync...");
  await syncProducts();
}, 1000 * 60 * 15);

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  setTimeout(async () => {
    await syncProducts();
  }, 5000);

});
