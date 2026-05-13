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

    return {
      title: node.title,
      price: node.variants?.edges?.[0]?.node?.price || 0,
      image: node.images?.edges?.[0]?.node?.url || ""
    };
  });
}

// ================= CHAT =================
app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    // ================= LOAD PRODUCTS =================
    const products = await getProducts();

    const productText = products.slice(0, 20).map(p =>
      `- ${p.title} | ${p.price}`
    ).join("\n");

    // ================= AI =================
    const ai = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد مبيعات لمتجر مجوهرات فاخر.

مهمتك:
- فهم طلب العميل
- اختيار المنتجات المناسبة فقط
- لو مفيش تطابق قول مفيش منتجات
- بيع بطريقة احترافية

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

    const reply = ai.choices[0].message.content;

    // ================= SMART FILTER =================
    const matchedProducts = products.filter(p => {

      const text = userMessage.toLowerCase();
      const title = (p.title || "").toLowerCase();

      return title.includes(text.split(" ")[0]);
    });

    // ================= RESPONSE =================
    res.json({
      reply,
      products: matchedProducts.length
        ? matchedProducts.slice(0, 5)
        : products.slice(0, 5)
    });

  } catch (err) {

    console.log("ERROR:", err.message);

    res.json({
      reply: "💎 حصل خطأ لكن السيرفر شغال",
      products: []
    });

  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
