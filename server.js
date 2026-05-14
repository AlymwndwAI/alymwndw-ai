const express = require("express");
const cors = require("cors");
const axios = require("axios");
const OpenAI = require("openai");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

async function getProducts() {
  try {
    const response = await axios.get(
      `https://${SHOP}/admin/api/2024-04/products.json?limit=50`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.products || [];
  } catch (error) {
    console.log("Shopify Error:", error.message);
    return [];
  }
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const products = await getProducts();

    const productsText = products
      .map((p) => {
        return `
Title: ${p.title}

Description:
${p.body_html}

Price:
${p.variants?.[0]?.price || "N/A"} AED

Tags:
${p.tags}

Type:
${p.product_type}

Handle:
${p.handle}
`;
      })
      .join("\n------------------\n");

    const prompt = `
You are Alymwndw AI.

You are a luxury jewellery AI sales assistant.

Your personality:
- Elegant
- Smart
- Luxury sales expert
- Friendly
- Speak Arabic and English naturally

Your job:
- Recommend ONLY relevant products
- Understand jewellery deeply
- Understand gemstones and materials
- Read full descriptions carefully
- Never show random products
- Recommend maximum 3 products
- Behave like ChatGPT

Products:
${productsText}

Customer:
${userMessage}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const aiReply = completion.choices[0].message.content;

    let matchedProducts = [];

    for (const p of products) {
      const text = `
${p.title}
${p.body_html}
${p.tags}
${p.product_type}
      `.toLowerCase();

      const user = userMessage.toLowerCase();

      if (
        text.includes(user) ||
        (user.includes("gold") && text.includes("gold")) ||
        (user.includes("silver") && text.includes("silver")) ||
        (user.includes("ring") && text.includes("ring")) ||
        (user.includes("moissanite") && text.includes("moissanite")) ||
        (user.includes("diamond") && text.includes("diamond"))
      ) {
        matchedProducts.push(p);
      }
    }

    matchedProducts = matchedProducts.slice(0, 3);

    res.json({
      reply: aiReply,

      products: matchedProducts.map((p) => ({
        title: p.title,
        price: p.variants?.[0]?.price || "N/A",
        image: p.images?.[0]?.src || "",
        url: `https://${SHOP}/products/${p.handle}`,
      })),
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      reply: "Server Error",
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
