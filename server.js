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
   GET ALL PRODUCTS (REAL PAGINATION)
========================= */
async function fetchAllProducts() {

  let all = [];
  let url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250`;

  try {

    while (url) {

      const res = await axios.get(url);

      const products = res.data.products || [];

      all = all.concat(products);

      console.log(`📦 Got: ${products.length}`);

      // Shopify pagination (real link header)
      const link = res.headers.link;

      if (link && link.includes('rel="next"')) {

        const nextUrl = link
          .split(",")
          .find(s => s.includes('rel="next"'))
          ?.match(/<([^>]+)>/)?.[1];

        url = nextUrl || null;

      } else {
        url = null;
      }
    }

    console.log("✅ TOTAL PRODUCTS:", all.length);

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

  const products = await fetchAllProducts();

  if (products.length > 0) {
    cache = products;
    console.log("💾 Cached:", cache.length);
  } else {
    console.log("⚠️ No products loaded");
  }
}

/* =========================
   PRODUCTS API
========================= */
app.get("/products", (req, res) => {

  const formatted = cache.map(p => {

    const v = p.variants?.[0];

    return {
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || "",

      // 💎 AED PRICE (as requested)
      price: `${v?.price || 0} AED`,

      // full variants (colors/metals/sizes)
      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,
        price: `${v.price} AED`,
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
   HOME PAGE
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
