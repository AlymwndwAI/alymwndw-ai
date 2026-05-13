const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   MEMORY CACHE
========================= */
let cache = [];

/* =========================
   FETCH ALL PRODUCTS (REAL PAGINATION)
========================= */
async function fetchAllProducts() {

  let allProducts = [];
  let url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250`;

  try {

    while (url) {

      const res = await axios.get(url);

      const products = res.data.products || [];
      allProducts = allProducts.concat(products);

      console.log(`📦 Fetched: ${products.length}`);

      // Shopify pagination via Link header
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

    console.log("✅ TOTAL PRODUCTS:", allProducts.length);

    return allProducts;

  } catch (err) {
    console.log("❌ Shopify error:", err.message);
    return [];
  }
}

/* =========================
   SYNC PRODUCTS INTO MEMORY
========================= */
async function syncProducts() {

  const products = await fetchAllProducts();

  if (products.length > 0) {
    cache = products;
    console.log("💾 Cached products:", cache.length);
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
   HOME PAGE
========================= */
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  // safe startup sync
  setTimeout(async () => {
    await syncProducts();
  }, 5000);

});
