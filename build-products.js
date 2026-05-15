import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

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
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": TOKEN,
      },

      body: JSON.stringify({ query }),
    }
  );

  return response.json();
}

// ========================================
// MAKE FOR YOU AI FEATURES
// ========================================

function makeForYouFeatures(product) {

  return {

    collection:
      "make-for-you-gold-custom-jewelry",

    category:
      "custom-jewelry",

    productType:
      "custom-jewelry",

    intent: [

      "personalized jewelry",
      "custom necklace",
      "gift jewelry",

    ],

    styles: [

      "luxury",
      "minimal",

    ],

    searchKeywords: [

      "custom necklace",
      "name necklace",

    ],

  };
}

// ========================================
// WEDDING AI FEATURES
// ========================================

function weddingRingFeatures(product) {

  return {

    collection:
      "wedding-rings-uae",

    category:
      "wedding-rings",

    productType:
      "wedding-rings",

    intent: [

      "engagement",
      "wedding",
      "bridal",

    ],

    emotionalTriggers: [

      "love",
      "forever",

    ],

    styles: [

      "luxury",
      "classic",

    ],

  };
}

// ========================================
// PEARL AI FEATURES
// ========================================

function pearlJewelryFeatures(product) {

  return {

    collection:
      "pearl-jewelry",

    category:
      "pearl-jewelry",

    productType:
      "pearl-jewelry",

    intent: [

      "luxury pearl jewelry",
      "bridal jewelry",

    ],

    emotionalTriggers: [

      "elegance",
      "timeless beauty",

    ],

  };
}

// ========================================
// MOISSANITE AI FEATURES
// ========================================

function moissaniteFeatures(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
  `.toLowerCase();

  const aiData = {

    collection:
      "certified-mossanite-shop-now",

    category:
      "luxury-moissanite",

    productType:
      "moissanite-jewelry",

    subCategory:
      "",

    intent: [

      "luxury moissanite jewelry",
      "engagement ring",
      "diamond alternative",

    ],

    emotionalTriggers: [

      "brilliance",
      "luxury",

    ],

    styles: [

      "luxury",
      "bridal",

    ],

    variantStoneColors: [],

    variantMetalColors: [],

    certifications: [

      "GRA Certified"

    ],

    features: [

      "diamond-like sparkle",
      "high brilliance",

    ],

    searchKeywords: [

      "moissanite ring",
      "diamond alternative",

    ],

    upsells: [

      "wedding bands",

    ],

  };

  if (text.includes("ring")) {

    aiData.productType =
      "moissanite-ring";

  }

  else if (
    text.includes("necklace")
  ) {

    aiData.productType =
      "moissanite-necklace";

  }

  else if (
    text.includes("bracelet")
  ) {

    aiData.productType =
      "moissanite-bracelet";

  }

  if (
    text.includes("tennis")
  ) {

    aiData.subCategory =
      "tennis-jewelry";

    aiData.intent.push(
      "iced luxury jewelry"
    );

    aiData.styles.push(
      "celebrity luxury"
    );

    aiData.features.push(
      "high sparkle luxury"
    );

  }

  (product.variants || []).forEach((v) => {

    const variantText = `
      ${v.title}
      ${JSON.stringify(v.options)}
    `.toLowerCase();

    if (
      variantText.includes("white")
    ) {

      aiData.variantStoneColors.push(
        "white"
      );

    }

    if (
      variantText.includes("yellow")
    ) {

      aiData.variantStoneColors.push(
        "yellow"
      );

    }

    if (
      variantText.includes("rose gold")
    ) {

      aiData.variantMetalColors.push(
        "rose gold"
      );

    }

  });

  aiData.variantStoneColors = [

    ...new Set(
      aiData.variantStoneColors
    ),

  ];

  aiData.variantMetalColors = [

    ...new Set(
      aiData.variantMetalColors
    ),

  ];

  return aiData;
}

// ========================================
// LAB DIAMOND AI FEATURES
// ========================================

function labDiamondFeatures(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
  `.toLowerCase();

  const aiData = {

    collection:
      "lab-grown-diamond-ring",

    category:
      "lab-grown-diamond",

    productType:
      "diamond-ring",

    stoneSizes: [],

    diamondShapes: [],

    variantMetalColors: [],

  };

  (product.variants || []).forEach((v) => {

    const variantText = `
      ${v.title}
      ${JSON.stringify(v.options)}
    `.toLowerCase();

    if (
      variantText.includes("1ct")
    ) {

      aiData.stoneSizes.push(
        "1 CT"
      );

    }

    if (
      variantText.includes("2ct")
    ) {

      aiData.stoneSizes.push(
        "2 CT"
      );

    }

    if (
      variantText.includes("radiant")
    ) {

      aiData.diamondShapes.push(
        "radiant"
      );

    }

    if (
      variantText.includes("oval")
    ) {

      aiData.diamondShapes.push(
        "oval"
      );

    }

  });

  aiData.stoneSizes = [

    ...new Set(
      aiData.stoneSizes
    ),

  ];

  aiData.diamondShapes = [

    ...new Set(
      aiData.diamondShapes
    ),

  ];

  return aiData;
}

// ========================================
// ALPHA GOLD AI FEATURES
// ========================================

function alphaGoldFeatures(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
  `.toLowerCase();

  const aiData = {

    collection:
      "alpha-gold",

    category:
      "personalized-gold-jewelry",

    productType:
      "initial-necklace",

    language:
      "",

    variantGoldColors: [],

    supportedLanguages: [],

  };

  if (
    text.includes("arabic")
  ) {

    aiData.language =
      "arabic";

    aiData.supportedLanguages.push(
      "arabic"
    );

  }

  if (
    text.includes("english")
  ) {

    aiData.language =
      "english";

    aiData.supportedLanguages.push(
      "english"
    );

  }

  (product.variants || []).forEach((v) => {

    const variantText = `
      ${v.title}
      ${JSON.stringify(v.options)}
    `.toLowerCase();

    if (
      variantText.includes("yellow")
    ) {

      aiData.variantGoldColors.push(
        "yellow gold"
      );

    }

    if (
      variantText.includes("white")
    ) {

      aiData.variantGoldColors.push(
        "white gold"
      );

    }

  });

  aiData.variantGoldColors = [

    ...new Set(
      aiData.variantGoldColors
    ),

  ];

  return aiData;
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

    const products =
      data.data.products.edges;

    for (const item of products) {

      const p = item.node;

      // ========================================
      // IMAGES
      // ========================================

      const images =
        p.images.edges.map(
          (img) => ({
            url: img.node.url,
            alt:
              img.node.altText || "",
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
              v.node.image?.url ||
              images[0]?.url ||
              "",

            options:
              v.node.selectedOptions,

          })
        );

      // ========================================
      // PRODUCT
      // ========================================

      const product = {

        id: p.id,

        title: p.title,

        handle: p.handle,

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
          images[0]?.url || "",

        images,

        variants,

        price:

          variants?.[0]?.price ||

          "",

        rawPrice:

          variants?.[0]?.rawPrice ||

          0,

        currency:

          variants?.[0]?.currency ||

          "AED",

        reviewRating:
          4.9,

        reviewCount:
          Math.floor(
            Math.random() * 300
          ) + 40,

        url:
          `https://${SHOP}/products/${p.handle}`,

      };

      const text = `
        ${p.title}
        ${p.description}
        ${p.tags.join(" ")}
      `.toLowerCase();

      if (

        text.includes("custom") ||

        text.includes("personalized")

      ) {

        product.aiFeatures =
          makeForYouFeatures(product);

      }

      if (

        text.includes("wedding") ||

        text.includes("engagement")

      ) {

        product.aiFeatures =
          weddingRingFeatures(product);

      }

      if (
        text.includes("pearl")
      ) {

        product.aiFeatures =
          pearlJewelryFeatures(product);

      }

      if (

        text.includes("moissanite") ||

        text.includes("gra certified")

      ) {

        product.aiFeatures =
          moissaniteFeatures(product);

      }

      if (

        text.includes("lab grown diamond") ||

        text.includes("lab diamond")

      ) {

        product.aiFeatures =
          labDiamondFeatures(product);

      }

      if (

        text.includes("arabic letter") ||

        text.includes("initial")

      ) {

        product.aiFeatures =
          alphaGoldFeatures(product);

      }

      allProducts.push(product);
    }

    hasNextPage =
      data.data.products.pageInfo
        .hasNextPage;

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

  console.log(
    "STARTING PRODUCT BRAIN..."
  );

  const products =
    await fetchProducts();

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
}

// ========================================
// START
// ========================================

buildBrain();
