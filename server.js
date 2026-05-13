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
    console.log("❌ product error:", handle);
    return null;
  }
}

/* =========================
   FETCH ALL PRODUCTS FULL
========================= */
async function fetchAllProducts() {

  let finalProducts = [];

  const list = await getProductsList();

  console.log("📦 LIST:", list.length);

  for (let i = 0; i < list.length; i++) {

    const p = list[i];

    const full = await getFullProduct(p.handle);

    if (full) finalProducts.push(full);

    console.log(`🔄 ${i + 1}/${list.length}`);
  }

  console.log("✅ TOTAL:", finalProducts.length);

  return finalProducts;
}

/* =========================
   SYNC
========================= */
async function syncProducts() {

  const products = await fetchAllProducts();

  if (products.length > 0) {
    cache = products;
    console.log("💾 Cached:", cache.length);
  }
}

/* =========================
   API - PRODUCTS (FIX PRICE + VARIANTS)
========================= */
app.get("/products", (req, res) => {

  const formatted = cache.map(p => ({

    title: p.title,
    handle: p.handle,

    image: p.images?.[0]?.src,

    // ✅ FIXED PRICE (important)
    price: p.variants?.[0]?.price || "0",

    // FULL VARIANTS (colors/metals/sizes)
    variants: (p.variants || []).map(v => ({
      id: v.id,
      title: v.title,
      price: v.price,
      option1: v.option1,
      option2: v.option2,
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
      console.log("❌ sync error:", err.message);
    }
  }, 5000);

});
