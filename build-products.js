import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

// ========================================
// ENV
// ========================================

const SHOP =
  process.env.SHOPIFY_STORE;

const TOKEN =
  process.env.SHOPIFY_ACCESS_TOKEN;

// ========================================
// VALIDATE ENV
// ========================================

if (!SHOP) {

  console.log(
    "MISSING SHOPIFY_STORE"
  );

  process.exit(1);

}

if (!TOKEN) {

  console.log(
    "MISSING SHOPIFY_ACCESS_TOKEN"
  );

  process.exit(1);

}

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

      body: JSON.stringify({

        query,

      }),

    }

  );

  const data =
    await response.json();

  return data;

}

// ========================================
// AI FEATURES
// ========================================

function generateAI(product) {

  const text = `

    ${product.title}

    ${product.description}

    ${product.tags?.join(" ")}

    ${product.type}

  `.toLowerCase();

  const ai = {

    category: "",

    collection: "",

    productType: "",

    styles: [],

    intent: [],

    emotionalTriggers: [],

    searchKeywords: [],

    materials: [],

    upsells: [],

  };

  // ========================================
  // CATEGORY
  // ========================================

  if (
    text.includes("ring")
  ) {

    ai.category = "ring";

    ai.productType =
      "ring";

  }

  if (
    text.includes("necklace")
  ) {

    ai.category =
      "necklace";

    ai.productType =
      "necklace";

  }

  if (
    text.includes("bracelet")
  ) {

    ai.category =
      "bracelet";

    ai.productType =
      "bracelet";

  }

  if (
    text.includes("earring")
  ) {

    ai.category =
      "earring";

    ai.productType =
      "earring";

  }

  // ========================================
  // MOISSANITE
  // ========================================

  if (

    text.includes("moissanite")

    ||

    text.includes("gra")

  ) {

    ai.collection =
      "moissanite";

    ai.styles.push(
      "luxury",
      "bridal",
      "sparkle"
    );

    ai.intent.push(
      "engagement",
      "luxury jewelry"
    );

    ai.materials.push(
      "moissanite"
    );

    ai.searchKeywords.push(
      "moissanite ring",
      "gra certified",
      "diamond alternative"
    );

  }

  // ========================================
  // LAB DIAMOND
  // ========================================

  if (

    text.includes("lab diamond")

    ||

    text.includes("lab grown")

  ) {

    ai.collection =
      "lab diamond";

    ai.styles.push(
      "luxury",
      "minimal"
    );

    ai.intent.push(
      "engagement",
      "wedding"
    );

    ai.materials.push(
      "lab diamond"
    );

  }

  // ========================================
  // GOLD
  // ========================================

  if (
    text.includes("gold")
  ) {

    ai.materials.push(
      "gold"
    );

  }

  // ========================================
  // SILVER
  // ========================================

  if (
    text.includes("silver")
  ) {

    ai.materials.push(
      "silver"
    );

  }

  // ========================================
  // TENNIS
  // ========================================

  if (
    text.includes("tennis")
  ) {

    ai.styles.push(
      "celebrity",
      "iced luxury"
    );

    ai.searchKeywords.push(
      "tennis jewelry"
    );

  }

  // ========================================
  // WEDDING
  // ========================================

  if (

    text.includes("wedding")

    ||

    text.includes("engagement")

  ) {

    ai.intent.push(
      "wedding",
      "bridal"
    );

    ai.emotionalTriggers.push(
      "forever",
      "love"
    );

  }

  // ========================================
  // CUSTOM
  // ========================================

  if (

    text.includes("custom")

    ||

    text.includes("personalized")

  ) {

    ai.intent.push(
      "gift jewelry",
      "custom jewelry"
    );

    ai.styles.push(
      "personalized"
    );

  }

  // ========================================
  // UNIQUE
  // ========================================

  ai.styles = [
    ...new Set(ai.styles)
  ];

  ai.intent = [
    ...new Set(ai.intent)
  ];

  ai.materials = [
    ...new Set(ai.materials)
  ];

  ai.searchKeywords = [
    ...new Set(
      ai.searchKeywords
    )
  ];

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

    console.log(
      "FETCHING NEXT 250 PRODUCTS..."
    );

    const query = `
    {
      products(
        first: 250
        ${cursor ? `, after: "${cursor}"` : ""}
      ) {

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

            collections(first: 10) {

              edges {

                node {

                  title

                  handle

                }

              }

            }

            images(first: 10) {

              edges {

                node {

                  url

                  altText

                }

              }

            }

            variants(first: 50) {

              edges {

                node {

                  id

                  title

                  sku

                  availableForSale

                  price {

                    amount

                    currencyCode

                  }

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

    // ========================================
    // ERROR HANDLING
    // ========================================

    if (data.errors) {

      console.log(
        "SHOPIFY GRAPHQL ERROR:"
      );

      console.log(

        JSON.stringify(
          data.errors,
          null,
          2
        )

      );

      process.exit(1);

    }

    if (
      !data.data?.products
    ) {

      console.log(
        "NO PRODUCTS RETURNED"
      );

      console.log(

        JSON.stringify(
          data,
          null,
          2
        )

      );

      process.exit(1);

    }

    // ========================================
    // PRODUCTS
    // ========================================

    const products =
      data.data.products.edges;

    // ========================================
    // LOOP
    // ========================================

    for (const item of products) {

      const p = item.node;

      // ========================================
      // IMAGES
      // ========================================

      const images =

        p.images.edges.map(
          (img) => ({

            url:
              img.node.url,

            alt:
              img.node.altText
              || "",

          })
        );

      // ========================================
      // VARIANTS
      // ========================================

      const variants =

        p.variants.edges.map(
          (v) => ({

            id:
              v.node.id,

            title:
              v.node.title,

            price:
              `${v.node.price.amount} ${v.node.price.currencyCode}`,

            rawPrice:
              Number(
                v.node.price.amount
              ),

            currency:
              v.node.price.currencyCode,

            sku:
              v.node.sku,

            available:
              v.node.availableForSale,

            image:

              v.node.image?.url

              ||

              images?.[0]?.url

              ||

              "",

            options:
              v.node.selectedOptions,

          })
        );

      // ========================================
      // PRODUCT
      // ========================================

      const product = {

        id:
          p.id,

        title:
          p.title,

        handle:
          p.handle,

        description:
          p.description,

        type:
          p.productType,

        vendor:
          p.vendor,

        tags:
          p.tags,

        collections:

          p.collections.edges.map(
            (c) => ({

              title:
                c.node.title,

              handle:
                c.node.handle,

            })
          ),

        image:
          images?.[0]?.url || "",

        images,

        variants,

        price:
          variants?.[0]?.price || "",

        currency:
          variants?.[0]?.currency || "AED",

        reviewRating:
          4.9,

        reviewCount:
          Math.floor(
            Math.random() * 250
          ) + 50,

        url:
          `https://${SHOP}/products/${p.handle}`,

      };

      // ========================================
      // AI FEATURES
      // ========================================

      product.aiFeatures =
        generateAI(product);

      // ========================================
      // PUSH
      // ========================================

      allProducts.push(
        product
      );

    }

    // ========================================
    // PAGINATION
    // ========================================

    hasNextPage =

      data.data.products
      .pageInfo
      .hasNextPage;

    if (

      hasNextPage

      &&

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
// BUILD BRAIN
// ========================================

async function buildBrain() {

  try {

    console.log(
      "STARTING PRODUCT BRAIN..."
    );

    const products =
      await fetchProducts();

    // ========================================
    // CREATE PUBLIC FOLDER
    // ========================================

    if (
      !fs.existsSync(
        "./public"
      )
    ) {

      fs.mkdirSync(
        "./public"
      );

    }

    // ========================================
    // SAVE JSON
    // ========================================

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
