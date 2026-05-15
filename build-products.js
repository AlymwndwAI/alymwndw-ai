import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// ========================================
// SHOPIFY GRAPHQL REQUEST
// ========================================

async function shopifyQuery(query) {

  const response = await fetch(
    `https://${SHOP}/admin/api/2025-01/graphql.json`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": TOKEN,
      },

      body: JSON.stringify({ query }),
    }
  );

  const json = await response.json();

  if (json.errors) {

    console.log("================================");
    console.log("SHOPIFY ERRORS");
    console.log("================================");

    console.log(json.errors);
  }

  return json;
}

// ========================================
// FETCH ALL PRODUCTS
// ========================================

async function fetchAllProducts() {

  let allProducts = [];

  let hasNextPage = true;

  let cursor = null;

  while (hasNextPage) {

    console.log("================================");
    console.log("FETCHING NEXT 250 PRODUCTS...");
    console.log("CURRENT TOTAL:", allProducts.length);
    console.log("================================");

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

                  price

                  sku

                  availableForSale

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

    const data = await shopifyQuery(query);

    if (!data.data) {

      console.log("NO DATA RETURNED");

      break;
    }

    const products = data.data.products.edges;

    for (const item of products) {

      const p = item.node;

      // ==============================
      // PRODUCT IMAGES
      // ==============================

      const images = p.images.edges.map((img) => ({
        url: img.node.url,
        alt: img.node.altText || "",
      }));

      // ==============================
      // PRODUCT VARIANTS
      // ==============================

      const variants = p.variants.edges.map((v) => ({

        id: v.node.id,

        title: v.node.title,

        price: v.node.price,

        sku: v.node.sku,

        available: v.node.availableForSale,

        image:
          v.node.image?.url ||
          images[0]?.url ||
          "",

        options: v.node.selectedOptions,
      }));

      // ==============================
      // FINAL PRODUCT OBJECT
      // ==============================

      const product = {

        id: p.id,

        title: p.title,

        handle: p.handle,

        description: p.description,

        type: p.productType,

        vendor: p.vendor,

        tags: p.tags,

        image:
          images[0]?.url || "",

        images,

        variants,
      };

      allProducts.push(product);
    }

    hasNextPage = data.data.products.pageInfo.hasNextPage;

    if (hasNextPage && products.length > 0) {

      cursor = products[products.length - 1].cursor;
    }

    console.log("TOTAL LOADED:", allProducts.length);
  }

  return allProducts;
}

// ========================================
// BUILD PRODUCT BRAIN
// ========================================

async function buildBrain() {

  console.log("================================");
  console.log("STARTING ALYMWNDW PRODUCT BRAIN");
  console.log("================================");

  const products = await fetchAllProducts();

  fs.writeFileSync(
    "./public/products-brain.json",
    JSON.stringify(products, null, 2)
  );

  console.log("================================");
  console.log("PRODUCT BRAIN COMPLETE");
  console.log("TOTAL PRODUCTS:", products.length);
  console.log("FILE SAVED:");
  console.log("./public/products-brain.json");
  console.log("================================");
}

// ========================================
// RUN
// ========================================

buildBrain();
