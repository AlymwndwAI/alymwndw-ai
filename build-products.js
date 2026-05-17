import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

import productEnrichment from "./brain/product-enrichment.js";

dotenv.config();

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// ========================================
// SHOPIFY GRAPHQL
// ========================================

async function shopifyQuery(query) {

  const response = await fetch(

    `https://${SHOP}/admin/api/2025-01/graphql.json`,

    {

      method: "POST",

      headers: {

        "Content-Type":
          "application/json",

        "X-Shopify-Access-Token":
          TOKEN,

      },

      body:
        JSON.stringify({ query }),

    }

  );

  return response.json();

}

// ========================================
// PARSE VARIANT
// ========================================

function parseVariant(v, images) {

  const optionText = `
    ${v.node.title}
    ${JSON.stringify(v.node.selectedOptions)}
  `.toLowerCase();

  let metal = "";

  if (optionText.includes("rose gold")) {
    metal = "rose gold";
  } else if (optionText.includes("yellow gold")) {
    metal = "yellow gold";
  } else if (optionText.includes("white gold")) {
    metal = "white gold";
  } else if (optionText.includes("platinum")) {
    metal = "platinum";
  } else if (optionText.includes("silver")) {
    metal = "silver";
  } else if (optionText.includes("gold")) {
    metal = "gold";
  }

  let stoneColor = "";

  if (optionText.includes("blue")) {
    stoneColor = "blue";
  } else if (optionText.includes("green")) {
    stoneColor = "green";
  } else if (optionText.includes("pink")) {
    stoneColor = "pink";
  } else if (optionText.includes("yellow")) {
    stoneColor = "yellow";
  } else if (optionText.includes("black")) {
    stoneColor = "black";
  } else if (optionText.includes("red")) {
    stoneColor = "red";
  }

  let shape = "";

  if (optionText.includes("round")) {
    shape = "round";
  } else if (optionText.includes("oval")) {
    shape = "oval";
  } else if (optionText.includes("pear")) {
    shape = "pear";
  } else if (optionText.includes("radiant")) {
    shape = "radiant";
  }

  let matchedImage =
    v.node.image?.url ||
    images[0]?.url ||
    "";

  return {

    id: v.node.id,

    title: v.node.title,

    sku: v.node.sku || "",

    available:
      v.node.availableForSale ?? true,

    price:
      `${v.node.price} AED`,

    rawPrice:
      Number(v.node.price),

    currency: "AED",

    image: matchedImage,

    mappedImage:
      matchedImage,

    metal,
    stoneColor,
    shape,

    options:
      v.node.selectedOptions,

  };

}

// ========================================
// AI FEATURES
// ========================================

function buildAiFeatures(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
    ${product.type}
  `.toLowerCase();

  const ai = {

    category: "",
    productType: "",

    styles: [],
    intent: [],
    materials: [],

    searchKeywords: [],

  };

  if (text.includes("ring")) {
    ai.category = "rings";
    ai.productType = "ring";
  }

  if (text.includes("necklace")) {
    ai.category = "necklaces";
    ai.productType = "necklace";
  }

  if (text.includes("bracelet")) {
    ai.category = "bracelets";
    ai.productType = "bracelet";
  }

  if (text.includes("earring")) {
    ai.category = "earrings";
    ai.productType = "earring";
  }

  if (text.includes("diamond")) {
    ai.materials.push("diamond");
  }

  if (text.includes("moissanite")) {

    ai.materials.push("moissanite");

    ai.styles.push("luxury");

  }

  if (text.includes("gold")) {
    ai.materials.push("gold");
  }

  if (text.includes("platinum")) {
    ai.materials.push("platinum");
  }

  return ai;

}

// ========================================
// FETCH PRODUCTS
// ========================================

async function fetchProducts() {

  let allProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {

    console.log("FETCHING PRODUCTS...");

    const query = `
    {
      products(first: 250 ${cursor ? `, after: "${cursor}"` : ""}) {

        pageInfo {
          hasNextPage
        }

        edges {

          cursor

          node {

            id
            title
            handle
            description
            productType
            vendor
            tags

            collections(first: 20) {
              edges {
                node {
                  title
                  handle
                }
              }
            }

            images(first: 20) {
              edges {
                node {
                  url
                  altText
                }
              }
            }

            variants(first: 100) {
              edges {
                node {

                  id
                  title
                  sku
                  availableForSale
                  price

                  selectedOptions {
                    name
                    value
                  }

                  image {
                    url
                  }

                }
              }
            }

          }

        }

      }

    }
    `;

    const data =
      await shopifyQuery(query);

    const products =
      data.data.products.edges;

    for (const item of products) {

      const p = item.node;

      const images =
        p.images.edges.map((img) => ({

          url:
            img.node.url,

          alt:
            img.node.altText || "",

        }));

      const collections =
        p.collections.edges.map((c) => ({

          title:
            c.node.title,

          handle:
            c.node.handle,

        }));

      const variants =
        p.variants.edges.map((v) =>
          parseVariant(v, images)
        );

      const product = {

        id: p.id,
        title: p.title,
        handle: p.handle,

        description: p.description,

        type: p.productType,

        vendor: p.vendor,

        tags: p.tags,

        collections,

        image:
          images[0]?.url || "",

        images,

        variants,

        price:
          variants[0]?.price || "",

        rawPrice:
          variants[0]?.rawPrice || 0,

        currency: "AED",

        reviewRating: 4.9,

        reviewCount: 120,

        url:
          `https://${SHOP}/products/${p.handle}`,

      };

      product.aiFeatures =
        buildAiFeatures(product);

      product.enrichment =
        productEnrichment(product);

      allProducts.push(product);

    }

    hasNextPage =
      data.data.products.pageInfo.hasNextPage;

    if (
      hasNextPage &&
      products.length > 0
    ) {

      cursor =
        products[
          products.length - 1
        ].cursor;

    }

    console.log(
      "TOTAL PRODUCTS:",
      allProducts.length
    );

  }

  return allProducts;

}

// ========================================
// BUILD PRODUCT BRAIN
// ========================================

async function buildBrain() {

  try {

    console.log(
      "STARTING PRODUCT BRAIN..."
    );

    const products =
      await fetchProducts();

    if (
      !fs.existsSync("./public")
    ) {

      fs.mkdirSync("./public");

    }

    fs.writeFileSync(

      "./public/products-brain.json",

      JSON.stringify(
        products,
        null,
        2
      )

    );

    console.log(
      "PRODUCT BRAIN COMPLETE"
    );

    console.log(
      "TOTAL PRODUCTS:",
      products.length
    );

  } catch (err) {

    console.log(err);

    process.exit(1);

  }

}

buildBrain();
