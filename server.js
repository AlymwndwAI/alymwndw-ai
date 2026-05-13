const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   MEMORY CACHE
========================= */
let cache = [];

/* =========================
   UTIL: sleep
========================= */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* =========================
   FETCH ALL PRODUCTS (SAFE + NO CRASH)
========================= */
async function fetchAllProducts() {

  let all = [];
  let since_id = 0;

  try {

    while (true) {

      let url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=100`;

      if (since_id) {
        url += `&since_id=${since_id}`;
      }

      let res;

      // retry system for 429 / 503
      for (let i = 0; i < 5; i++) {
        try {
          res = await axios.get(url, { timeout: 15000 });
          break;
        } catch (err) {

          const status = err.response?.status;

          if (status === 429 || status === 503) {
            console.log(`⛔ Shopify busy (${status}) retrying...`);
            await sleep(3000);
          } else {
            throw err;
          }
        }
      }

      const products = res?.data?.products || [];

      if (!products.length) break;

      // remove duplicates
      const existing = new Set(all.map(p => p.id));
      const filtered = products.filter(p => !existing.has(p.id));

      all = all.concat(filtered);

      since_id = products[products.length - 1].id;

      console.log(`📦 Got: ${filtered.length} | Total: ${all.length}`);

      // IMPORTANT: slow down requests
      await sleep(1200);

      if (products.length < 100) break;
    }

    console.log("✅ FINAL TOTAL PRODUCTS:", all.length);

    return all;

  } catch (err) {
    console.log("❌ Fatal error:", err.message);
    return [];
  }
}

/* =========================
   SYNC CACHE
========================= */
async function syncProducts() {

  console.log("🔄 Sync started...");

  const products = await fetchAllProducts();

  cache = products || [];

  console.log("💾 Cached products:", cache.length);
}

/* =========================
   PRODUCTS API (AED + CLEAN)
========================= */
app.get("/products", (req, res) => {

  if (!cache || cache.length === 0) {
    return res.json({
      error: "No products found - run /sync"
    });
  }

  const formatted = cache.map(p => {

    const v = p.variants?.[0];

    const price = parseFloat(v?.price || 0);

    return {
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || "",

      // 💎 AED PRICE
      price: `${price.toFixed(2)} AED`,

      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,
        price: `${parseFloat(v.price || 0).toFixed(2)} AED`,
        option1: v.option1,
        option2: v.option2,
        option3: v.option3,
        sku: v.sku
      }))
    };
  });

  res.json(formatted);
});

/* =========================
   MANUAL SYNC
========================= */
app.get("/sync", async (req, res) => {

  await syncProducts();

  res.json({
    success: true,
    total: cache.length
  });
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("🚀 AI Store is running");
});

/* =========================
   AUTO SYNC (SAFE)
========================= */
setInterval(async () => {
  console.log("🔄 Auto sync running...");
  await syncProducts();
}, 1000 * 60 * 15); // كل 15 دقيقة

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  // initial sync only once
  setTimeout(async () => {
    await syncProducts();
  }, 5000);

});
