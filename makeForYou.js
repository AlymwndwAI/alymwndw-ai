const axios = require("axios");

async function getProducts() {
  try {
    const res = await axios.get(
      "https://alymwndw.com/products.json?limit=250"
    );

    return res.data.products || [];

  } catch (err) {
    console.log("Shopify error:", err.message);
    return [];
  }
}

module.exports = { getProducts };