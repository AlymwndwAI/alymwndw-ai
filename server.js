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
   SLEEP
========================= */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* =========================
   FETCH ALL PRODUCTS (STABLE)
========================= */
async function fetchAllProducts() {

  let all = [];
  let page = 1;

  try {

    while (true) {

      const url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250&page=${page}`;

      let res;

      // retry system (429 / 503)
      for (let i = 0; i < 5; i++) {
        try {
          res = await axios.get(url, { timeout: 15000 });
          break;
        } catch (err) {

          const status = err.response?.status;

          if (status === 429 || status === 503) {
            console.log(`⛔ Shopify busy (${status}) retrying...`);
            await sleep(3000);
          } else {
            throw err;
          }
        }
      }

      const products = res?.data?.products || [];

      if (!products.length) break;

      all = all.concat(products);

      console.log(`📦 Page ${page} | Got: ${products.length} | Total: ${all.length}`);

      page++;

      await sleep(800);
    }

    console.log("✅ FINAL PRODUCTS:", all.length);

    return all;

  } catch (err) {
    console.log("❌ Fatal error:", err.message);
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
   REAL REVIEWS (Judge.me)
========================= */
async function getReviews(handle) {

  try {

    const url = `https://judge.me/api/v1/reviews?shop_domain=${process.env.SHOPIFY_STORE}&product_handle=${handle}`;

    const res = await axios.get(url, { timeout: 10000 });

    const reviews = res?.data?.reviews || [];

    return reviews.map(r => ({
      name: r.reviewer_name,
      rating: r.rating,
      text: r.body
    }));

  } catch (err) {
    return []; // مهم: ما نكسرش الموقع
  }
}

/* =========================
   PRODUCTS API (FULL DATA)
========================= */
app.get("/products", async (req, res) => {

  if (!cache || cache.length === 0) {
    return res.json({ error: "No products - run /sync" });
  }

  const formatted = [];

  for (let p of cache) {

    const v = p.variants?.[0];
    const price = parseFloat(v?.price || 0);

    // 🧠 REAL SHOPIFY OPTIONS
    const options = p.options || [];

    const detect = (keywords) => {
      const opt = options.find(o =>
        keywords.some(k =>
          (o.name || "").toLowerCase().includes(k)
        )
      );
      return opt?.values || [];
    };

    // 💎 REVIEWS FROM SHOPIFY APP (if exists)
    const reviews = await getReviews(p.handle);

    formatted.push({
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || "",

      price: `${price.toFixed(2)} AED`,

      // 💎 VARIANTS FULL
      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,
        price: `${parseFloat(v.price || 0).toFixed(2)} AED`,
        option1: v.option1,
        option2: v.option2,
        option3: v.option3
      })),

      // 💎 REAL OPTIONS
      attributes: {
        metals: detect(["metal", "gold", "silver", "platinum"]),
        stones: detect(["stone", "diamond", "moissanite", "gem"]),
        sizes: detect(["size", "ring"])
      },

      // ⭐ REAL REVIEWS (Shopify App)
      reviews: reviews,
      rating: reviews.length
        ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)
        : 0
    });
  }

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
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.send("🚀 AI Jewelry Store FULL SYSTEM RUNNING");
});

/* =========================
   AUTO SYNC
========================= */
setInterval(async () => {
  console.log("🔄 Auto sync...");
  await syncProducts();
}, 1000 * 60 * 15);

/* =========================
   START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log("🚀 Server running on", PORT);

  setTimeout(async () => {
    await syncProducts();
  }, 5000);

});
