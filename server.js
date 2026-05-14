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
    `https://${SHOP}/admin/api/2025-01/products.json?limit=20`,
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
      description: p.body_html,
      price: p.variants?.[0]?.price,
      image: p.images?.[0]?.src || "",
      handle: p.handle,
    }));

    const prompt = `
You are Alymwndw Jewellery AI.

You are a luxury jewellery sales expert.

You understand:
- Gold
- Silver
- Platinum
- Diamonds
- Moissanite
- Luxury jewelry

Your job:
- Recommend products smartly
- Upsell products
- Understand customer budget
- Explain jewelry professionally
- Explain gemstones professionally
- Sell like an expert luxury jewelry seller

Store products:
${JSON.stringify(formattedProducts)}

Customer message:
${message}

Always answer professionally.
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

    res.json({
      reply: completion.choices[0].message.content,
      products: formattedProducts,
    });

  } catch (error) {

    console.log(error);

    res.json({
      reply: "AI Error",
    });

  }

});

app.listen(PORT, () => {
  console.log("ALYMWNDW AI RUNNING");
});
