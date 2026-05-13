const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   CACHE (in memory)
========================= */
let cache = [];

/* =========================
   SLEEP (anti 429 safety)
========================= */
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/* =========================
   FETCH ALL PRODUCTS (SAFE)
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

      // retry if 429
      for (let i = 0; i < 3; i++) {
        try {
          res = await axios.get(url);
          break;
        } catch (err) {
          if (err.response?.status === 429) {
            console.log("⛔ 429 - waiting...");
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

      await sleep(400);

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
   SYNC PRODUCTS
========================= */
async function syncProducts() {

  console.log("🔄 Sync started...");

  const products = await fetchAllProducts();

  cache = products || [];

  console.log("💾 Cached products:", cache.length);
}

/* =========================
   GET PRODUCTS API
========================= */
app.get("/products", (req, res) => {

  if (!cache || cache.length === 0) {
    return res.json({
      error: "No products in cache. Call /sync first"
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

      // variants (colors / metals / sizes)
      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,
        price: `${parseFloat(v.price || 0).toFixed(2)} AED`,
        option1: v.option1,
        option2: v.option2,
        option3: v.option3
      }))
    };
  });

  res.json(formatted);
});

/* =========================
   FORCE SYNC
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
  res.send("🚀 Server is running");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  // auto sync on start
  setTimeout(async () => {
    await syncProducts();
  }, 5000);

});
