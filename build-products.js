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
  } else if (optionText.includes("platinum 950") || optionText.includes("platinum")) {
    metal = "platinum";
  } else if (optionText.includes("gold 18k") || optionText.includes("gold 750") || optionText.includes("gold 18")) {
    metal = "gold";
  } else if (optionText.includes("silver 925") || optionText.includes("silver")) {
    metal = "silver";
  } else if (optionText.includes("gold")) {
    metal = "gold";
  }

  // ========================================
  // STONE COLOR
  // ========================================

  let stoneColor = "";

  if (optionText.includes("royal purple") || optionText.includes("purple")) {
    stoneColor = "purple";
  } else if (optionText.includes("red") || optionText.includes("ruby")) {
    stoneColor = "red";
  } else if (
    optionText.includes("rose") &&
    !optionText.includes("rose gold")
  ) {
    stoneColor = "rose";
  } else if (
    optionText.includes("pink") &&
    !optionText.includes("pink gold")
  ) {
    stoneColor = "pink";
  } else if (
    optionText.includes("yellow") &&
    !optionText.includes("yellow gold")
  ) {
    stoneColor = "yellow";
  } else if (
    optionText.includes("white") &&
    !optionText.includes("white gold")
  ) {
    stoneColor = "white";
  } else if (optionText.includes("blue") || optionText.includes("sapphire")) {
    stoneColor = "blue";
  } else if (optionText.includes("green") || optionText.includes("emerald")) {
    stoneColor = "green";
  } else if (optionText.includes("black")) {
    stoneColor = "black";
  } else if (optionText.includes("orange")) {
    stoneColor = "orange";
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
  } else if (optionText.includes("asscher")) {
    shape = "asscher";
  } else if (optionText.includes("hexagonal")) {
    shape = "hexagonal";
  }

  // ========================================
  // STONE SIZE
  // ========================================

  let stoneSize = "";

  const sizeMatch = optionText.match(/(\d+\.?\d*)\s*ct/);
  if (sizeMatch) {
    stoneSize = `${sizeMatch[1]} CT`;
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

    matchedImage = smartImage?.url || images[0]?.url || "";

  }

  return {
    id: v.node.id,
    title: v.node.title,
    sku: v.node.sku || "",
    available: v.node.availableForSale ?? true,
    price: `${v.node.price} AED`,
    rawPrice: Number(v.node.price),
    currency: "AED",
    image: matchedImage,
    mappedImage: matchedImage,
    metal,
    stoneColor,
    shape,
    stoneSize,
    options: v.node.selectedOptions,
  };

}

// ========================================
// BUILD AI FEATURES FROM COLLECTIONS
// ========================================

function buildAiFeatures(product) {

  const collectionTitles =
    product.collections.map((c) => c.title.toLowerCase());

  const collectionHandles =
    product.collections.map((c) => c.handle.toLowerCase());

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
    ${product.type}
    ${collectionTitles.join(" ")}
  `.toLowerCase();

  const ai = {
    category: "",
    collection: "",
    collections: product.collections.map((c) => c.title),
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

  const hasCollection = (keyword) =>
    collectionTitles.some((c) => c.includes(keyword)) ||
    collectionHandles.some((c) => c.includes(keyword));

  // ========================================
  // PRODUCT TYPE FROM COLLECTIONS
  // ========================================

  if (hasCollection("ring") || text.includes("ring")) {
    ai.category = "rings";
    ai.productType = "ring";
  } else if (hasCollection("necklace") || text.includes("necklace")) {
    ai.category = "necklaces";
    ai.productType = "necklace";
  } else if (hasCollection("bracelet") || text.includes("bracelet")) {
    ai.category = "bracelets";
    ai.productType = "bracelet";
  } else if (hasCollection("earring") || text.includes("earring")) {
    ai.category = "earrings";
    ai.productType = "earring";
  } else if (hasCollection("chain") || text.includes("chain")) {
    ai.category = "chains";
    ai.productType = "chain";
  } else if (hasCollection("pendant") || text.includes("pendant")) {
    ai.category = "pendants";
    ai.productType = "pendant";
  }

  // ========================================
  // MOISSANITE
  // ========================================

  if (
    hasCollection("moissanite") ||
    hasCollection("massonite") ||
    hasCollection("mossanite") ||
    text.includes("moissanite") ||
    text.includes("gra certified")
  ) {

    ai.collection = "moissanite";
    ai.certifications.push("GRA Certified");
    ai.features.push("diamond-like sparkle", "high brilliance");
    ai.intent.push("luxury moissanite jewelry", "engagement ring", "diamond alternative");
    ai.emotionalTriggers.push("brilliance", "luxury");
    ai.styles.push("luxury", "bridal");
    ai.searchKeywords.push("moissanite ring", "diamond alternative", "gra certified");
    ai.upsells.push("wedding bands");
    ai.materials.push("moissanite");

    if (text.includes("tennis")) {
      ai.subCategory = "tennis-jewelry";
      ai.intent.push("iced luxury jewelry");
      ai.styles.push("celebrity luxury");
    }

  }

  // ========================================
  // LAB GROWN DIAMOND
  // ========================================

  if (
    hasCollection("lab grown") ||
    hasCollection("lab diamond") ||
    text.includes("lab grown diamond") ||
    text.includes("lab diamond")
  ) {

    ai.collection = ai.collection || "lab-grown-diamond";
    ai.intent.push("engagement", "wedding", "luxury diamond");
    ai.styles.push("luxury", "minimal");
    ai.searchKeywords.push("lab diamond ring", "lab grown diamond");
    ai.materials.push("lab diamond");

  }

  // ========================================
  // MAKE FOR YOU / CUSTOM
  // ========================================

  if (
    hasCollection("make for you") ||
    hasCollection("custom") ||
    text.includes("custom") ||
    text.includes("personalized")
  ) {

    ai.collection = ai.collection || "custom-jewelry";
    ai.intent.push("personalized jewelry", "custom jewelry", "gift jewelry");
    ai.styles.push("luxury", "minimal", "personalized");
    ai.searchKeywords.push("custom necklace", "name necklace", "personalized jewelry");

  }

  // ========================================
  // WEDDING / ENGAGEMENT
  // ========================================

  if (
    hasCollection("wedding") ||
    hasCollection("engagement") ||
    text.includes("wedding") ||
    text.includes("engagement")
  ) {

    ai.collection = ai.collection || "wedding-rings";
    ai.intent.push("engagement", "wedding", "bridal");
    ai.emotionalTriggers.push("love", "forever", "commitment");
    ai.styles.push("luxury", "classic");

  }

  // ========================================
  // PEARL
  // ========================================

  if (
    hasCollection("pearl") ||
    text.includes("pearl")
  ) {

    ai.collection = ai.collection || "pearl-jewelry";
    ai.intent.push("luxury pearl jewelry", "bridal jewelry", "elegant jewelry");
    ai.emotionalTriggers.push("elegance", "timeless beauty");
    ai.materials.push("pearl");

  }

  // ========================================
  // DIANA PEARL
  // ========================================

  if (hasCollection("diana pearl")) {

    ai.collection = "diana-pearl";
    ai.styles.push("classic", "elegant");

  }

  // ========================================
  // MEN'S
  // ========================================

  if (
    hasCollection("men") ||
    text.includes("men") ||
    text.includes("man")
  ) {

    ai.intent.push("men jewelry", "gift for him");
    ai.styles.push("masculine", "bold");

  }

  // ========================================
  // KIDS
  // ========================================

  if (hasCollection("kids")) {

    ai.intent.push("kids jewelry", "gift for kids");
    ai.styles.push("cute", "minimal");

  }

  // ========================================
  // SILVER
  // ========================================

  if (
    hasCollection("silver") ||
    text.includes("silver 925") ||
    text.includes("sterling silver")
  ) {

    ai.materials.push("silver 925");
    ai.searchKeywords.push("silver jewelry", "925 silver");

  }

  // ========================================
  // SHAPES FROM COLLECTIONS
  // ========================================

  const shapes = ["oval", "pear", "round", "emerald", "princess", "radiant", "marquise", "cushion", "asscher", "hexagonal", "heart"];

  shapes.forEach((shape) => {
    if (hasCollection(shape) || text.includes(shape)) {
      ai.diamondShapes.push(shape);
    }
  });

  // ========================================
  // FLASH SALE / BEST SELLERS
  // ========================================

  if (hasCollection("flash sale")) {
    ai.searchKeywords.push("sale", "discount");
  }

  if (hasCollection("best sell")) {
    ai.searchKeywords.push("best seller", "popular");
  }

  if (hasCollection("newly arrived") || hasCollection("newest")) {
    ai.searchKeywords.push("new arrival", "latest");
  }

  // ========================================
  // MATERIALS FROM TEXT
  // ========================================

  if (text.includes("gold")) ai.materials.push("gold");
  if (text.includes("platinum")) ai.materials.push("platinum");
  if (text.includes("diamond")) ai.materials.push("diamond");

  // ========================================
  // VARIANT ANALYSIS
  // ========================================

  (product.variants || []).forEach((v) => {

    const variantText = `
      ${v.title}
      ${JSON.stringify(v.options)}
    `.toLowerCase();

    if (variantText.includes("rose gold")) ai.variantMetalColors.push("rose gold");
    if (variantText.includes("yellow gold")) ai.variantMetalColors.push("yellow gold");
    if (variantText.includes("white gold")) ai.variantMetalColors.push("white gold");
    if (variantText.includes("silver")) ai.variantMetalColors.push("silver");
    if (variantText.includes("platinum")) ai.variantMetalColors.push("platinum");

    if (variantText.includes("white") && !variantText.includes("white gold")) ai.variantStoneColors.push("white");
    if (variantText.includes("yellow") && !variantText.includes("yellow gold")) ai.variantStoneColors.push("yellow");
    if (variantText.includes("pink") && !variantText.includes("pink gold")) ai.variantStoneColors.push("pink");
    if (variantText.includes("blue")) ai.variantStoneColors.push("blue");

    shapes.forEach((shape) => {
      if (variantText.includes(shape)) ai.diamondShapes.push(shape);
    });

    const sizeMatch = variantText.match(/(\d+\.?\d*)\s*ct/);
    if (sizeMatch) ai.variantStoneSizes.push(`${sizeMatch[1]} CT`);

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

    console.log("FETCHING NEXT 250 PRODUCTS...");

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

    const data = await shopifyQuery(query);
    const products = data.data.products.edges;

    for (const item of products) {

      const p = item.node;

      // IMAGES
      const images = p.images.edges.map((img) => ({
        url: img.node.url,
        alt: img.node.altText || "",
      }));

      // COLLECTIONS
      const collections = p.collections.edges.map((c) => ({
        title: c.node.title,
        handle: c.node.handle,
      }));

      // VARIANTS
      const variants = p.variants.edges.map((v) =>
        parseVariant(v, images)
      );

      // PRODUCT
      const product = {
        id: p.id,
        title: p.title,
        handle: p.handle,
        description: p.description,
        type: p.productType,
        vendor: p.vendor,
        tags: p.tags,
        collections,
        image: images[0]?.url || "",
        images,
        variants,
        price: variants[0]?.price || "",
        rawPrice: variants[0]?.rawPrice || 0,
        currency: "AED",
        reviewRating: 4.9,
        reviewCount: 120,
        url: `https://${SHOP}/products/${p.handle}`,
      };

      // AI FEATURES
      product.aiFeatures = buildAiFeatures(product);

      allProducts.push(product);

    }

    hasNextPage = data.data.products.pageInfo.hasNextPage;

    if (hasNextPage && products.length > 0) {
      cursor = products[products.length - 1].cursor;
    }

    console.log("TOTAL PRODUCTS:", allProducts.length);

  }

  return allProducts;

}

// ========================================
// BUILD PRODUCT BRAIN
// ========================================

async function buildBrain() {

  try {

    console.log("STARTING PRODUCT BRAIN...");

    const products = await fetchProducts();

    if (!fs.existsSync("./public")) {
      fs.mkdirSync("./public");
    }

    fs.writeFileSync(
      "./public/products-brain.json",
      JSON.stringify(products, null, 2)
    );

    console.log("PRODUCT BRAIN COMPLETE");
    console.log("TOTAL PRODUCTS:", products.length);

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
