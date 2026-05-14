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

// ======================
// CACHE
// ======================

let productsCache = [];
let lastUpdate = 0;

// ======================
// LOAD PRODUCTS
// ======================

async function loadProducts() {

  try {

    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/products.json?limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    const products = data.products || [];

    productsCache = products.map((p) => {

      const text = `
        ${p.title}
        ${p.body_html}
        ${p.tags}
      `.toLowerCase();

      // ======================
      // METAL DETECTION
      // ======================

      let metal = "Unknown";

      if (
        text.includes("18k") ||
        text.includes("gold")
      ) {
        metal = "Gold";
      }

      if (
        text.includes("925") ||
        text.includes("silver")
      ) {
        metal = "Silver";
      }

      if (
        text.includes("platinum")
      ) {
        metal = "Platinum";
      }

      // ======================
      // STONE DETECTION
      // ======================

      let stone = "None";

      if (
        text.includes("moissanite")
      ) {
        stone = "Moissanite";
      }

      if (
        text.includes("diamond")
      ) {
        stone = "Diamond";
      }

      if (
        text.includes("ruby")
      ) {
        stone = "Ruby";
      }

      if (
        text.includes("sapphire")
      ) {
        stone = "Sapphire";
      }

      // ======================
      // COLORS
      // ======================

      let colors = [];

      if (
        /\bred\b/.test(text)
      ) {
        colors.push("Red");
      }

      if (
        /\bblue\b/.test(text)
      ) {
        colors.push("Blue");
      }

      if (
        /\bgreen\b/.test(text)
      ) {
        colors.push("Green");
      }

      if (
        /\bpink\b/.test(text)
      ) {
        colors.push("Pink");
      }

      if (
        /\bpurple\b/.test(text)
      ) {
        colors.push("Purple");
      }

      // ======================
      // IMAGES
      // ======================

      const mainImage =
        p.images?.[0]?.src || "";

      // ======================
      // VARIANTS
      // ======================

      const variants =
        (p.variants || []).map((v) => {

          let variantImage = mainImage;

          if (
            v.image_id &&
            p.images
          ) {

            const img = p.images.find(
              (i) =>
                i.id === v.image_id
            );

            if (img) {
              variantImage = img.src;
            }

          }

          return {

            title: v.title,

            price: v.price,

            available:
              v.available,

            image:
              variantImage,

          };

        });

      return {

        id: p.id,

        title: p.title,

        description:
          p.body_html
            ?.replace(/<[^>]+>/g, "")
            || "",

        price:
          p.variants?.[0]?.price || "",

        metal,

        stone,

        colors,

        image: mainImage,

        url:
          `https://${SHOP}/products/${p.handle}`,

        variants,

      };

    });

    lastUpdate = Date.now();

    console.log(
      "Products Loaded:",
      productsCache.length
    );

  } catch (error) {

    console.log(
      "LOAD PRODUCTS ERROR",
      error
    );

  }

}

// ======================
// SEARCH
// ======================

function searchProducts(message) {

  const msg =
    message.toLowerCase();

  let filtered =
    productsCache.filter((p) => {

      const text = `
        ${p.title}
        ${p.description}
        ${p.metal}
        ${p.stone}
        ${p.colors.join(" ")}
      `.toLowerCase();

      return msg
        .split(" ")
        .some((word) =>
          text.includes(word)
        );

    });

  // fallback
  if (filtered.length === 0) {
    filtered =
      productsCache.slice(0, 4);
  }

  return filtered.slice(0, 4);

}

// ======================
// CHAT
// ======================

app.post("/chat", async (req, res) => {

  try {

    const message =
      req.body.message || "";

    // refresh cache every 15 min
    if (
      Date.now() - lastUpdate >
      1000 * 60 * 15
    ) {

      await loadProducts();

    }

    if (
      productsCache.length === 0
    ) {

      await loadProducts();

    }

    const matchedProducts =
      searchProducts(message);

    // ======================
    // CLEAN PRODUCTS
    // ======================

    const cleanProducts =
      matchedProducts.map((p) => ({

        title: p.title,

        description:
          p.description,

        price: p.price,

        metal: p.metal,

        stone: p.stone,

        colors: p.colors,

        image: p.image,

        url: p.url,

        variants: p.variants,

      }));

    // ======================
    // AI PROMPT
    // ======================

    const systemPrompt = `

You are Alymwndw Jewellery AI.

You are a luxury jewellery expert.

STRICT RULES:

1- NEVER invent colors.
2- NEVER invent gemstones.
3- NEVER invent metals.
4- NEVER invent variants.
5- NEVER say product exists unless it exists.
6- NEVER create fake product info.
7- ONLY use provided products.
8- NEVER output markdown image syntax.
9- NEVER output raw image URLs.
10- Speak naturally like ChatGPT.
11- Recommend products smartly.
12- Upsell naturally.
13- Keep answers elegant.
14- Answer Arabic if user speaks Arabic.
15- If user asks unavailable color say unavailable politely.

AVAILABLE PRODUCTS:

${JSON.stringify(cleanProducts)}

`;

    // ======================
    // OPENAI
    // ======================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.2,

        messages: [

          {
            role: "system",
            content: systemPrompt,
          },

          {
            role: "user",
            content: message,
          },

        ],

      });

    // ======================
    // RESPONSE
    // ======================

    res.json({

      reply:
        completion.choices[0]
          .message.content,

      products:
        cleanProducts,

    });

  } catch (error) {

    console.log(error);

    res.json({

      reply:
        "AI Error",

      products: [],

    });

  }

});

// ======================
// START SERVER
// ======================

app.listen(PORT, async () => {

  console.log(
    "ALYMWNDW AI RUNNING"
  );

  await loadProducts();

});
