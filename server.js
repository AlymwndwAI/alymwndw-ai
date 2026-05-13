const express = require("express");
const axios = require("axios");
const path = require("path");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// ================= OPENAI =================
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================= CLEAN TEXT =================
function cleanText(text) {
  if (!text) return "";

  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  return [...new Set(lines)].join("\n");
}

// ================= HOME =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= SHOPIFY PRODUCTS =================
async function getProducts() {

  try {

    const query = `
    {
      products(first: 100) {
        edges {
          node {
            id
            title
            handle
            images(first: 3) {
              edges {
                node {
                  originalSrc
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
      `https://${process.env.SHOPIFY_STORE}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
      { query },
      {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    const products =
      response?.data?.data?.products?.edges || [];

    return products.map(p => {
      const n = p.node;

      return {
        id: n.id,
        title: n.title,
        handle: n.handle,
        price: n.variants?.edges?.[0]?.node?.price || 0,
        image: n.images?.edges?.[0]?.node?.originalSrc || ""
      };
    });

  } catch (err) {
    console.log("SHOPIFY ERROR:", err.message);
    return [];
  }
}

// ================= SMART FILTER =================
function smartSearch(products, msg) {

  const q = msg.toLowerCase();

  return products
    .map(p => {

      const t = (p.title || "").toLowerCase();

      let score = 0;

      if (t.includes(q)) score += 50;

      q.split(" ").forEach(w => {
        if (t.includes(w)) score += 10;
      });

      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ================= CHAT =================
app.post("/chat", async (req, res) => {

  try {

    const message = req.body.message;

    const products = await getProducts();

    const productText = products
      .slice(0, 30)
      .map(p => `- ${p.title} | ${p.price}`)
      .join("\n");

    const ai = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد مبيعات فاخر لمتجر مجوهرات.

قواعد:
- لا تكرر الجمل
- رد مرة واحدة فقط
- كن مختصر واحترافي
- لا spam
- اقترح منتج واحد أو اثنين فقط

المنتجات:
${productText}
          `
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    let reply = cleanText(ai.choices[0].message.content);

    const smart = smartSearch(products, message);

    res.json({
      reply,
      products: smart.length ? smart : products.slice(0, 5)
    });

  } catch (err) {

    console.log(err.message);

    res.json({
      reply: "حدث خطأ في السيرفر",
      products: []
    });

  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
