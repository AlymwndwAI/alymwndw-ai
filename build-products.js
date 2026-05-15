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
// PARSE VARIANT
// ========================================

function parseVariant(v, images) {

  const optionText = `
    ${v.node.title}
    ${JSON.stringify(v.node.selectedOptions)}
  `.toLowerCase();

  // ========================================
  // METAL
  // ========================================

  let metal = "";

  if (optionText.includes("rose gold")) {
    metal = "rose gold";
  } else if (optionText.includes("yellow gold")) {
    metal = "yellow gold";
  } else if (optionText.includes("white gold")) {
    metal = "white gold";
  } else if (optionText.includes("silver")) {
    metal = "silver";
  } else if (optionText.includes("platinum")) {
    metal = "platinum";
  }

  // ========================================
  // STONE COLOR
  // ========================================

  let stoneColor = "";

  if (
    optionText.includes("yellow") &&
    !optionText.includes("yellow gold")
  ) {
    stoneColor = "yellow";
  } else if (
    optionText.includes("white") &&
    !optionText.includes("white gold")
  ) {
    stoneColor = "white";
  } else if (
    optionText.includes("pink") &&
    !optionText.includes("pink gold")
  ) {
    stoneColor = "pink";
  }

  // ========================================
  // SHAPE
  // ========================================

  let shape = "";

  if (optionText.includes("oval")) {
    shape = "oval";
  } else if (optionText.includes("emerald")) {
    shape = "emerald";
  } else if (optionText.includes("radiant")) {
    shape = "radiant";
  } else if (optionText.includes("pear")) {
    shape = "pear";
  } else if (optionText.includes("round")) {
    shape = "round";
  } else if (optionText.includes("cushion")) {
    shape = "cushion";
  } else if (optionText.includes("princess")) {
    shape = "princess";
  } else if (optionText.includes("marquise")) {
    shape = "marquise";
  } else if (optionText.includes("heart")) {
    shape = "heart";
  }

  // ========================================
  // STONE SIZE
  // ========================================

  let stoneSize = "";

  if (
    optionText.includes("0.5ct") ||
    optionText.includes("0.5 ct")
  ) {
    stoneSize = "0.5 CT";
  } else if (
    optionText.includes("1ct") ||
    optionText.includes("1 ct")
  ) {
    stoneSize = "1 CT";
  } else if (
    optionText.includes("1.5ct") ||
    optionText.includes("1.5 ct")
  ) {
    stoneSize = "1.5 CT";
  } else if (
    optionText.includes("2ct") ||
    optionText.includes("2 ct")
  ) {
    stoneSize = "2 CT";
  } else if (
    optionText.includes("3ct") ||
    optionText.includes("3 ct")
  ) {
    stoneSize = "3 CT";
  }

  // ========================================
  // SMART IMAGE MATCHING
  // ========================================

  let matchedImage = v.node.image?.url || "";

  if (!matchedImage) {

    const smartImage = images.find((img) => {

      const alt = (img.alt || "").toLowerCase();

      return (
        (metal && alt.includes(metal)) ||
        (shape && alt.includes(shape)) ||
        (stoneColor && alt.includes(stoneColor))
      );

    });

    matchedImage =
      smartImage?.url ||
      images[0]?.url ||
      "";

  }

  // ========================================
  // RETURN
  // ========================================

  return {

    id:
      v.node.id,

    title:
      v.node.title,

    sku:
      v.node.sku || "",

    available:
      v.node.availableForSale ?? true,

    price:
      `${v.node.price} AED`,

    rawPrice:
      Number(v.node.price),

    currency:
      "AED",

    image:
      matchedImage,

    mappedImage:
      matchedImage,

    metal,

    stoneColor,

    shape,

    stoneSize,

    options:
      v.node.selectedOptions,

  };

}

// ========================================
// BUILD AI FEATURES
// ========================================

function buildAiFeatures(product, text) {

  const ai = {

    category: "",
    collection: "",
    productType: "",
    subCategory: "",

    styles: [],
    intent: [],
    emotionalTriggers: [],
    searchKeywords: [],
    materials: [],

    variantMetalColors: [],
    variantStoneColors: [],
    variantStoneSizes: [],
    diamondShapes: [],

    language: "",
    supportedLanguages: [],
    certifications: [],
    features: [],
    upsells: [],

  };

  const collectionHandles =
    product.collections.map((c) => c.handle);

  // ========================================
  // MAKE FOR YOU
  // ========================================

  if (
    collectionHandles.includes(
      "make-for-you-gold-custom-jewelry"
    ) ||
    text.includes("custom") ||
    text.includes("personalized")
  ) {

    ai.collection =
      "make-for-you-gold-custom-jewelry";

    ai.category =
      "custom-jewelry";

    ai.productType =
      "custom-jewelry";

    ai.intent.push(
      "personalized jewelry",
      "custom necklace",
      "gift jewelry"
    );

    ai.styles.push(
      "luxury",
      "minimal"
    );

    ai.searchKeywords.push(
      "custom necklace",
      "name necklace"
    );

  }

  // ========================================
  // WEDDING
  // ========================================

  if (
    collectionHandles.includes(
      "wedding-rings-uae"
    ) ||
    text.includes("wedding") ||
    text.includes("engagement")
  ) {

    if (!ai.collection) {
      ai.collection = "wedding-rings-uae";
    }

    ai.category =
      "wedding-rings";

    ai.productType =
      "wedding-rings";

    ai.intent.push(
      "engagement",
      "wedding",
      "bridal"
    );

    ai.emotionalTriggers.push(
      "love",
      "forever"
    );

    ai.styles.push(
      "luxury",
      "classic"
    );

  }

  // ========================================
  // PEARL
  // ========================================

  if (
    collectionHandles.includes(
      "pearl-jewelry"
    ) ||
    text.includes("pearl")
  ) {

    if (!ai.collection) {
      ai.collection = "pearl-jewelry";
    }

    ai.category =
      "pearl-jewelry";

    ai.productType =
      "pearl-jewelry";

    ai.intent.push(
      "luxury pearl jewelry",
      "bridal jewelry"
    );

    ai.emotionalTriggers.push(
      "elegance",
      "timeless beauty"
    );

  }

  // ========================================
  // MOISSANITE
  // ========================================

  if (
    collectionHandles.includes(
      "certified-mossanite-shop-now"
    ) ||
    text.includes("moissanite") ||
    text.includes("gra certified")
  ) {

    if (!ai.collection) {
      ai.collection = "certified-mossanite-shop-now";
    }

    ai.category =
      "luxury-moissanite";

    ai.certifications.push(
      "GRA Certified"
    );

    ai.features.push(
      "diamond-like sparkle",
      "high brilliance"
    );

    ai.intent.push(
      "luxury moissanite jewelry",
      "engagement ring",
      "diamond alternative"
    );

    ai.emotionalTriggers.push(
      "brilliance",
      "luxury"
    );

    ai.styles.push(
      "luxury",
      "bridal"
    );

    ai.searchKeywords.push(
      "moissanite ring",
      "diamond alternative"
    );

    ai.upsells.push(
      "wedding bands"
    );

    if (text.includes("ring")) {
      ai.productType = "moissanite-ring";
    } else if (text.includes("necklace")) {
      ai.productType = "moissanite-necklace";
    } else if (text.includes("bracelet")) {
      ai.productType = "moissanite-bracelet";
    } else if (text.includes("earring")) {
      ai.productType = "moissanite-earring";
    } else {
      ai.productType = "moissanite-jewelry";
    }

    if (text.includes("tennis")) {

      ai.subCategory =
        "tennis-jewelry";

      ai.intent.push(
        "iced luxury jewelry"
      );

      ai.styles.push(
        "celebrity luxury"
      );

      ai.features.push(
        "high sparkle luxury"
      );

    }

  }

  // ========================================
  // LAB DIAMOND
  // ========================================

  if (
    collectionHandles.includes(
      "lab-grown-diamond-ring"
    ) ||
    text.includes("lab grown diamond") ||
    text.includes("lab diamond")
  ) {

    if (!ai.collection) {
      ai.collection = "lab-grown-diamond-ring";
    }

    ai.category =
      "lab-grown-diamond";

    ai.productType =
      "diamond-ring";

    ai.intent.push(
      "engagement",
      "wedding",
      "luxury diamond"
    );

    ai.styles.push(
      "luxury",
      "minimal"
    );

    ai.searchKeywords.push(
      "lab diamond ring",
      "lab grown diamond"
    );

  }

  // ========================================
  // ALPHA GOLD
  // ========================================

  if (
    collectionHandles.includes(
      "alpha-gold"
    ) ||
    text.includes("arabic letter") ||
    text.includes("initial")
  ) {

    if (!ai.collection) {
      ai.collection = "alpha-gold";
    }

    ai.category =
      "personalized-gold-jewelry";

    ai.productType =
      "initial-necklace";

    ai.intent.push(
      "gift jewelry",
      "personalized jewelry"
    );

    ai.styles.push(
      "minimal",
      "personalized"
    );

    if (text.includes("arabic")) {
      ai.language = "arabic";
      ai.supportedLanguages.push("arabic");
    }

    if (text.includes("english")) {
      ai.language = "english";
      ai.supportedLanguages.push("english");
    }

  }

  // ========================================
  // FALLBACK CATEGORY
  // ========================================

  if (!ai.category) {

    if (text.includes("ring")) {
      ai.category = "rings";
      ai.productType = "ring";
    } else if (text.includes("necklace")) {
      ai.category = "necklaces";
      ai.productType = "necklace";
    } else if (text.includes("bracelet")) {
      ai.category = "bracelets";
      ai.productType = "bracelet";
    } else if (text.includes("earring")) {
      ai.category = "earrings";
      ai.productType = "earring";
    }

  }

  // ========================================
  // MATERIALS
  // ========================================

  if (text.includes("gold"))       ai.materials.push("gold");
  if (text.includes("silver"))     ai.materials.push("silver");
  if (text.includes("platinum"))   ai.materials.push("platinum");
  if (text.includes("moissanite")) ai.materials.push("moissanite");
  if (text.includes("diamond"))    ai.materials.push("diamond");
  if (text.includes("pearl"))      ai.materials.push("pearl");

  // ========================================
  // VARIANT ANALYSIS
  // ========================================

  (product.variants || []).forEach((v) => {

    const variantText = `
      ${v.title}
      ${JSON.stringify(v.options)}
    `.toLowerCase();

    // METALS

    if (variantText.includes("rose gold")) {
      ai.variantMetalColors.push("rose gold");
    }
    if (variantText.includes("yellow gold")) {
      ai.variantMetalColors.push("yellow gold");
    }
    if (variantText.includes("white gold")) {
      ai.variantMetalColors.push("white gold");
    }
    if (variantText.includes("silver")) {
      ai.variantMetalColors.push("silver");
    }
    if (variantText.includes("platinum")) {
      ai.variantMetalColors.push("platinum");
    }

    // STONE COLORS

    if (
      variantText.includes("white") &&
      !variantText.includes("white gold")
    ) {
      ai.variantStoneColors.push("white");
    }
    if (
      variantText.includes("yellow") &&
      !variantText.includes("yellow gold")
    ) {
      ai.variantStoneColors.push("yellow");
    }
    if (
      variantText.includes("pink") &&
      !variantText.includes("pink gold")
    ) {
      ai.variantStoneColors.push("pink");
    }

    // SHAPES

    if (variantText.includes("oval"))     ai.diamondShapes.push("oval");
    if (variantText.includes("emerald"))  ai.diamondShapes.push("emerald");
    if (variantText.includes("radiant"))  ai.diamondShapes.push("radiant");
    if (variantText.includes("pear"))     ai.diamondShapes.push("pear");
    if (variantText.includes("round"))    ai.diamondShapes.push("round");
    if (variantText.includes("cushion"))  ai.diamondShapes.push("cushion");
    if (variantText.includes("princess")) ai.diamondShapes.push("princess");
    if (variantText.includes("marquise")) ai.diamondShapes.push("marquise");
    if (variantText.includes("heart"))    ai.diamondShapes.push("heart");

    // STONE SIZES

    if (
      variantText.includes("0.5ct") ||
      variantText.includes("0.5 ct")
    ) ai.variantStoneSizes.push("0.5 CT");

    if (
      variantText.includes("1ct") ||
      variantText.includes("1 ct")
    ) ai.variantStoneSizes.push("1 CT");

    if (
      variantText.includes("1.5ct") ||
      variantText.includes("1.5 ct")
    ) ai.variantStoneSizes.push("1.5 CT");

    if (
      variantText.includes("2ct") ||
      variantText.includes("2 ct")
    ) ai.variantStoneSizes.push("2 CT");

    if (
      variantText.includes("3ct") ||
      variantText.includes("3 ct")
    ) ai.variantStoneSizes.push("3 CT");

  });

  // ========================================
  // UNIQUE VALUES
  // ========================================

  ai.styles =             [...new Set(ai.styles)];
  ai.intent =             [...new Set(ai.intent)];
  ai.materials =          [...new Set(ai.materials)];
  ai.searchKeywords =     [...new Set(ai.searchKeywords)];
  ai.emotionalTriggers =  [...new Set(ai.emotionalTriggers)];
  ai.variantMetalColors = [...new Set(ai.variantMetalColors)];
  ai.variantStoneColors = [...new Set(ai.variantStoneColors)];
  ai.variantStoneSizes =  [...new Set(ai.variantStoneSizes)];
  ai.diamondShapes =      [...new Set(ai.diamondShapes)];
  ai.supportedLanguages = [...new Set(ai.supportedLanguages)];
  ai.certifications =     [...new Set(ai.certifications)];
  ai.features =           [...new Set(ai.features)];
  ai.upsells =            [...new Set(ai.upsells)];

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

    // ========================================
    // LOOP PRODUCTS
    // ========================================

    for (const item of products) {

      const p = item.node;

      // ========================================
      // IMAGES
      // ========================================

      const images =
        p.images.edges.map((img) => ({
          url: img.node.url,
          alt: img.node.altText || "",
        }));

      // ========================================
      // VARIANTS
      // ========================================

      const variants =
        p.variants.edges.map((v) =>
          parseVariant(v, images)
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
          p.collections.edges.map((c) => ({
            title: c.node.title,
            handle: c.node.handle,
          })),

        image:
          images[0]?.url || "",

        images,

        variants,

        price:
          variants[0]?.price || "",

        rawPrice:
          variants[0]?.rawPrice || 0,

        currency:
          "AED",

        reviewRating:
          4.9,

        reviewCount:
          120,

        url:
          `https://${SHOP}/products/${p.handle}`,

      };

      // ========================================
      // PRODUCT TEXT
      // ========================================

      const text = `
        ${p.title}
        ${p.description}
        ${p.tags.join(" ")}
        ${p.productType}
      `.toLowerCase();

      // ========================================
      // AI FEATURES
      // ========================================

      product.aiFeatures =
        buildAiFeatures(product, text);

      // ========================================
      // SAVE
      // ========================================

      allProducts.push(product);

    }

    // ========================================
    // PAGINATION
    // ========================================

    hasNextPage =
      data.data.products.pageInfo.hasNextPage;

    if (hasNextPage && products.length > 0) {
      cursor =
        products[products.length - 1].cursor;
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

    // ========================================
    // CREATE PUBLIC DIR
    // ========================================

    if (!fs.existsSync("./public")) {
      fs.mkdirSync("./public");
    }

    // ========================================
    // SAVE JSON
    // ========================================

    fs.writeFileSync(

      "./public/products-brain.json",

      JSON.stringify(products, null, 2)

    );

    console.log(
      "PRODUCT BRAIN COMPLETE"
    );

    console.log(
      "TOTAL PRODUCTS:",
      products.length
    );

  } catch (err) {

    console.log("BUILD ERROR:");
    console.log(err);
    process.exit(1);

  }

}

// ========================================
// START
// ========================================

buildBrain();
