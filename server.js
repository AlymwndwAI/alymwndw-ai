import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// ====================================
// HOME
// ====================================

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});


// ====================================
// CHAT
// ====================================

app.post("/chat", async (req, res) => {

  try {

    const { message } = req.body;

    // =========================
    // GET SHOPIFY PRODUCTS
    // =========================

    const productsResponse =
      await fetch(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/products.json?limit=40`,
        {
          headers: {
            "X-Shopify-Access-Token":
              process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
            "Content-Type":
              "application/json",
          },
        }
      );

    const productsData =
      await productsResponse.json();

    const products =
      productsData.products || [];

    // =========================
    // PRODUCTS TEXT
    // =========================

    const catalog =
      products.map(product => {

        return `
PRODUCT:
Title: ${product.title}

Price:
${product.variants?.[0]?.price}

Description:
${product.body_html}

Image:
${product.images?.[0]?.src}

Link:
https://${process.env.SHOPIFY_STORE}/products/${product.handle}
        `;

      }).join("\n\n");


    // =========================
    // OPENAI
    // =========================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        messages: [

          {
            role: "system",

            content: `

You are Alymwndw AI.

You are a luxury jewelry sales assistant.

RULES:

- Speak Arabic if customer speaks Arabic.
- Speak English if customer speaks English.

- ONLY recommend products from the catalog below.
- Do NOT invent products.
- Recommend only 1-3 products maximum.
- Sound luxurious and premium.
- Explain jewelry elegantly.
- If customer dislikes a product:
  suggest alternatives.
- If customer asks for another color/material:
  suggest similar products.
- Always include:
  product name,
  price,
  image,
  product link.

CATALOG:

${catalog}

            `,
          },

          {
            role: "user",
            content: message,
          },

        ],
      });

    const reply =
      completion.choices[0].message.content;

    res.json({
      reply,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "AI failed",
    });

  }

});


// ====================================
// SERVER
// ====================================

const PORT =
  process.env.PORT || 10000;

app.listen(PORT, () => {

  console.log(
    `Server running on ${PORT}`
  );

});
