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

// ================= SHOPIFY =================
async function getProducts() {

  const query = `
  {
    products(first: 50) {
      edges {
        node {
          title
          images(first: 1) {
            edges { node { originalSrc } }
          }
          variants(first: 1) {
            edges { node { price } }
          }
        }
      }
    }
  }`;

  const res = await axios.post(
    `https://${process.env.SHOPIFY_STORE}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
    { query },
    {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_TOKEN,
        "Content-Type": "application/json"
      }
    }
  );

  const products = res.data.data.products.edges;

  return products.map(p => {
    const n = p.node;

    return {
      title: n.title,
      price: n.variants?.edges?.[0]?.node?.price || 0,
      image: n.images?.edges?.[0]?.node?.originalSrc || ""
    };
  });
}

// ================= CHAT API (STRUCTURED) =================
app.post("/chat", async (req, res) => {

  try {

    const message = req.body.message;

    const products = await getProducts();

    const productList = products.slice(0, 20)
      .map(p => `${p.title} | ${p.price}`)
      .join("\n");

    const ai = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد مبيعات مجوهرات فاخر.

ارجع JSON فقط بدون أي نص إضافي:

{
  "text": "رد مختصر احترافي",
  "products": [
    {
      "title": "",
      "price": "",
      "image": ""
    }
  ]
}

اختار أفضل 2 منتجات فقط من القائمة.

المنتجات:
${productList}
          `
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    let result;

    try {
      result = JSON.parse(ai.choices[0].message.content);
    } catch (e) {
      result = {
        text: ai.choices[0].message.content,
        products: []
      };
    }

    res.json(result);

  } catch (err) {

    console.log(err.message);

    res.json({
      text: "حدث خطأ",
      products: []
    });

  }

});

// ================= HOME =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= START =================
app.listen(3000, () => {
  console.log("🚀 AI Jewelry V2 Running");
});
