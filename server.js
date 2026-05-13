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

// ================= CHAT (SMART AI ENGINE) =================
app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    // ================= GET SHOPIFY PRODUCTS =================
    const shop = await axios.get(
      `https://${process.env.SHOPIFY_STORE}/products.json?limit=250`
    );

    const products = shop?.data?.products || [];

    // ================= AI UNDERSTANDING =================
    const intent = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
حلل طلب العميل إلى JSON فقط:

{
"type": "ring/necklace/bracelet/any",
"level": "cheap/mid/luxury/any",
"stone": "diamond/moissanite/gold/any"
}
          `
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    let parsed = {};

    try {
      parsed = JSON.parse(intent.choices[0].message.content);
    } catch {
      parsed = {};
    }

    // ================= SMART FILTER =================
    const filtered = products.filter(p => {

      const title = (p.title || "").toLowerCase();

      const typeMatch = !parsed.type || parsed.type === "any" || title.includes(parsed.type);
      const stoneMatch = !parsed.stone || parsed.stone === "any" || title.includes(parsed.stone);

      return typeMatch && stoneMatch;
    });

    const finalProducts = filtered.length ? filtered : products.slice(0, 5);

    // ================= AI SELLER RESPONSE =================
    const productText = finalProducts.slice(0, 10).map(p =>
      `- ${p.title} | ${p.variants?.[0]?.price || 0}`
    ).join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت خبير مبيعات مجوهرات فاخر.

- اختر أفضل المنتجات فقط
- اقنع العميل
- تحدث كبائع محترف

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
    const formattedProducts = finalProducts.slice(0, 5).map(p => {

      let img =
        p.images?.[0]?.src ||
        p.image?.src ||
        "";

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
