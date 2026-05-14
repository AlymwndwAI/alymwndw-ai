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


// =======================================
// HOME
// =======================================

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});


// =======================================
// CHAT
// =======================================

app.post("/chat", async (req, res) => {

  try {

    const { message } = req.body;

    // ===================================
    // GET SHOPIFY PRODUCTS
    // ===================================

    let products = [];

    try {

      const shopifyResponse =
        await fetch(
          `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/products.json?limit=100`,
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

      products =
        shopifyData.products || [];

      console.log(products);

    } catch (err) {

      console.log("SHOPIFY ERROR");
      console.log(err);

    }


    // ===================================
    // SMART PRODUCT SEARCH
    // ===================================

    const foundProducts =
      products.filter(product => {

        const text =
          (
            product.title +
            " " +
            product.body_html +
            " " +
            product.tags
          ).toLowerCase();

        return text.includes(
          message.toLowerCase()
        );

      }).slice(0, 4);


    // ===================================
    // RETURN PRODUCTS
    // ===================================

    if(foundProducts.length > 0){

      const result =
        foundProducts.map(product => {

          return {

            title:
              product.title,

            description:
              product.body_html
                .replace(/<[^>]*>?/gm, '')
                .slice(0, 120),

            price:
              product.variants?.[0]?.price || "0",

            image:
              product.images?.[0]?.src ||

"https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",

            link:
`https://${process.env.SHOPIFY_STORE}/products/${product.handle}`

          };

        });

      return res.json({
        products: result
      });

    }


    // ===================================
    // OPENAI LUXURY CHAT
    // ===================================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        messages: [

          {
            role: "system",

            content: `
You are Alymwndw AI.

You are luxury jewelry sales AI.

Rules:
- Arabic if user speaks Arabic.
- English if user speaks English.
- Elegant luxury tone.
- Short replies.
- Help user choose products.
- Recommend rings, necklaces, bracelets.
- Mention moissanite, gold, silver, lab diamonds.
- Try to upsell elegantly.
            `
          },

          {
            role: "user",
            content: message,
          },

        ],

      });

    res.json({
      reply:
        completion.choices[0].message.content
    });

  } catch(error){

    console.log(error);

    res.status(500).json({
      error: "Server Error"
    });

  }

});


// =======================================
// SERVER
// =======================================

const PORT =
  process.env.PORT || 10000;

app.listen(PORT, () => {

  console.log(
    `Server Running On ${PORT}`
  );

});
