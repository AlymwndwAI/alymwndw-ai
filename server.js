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
   FETCH ALL PRODUCTS (NO TOKEN)
========================= */
async function fetchAllProducts() {

  let allProducts = [];
  let page = 1;

  try {

    while (true) {

      const res = await axios.get(
        `https://${process.env.SHOPIFY_STORE}/products.json?limit=250&page=${page}`
      );

      const products = res.data.products || [];

      if (products.length === 0) break;

      allProducts = allProducts.concat(products);

      console.log(`📦 Page ${page}: ${products.length}`);

      // لو أقل من 250 → آخر صفحة
      if (products.length < 250) break;

      page++;
    }

    console.log("✅ TOTAL PRODUCTS:", allProducts.length);

    return allProducts;

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
   API - PRODUCTS
========================= */
app.get("/products", (req, res) => {

  const formatted = cache.map(p => ({
    title: p.title,
    price: p.variants?.[0]?.price,
    image: p.images?.[0]?.src,
    handle: p.handle
  }));

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
   START SERVER (SAFE)
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  // safe startup (Render friendly)
  setTimeout(async () => {
    try {
      await syncProducts();
    } catch (err) {
      console.log("❌ Sync error:", err.message);
    }
  }, 5000);

});
