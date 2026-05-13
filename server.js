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
   GET PRODUCTS LIST
========================= */
async function getProductsList() {
  try {
    const res = await axios.get(
      `https://${process.env.SHOPIFY_STORE}/products.json?limit=250`
    );

    return res.data.products || [];

  } catch (err) {
    console.log("❌ list error:", err.message);
    return [];
  }
}

/* =========================
   GET FULL PRODUCT (WITH VARIANTS)
========================= */
async function getFullProduct(handle) {
  try {
    const res = await axios.get(
      `https://${process.env.SHOPIFY_STORE}/products/${handle}.json`
    );

    return res.data.product;

  } catch (err) {
    console.log("❌ detail error:", handle);
    return null;
  }
}

/* =========================
   FETCH ALL (FULL DATA)
========================= */
async function fetchAllProducts() {

  let finalProducts = [];

  const list = await getProductsList();

  console.log("📦 List products:", list.length);

  for (let i = 0; i < list.length; i++) {

    const p = list[i];

    const full = await getFullProduct(p.handle);

    if (full) {
      finalProducts.push(full);
    }

    console.log(`🔄 Loaded: ${i + 1}/${list.length}`);
  }

  console.log("✅ TOTAL FULL PRODUCTS:", finalProducts.length);

  return finalProducts;
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
   API - PRODUCTS (FULL VARIANTS)
========================= */
app.get("/products", (req, res) => {

  const formatted = cache.map(p => ({
    title: p.title,
    handle: p.handle,
    image: p.images?.[0]?.src,

    // FULL VARIANTS (colors, metals, sizes)
    variants: (p.variants || []).map(v => ({
      id: v.id,
      title: v.title,
      price: v.price,
      option1: v.option1, // color / metal
      option2: v.option2, // size
      option3: v.option3,
      sku: v.sku
    }))
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
      console.log("❌ Sync error:", err.message);
    }
  }, 5000);

});
