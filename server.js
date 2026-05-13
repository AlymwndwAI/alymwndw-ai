const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const CACHE_FILE = path.join(__dirname, "products-cache.json");

// ================= GET ALL PRODUCTS (PAGINATION) =================
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

      console.log(`📦 Page ${page}: ${products.length} products`);

      page++;
    }

    console.log(`✅ Total products fetched: ${allProducts.length}`);

    return allProducts;

  } catch (err) {
    console.log("❌ Error fetching Shopify:", err.message);
    return [];
  }
}

// ================= SAVE CACHE =================
function saveCache(products) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(products, null, 2));
  console.log("💾 Cache saved");
}

// ================= LOAD CACHE =================
function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return [];
  return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
}

// ================= SYNC =================
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

// ================= FORCE SYNC =================
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.send("Sync Done");
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  // important for Render startup
  setTimeout(async () => {
    await syncProducts();
  }, 3000);

});
