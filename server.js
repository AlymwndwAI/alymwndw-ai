const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const COLLECTION = process.env.COLLECTION_HANDLE;

// ================= GET COLLECTION PRODUCTS =================
async function getCollectionProducts() {
  const url = `https://${process.env.SHOPIFY_STORE}/products.json?limit=250`;

  const res = await axios.get(url);

  const products = res.data.products || [];

  return products
    .filter(p => p.handle.includes(COLLECTION.split("-")[0])) // filter simple
    .map(p => ({
      title: p.title,
      price: p.variants?.[0]?.price,
      image: p.images?.[0]?.src,
      link: `https://${process.env.SHOPIFY_STORE}/products/${p.handle}`
    }));
}

// ================= API =================
app.get("/products", async (req, res) => {
  const data = await getCollectionProducts();
  res.json(data);
});

// ================= START =================
app.listen(3000, () => console.log("Server running"));
