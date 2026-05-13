const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const CACHE_FILE = path.join(__dirname, "products-cache.json");

// ================= FETCH SHOPIFY =================
async function fetchProducts() {
  try {
    const res = await axios.get(
      `https://${process.env.SHOPIFY_STORE}/products.json?limit=250`
    );

    return res.data.products || [];
  } catch (err) {
    console.log("❌ Shopify error:", err.message);
    return [];
  }
}

// ================= SAVE CACHE =================
function saveCache(products) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(products, null, 2));
}

// ================= LOAD CACHE =================
function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return [];
  return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
}

// ================= SYNC =================
async function syncProducts() {
  const products = await fetchProducts();

  if (products.length > 0) {
    saveCache(products);
    console.log("💾 Cached:", products.length);
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

// manual sync
app.get("/sync", async (req, res) => {
  await syncProducts();
  res.send("Sync Done");
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= START =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("🚀 Server running on", PORT);

  // important for Render
  setTimeout(async () => {
    await syncProducts();
  }, 3000);
});
