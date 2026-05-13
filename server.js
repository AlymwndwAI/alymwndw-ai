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

// ================= CHAT =================
app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    // ================= SHOPIFY =================
    const shop = await axios.get(
      `https://${process.env.SHOPIFY_STORE}/products.json?limit=50`
    );

    const products = shop?.data?.products || [];

    // ================= AI CONTEXT =================
    const productText = products.slice(0, 10).map(p =>
      `- ${p.title} | ${p.variants?.[0]?.price || 0}`
    ).join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد ذكي لمتجر مجوهرات فاخر.

- تفهم العميل
- تقترح منتجات
- تتكلم كبائع محترف

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

    // ================= FIX IMAGES =================
    const formattedProducts = products.slice(0, 5).map(p => {

      let img = "";

      if (p.images && p.images.length > 0) {
        img = p.images[0].src;
      } else if (p.image && p.image.src) {
        img = p.image.src;
      }

      return {
        title: p.title,
        price: p.variants?.[0]?.price || 0,
        image: img ? (img.startsWith("//") ? `https:${img}` : img) : ""
      };
    });

    res.json({
      reply: response.choices[0].message.content,
      products: formattedProducts
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
  console.log("🚀 Server running on port", PORT);
});
