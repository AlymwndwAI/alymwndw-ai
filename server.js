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


// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});


// ===============================
// GET SHOPIFY PRODUCTS
// ===============================

app.get("/products", async (req, res) => {

  try {

    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/products.json?limit=20`,
      {
        headers: {
          "X-Shopify-Access-Token":
            process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    res.json(data.products);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Failed to fetch products",
    });

  }

});


// ===============================
// CHAT AI
// ===============================

app.post("/chat", async (req, res) => {

  try {

    const { message } = req.body;

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        messages: [

          {
            role: "system",
            content: `
You are Alymwndw AI.

You are a luxury jewelry sales assistant.

You help customers:
- recommend products
- explain moissanite
- explain diamonds
- upsell elegantly
- speak Arabic and English
- sound luxurious
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

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Chat failed",
    });

  }

});


// ===============================
// IMAGE GENERATION
// ===============================

app.post("/generate-image", async (req, res) => {

  try {

    const { prompt } = req.body;

    const image =
      await openai.images.generate({

        model: "gpt-image-1",

        prompt:
          `Luxury jewelry photography, ${prompt}, ultra realistic, black background, luxury lighting`,

        size: "1024x1024",

      });

    res.json({
      image:
        image.data[0].url,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Image generation failed",
    });

  }

});


// ===============================
// SERVER
// ===============================

const PORT =
  process.env.PORT || 10000;

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
