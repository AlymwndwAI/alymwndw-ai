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

    const products = response.data.products;

    for (const product of products) {
      try {
        const metafields = await axios.get(
          `https://${SHOP}/admin/api/2024-04/products/${product.id}/metafields.json`,
          {
            headers: {
              "X-Shopify-Access-Token": TOKEN,
              "Content-Type": "application/json",
            },
          }
        );

        product.metafields = metafields.data.metafields || [];
      } catch (err) {
        product.metafields = [];
      }
    }

    return products;
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
      .map(
        (p) => `
Title:
${p.title}

Description:
${p.body_html}

Price:
${p.variants?.[0]?.price || "N/A"} AED

Tags:
${p.tags}

Product Type:
${p.product_type}

Vendor:
${p.vendor}

Handle:
${p.handle}

Images:
${p.images?.map((img) => img.src).join(", ")}

Reviews:
${p.metafields
  ?.map((m) => `${m.namespace} - ${m.key}: ${m.value}`)
  .join("\n")}

`
      )
      .join("\n====================\n");

    const prompt = `
You are Alymwndw AI.

You are NOT a basic chatbot.

You are a luxury jewellery AI sales expert working for Alymwndw Jewellery.

Your personality:
- Elegant
- Luxury
- Smart seller
- Friendly
- Speaks naturally like ChatGPT
- Understands Arabic and English perfectly
- Upselling expert

Your job:
- Understand customer intent deeply
- Recommend ONLY relevant products
- Never show random products
- Recommend maximum 3 products
- Read full product descriptions
- Understand gemstones, gold, silver, platinum, diamonds, moissanite
- Understand colors and styles
- Read reviews and metadata
- Help customer buy
- Speak naturally and shortly
- Focus on conversion and sales

VERY IMPORTANT:
- If customer asks for red gemstone:
search carefully in descriptions and tags

- If product doesn't exist:
recommend closest luxury alternative

- Never say:
"I don't know"

- Never dump all products

- Always behave like premium ChatGPT assistant

STORE PRODUCTS:
${productsText}

CUSTOMER MESSAGE:
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
      max_tokens: 700,
    });

    const aiReply = completion.choices[0].message.content;

    let matchedProducts = [];

    for (const product of products) {
      const text = `
${product.title}
${product.body_html}
${product.tags}
${product.product_type}
`
        .toLowerCase();

      const user = userMessage.toLowerCase();

      if (
        text.includes(user) ||
        user.includes(product.title.toLowerCase()) ||
        text.includes("moissanite") && user.includes("moissanite") ||
        text.includes("gold") && user.includes("gold") ||
        text.includes("silver") && user.includes("silver") ||
        text.includes("diamond") && user.includes("diamond") ||
        text.includes("ring") && user.includes("ring") ||
        text.includes("necklace") && user.includes("necklace") ||
        text.includes("earring") && user.includes("earring")
      ) {
        matchedProducts.push(product);
      }
    }

    matchedProducts = matchedProducts.slice(0, 3);

    res.json({
      reply: aiReply,
      products: matchedProducts.map((p) => ({
        title: p.title,
        description: p.body_html,
        price: p.variants?.[0]?.price || "N/A",
        image: p.images?.[0]?.src || "",
        handle: p.handle,
        url: `https://${SHOP}/products/${p.handle}`,
      })),
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      reply: "Server error",
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
