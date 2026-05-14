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

    let allProducts = [];
    let since_id = 0;
    let keepLoading = true;

    while (keepLoading) {

      console.log(
        "Loading products after ID:",
        since_id
      );

      const response = await fetch(
        `https://${SHOP}/admin/api/2025-01/products.json?limit=250&since_id=${since_id}`,
        {
          headers: {
            "X-Shopify-Access-Token": TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      const products =
        data.products || [];

      console.log(
        "Loaded:",
        products.length
      );

      if (products.length === 0) {

        keepLoading = false;
        break;

      }

      allProducts.push(...products);

      since_id =
        products[
          products.length - 1
        ].id;

      if (products.length < 250) {

        keepLoading = false;

      }

    }

    productsCache =
      allProducts.map((p) => {

        const text = `
          ${p.title}
          ${p.body_html}
          ${p.tags}
          ${(p.options || [])
            .map((o) => o.values?.join(" "))
            .join(" ")}
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

        const colorList = [
          "red",
          "blue",
          "green",
          "pink",
          "purple",
          "yellow",
          "black",
          "white",
          "rose gold",
          "gold",
        ];

        colorList.forEach((c) => {

          if (
            text.includes(c)
          ) {
            colors.push(c);
          }

        });

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

            let variantText = `
              ${v.title}
              ${v.option1}
              ${v.option2}
              ${v.option3}
            `.toLowerCase();

            let variantColor = "";

            colorList.forEach((c) => {

              if (
                variantText.includes(c)
              ) {
                variantColor = c;
              }

            });

            let variantImage =
              mainImage;

            if (
              v.image_id
            ) {

              const img =
                p.images.find(
                  (i) =>
                    i.id ===
                    v.image_id
                );

              if (img) {

                variantImage =
                  img.src;

              }

            }

            return {

              id: v.id,

              title: v.title,

              price: v.price,

              available:
                v.inventory_quantity > 0,

              image:
                variantImage,

              color:
                variantColor,

              option1:
                v.option1,

              option2:
                v.option2,

              option3:
                v.option3,

            };

          });

        return {

          id: p.id,

          title: p.title,

          description:
            p.body_html
              ?.replace(/<[^>]+>/g, "")
              || "",

          tags:
            p.tags,

          handle:
            p.handle,

          price:
            p.variants?.[0]?.price || "",

          metal,

          stone,

          colors,

          image:
            mainImage,

          url:
            `https://${SHOP}/products/${p.handle}`,

          variants,

        };

      });

    lastUpdate =
      Date.now();

    console.log(
      "FINAL PRODUCTS:",
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
        ${p.tags}
        ${(p.variants || [])
          .map((v) =>
            `${v.title} ${v.color}`
          )
          .join(" ")}
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

        title:
          p.title,

        description:
          p.description,

        price:
          p.price,

        metal:
          p.metal,

        stone:
          p.stone,

        colors:
          p.colors,

        image:
          p.image,

        url:
          p.url,

        variants:
          p.variants,

      }));

    // ======================
    // AI PROMPT
    // ======================

    const systemPrompt = `

You are Alymwndw Jewellery AI.

You are an elite luxury jewellery sales expert.

STRICT RULES:

1- NEVER invent products.
2- NEVER invent colors.
3- NEVER invent metals.
4- NEVER invent gemstones.
5- NEVER invent prices.
6- NEVER invent variants.
7- ONLY recommend existing products.
8- Use ONLY provided products.
9- Speak naturally and elegantly.
10- Upsell smartly.
11- If user speaks Arabic answer Arabic.
12- Mention price when useful.
13- Mention metal and stone accurately.
14- If unavailable politely say unavailable.
15- Recommend closest alternatives if needed.
16- NEVER output markdown image syntax.
17- NEVER output raw image URLs.

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
            content:
              systemPrompt,
          },

          {
            role: "user",
            content:
              message,
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
