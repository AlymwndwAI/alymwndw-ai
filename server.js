const express = require("express");
const cors = require("cors");
const axios = require("axios");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

async function getProducts() {

  const response = await axios.get(
    `https://${SHOP}/admin/api/2024-04/products.json?limit=50`,
    {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
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
          },
        }
      );

      product.metafields = metafields.data.metafields;

    } catch (err) {

      product.metafields = [];

    }

  }

  return products;

}

app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;

    const products = await getProducts();

    const productsText = products.map((p) => {

      const reviews = p.metafields
        .map((m) => `${m.namespace} ${m.key}: ${m.value}`)
        .join("\n");

      return `

PRODUCT:

Title:
${p.title}

Description:
${p.body_html.replace(/<[^>]*>?/gm, "")}

Product Type:
${p.product_type}

Tags:
${p.tags}

Price:
${p.variants[0]?.price} AED

Vendor:
${p.vendor}

Images:
${p.images.map((i) => i.src).join(", ")}

Customer Reviews:
${reviews}

Luxury Analysis:

This product may include:
gold,
silver,
platinum,
diamond,
moissanite,
luxury gemstones,
engagement style,
premium jewelry,
fashion jewelry,
custom jewelry.

Handle:
${p.handle}

-----------------------------------

`;

    }).join("\n");

    const prompt = `

You are Alymwndw Jewellery AI.

You are an elite luxury jewellery expert and AI sales assistant.

You deeply understand:

- Gold
- Silver
- Platinum
- Diamonds
- Moissanite
- Gemstones
- Luxury fashion
- Jewelry trends
- Engagement rings
- Wedding jewelry
- High-end jewelry styling

You help customers choose products based on:

- budget
- luxury level
- materials
- gemstones
- color
- relationship occasion
- elegance
- fashion style
- minimal or luxury design

You must act like a professional luxury jewellery consultant.

You intelligently understand all products inside the Shopify store.

You also analyze customer reviews and use them
to recommend the best products based on customer satisfaction,
luxury feel,
quality,
beauty,
elegance,
and popularity.

You ONLY recommend products if relevant.

If no exact match exists:
suggest the closest luxury alternatives.

Always sound premium and elegant.

Speak naturally in Arabic or English based on the customer language.

STORE DATA:

${productsText}

USER MESSAGE:
${userMessage}

`;

    const completion = await openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],

      temperature: 0.7,

    });

    const aiReply =
      completion.choices[0].message.content;

    const lower =
      userMessage.toLowerCase();

    let matchedProducts = [];

    const shouldRecommendWords = [

      "ring",
      "rings",
      "necklace",
      "bracelet",
      "earring",
      "diamond",
      "moissanite",
      "gold",
      "silver",
      "platinum",
      "ruby",
      "emerald",
      "luxury",

      "خاتم",
      "خواتم",
      "قلادة",
      "اسورة",
      "حلق",
      "ألماس",
      "مويسانيت",
      "ذهب",
      "فضة",
      "بلاتين",
      "ياقوت",
      "زمرد",
      "احمر",
      "أحمر",
      "ازرق",
      "أزرق",
      "اخضر",
      "أخضر",
      "مجوهرات"

    ];

    const shouldRecommend =
      shouldRecommendWords.some((word) =>
        lower.includes(word)
      );

    if (shouldRecommend) {

      matchedProducts = products
        .filter((p) => {

          const text = `
${p.title}
${p.body_html}
${p.tags}
${p.product_type}
`
            .toLowerCase();

          return lower
            .split(" ")
            .some((word) => text.includes(word));

        })
        .slice(0, 3)
        .map((p) => ({

          title: p.title,

          price: p.variants[0]?.price,

          image: p.images[0]?.src,

          handle: p.handle,

        }));

    }

    res.json({

      reply: aiReply,

      products: matchedProducts,

    });

  } catch (err) {

    console.log(
      err.response?.data || err.message
    );

    res.status(500).json({

      reply: "Server error",

    });

  }

});

app.listen(process.env.PORT || 10000, () => {

  console.log("ALYMWNDW AI RUNNING");

});
