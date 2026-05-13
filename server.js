const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

// ⚠️ لازم يكون كده:
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; 
// مثال: your-store.myshopify.com

let cache = [];

function log(msg){
  console.log("👉", msg);
}

async function syncProducts() {

  try {

    if (!SHOPIFY_STORE) {
      throw new Error("SHOPIFY_STORE is EMPTY in ENV");
    }

    let all = [];
    let page = 1;

    while (true) {

      const url =
        `https://${SHOPIFY_STORE}/products.json?limit=250&page=${page}`;

      log("Fetching page " + page);

      const res = await axios.get(url, { timeout: 20000 });

      const products = res.data.products;

      if (!products || products.length === 0) break;

      all.push(...products);

      page++;
    }

    cache = all;

    console.log("✅ FINAL PRODUCTS:", cache.length);

  } catch (err) {
    console.log("❌ SYNC ERROR:", err.response?.data || err.message);
  }
}

app.get("/products", (req, res) => {

  if (!cache.length) {
    return res.json({
      error: "No cached products",
      hint: "Check /sync or SHOPIFY_STORE"
    });
  }

  res.json(cache.map(p => ({
    title: p.title,
    image: p.images?.[0]?.src || "",
    variants: p.variants?.map(v => ({
      price: v.price,
      title: v.title
    }))
  })));
});

app.get("/sync", async (req, res) => {
  await syncProducts();
  res.json({ ok: true, total: cache.length });
});

app.get("/", (req, res) => {
  res.send("OK");
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
  syncProducts();
});
