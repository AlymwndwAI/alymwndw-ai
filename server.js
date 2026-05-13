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

// ================= CLEAN JSON =================
function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return {
        text: text,
        products: []
      };
    }
  }
}

// ================= SHOPIFY PRODUCTS =================
async function getProducts() {

  try {

    const query = `
    {
      products(first: 50) {
        edges {
          node {
            title
            images(first: 5) {
              edges {
                node {
                  originalSrc
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

    return res.data.data.products.edges.map(p => {
      const n = p.node;

      const img =
        n.images?.edges?.[0]?.node?.originalSrc ||
        n.images?.edges?.[0]?.node?.url ||
        "";

      return {
        title: n.title,
        price: n.variants?.edges?.[0]?.node?.price || 0,
        image: img
      };
    });

  } catch (err) {
    console.log("SHOPIFY ERROR:", err.message);
    return [];
  }
}

// ================= CHAT =================
app.post("/chat", async (req, res) => {

  try {

    const message = req.body.message;

    const products = await getProducts();

    const productList = products
      .slice(0, 20)
      .map(p => `- ${p.title} | ${p.price}`)
      .join("\n");

    const ai = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد مبيعات مجوهرات فاخر.

🚨 ارجع JSON فقط:

{
  "text": "رد مختصر واحترافي",
  "products": [
    {
      "title": "",
      "price": "",
      "image": ""
    }
  ]
}

اختار أفضل 2 منتجات فقط.

لا تكتب أي شيء خارج JSON.

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

    const result = safeJSON(ai.choices[0].message.content);

    res.json(result);

  } catch (err) {
    console.log(err.message);

    res.json({
      text: "حدث خطأ في السيرفر",
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
  console.log("🚀 AI Jewelry FULL SYSTEM RUNNING");
});
