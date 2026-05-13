const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

/* =========================
   MEMORY CACHE
========================= */
let cache = [];

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.send("🚀 AI Store Running (Webhook Mode)");
});

/* =========================
   GET PRODUCTS (FAST)
========================= */
app.get("/products", (req, res) => {
  res.json({
    success: true,
    count: cache.length,
    products: cache,
  });
});

/* =========================
   SHOPIFY WEBHOOK RECEIVER
========================= */
app.post("/webhook/product-created", (req, res) => {
  const product = req.body;

  console.log("🟢 Product Created:", product.title);

  cache.push(formatProduct(product));

  res.sendStatus(200);
});

app.post("/webhook/product-updated", (req, res) => {
  const product = req.body;

  console.log("🟡 Product Updated:", product.title);

  const formatted = formatProduct(product);

  const index = cache.findIndex((p) => p.id === formatted.id);

  if (index !== -1) {
    cache[index] = formatted;
  } else {
    cache.push(formatted);
  }

  res.sendStatus(200);
});

/* =========================
   FORMAT PRODUCT
========================= */
function formatProduct(p) {
  return {
    id: p.id,
    title: p.title,
    image: p.images?.[0]?.src || "",
    variants: (p.variants || []).map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      metal: v.option1 || null,
      stone: v.option2 || null,
      size: v.option3 || null,
    })),
  };
}

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port:", PORT);
});
