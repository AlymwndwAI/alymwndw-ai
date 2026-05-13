const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const CACHE_FILE = path.join(__dirname, "products-cache.json");

// ================= FETCH ALL PRODUCTS =================
async function fetchAllProducts() {

  let allProducts = [];
  let page = 1;

  try {

    while (true) {

      const res = await axios.get(
        `https://${process.env.SHOPIFY_STORE}/products.json?limit=250&page=${page}`
      );

      const products = res.data.products;

      if (!products || products.length === 0) break;

      allProducts = allProducts.concat(products);

      console.log(`📦 Page ${page}: ${products.length}`);

      page++;
    }

    console.log(`✅ Total products: ${allProducts.length}`);

    return allProducts;

  } catch (err) {
    console.log("❌ Shopify error:", err.message);
    return [];
  }
}

// ================= SAVE CACHE =================
function saveCache(products) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(products, null, 2));
    console.log("💾 Cache saved");
  } catch (e) {
    console.log("Cache write error:", e.message);
  }
}

// ================= LOAD CACHE =================
function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return [];
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } catch (e) {
    console.log("Cache read error:", e.message);
    return [];
  }
}

// ================= SYNC PRODUCTS =================
async function syncProducts() {
  const products = await fetchAllProducts();

  if (products.length > 0) {
    saveCache(products);
  }
}

// ================= API =================
app.get("/products", (req, res) => {

  const products = loadCache();

  const formatted = products.map(p => ({
    title: p.title,
    price: p.variants?.[0]?.price,
    image: p.images?.[0]?.src,
    handle: p.handle
  }));

  res.json(formatted);
});

// ================= MANUAL SYNC =================
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.send("Sync done");
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log("🚀 Server running on", PORT);

  // safe startup (prevents Render crash)
  setTimeout(async () => {
    try {
      await syncProducts();
      console.log("💾 Initial sync done");
    } catch (err) {
      console.log("❌ Sync error:", err.message);
    }
  }, 5000);

});
