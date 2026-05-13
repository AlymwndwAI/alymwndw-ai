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
   SLEEP
========================= */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* =========================
   FETCH ALL PRODUCTS (FIXED PAGINATION)
========================= */
async function fetchAllProducts() {

  let all = [];
  let page = 1;

  try {

    while (true) {

      const url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250&page=${page}`;

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

      if (!products.length) {
        console.log(`🛑 Page ${page} empty → stop`);
        break;
      }

      all = all.concat(products);

      console.log(`📦 Page ${page} | Got: ${products.length} | Total: ${all.length}`);

      page++;

      // slow down requests (VERY IMPORTANT)
      await sleep(1200);
    }

    console.log("✅ FINAL TOTAL PRODUCTS:", all.length);

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

  console.log("💾 Cached products:", cache.length);
}

/* =========================
   PRODUCTS API
========================= */
app.get("/products", (req, res) => {

  if (!cache || cache.length === 0) {
    return res.json({
      error: "No products - run /sync"
    });
  }

  const formatted = cache.map(p => {

    const v = p.variants?.[0];

    const price = parseFloat(v?.price || 0);

    return {
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || "",

      // 💎 AED ONLY
      price: `${price.toFixed(2)} AED`,

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
   SYNC ENDPOINT
========================= */
app.get("/sync", async (req, res) => {

  cache = []; // clear old data

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
  res.send("🚀 AI Store Running");
});

/* =========================
   AUTO SYNC (SAFE)
========================= */
setInterval(async () => {
  console.log("🔄 Auto sync...");
  await syncProducts();
}, 1000 * 60 * 15); // كل 15 دقيقة

/* =========================
   START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  setTimeout(async () => {
    await syncProducts();
  }, 5000);

});
