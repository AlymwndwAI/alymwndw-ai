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

      const cleanDescription =
        cleanHtml(p.body_html);

      // =========================
      // VARIANTS
      // =========================

      const variants =
        (p.variants || []).map((v) => ({

          id: v.id,

          title: v.title,

          price: v.price,

          compareAtPrice:
            v.compare_at_price,

          sku: v.sku,

          available:
            v.inventory_quantity > 0,

        }));

      // =========================
      // OPTIONS
      // =========================

      const options =
        (p.options || []).map((o) => ({

          name: o.name,

          values: o.values,

        }));

      // =========================
      // IMAGES
      // =========================

      const images =
        (p.images || []).map(
          (img) => img.src
        );

      // =========================
      // SEARCHABLE TEXT
      // =========================

      const fullText = `
${p.title}
${cleanDescription}
${p.tags}
${p.product_type}
      `.toLowerCase();

      // =========================
      // METAL DETECTION
      // =========================

      let metal = "Luxury Metal";

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
      // STONE DETECTION
      // =========================

      let stone = "Luxury Stone";

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
      // REVIEW SCORE
      // =========================

      const reviewCount =
        (
          cleanDescription.match(
            /review/gi
          ) || []
        ).length;

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

        luxuryScore,

        reviewCount,

        options,

        variants,

        images,

        image:
          images[0] || "",

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

    // earring
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
        score += 50;
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
        score += 50;
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
        score += 50;
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
        score += 60;
      }

    }

    // engagement
    if (
      q.includes("engagement") ||
      q.includes("خطوبة")
    ) {

      if (
        text.includes("engagement")
      ) {
        score += 60;
      }

    }

    // luxury
    if (
      q.includes("luxury") ||
      q.includes("فاخر")
    ) {

      score +=
        p.luxuryScore || 0;

    }

    // gift
    if (
      q.includes("gift") ||
      q.includes("هدية")
    ) {

      score += 20;

    }

    // review boost
    score +=
      p.reviewCount || 0;

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

    // refresh every 15 mins
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
    // SEARCH PRODUCTS
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

COLLECTION:
${p.collection}

LUXURY SCORE:
${p.luxuryScore}

DESCRIPTION:
${p.description}

OPTIONS:
${JSON.stringify(p.options)}

VARIANTS:
${JSON.stringify(p.variants)}

PRODUCT URL:
${p.url}

IMAGE:
${p.image}

`).join("\n\n");

    // =========================
    // SYSTEM PROMPT
    // =========================

    const systemPrompt = `

You are Alymwndw Jewellery AI.

You are an elite luxury jewellery AI sales assistant.

You speak naturally like ChatGPT.

You are NOT robotic.

You deeply understand:
- Diamonds
- Moissanite
- Gold
- Silver
- Platinum
- Engagement rings
- Wedding jewelry
- Luxury gifting
- Jewelry styling
- Jewelry trends

Your personality:
- Elegant
- Luxury
- Smart
- Human-like
- Professional
- Friendly

VERY IMPORTANT:

Every product contains:
- variants
- pricing
- metals
- stones
- colors
- customizations

You MUST:
- recommend products naturally
- explain products professionally
- upsell elegantly
- understand customer intent
- never invent fake products
- only recommend relevant products
- answer Arabic naturally
- answer English naturally

If customer asks:
- gift
- engagement
- luxury
- trending
- elegant
- wedding

You should recommend products smartly.

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
