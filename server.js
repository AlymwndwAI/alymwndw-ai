const express = require("express");
const axios = require("axios");
const path = require("path");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= GET PRODUCTS (GRAPHQL) =================
async function getProducts() {

  const query = `
  {
    products(first: 100) {
      edges {
        node {
          title
          images(first: 1) {
            edges {
              node {
                url
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
        }
      }
    }
  }`;

  const response = await axios.post(
    `https://${process.env.SHOPIFY_STORE}/admin/api/2024-04/graphql.json`,
    { query },
    {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json"
      }
    }
  );

  const products = response?.data?.data?.products?.edges || [];

  return products.map(p => {

    const node = p.node;

    const image =
      node.images?.edges?.[0]?.node?.url || "";

    const price =
      node.variants?.edges?.[0]?.node?.price || 0;

    return {
      title: node.title,
      price,
      image
    };
  });
}

// ================= CHAT =================
app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    // ================= PRODUCTS =================
    const products = await getProducts();

    // ================= AI RESPONSE =================
    const productText = products.slice(0, 10).map(p =>
      `- ${p.title} | ${p.price}`
    ).join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد مبيعات لمتجر مجوهرات فاخر.

- اختر أفضل المنتجات
- كن مقنع
- ساعد العميل يشتري

المنتجات:
${productText}
          `
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    // ================= FORMAT RESPONSE =================
    const finalProducts = products.slice(0, 5);

    res.json({
      reply: response.choices[0].message.content,
      products: finalProducts
    });

  } catch (err) {

    console.log(err.message);

    res.json({
      reply: "💎 حصل خطأ لكن السيرفر شغال",
      products: []
    });

  }

});

// ================= START =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 GraphQL Server running on port", PORT);
});
