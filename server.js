const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   CACHE
========================= */
let cache = [];

/* =========================
   SLEEP (ANTI 429)
========================= */
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/* =========================
   GET ALL PRODUCTS (SAFE + RATE LIMIT FIX)
========================= */
async function fetchAllProducts() {

  let all = [];
  let since_id = 0;

  try {

    while (true) {

      let url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250`;

      if (since_id > 0) {
        url += `&since_id=${since_id}`;
      }

      let res;

      // 🔥 retry logic for 429
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await axios.get(url);
          break;
        } catch (err) {

          if (err.response?.status === 429) {
            console.log("⛔ 429 Rate limit... waiting 2s");
            await sleep(2000);
          } else {
            throw err;
          }
        }
      }

      const products = res?.data?.products || [];

      if (products.length === 0) break;

      all = all.concat(products);

      since_id = products[products.length - 1].id;

      console.log(`📦 Got: ${products.length} | Total: ${all.length}`);

      // 🔥 مهم: تهدئة Shopify
      await sleep(500);

      if (products.length < 250) break;
    }

    console.log("✅ FINAL TOTAL PRODUCTS:", all.length);

    return all;

  } catch (err) {
    console.log("❌ Shopify error:", err.message);
    return [];
  }
}

/* =========================
   SYNC CACHE
========================= */
async function syncProducts() {

  const products = await fetchAllProducts();

  if (products.length > 0) {
    cache = products;
    console.log("💾 Cached:", cache.length);
  }
}

/* =========================
   PRODUCTS API (AED + VARIANTS)
========================= */
app.get("/products", (req, res) => {

  const formatted = cache.map(p => {

    const v = p.variants?.[0];

    const price = parseFloat(v?.price || 0);

    return {
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || "",

      // 💎 AED PRICE
      price: `${price.toFixed(2)} AED`,

      // 💎 VARIANTS FULL (colors/metals/sizes)
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
   HOME
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  setTimeout(async () => {
    try {
      await syncProducts();
    } catch (err) {
      console.log("❌ sync error:", err.message);
    }
  }, 5000);

});
