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

// ================= PAGE =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= CHAT =================
app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    // 🛍️ Shopify products (زودنا العدد)
    const shop = await axios.get(
      `https://${process.env.SHOPIFY_STORE}/products.json?limit=50`
    );

    const products = shop.data.products || [];

    // 🧠 نعرض AI جزء مفيد فقط
    const productText = products.slice(0, 10).map(p =>
      `- ${p.title} | ${p.variants?.[0]?.price || 0} AED`
    ).join("\n");

    // 🧠 AI
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد ذكي لمتجر مجوهرات فاخر.

وظيفتك:
- تفهم العميل
- تقترح منتجات من المتجر
- تتكلم كبائع محترف
- تساعد في اختيار التصميم

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

    res.json({
      reply: response.choices[0].message.content,
      products: products.slice(0, 5).map(p => ({
        title: p.title,
        price: p.variants?.[0]?.price || 0,
        image: p.images?.[0]?.src || ""
      }))
    });

  } catch (err) {

    console.log("ERROR:", err.message);

    res.json({
      reply: "💎 حصل خطأ لكن السيرفر شغال",
      products: []
    });

  }

});

// ================= START (IMPORTANT FOR RENDER) =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Running on port", PORT);
});