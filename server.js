const express = require("express");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// ================= GET PRODUCTS =================
async function getProducts() {
  try {
    const url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=50`;

    const res = await axios.get(url);

    return (res.data.products || []).map(p => ({
      title: p.title,
      price: p.variants?.[0]?.price,
      image: p.images?.[0]?.src,
      handle: p.handle
    }));

  } catch (err) {
    console.log("ERROR:", err.message);
    return [];
  }
}

// ================= API =================
app.get("/products", async (req, res) => {
  const products = await getProducts();
  res.json(products);
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= START =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});
