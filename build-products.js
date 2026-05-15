import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

const PRODUCTS_URL = `https://${SHOP}/admin/api/2024-01/products.json?limit=250`;

function cleanHTML(html) {
  return html
    ?.replace(/<[^>]*>/g, "")
    ?.replace(/\s+/g, " ")
    ?.trim() || "";
}

function detectType(product) {
  const text = `
    ${product.title}
    ${product.product_type}
    ${product.tags}
  `.toLowerCase();

  if (text.includes("ring")) return "ring";
  if (text.includes("necklace")) return "necklace";
  if (text.includes("earring")) return "earring";
  if (text.includes("bracelet")) return "bracelet";
  if (text.includes("tennis")) return "tennis";
  return "jewelry";
}

function detectMaterials(product) {
  const text = `
    ${product.title}
    ${product.body_html}
    ${product.tags}
  `.toLowerCase();

  const materials = [];

  if (text.includes("gold")) materials.push("gold");
  if (text.includes("silver")) materials.push("silver");
  if (text.includes("platinum")) materials.push("platinum");

  return materials;
}

function detectStones(product) {
  const text = `
    ${product.title}
    ${product.body_html}
    ${product.tags}
  `.toLowerCase();

  const stones = [];

  if (text.includes("moissanite"))
    stones.push("moissanite");

  if (text.includes("diamond"))
    stones.push("diamond");

  if (text.includes("ruby"))
    stones.push("ruby");

  if (text.includes("emerald"))
    stones.push("emerald");

  if (text.includes("sapphire"))
    stones.push("sapphire");

  return stones;
}

function detectColors(product) {
  const text = `
    ${product.title}
    ${product.body_html}
    ${product.tags}
  `.toLowerCase();

  const colors = [];

  if (text.includes("red")) colors.push("red");
  if (text.includes("blue")) colors.push("blue");
  if (text.includes("green")) colors.push("green");
  if (text.includes("yellow")) colors.push("yellow");
  if (text.includes("white")) colors.push("white");
  if (text.includes("black")) colors.push("black");
  if (text.includes("rose gold"))
    colors.push("rose gold");

  return colors;
}

async function buildProductBrain() {
  try {
    console.log("LOADING PRODUCTS...");

    const response = await fetch(PRODUCTS_URL, {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
      },
    });

    const data = await response.json();

    const products = data.products || [];

    console.log(
      `FOUND ${products.length} PRODUCTS`
    );

    const brain = products.map((product) => {
      const variants = product.variants.map(
        (variant) => ({
          id: variant.id,
          title: variant.title,
          price: variant.price,
          sku: variant.sku,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
        })
      );

      return {
        id: product.id,

        title: product.title,

        description: cleanHTML(
          product.body_html
        ),

        type: detectType(product),

        materials: detectMaterials(product),

        stones: detectStones(product),

        colors: detectColors(product),

        tags: product.tags
          ?.split(",")
          ?.map((t) => t.trim().toLowerCase()),

        handle: product.handle,

        url: `https://${SHOP}/products/${product.handle}`,

        image:
          product.images?.[0]?.src || "",

        images:
          product.images?.map(
            (img) => img.src
          ) || [],

        price:
          product.variants?.[0]?.price || 0,

        variants,

        options: product.options || [],

        vendor: product.vendor,

        product_type: product.product_type,

        created_at: product.created_at,
      };
    });

    fs.writeFileSync(
      "./public/products-brain.json",
      JSON.stringify(brain, null, 2)
    );

    console.log("PRODUCT BRAIN BUILT ✅");
    console.log(
      `TOTAL PRODUCTS: ${brain.length}`
    );
  } catch (err) {
    console.error(
      "ERROR BUILDING PRODUCT BRAIN",
      err
    );
  }
}

buildProductBrain();
