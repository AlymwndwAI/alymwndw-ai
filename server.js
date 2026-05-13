const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   CACHE
========================= */
let cache = [];

/* =========================
   SLEEP (safe requests)
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
   SMART DETECTION ENGINE
========================= */

function detectFromOptions(options, keywords) {
  if (!options) return [];

  const opt = options.find(o =>
    keywords.some(k =>
      (o.name || "").toLowerCase().includes(k)
    )
  );

  return opt?.values || [];
}

function guessFromTitle(text, keywords) {
  text = (text || "").toLowerCase();
  return keywords.find(k => text.includes(k)) || "unknown";
}

function guessSize(text) {
  const match = text?.match(/\d+/);
  return match ? match[0] : "N/A";
}

/* =========================
   PRODUCTS API (SMART AI STRUCTURE)
========================= */
app.get("/products", (req, res) => {

  if (!cache || cache.length === 0) {
    return res.json({ error: "No products - run /sync" });
  }

  const formatted = cache.map(p => {

    const v = p.variants?.[0];
    const price = parseFloat(v?.price || 0);

    const options = p.options || [];

    return {
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || "",

      // 💎 base price
      price: `${price.toFixed(2)} AED`,

      // 🧠 SMART ATTRIBUTES (AI STRUCTURE)
      attributes: {
        metals: detectFromOptions(options, ["metal", "material", "gold", "silver", "platinum"]),
        stones: detectFromOptions(options, ["stone", "diamond", "moissanite", "gem"]),
        sizes: detectFromOptions(options, ["size", "ring"])
      },

      // 💎 SMART VARIANTS
      variants: (p.variants || []).map(v => {

        const title = (v.title || "").toLowerCase();

        return {
          id: v.id,
          title: v.title,
          price: `${parseFloat(v.price || 0).toFixed(2)} AED`,

          // 🧠 intelligent guess (not fixed mapping)
          metal: guessFromTitle(title, ["gold", "silver", "platinum"]),
          stone: guessFromTitle(title, ["diamond", "moissanite", "ruby", "emerald"]),
          size: guessSize(v.title)
        };
      })
    };
  });

  res.json(formatted);
});

/* =========================
   SYNC ENDPOINT
========================= */
app.get("/sync", async (req, res) => {

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
  res.send("🚀 Smart AI Jewelry Store Running");
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
