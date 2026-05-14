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
}

app.post("/chat", async (req, res) => {

  try {

    const { message } = req.body;

    const products = await getProducts();

    const formattedProducts = products.map((p) => ({

      title: p.title,

      description: p.body_html
        ?.replace(/<[^>]*>/g, "")
        ?.substring(0, 300),

      price: p.variants?.[0]?.price,

      image: p.images?.[0]?.src || "",

      handle: p.handle,

    }));

    const prompt = `
You are Alymwndw Jewellery AI.

You are a luxury jewelry sales expert.

You specialize in:
- Gold
- Silver
- Platinum
- Diamonds
- Moissanite
- Engagement rings
- Luxury jewelry

Your personality:
- Elegant
- Professional
- Smart luxury seller
- Helpful
- Upselling expert

Your job:
- Recommend products based on customer request
- Understand budget
- Explain jewelry materials
- Explain gemstones
- Recommend ONLY the most relevant products
- Upsell luxury pieces
- Speak naturally
- Speak Arabic if customer speaks Arabic
- Keep answers elegant and not too long

Store products:
${JSON.stringify(formattedProducts)}

Customer message:
${message}

VERY IMPORTANT:
Mention exact product names when recommending products.
`;

    const completion = await openai.chat.completions.create({

      model: "gpt-4.1-mini",

      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],

    });

    const aiReply = completion.choices[0].message.content;

    const selectedProducts = formattedProducts.filter(product => {

      return aiReply
        .toLowerCase()
        .includes(product.title.toLowerCase().substring(0, 15));

    }).slice(0, 3);

    res.json({

      reply: aiReply,

      products: selectedProducts.length
        ? selectedProducts
        : formattedProducts.slice(0, 3),

    });

  } catch (error) {

    console.log(error);

    res.json({
      reply: "AI Error",
      products: [],
    });

  }

});

app.listen(PORT, () => {

  console.log("ALYMWNDW AI RUNNING");

});
