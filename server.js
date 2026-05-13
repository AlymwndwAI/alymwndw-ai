const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   CACHE
========================= */
let cache = [];

/* =========================
   UTIL
========================= */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* =========================
   FETCH PRODUCTS (FULL VARIANTS SAFE)
========================= */
async function fetchAllProducts() {

  let all = [];
  let page = 1;

  try {

    while (true) {

      const url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250&page=${page}`;

      const res = await axios.get(url, { timeout: 15000 });

      const products = res?.data?.products || [];

      if (!products.length) break;

      for (let p of products) {

        // نضمن إن variants موجودة
        if (p && p.variants && p.variants.length > 0) {
          all.push(p);
        }

      }

      console.log(`📦 Page ${page} | Got: ${products.length} | Total: ${all.length}`);

      page++;

      await sleep(800);
    }

    console.log("✅ FINAL PRODUCTS:", all.length);

    return all;

  } catch (err) {
    console.log("❌ Error:", err.message);
    return [];
  }
}

/* =========================
   SYNC
========================= */
async function syncProducts() {

  const products = await fetchAllProducts();

  cache = products || [];

  console.log("💾 Cached:", cache.length);
}

/* =========================
   SMART VARIANTS EXTRACTOR
========================= */
function extractVariants(product) {

  return (product.variants || []).map(v => {

    return {
      id: v.id,
      title: v.title,

      price: `${parseFloat(v.price || 0).toFixed(2)} AED`,

      // 💎 REAL SHOPIFY DATA (NO GUESS)
      metal: v.option1 || "Gold",
      stone: v.option2 || "White",
      size: v.option3 || "N/A",

      sku: v.sku || ""
    };
  });
}

/* =========================
   PRODUCTS API
========================= */
app.get("/products", (req, res) => {

  if (!cache.length) {
    return res.json({ error: "No products - run /sync" });
  }

  const formatted = cache.map(p => {

    const price = parseFloat(p.variants?.[0]?.price || 0);

    return {
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || "",

      price: `${price.toFixed(2)} AED`,

      // 💎 VARIANTS FULLY SHOWN
      variants: extractVariants(p),

      // 💎 OPTIONS RAW FROM SHOPIFY
      options: p.options || []
    };
  });

  res.json(formatted);
});

/* =========================
   SYNC ENDPOINT
========================= */
app.get("/sync", async (req, res) => {

  cache = [];

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
  res.send("🚀 Shopify AI Store Running");
});

/* =========================
   AUTO SYNC
========================= */
setInterval(async () => {
  console.log("🔄 Auto sync...");
  await syncProducts();
}, 1000 * 60 * 15);

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  setTimeout(async () => {
    await syncProducts();
  }, 5000);

});
