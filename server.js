import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

// =========================
// OPENAI
// =========================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =========================
// SHOPIFY
// =========================

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// =========================
// MEMORY
// =========================

let productsCache = [];
let lastUpdate = 0;

// =========================
// CLEAN HTML
// =========================

function cleanHtml(html) {

  if (!html) return "";

  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

// =========================
// LOAD PRODUCTS
// =========================

async function loadProducts() {

  try {

    console.log("Loading Shopify products...");

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

    productsCache = (data.products || []).map((p) => {

      // =========================
      // CLEAN DESCRIPTION
      // =========================

      const cleanDescription =
        cleanHtml(p.body_html);

      // =========================
      // IMAGES
      // =========================

      const images =
        (p.images || []).map(
          (img) => ({
            id: img.id,
            src: img.src,
          })
        );

      // =========================
      // VARIANTS
      // =========================

      const variants =
        (p.variants || []).map((v) => {

          // variant image
          let variantImage = "";

          const matchedImage =
            images.find(
              (img) =>
                img.id === v.image_id
            );

          if (matchedImage) {
            variantImage =
              matchedImage.src;
          }

          return {

            id: v.id,

            title: v.title,

            price: v.price,

            compareAtPrice:
              v.compare_at_price,

            sku: v.sku,

            available:
              v.inventory_quantity > 0,

            image:
              variantImage,

            optionValues:
              v.title.split(" / "),

          };

        });

      // =========================
      // OPTIONS
      // =========================

      const options =
        (p.options || []).map((o) => ({

          name: o.name,

          values: o.values,

        }));

      // =========================
      // FULL SEARCH TEXT
      // =========================

      const fullText = `
${p.title}
${cleanDescription}
${p.tags}
${p.product_type}
${JSON.stringify(options)}
${JSON.stringify(variants)}
      `.toLowerCase();

      // =========================
      // METAL
      // =========================

      let metal =
        "Luxury Metal";

      if (
        fullText.includes("18k") ||
        fullText.includes("gold")
      ) {

        metal = "18K Gold";

      }

      if (
        fullText.includes("silver") ||
        fullText.includes("925")
      ) {

        metal = "925 Silver";

      }

      if (
        fullText.includes("platinum")
      ) {

        metal = "Platinum";

      }

      // =========================
      // STONE
      // =========================

      let stone =
        "Luxury Stone";

      if (
        fullText.includes("moissanite")
      ) {

        stone = "Moissanite";

      }

      if (
        fullText.includes("diamond")
      ) {

        stone = "Diamond";

      }

      if (
        fullText.includes("ruby")
      ) {

        stone = "Ruby";

      }

      if (
        fullText.includes("emerald")
      ) {

        stone = "Emerald";

      }

      if (
        fullText.includes("sapphire")
      ) {

        stone = "Sapphire";

      }

      // =========================
      // COLORS
      // =========================

      let colors = [];

      if (
        fullText.includes("red")
      ) {
        colors.push("Red");
      }

      if (
        fullText.includes("blue")
      ) {
        colors.push("Blue");
      }

      if (
        fullText.includes("green")
      ) {
        colors.push("Green");
      }

      if (
        fullText.includes("yellow")
      ) {
        colors.push("Yellow");
      }

      if (
        fullText.includes("pink")
      ) {
        colors.push("Pink");
      }

      if (
        fullText.includes("purple")
      ) {
        colors.push("Purple");
      }

      // =========================
      // LUXURY SCORE
      // =========================

      let luxuryScore = 0;

      if (
        fullText.includes("gra")
      ) {
        luxuryScore += 30;
      }

      if (
        fullText.includes("vvs1")
      ) {
        luxuryScore += 20;
      }

      if (
        fullText.includes("18k")
      ) {
        luxuryScore += 20;
      }

      if (
        fullText.includes("platinum")
      ) {
        luxuryScore += 25;
      }

      if (
        fullText.includes("diamond")
      ) {
        luxuryScore += 30;
      }

      // =========================
      // PRODUCT OBJECT
      // =========================

      return {

        id: p.id,

        title: p.title,

        description:
          cleanDescription,

        collection:
          p.product_type ||
          "Luxury Jewelry",

        tags: p.tags,

        type:
          p.product_type,

        vendor: p.vendor,

        metal,

        stone,

        colors,

        luxuryScore,

        options,

        variants,

        images,

        image:
          images[0]?.src || "",

        price:
          variants[0]?.price || "",

        handle: p.handle,

        url:
`https://${SHOP}/products/${p.handle}`,

        searchable: `
${p.title}
${cleanDescription}
${p.tags}
${metal}
${stone}
${colors.join(" ")}
${JSON.stringify(options)}
${JSON.stringify(variants)}
${p.product_type}
        `.toLowerCase(),

      };

    });

    lastUpdate = Date.now();

    console.log(
      "Products Loaded:",
      productsCache.length
    );

  } catch (error) {

    console.log(error);

  }

}

// =========================
// SMART SEARCH
// =========================

function searchProducts(message) {

  const q =
    message.toLowerCase();

  const scored = [];

  for (const p of productsCache) {

    let score = 0;

    const text =
      p.searchable;

    // exact
    if (
      text.includes(q)
    ) {
      score += 100;
    }

    // ring
    if (
      q.includes("ring") ||
      q.includes("خاتم")
    ) {

      if (
        text.includes("ring")
      ) {
        score += 40;
      }

    }

    // necklace
    if (
      q.includes("necklace") ||
      q.includes("عقد")
    ) {

      if (
        text.includes("necklace")
      ) {
        score += 40;
      }

    }

    // earrings
    if (
      q.includes("earring") ||
      q.includes("حلق")
    ) {

      if (
        text.includes("earring")
      ) {
        score += 40;
      }

    }

    // gold
    if (
      q.includes("gold") ||
      q.includes("ذهب")
    ) {

      if (
        text.includes("gold")
      ) {
        score += 60;
      }

    }

    // silver
    if (
      q.includes("silver") ||
      q.includes("فضة")
    ) {

      if (
        text.includes("silver")
      ) {
        score += 60;
      }

    }

    // platinum
    if (
      q.includes("platinum") ||
      q.includes("بلاتين")
    ) {

      if (
        text.includes("platinum")
      ) {
        score += 60;
      }

    }

    // moissanite
    if (
      q.includes("moissanite") ||
      q.includes("مويسانيت")
    ) {

      if (
        text.includes("moissanite")
      ) {
        score += 70;
      }

    }

    // diamond
    if (
      q.includes("diamond") ||
      q.includes("الماس")
    ) {

      if (
        text.includes("diamond")
      ) {
        score += 70;
      }

    }

    // red
    if (
      q.includes("red") ||
      q.includes("احمر")
    ) {

      if (
        text.includes("red")
      ) {
        score += 50;
      }

    }

    // blue
    if (
      q.includes("blue") ||
      q.includes("ازرق")
    ) {

      if (
        text.includes("blue")
      ) {
        score += 50;
      }

    }

    // green
    if (
      q.includes("green") ||
      q.includes("اخضر")
    ) {

      if (
        text.includes("green")
      ) {
        score += 50;
      }

    }

    // luxury
    if (
      q.includes("فاخر") ||
      q.includes("luxury")
    ) {

      score +=
        p.luxuryScore || 0;

    }

    if (score > 0) {

      scored.push({

        ...p,

        score,

      });

    }

  }

  scored.sort(
    (a, b) => b.score - a.score
  );

  return scored.slice(0, 5);

}

// =========================
// CHAT
// =========================

app.post("/chat", async (req, res) => {

  try {

    const message =
      req.body.message || "";

    // refresh products
    if (
      Date.now() - lastUpdate >
      1000 * 60 * 15
    ) {

      await loadProducts();

    }

    // first load
    if (
      productsCache.length === 0
    ) {

      await loadProducts();

    }

    // =========================
    // SEARCH
    // =========================

    let matchedProducts =
      searchProducts(message);

    // fallback
    if (
      matchedProducts.length === 0
    ) {

      matchedProducts =
        productsCache
          .sort(
            (a, b) =>
              b.luxuryScore -
              a.luxuryScore
          )
          .slice(0, 5);

    }

    // =========================
    // PRODUCTS CONTEXT
    // =========================

    const productsText =
      matchedProducts.map((p) => `

TITLE:
${p.title}

PRICE:
${p.price} AED

METAL:
${p.metal}

STONE:
${p.stone}

COLORS:
${p.colors.join(", ")}

DESCRIPTION:
${p.description}

OPTIONS:
${JSON.stringify(p.options)}

VARIANT IMAGES:
${JSON.stringify(p.variants)}

PRODUCT URL:
${p.url}

`).join("\n\n");

    // =========================
    // SYSTEM PROMPT
    // =========================

    const systemPrompt = `

You are Alymwndw Jewellery AI.

You are an elite luxury jewellery AI.

You speak naturally like ChatGPT.

You deeply understand:
- diamonds
- moissanite
- metals
- colors
- variants
- images
- pricing
- customization

IMPORTANT:

Every variant has:
- different image
- different color
- different metal
- different stone
- different pricing

When customer asks:
- red
- blue
- green
- gold
- silver
- platinum

You MUST choose the correct variant and image.

You MUST:
- recommend naturally
- sound luxury
- answer like human
- answer Arabic naturally
- answer English naturally
- never invent fake products

Relevant Products:

${productsText}

`;

    // =========================
    // OPENAI
    // =========================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.5,

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

    // =========================
    // RESPONSE
    // =========================

    res.json({

      reply:
        completion.choices[0]
          .message.content,

      products:
        matchedProducts,

    });

  } catch (error) {

    console.log(error);

    res.json({

      reply:
        "Alymwndw AI temporarily unavailable.",

      products: [],

    });

  }

});

// =========================
// START SERVER
// =========================

loadProducts();

app.listen(PORT, () => {

  console.log(
    "ALYMWNDW AI RUNNING"
  );

});
