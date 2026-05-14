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


// ===================================
// HOME
// ===================================

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});


// ===================================
// CHAT
// ===================================

app.post("/chat", async (req, res) => {

  try {

    const { message } = req.body;

    // ============================
    // GET PRODUCTS FROM SHOPIFY
    // ============================

    const shopifyResponse =
      await fetch(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/products.json?limit=50`,
        {
          headers: {
            "X-Shopify-Access-Token":
              process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
            "Content-Type":
              "application/json",
          },
        }
      );

    const shopifyData =
      await shopifyResponse.json();

    const products =
      shopifyData.products || [];


    // ============================
    // SMART SEARCH
    // ============================

    const foundProducts =
      products.filter(product => {

        const text =
          (
            product.title +
            " " +
            product.body_html
          ).toLowerCase();

        return text.includes(
          message.toLowerCase()
        );

      }).slice(0, 3);


    // ============================
    // RETURN REAL PRODUCTS
    // ============================

    if(foundProducts.length > 0){

      const result =
        foundProducts.map(product => {

          return {

            title:
              product.title,

            price:
              product.variants?.[0]?.price,

            image:
              product.images?.[0]?.src,

            link:
`https://${process.env.SHOPIFY_STORE}/products/${product.handle}`

          };

        });

      return res.json({
        products: result
      });

    }


    // ============================
    // NORMAL AI CHAT
    // ============================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        messages: [

          {
            role: "system",

            content: `
You are Alymwndw AI.

- Speak Arabic if user speaks Arabic.
- Speak English if user speaks English.
- Sound luxurious.
- Short elegant replies.
            `,
          },

          {
            role: "user",
            content: message,
          },

        ],

      });

    res.json({
      reply:
        completion.choices[0].message.content,
    });

  } catch(error){

    console.log(error);

    res.status(500).json({
      error: "Server failed"
    });

  }

});


// ===================================
// SERVER
// ===================================

const PORT =
  process.env.PORT || 10000;

app.listen(PORT, () => {

  console.log(
    `Server running on ${PORT}`
  );

});
