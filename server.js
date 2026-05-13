const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

let cache = [];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* =========================
   SAFE SHOPIFY FETCH (NO 429)
========================= */
async function fetchAllProducts() {

  let all = [];
  let since_id = 0;

  try {

    while (true) {

      const url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250&since_id=${since_id}`;

      const res = await axios.get(url, { timeout: 20000 });

      const products = res.data.products || [];

      if (!products.length) break;

      all = all.concat(products);

      since_id = products[products.length - 1].id;

      console.log(`📦 Got: ${products.length} | Total: ${all.length}`);

      await sleep(800); // 🔥 مهم جدًا ضد 429
    }

    return all;

  } catch (err) {
    console.log("❌ Error:", err.message);
    return all;
  }
}

/* =========================
   SYNC
========================= */
async function syncProducts() {

  console.log("🔄 Sync started...");

  cache = await fetchAllProducts();

  console.log("💾 Cached:", cache.length);
}

/* =========================
   PRODUCTS API (VARIANTS FIXED)
========================= */
app.get("/products", (req, res) => {

  if (!cache.length) {
    return res.json({ error: "No products yet" });
  }

  const formatted = cache.map(p => {

    return {
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || "",

      // 💎 IMPORTANT: variants from Shopify مباشرة
      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,
        price: `${parseFloat(v.price || 0).toFixed(2)} AED`,

        // 🪙 REAL OPTIONS (NO EXTRA REQUESTS)
        option1: v.option1, // metal
        option2: v.option2, // stone color
        option3: v.option3  // size
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
   START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  setTimeout(syncProducts, 5000);

});
