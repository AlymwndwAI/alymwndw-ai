const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const CACHE_FILE = path.join(__dirname, "products-cache.json");

// ================= GET ALL PRODUCTS FROM SHOPIFY =================
async function fetchAllProductsFromShopify() {
  let products = [];
  let page = 1;

  try {
    while (true) {
      const res = await axios.get(
        `https://${process.env.SHOPIFY_STORE}/products.json?limit=250&page=${page}`
      );

      const data = res.data.products;

      if (!data || data.length === 0) break;

      products = products.concat(data);
      page++;
    }

    console.log(`✅ Fetched ${products.length} products from Shopify`);
    return products;

  } catch (err) {
    console.log("❌ Shopify fetch error:", err.message);
    return [];
  }
}

// ================= SAVE TO CACHE =================
function saveCache(products) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(products, null, 2));
  console.log("💾 Products saved to cache");
}

// ================= LOAD FROM CACHE =================
function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return [];
  return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
}

// ================= INIT SYNC =================
async function syncProducts() {
  const products = await fetchAllProductsFromShopify();

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
  res.send("Sync done");
});

// ================= START =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("🚀 Server running on", PORT);

  // أول تشغيل يعمل sync
  await syncProducts();
});
