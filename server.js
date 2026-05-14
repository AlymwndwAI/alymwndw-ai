import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

let productsCache = [];
let lastUpdate = 0;

function cleanHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectMetal(text) {
  text = text.toLowerCase();

  if (text.includes("18k")) return "18K Gold";
  if (text.includes("14k")) return "14K Gold";
  if (text.includes("925")) return "925 Silver";
  if (text.includes("platinum")) return "Platinum";

  return "Luxury Metal";
}

function detectStone(text) {
  text = text.toLowerCase();

  if (text.includes("moissanite")) return "Moissanite";
  if (text.includes("diamond")) return "Diamond";
  if (text.includes("ruby")) return "Ruby";
  if (text.includes("emerald")) return "Emerald";
  if (text.includes("sapphire")) return "Sapphire";
  if (text.includes("zircon")) return "Zircon";

  return "Luxury Stone";
}

function detectColor(text) {
  text = text.toLowerCase();

  if (text.includes("red")) return "Red";
  if (text.includes("blue")) return "Blue";
  if (text.includes("green")) return "Green";
  if (text.includes("yellow")) return "Yellow";
  if (text.includes("pink")) return "Pink";
  if (text.includes("purple")) return "Purple";
  if (text.includes("black")) return "Black";
  if (text.includes("white")) return "White";

  return "Classic";
}

async function loadProducts() {

  if (
    productsCache.length > 0 &&
    Date.now() - lastUpdate < 1000 * 60 * 10
  ) {
    return productsCache;
  }

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

    const products = (data.products || []).map((p) => {

      const fullText = `
        ${p.title}
        ${cleanHtml(p.body_html)}
        ${p.tags}
      `;

      const variants = (p.variants || []).map((v) => ({
        title: v.title,
        price: v.price,
        sku: v.sku,
        available: v.inventory_quantity > 0,
      }));

      return {
        id: p.id,

        title: p.title,

        description: cleanHtml(p.body_html),

        productType: p.product_type,

        tags: p.tags,

        metal: detectMetal(fullText),

        stone: detectStone(fullText),

        color: detectColor(fullText),

        price: p.variants?.[0]?.price || "",

        variants,

        images: (p.images || []).map((img) => img.src),

        image: p.images?.[0]?.src || "",

        handle: p.handle,

        url: `https://${SHOP}/products/${p.handle}`,
      };
    });

    productsCache = products;

    lastUpdate = Date.now();

    console.log("Products Loaded:", products.length);

    return products;

  } catch (error) {

    console.log("SHOPIFY ERROR:", error);

    return [];
  }
}

function searchProducts(products, message) {

  const msg = message.toLowerCase();

  return products.filter((p) => {

    const text = `
      ${p.title}
      ${p.description}
      ${p.tags}
      ${p.metal}
      ${p.stone}
      ${p.color}
      ${p.productType}
    `.toLowerCase();

    return (
      text.includes(msg) ||
      msg.includes("خاتم") && text.includes("ring") ||
      msg.includes("سلسله") && text.includes("necklace") ||
      msg.includes("حلق") && text.includes("earring") ||
      msg.includes("فضه") && text.includes("silver") ||
      msg.includes("ذهب") && text.includes("gold") ||
      msg.includes("مويسانيت") && text.includes("moissanite") ||
      msg.includes("الماس") && text.includes("diamond") ||
      msg.includes("احمر") && text.includes("red") ||
      msg.includes("ازرق") && text.includes("blue") ||
      msg.includes("اخضر") && text.includes("green")
    );
  }).slice(0, 6);
}

app.post("/chat", async (req, res) => {

  try {

    const message = req.body.message || "";

    const products = await loadProducts();

    const matchedProducts = searchProducts(products, message);

    const productsText = matchedProducts.map((p) => `

TITLE: ${p.title}

PRICE: ${p.price} AED

METAL: ${p.metal}

STONE: ${p.stone}

COLOR: ${p.color}

DESCRIPTION:
${p.description}

PRODUCT URL:
${p.url}

IMAGE:
${p.image}

    `).join("\n\n");

    const systemPrompt = `

You are Alymwndw Jewellery AI.

You are an elite luxury jewellery sales AI.

You must:
- Speak naturally
- Sound premium and smart
- Understand jewellery deeply
- Recommend products intelligently
- Understand gemstones
- Understand metals
- Understand colors
- Understand customer intent
- Upsell naturally
- Be conversational like ChatGPT
- Never repeat robotic answers
- Never say "we don't have products" unless truly unavailable

If customer speaks Arabic answer Arabic.

If customer asks:
- new arrivals
- trendy
- best seller
- engagement
- luxury
- gift

You MUST recommend products smartly.

Available matching products:

${productsText}

`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.9,
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

    res.json({
      reply: completion.choices[0].message.content,
      products: matchedProducts,
    });

  } catch (error) {

    console.log(error);

    res.json({
      reply: "AI Error",
      products: [],
    });

  }

});

app.get("/", (req, res) => {
  res.send("ALYMWNDW AI RUNNING");
});

app.listen(PORT, async () => {

  await loadProducts();

  console.log("ALYMWNDW AI RUNNING ON PORT", PORT);

});
