const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

/* =======================
   MEMORY CACHE (بدون ملفات)
======================= */
let cache = [];

/* =======================
   FETCH ALL PRODUCTS
======================= */
async function fetchAllProducts() {
  try {
    const url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250`;

    const res = await axios.get(url);

    return res.data.products || [];

  } catch (err) {
    console.log("❌ Shopify error:", err.message);
    return [];
  }
}

/* =======================
   SYNC PRODUCTS
======================= */
async function syncProducts() {
  const products = await fetchAllProducts();

  if (products.length > 0) {
    cache = products;
    console.log("💾 Cached products:", cache.length);
  } else {
    console.log("⚠️ No products fetched");
  }
}

/* =======================
   API - PRODUCTS
======================= */
app.get("/products", (req, res) => {

  const formatted = cache.map(p => ({
    title: p.title,
    price: p.variants?.[0]?.price,
    image: p.images?.[0]?.src,
    handle: p.handle
  }));

  res.json(formatted);
});

/* =======================
   MANUAL SYNC
======================= */
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.send({
    success: true,
    count: cache.length
  });
});

/* =======================
   HOME PAGE
======================= */
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("🚀 Server running on", PORT);

  // auto sync بعد التشغيل
  setTimeout(async () => {
    await syncProducts();
  }, 5000);
});
