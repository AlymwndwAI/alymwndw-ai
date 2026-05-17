import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";
import enrichProduct from "./brain/product-enrichment.js";

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
// PARSE STONE SIZE FROM VARIANT TITLE
// e.g. "0.70 CT", "1.10ct", "2.5 carat"
// ========================================

function parseStoneSize(text) {
  const match = text.match(/(\d+\.?\d*)\s*(ct|carat)/i);
  if (match) return match[1].trim() + " CT";
  return "";
}

// ========================================
// PARSE VARIANT
// ========================================

function parseVariant(v, images) {

  const optionText = `
    ${v.node.title}
    ${JSON.stringify(v.node.selectedOptions)}
  `.toLowerCase();

  // METAL
  let metal = "";
  if (optionText.includes("rose gold"))   metal = "rose gold";
  else if (optionText.includes("yellow gold")) metal = "yellow gold";
  else if (optionText.includes("white gold"))  metal = "white gold";
  else if (optionText.includes("platinum"))    metal = "platinum";
  else if (optionText.includes("silver"))      metal = "silver";
  else if (optionText.includes("gold"))        metal = "gold";

  // STONE COLOR
  let stoneColor = "";
  if (optionText.includes("blue"))   stoneColor = "blue";
  else if (optionText.includes("green"))  stoneColor = "green";
  else if (optionText.includes("pink"))   stoneColor = "pink";
  else if (optionText.includes("yellow")) stoneColor = "yellow";
  else if (optionText.includes("black"))  stoneColor = "black";
  else if (optionText.includes("red"))    stoneColor = "red";
  else if (optionText.includes("white"))  stoneColor = "white";
  else if (optionText.includes("purple")) stoneColor = "purple";
  else if (optionText.includes("orange")) stoneColor = "orange";

  // SHAPE
  let shape = "";
  if (optionText.includes("round"))    shape = "round";
  else if (optionText.includes("oval"))     shape = "oval";
  else if (optionText.includes("pear"))     shape = "pear";
  else if (optionText.includes("radiant"))  shape = "radiant";
  else if (optionText.includes("princess")) shape = "princess";
  else if (optionText.includes("cushion"))  shape = "cushion";
  else if (optionText.includes("heart"))    shape = "heart";
  else if (optionText.includes("marquise")) shape = "marquise";
  else if (optionText.includes("emerald"))  shape = "emerald";
  else if (optionText.includes("asscher"))  shape = "asscher";

  // STONE SIZE
  const stoneSize = parseStoneSize(optionText);

  // IMAGE — prefer variant image, fallback to first product image
  const matchedImage = v.node.image?.url || images[0]?.url || "";

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
// BUILD AI FEATURES
// pulls unique sets from variants so
// server.js search scoring works correctly
// ========================================

function buildAiFeatures(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
    ${product.type}
    ${(product.variants || []).map((v) => v.title).join(" ")}
  `.toLowerCase();

  const ai = {
    category: "",
    productType: "",
    collection: (product.collections?.[0]?.title || ""),
    collections: (product.collections || []).map((c) => c.title),

    styles: [],
    intent: [],
    materials: [],
    searchKeywords: [],
    emotionalTriggers: [],
    certifications: [],

    // pulled from variants — critical for server.js scoring
    variantMetalColors: [],
    variantStoneColors: [],
    variantStoneSizes: [],
    diamondShapes: [],
  };

  // CATEGORY
  if (text.includes("ring"))     { ai.category = "ring";     ai.productType = "ring"; }
  if (text.includes("necklace")) { ai.category = "necklace"; ai.productType = "necklace"; }
  if (text.includes("bracelet")) { ai.category = "bracelet"; ai.productType = "bracelet"; }
  if (text.includes("earring"))  { ai.category = "earring";  ai.productType = "earring"; }
  if (text.includes("pendant"))  { ai.category = "pendant";  ai.productType = "pendant"; }
  if (text.includes("chain"))    { ai.category = "chain";    ai.productType = "chain"; }

  // MATERIALS
  const matList = [
    "diamond", "lab diamond", "lab grown diamond", "moissanite",
    "gold", "yellow gold", "white gold", "rose gold",
    "18k", "21k", "22k", "platinum", "silver", "925 silver", "pearl",
  ];
  matList.forEach((m) => { if (text.includes(m)) ai.materials.push(m); });

  // STYLES
  if (text.includes("tennis"))      ai.styles.push("tennis");
  if (text.includes("solitaire"))   ai.styles.push("solitaire");
  if (text.includes("halo"))        ai.styles.push("halo");
  if (text.includes("eternity"))    ai.styles.push("eternity");
  if (text.includes("name") || text.includes("initial")) ai.styles.push("name", "custom");
  if (text.includes("men") || text.includes("groom"))    ai.styles.push("men");
  if (text.includes("kids") || text.includes("children")) ai.styles.push("kids");
  if (text.includes("couple") || text.includes("matching")) ai.styles.push("couple");

  // INTENT
  if (text.includes("engagement") || text.includes("proposal")) ai.intent.push("engagement", "proposal");
  if (text.includes("wedding"))    ai.intent.push("wedding");
  if (text.includes("gift"))       ai.intent.push("gift");
  if (text.includes("birthday"))   ai.intent.push("birthday");
  if (text.includes("anniversary")) ai.intent.push("anniversary");

  // EMOTIONAL TRIGGERS
  if (text.includes("love") || text.includes("heart"))   ai.emotionalTriggers.push("love");
  if (text.includes("elegant") || text.includes("luxury")) ai.emotionalTriggers.push("elegance");
  if (text.includes("diamond"))  ai.emotionalTriggers.push("prestige");
  if (text.includes("custom") || text.includes("personalized")) ai.emotionalTriggers.push("personal story");

  // CERTIFICATIONS
  if (text.includes("gia"))    ai.certifications.push("GIA");
  if (text.includes("igi"))    ai.certifications.push("IGI");
  if (text.includes("certified")) ai.certifications.push("certified");

  // PULL UNIQUE VALUES FROM VARIANTS
  const metalSet      = new Set();
  const stoneColorSet = new Set();
  const stoneSizeSet  = new Set();
  const shapeSet      = new Set();

  (product.variants || []).forEach((v) => {
    if (v.metal)      metalSet.add(v.metal);
    if (v.stoneColor) stoneColorSet.add(v.stoneColor);
    if (v.stoneSize)  stoneSizeSet.add(v.stoneSize);
    if (v.shape)      shapeSet.add(v.shape);
  });

  ai.variantMetalColors  = [...metalSet];
  ai.variantStoneColors  = [...stoneColorSet];
  ai.variantStoneSizes   = [...stoneSizeSet];
  ai.diamondShapes       = [...shapeSet];

  // SEARCH KEYWORDS — all useful terms in one flat array
  ai.searchKeywords = [
    ...new Set([
      ai.category,
      ai.productType,
      ...ai.materials,
      ...ai.styles,
      ...ai.intent,
      ...ai.variantMetalColors,
      ...ai.variantStoneColors,
      ...ai.diamondShapes,
      ...ai.collections,
    ]),
  ].filter(Boolean);

  return ai;
}

// ========================================
// FETCH ALL PRODUCTS FROM SHOPIFY
// ========================================

async function fetchProducts() {

  let allProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {

    console.log(`FETCHING... (total so far: ${allProducts.length})`);

    const query = `
    {
      products(first: 250 ${cursor ? `, after: "${cursor}"` : ""}) {

        pageInfo { hasNextPage }

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
                node { title handle }
              }
            }

            images(first: 20) {
              edges {
                node { url altText }
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
                  selectedOptions { name value }
                  image { url }
                }
              }
            }

          }
        }

      }
    }
    `;

    const data = await shopifyQuery(query);
    const edges = data.data.products.edges;

    for (const item of edges) {

      const p = item.node;

      const images = p.images.edges.map((img) => ({
        url: img.node.url,
        alt: img.node.altText || "",
      }));

      const collections = p.collections.edges.map((c) => ({
        title: c.node.title,
        handle: c.node.handle,
      }));

      const variants = p.variants.edges.map((v) => parseVariant(v, images));

      // Clean domain — store URL without double domain
      const domain = SHOP.replace("https://", "").replace("http://", "").replace(/\/$/, "");

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
        url: `https://${domain}/products/${p.handle}`,
      };

      product.aiFeatures = buildAiFeatures(product);
      product.enrichment = enrichProduct(product);

      allProducts.push(product);
    }

    hasNextPage = data.data.products.pageInfo.hasNextPage;

    if (hasNextPage && edges.length > 0) {
      cursor = edges[edges.length - 1].cursor;
    }

    console.log(`TOTAL: ${allProducts.length}`);
  }

  return allProducts;
}

// ========================================
// BUILD BRAIN
// ========================================

async function buildBrain() {
  try {
    console.log("STARTING PRODUCT BRAIN BUILD...");

    const products = await fetchProducts();

    if (!fs.existsSync("./public")) {
      fs.mkdirSync("./public", { recursive: true });
    }

    fs.writeFileSync(
      "./public/products-brain.json",
      JSON.stringify(products, null, 2)
    );

    console.log("✅ PRODUCT BRAIN COMPLETE");
    console.log(`✅ TOTAL PRODUCTS: ${products.length}`);

  } catch (err) {
    console.error("BUILD BRAIN ERROR:", err);
    process.exit(1);
  }
}

buildBrain();
