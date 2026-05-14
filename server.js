import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

async function getProducts() {
  try {
    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/products.json?limit=50`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    return data.products || [];
  } catch (error) {
    console.log("Shopify Error:", error);
    return [];
  }
}

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const products = await getProducts();

    const productsText = products
      .map(
        (p) => `
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

Image:
${p.images?.[0]?.src || ""}
`
      )
      .join("\n----------------------\n");

    const prompt = `
You are Alymwndw AI.

You are an elite luxury jewellery AI sales assistant.

Your personality:
- Elegant
- Luxury
- Friendly
- Smart seller
- Speak Arabic and English naturally
- Behave like ChatGPT

You understand:
- Gold
- Silver
- Platinum
- Diamonds
- Moissanite
- Gemstones
- Luxury jewellery
- Engagement rings
- Wedding jewellery

Your job:
- Recommend ONLY relevant products
- Never dump all products
- Recommend maximum 3 products
- Understand customer intent deeply
- Explain jewellery professionally
- Upsell professionally
- Keep answers short and premium
- Use product descriptions carefully

Store Products:
${productsText}

Customer Message:
${message}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply =
      completion.choices[0].message.content;

    let matchedProducts = [];

    for (const p of products) {
      const text = `
${p.title}
${p.body_html}
${p.tags}
${p.product_type}
      `.toLowerCase();

      const user = message.toLowerCase();

      if (
        text.includes(user) ||
        (user.includes("gold") && text.includes("gold")) ||
        (user.includes("silver") && text.includes("silver")) ||
        (user.includes("ring") && text.includes("ring")) ||
        (user.includes("diamond") && text.includes("diamond")) ||
        (user.includes("moissanite") &&
          text.includes("moissanite"))
      ) {
        matchedProducts.push({
          title: p.title,
          description: p.body_html,
          price: p.variants?.[0]?.price || "N/A",
          image: p.images?.[0]?.src || "",
          handle: p.handle,
          url: `https://${SHOP}/products/${p.handle}`,
        });
      }
    }

    matchedProducts = matchedProducts.slice(0, 3);

    res.json({
      reply,
      products: matchedProducts,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      reply: "AI Error",
    });
  }
});

app.listen(PORT, () => {
  console.log("ALYMWNDW AI RUNNING");
});
