import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import crypto from "crypto";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;

const conversations = {};
const summaries = {};
const sessionTimestamps = {};
const sessionProducts = {};
const sessionImageCount = {};
const sessionEmails = {};

setInterval(() => {
  const now = Date.now();
  Object.keys(sessionTimestamps).forEach((id) => {
    if (now - sessionTimestamps[id] > 3600000) {
      delete conversations[id];
      delete summaries[id];
      delete sessionTimestamps[id];
      delete sessionImageCount[id];
      delete sessionEmails[id];
      delete sessionProducts[id];
    }
  });
}, 3600000);

let products = [];

try {
  const raw = fs.readFileSync("./public/products-brain.json", "utf8");
  products = JSON.parse(raw);
  console.log("PRODUCT BRAIN LOADED: " + products.length);
} catch (err) {
  console.log("NO PRODUCTS BRAIN FOUND");
}

async function shopifyQuery(query) {
  try {
    const response = await fetch(
      "https://" + SHOP + "/admin/api/2025-01/graphql.json",
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
  } catch (err) {
    return null;
  }
}

// =====================================
// SHOPIFY STOREFRONT API
// =====================================

async function storefrontQuery(query, variables = {}) {
  try {
    const response = await fetch(
      "https://" + SHOP + "/api/2025-01/graphql.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
      }
    );
    return response.json();
  } catch (err) {
    console.log("STOREFRONT ERROR:", err.message);
    return null;
  }
}

async function getActiveDiscounts() {
  try {
    const data = await shopifyQuery(`
      {
        discountNodes(first: 10) {
          edges {
            node {
              discount {
                ... on DiscountCodeBasic {
                  title
                  status
                  codes(first: 3) {
                    edges { node { code } }
                  }
                  customerGets {
                    value {
                      ... on DiscountPercentage { percentage }
                      ... on DiscountAmount { amount { amount currencyCode } }
                    }
                  }
                }
                ... on DiscountAutomaticBasic {
                  title
                  status
                  customerGets {
                    value {
                      ... on DiscountPercentage { percentage }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);
    if (!data || !data.data || !data.data.discountNodes || !data.data.discountNodes.edges) return [];
    return data.data.discountNodes.edges
      .map((e) => e.node.discount)
      .filter((d) => d && d.status === "ACTIVE");
  } catch (err) {
    return [];
  }
}

function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replaceAll("\u0623", "\u0627").replaceAll("\u0625", "\u0627").replaceAll("\u0622", "\u0627")
    .replaceAll("\u0629", "\u0647").replaceAll("\u0649", "\u064a")
    .replaceAll("خاتم خطوبه", "engagement ring")
    .replaceAll("خاتم خطوبة", "engagement ring")
    .replaceAll("سلسله اسم", "name necklace")
    .replaceAll("سلسلة اسم", "name necklace")
    .replaceAll("سلسله حرف", "initial necklace")
    .replaceAll("سلسلة حرف", "initial necklace")
    .replaceAll("روز جولد", "rose gold")
    .replaceAll("خاتم", "ring").replaceAll("دبله", "ring").replaceAll("محبس", "ring")
    .replaceAll("عقد", "necklace").replaceAll("سلسله", "necklace").replaceAll("سلسلة", "necklace")
    .replaceAll("اسوره", "bracelet").replaceAll("أسوارة", "bracelet")
    .replaceAll("حلق", "earring").replaceAll("حلقان", "earring")
    .replaceAll("ذهب", "gold").replaceAll("فضه", "silver").replaceAll("فضة", "silver")
    .replaceAll("بلاتين", "platinum")
    .replaceAll("الماس", "diamond")
    .replaceAll("موزانيت", "moissanite").replaceAll("مويسانيت", "moissanite").replaceAll("موزنايت", "moissanite")
    .replaceAll("روز", "rose gold")
    .replaceAll("اصفر", "yellow gold").replaceAll("ابيض", "white gold")
    .replaceAll("هديه", "gift jewelry").replaceAll("هدية", "gift jewelry")
    .replaceAll("اسم", "name").replaceAll("حرف", "initial")
    .replaceAll("قلاده", "necklace").replaceAll("قلادة", "necklace")
    .replaceAll("دلايه", "pendant").replaceAll("دلاية", "pendant")
    .replaceAll("رجالي", "men").replaceAll("رجال", "men")
    .replaceAll("اطفال", "kids").replaceAll("أطفال", "kids")
    .replaceAll("خصم", "discount").replaceAll("تخفيض", "discount")
    .replaceAll("زوجين", "couple").replaceAll("زوجي", "couple")
    .replaceAll("هدية", "gift").replaceAll("هديه", "gift");
}

function detectLanguage(message) {
  return /[\u0600-\u06FF]/.test(message) ? "arabic" : "english";
}

async function extractIntent(userMessage) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You are a jewelry search intent extractor. Extract the customer jewelry search intent and return ONLY a JSON object. Format: {\"category\": \"ring|necklace|bracelet|earring|pendant|chain|\", \"metal\": \"rose gold|yellow gold|white gold|silver|platinum|\", \"stone\": \"moissanite|diamond|pearl|\", \"shape\": \"oval|pear|round|emerald|princess|radiant|marquise|cushion|heart|asscher|\", \"occasion\": \"wedding|engagement|gift|anniversary|birthday|\", \"style\": \"men|kids|couple|custom|name|initial|tennis|\", \"keywords\": []}. Only fill fields clearly mentioned. Return ONLY the JSON.",
        },
        { role: "user", content: userMessage },
      ],
    });
    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function shouldSearchProducts(message) {
  const msg = normalizeText(message);
  const keywords = [
    "ring", "necklace", "bracelet", "earring", "pendant", "chain",
    "name", "initial", "letter", "custom", "personalized",
    "diamond", "gold", "silver", "platinum", "rose gold", "moissanite", "pearl",
    "gift", "luxury", "bridal", "wedding", "engagement",
    "oval", "pear", "round", "emerald", "princess", "radiant", "heart",
    "men", "kids", "couple", "tennis",
    "show", "recommend", "suggest", "find", "want", "buy",
    "هديه", "هدية", "ذكري", "عيد", "مجوهرات", "جواهر", "رجالي", "زوجين",
  ];
  return keywords.some((w) => msg.includes(normalizeText(w)));
}

function shouldShowNext(message) {
  const msg = message.toLowerCase();
  const keywords = [
    "next", "another", "more", "different", "other", "else",
    "تاني", "غيره", "غيرها", "واحد تاني", "ورني تاني",
    "قطعه اخره", "قطعة اخرى", "قطعه اخري", "قطعة أخرى",
    "اخري", "اخره", "اخرى", "مش عاجبني", "غير",
    "كمان", "شوف تاني", "ورني غيره", "حاجة تانية",
  ];
  return keywords.some((w) => msg.includes(w));
}

function shouldAskDiscount(message) {
  const msg = normalizeText(message);
  return msg.includes("discount") || msg.includes("sale") ||
    msg.includes("offer") || msg.includes("promo") || msg.includes("code");
}

function roughFilter(userMessage, intent, products) {
  const msg = normalizeText(userMessage);
  const words = msg.split(" ").filter((w) => w.length > 2);
  const intentWords = [
    intent && intent.category,
    intent && intent.metal,
    intent && intent.stone,
    intent && intent.shape,
    intent && intent.occasion,
    intent && intent.style,
    ...((intent && intent.keywords) || []),
  ].filter(Boolean).map((w) => normalizeText(w));

  let scoredProducts = products.map((p) => {
    const collectionText = ((p.aiFeatures && p.aiFeatures.collections) || []).join(" ").toLowerCase();
    const text = normalizeText(
      (p.title || "") + " " + (p.description || "") + " " + (p.type || "") + " " +
      ((p.tags && p.tags.join(" ")) || "") + " " +
      ((p.aiFeatures && p.aiFeatures.category) || "") + " " +
      ((p.aiFeatures && p.aiFeatures.collection) || "") + " " +
      ((p.aiFeatures && p.aiFeatures.productType) || "") + " " +
      ((p.aiFeatures && p.aiFeatures.styles && p.aiFeatures.styles.join(" ")) || "") + " " +
      ((p.aiFeatures && p.aiFeatures.intent && p.aiFeatures.intent.join(" ")) || "") + " " +
      ((p.aiFeatures && p.aiFeatures.searchKeywords && p.aiFeatures.searchKeywords.join(" ")) || "") + " " +
      ((p.aiFeatures && p.aiFeatures.materials && p.aiFeatures.materials.join(" ")) || "") + " " +
      ((p.aiFeatures && p.aiFeatures.variantMetalColors && p.aiFeatures.variantMetalColors.join(" ")) || "") + " " +
      ((p.aiFeatures && p.aiFeatures.diamondShapes && p.aiFeatures.diamondShapes.join(" ")) || "") + " " +
      collectionText
    );

    let score = 0;
    words.forEach((word) => { if (text.includes(word)) score += 10; });
    intentWords.forEach((word) => { if (word && text.includes(word)) score += 40; });
    if (intent && intent.category && text.includes(intent.category)) score += 100;
    if (intent && intent.metal && text.includes(intent.metal)) score += 150;
    if (intent && intent.stone && text.includes(intent.stone)) score += 200;
    if (intent && intent.shape && text.includes(intent.shape)) score += 150;
    if (intent && intent.occasion && text.includes(intent.occasion)) score += 120;
    if (intent && intent.style && text.includes(intent.style)) score += 100;
    if (intent && intent.category) {
      if (!text.includes(intent.category)) score -= 200;
    } else {
      if (msg.includes("ring") && !text.includes("ring")) score -= 150;
      if (msg.includes("necklace") && !text.includes("necklace")) score -= 150;
      if (msg.includes("bracelet") && !text.includes("bracelet")) score -= 150;
      if (msg.includes("earring") && !text.includes("earring")) score -= 150;
    }
    return Object.assign({}, p, { score: score });
  });

  return scoredProducts.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 30);
}

async function aiSelectProducts(userMessage, intent, candidates) {
  try {
    const candidateList = candidates.map((p, i) => ({
      index: i, title: p.title,
      category: (p.aiFeatures && p.aiFeatures.category) || "",
      collections: ((p.aiFeatures && p.aiFeatures.collections) || []).slice(0, 5),
      productType: (p.aiFeatures && p.aiFeatures.productType) || "",
      metals: ((p.aiFeatures && p.aiFeatures.variantMetalColors) || []).join(", "),
      shapes: ((p.aiFeatures && p.aiFeatures.diamondShapes) || []).join(", "),
      stones: ((p.aiFeatures && p.aiFeatures.variantStoneColors) || []).join(", "),
      styles: ((p.aiFeatures && p.aiFeatures.styles) || []).join(", "),
      intent: ((p.aiFeatures && p.aiFeatures.intent) || []).join(", "),
      price: (p.variants && p.variants[0] && p.variants[0].price) || p.price || "",
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a luxury jewelry product selector. Choose the 8 most relevant AND DIVERSE products. CATEGORY IS MANDATORY. Return ONLY a JSON array of index numbers. No extra text." },
        { role: "user", content: "Customer: \"" + userMessage + "\"\nIntent: " + JSON.stringify(intent) + "\nProducts:\n" + JSON.stringify(candidateList, null, 2) + "\nReturn 8 diverse best index numbers as JSON array." },
      ],
    });

    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    const indices = JSON.parse(raw);
    return indices.filter((i) => i >= 0 && i < candidates.length).slice(0, 8).map((i) => candidates[i]);
  } catch (err) {
    return candidates.slice(0, 8);
  }
}

function buildProductDetails(p) {
  const rawPrices = (p.variants || []).map((v) => v.rawPrice).filter(Boolean).sort((a, b) => a - b);
  return {
    title: p.title,
    category: (p.aiFeatures && p.aiFeatures.category) || "",
    collections: ((p.aiFeatures && p.aiFeatures.collections) || []).slice(0, 5),
    metals: (p.aiFeatures && p.aiFeatures.variantMetalColors) || [],
    shapes: (p.aiFeatures && p.aiFeatures.diamondShapes) || [],
    stoneSizes: (p.aiFeatures && p.aiFeatures.variantStoneSizes) || [],
    stoneColors: (p.aiFeatures && p.aiFeatures.variantStoneColors) || [],
    certifications: (p.aiFeatures && p.aiFeatures.certifications) || [],
    startingPrice: rawPrices.length > 0 ? rawPrices[0] + " AED" : p.price || "",
    styles: (p.aiFeatures && p.aiFeatures.styles) || [],
    emotionalTriggers: (p.aiFeatures && p.aiFeatures.emotionalTriggers) || [],
    description: (p.description || "").slice(0, 200),
  };
}

function buildProductForFrontend(p) {
  const resolvedImage = p.image || "";
  return {
    id: p.id || "", title: p.title || "", handle: p.handle || "",
    description: p.description || "", type: p.type || "", vendor: p.vendor || "",
    image: resolvedImage, images: p.images || [],
    url: p.url || "https://alymwndw.com/products/" + p.handle,
    reviewRating: p.reviewRating != null ? p.reviewRating : 4.9,
    reviewCount: p.reviewCount != null ? p.reviewCount : 120,
    category: (p.aiFeatures && p.aiFeatures.category) || "",
    collection: (p.aiFeatures && p.aiFeatures.collection) || "",
    styles: (p.aiFeatures && p.aiFeatures.styles) || [],
    emotionalTriggers: (p.aiFeatures && p.aiFeatures.emotionalTriggers) || [],
    price: (p.variants && p.variants[0] && p.variants[0].price) || p.price || "",
    rawPrice: (p.variants && p.variants[0] && p.variants[0].rawPrice) || p.rawPrice || 0,
    currency: p.currency || "AED",
    variants: (p.variants || []).slice(0, 20).map((v) => {
      const variantImage = v.mappedImage || v.image || resolvedImage || "";
      return {
        id: v.id || "", title: v.title || "", sku: v.sku || "",
        available: v.available != null ? v.available : true,
        price: v.price || "", rawPrice: v.rawPrice || 0, currency: v.currency || "AED",
        image: variantImage, mappedImage: variantImage,
        metal: v.metal || "", stoneColor: v.stoneColor || "",
        shape: v.shape || "", stoneSize: v.stoneSize || "", options: v.options || [],
      };
    }),
  };
}

app.get("/", (req, res) => { res.send("ALYMWNDW AI RUNNING"); });

// =====================================
// SHOPIFY STOREFRONT API
// =====================================

async function storefrontQuery(query, variables = {}) {
  try {
    const response = await fetch(
      "https://" + SHOP + "/api/2025-01/graphql.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
      }
    );
    return response.json();
  } catch (err) {
    console.log("STOREFRONT ERROR:", err.message);
    return null;
  }
}

// =====================================
// ADD TO CART
// =====================================

app.post("/add-to-cart", async (req, res) => {
  try {

    const { variantId, quantity = 1, cartId } = req.body;

    if (!variantId) {
      return res.status(400).json({ error: "variantId required" });
    }

    let mutation;
    let variables;

    if (cartId) {
      mutation = `
        mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart {
              id
              checkoutUrl
              totalQuantity
            }
            userErrors { field message }
          }
        }
      `;
      variables = { cartId, lines: [{ merchandiseId: variantId, quantity }] };
    } else {
      mutation = `
        mutation cartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart {
              id
              checkoutUrl
              totalQuantity
            }
            userErrors { field message }
          }
        }
      `;
      variables = { input: { lines: [{ merchandiseId: variantId, quantity }] } };
    }

    const data = await storefrontQuery(mutation, variables);

    if (!data) return res.status(500).json({ error: "Storefront API error" });

    const cartData = cartId
      ? data.data?.cartLinesAdd?.cart
      : data.data?.cartCreate?.cart;

    const userErrors = cartId
      ? data.data?.cartLinesAdd?.userErrors
      : data.data?.cartCreate?.userErrors;

    if (userErrors && userErrors.length > 0) {
      return res.status(400).json({ error: userErrors[0].message });
    }

    if (!cartData) return res.status(500).json({ error: "Cart creation failed" });

    res.json({
      success: true,
      cartId: cartData.id,
      checkoutUrl: cartData.checkoutUrl,
      totalQuantity: cartData.totalQuantity,
    });

  } catch (err) {
    console.log("ADD TO CART ERROR:", err.message);
    res.status(500).json({ error: "Add to cart failed" });
  }
});

// =====================================
// ADD TO CART - SHOPIFY STOREFRONT API
// =====================================

app.post("/add-to-cart", async (req, res) => {

  try {

    const { variantId, quantity = 1, cartId } = req.body;

    if (!variantId) {
      return res.status(400).json({ error: "variantId required" });
    }

    // =====================================
    // CREATE OR UPDATE CART
    // =====================================

    let mutation;
    let variables;

    if (cartId) {

      // ADD TO EXISTING CART
      mutation = `
        mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart {
              id
              checkoutUrl
              totalQuantity
              lines(first: 10) {
                edges {
                  node {
                    id
                    quantity
                    merchandise {
                      ... on ProductVariant {
                        id
                        title
                        price { amount currencyCode }
                        product { title }
                      }
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      variables = {
        cartId,
        lines: [{ merchandiseId: variantId, quantity }],
      };

    } else {

      // CREATE NEW CART
      mutation = `
        mutation cartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart {
              id
              checkoutUrl
              totalQuantity
              lines(first: 10) {
                edges {
                  node {
                    id
                    quantity
                    merchandise {
                      ... on ProductVariant {
                        id
                        title
                        price { amount currencyCode }
                        product { title }
                      }
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      variables = {
        input: {
          lines: [{ merchandiseId: variantId, quantity }],
        },
      };

    }

    const data = await storefrontQuery(mutation, variables);

    if (!data) {
      return res.status(500).json({ error: "Storefront API error" });
    }

    const cartData = cartId
      ? data.data?.cartLinesAdd?.cart
      : data.data?.cartCreate?.cart;

    const userErrors = cartId
      ? data.data?.cartLinesAdd?.userErrors
      : data.data?.cartCreate?.userErrors;

    if (userErrors && userErrors.length > 0) {
      return res.status(400).json({ error: userErrors[0].message });
    }

    if (!cartData) {
      return res.status(500).json({ error: "Cart creation failed" });
    }

    res.json({
      success: true,
      cartId: cartData.id,
      checkoutUrl: cartData.checkoutUrl,
      totalQuantity: cartData.totalQuantity,
    });

  } catch (err) {
    console.log("ADD TO CART ERROR:", err.message);
    res.status(500).json({ error: "Add to cart failed" });
  }

});

// =============================================
// CUSTOMIZE PRODUCT - IMAGE TO IMAGE
// =============================================

app.post("/customize-product", async (req, res) => {
  try {
    const sessionId = req.body.sessionId || "";
    const productHandle = req.body.productHandle || "";
    const productImageUrl = req.body.productImageUrl || "";
    const userDesc = req.body.userDescription || "";

    if (!sessionImageCount[sessionId]) sessionImageCount[sessionId] = 0;
    const count = sessionImageCount[sessionId];

    if (count >= 2 && !sessionEmails[sessionId]) return res.json({ requireEmail: true });
    if (count >= 3) return res.json({ blocked: true });

    let englishDesc = userDesc;
    if (/[\u0600-\u06FF]/.test(userDesc)) {
      try {
        const translation = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          temperature: 0,
          messages: [
            { role: "system", content: "Translate the following Arabic jewelry customization request to English. Return only the translated text." },
            { role: "user", content: userDesc },
          ],
        });
        englishDesc = translation.choices[0].message.content.trim();
      } catch (e) { englishDesc = userDesc; }
    }

    const prompt =
      "This is a luxury jewelry product photo. Keep the EXACT SAME jewelry design, shape, style, and structure. " +
      "Only apply this specific change: " + englishDesc + ". " +
      "Maintain professional studio lighting, pure white background, ultra-realistic 8K quality, photorealistic gemstones and metal finish.";

    let response;

    if (productImageUrl && (productImageUrl.startsWith("http://") || productImageUrl.startsWith("https://"))) {
      try {
        const imgFetch = await fetch(productImageUrl);
        if (!imgFetch.ok) throw new Error("Image fetch failed: " + imgFetch.status);
        const imgArrayBuffer = await imgFetch.arrayBuffer();
        const imgBuffer = Buffer.from(imgArrayBuffer);
        const { toFile } = await import("openai");
        const imageFile = await toFile(imgBuffer, "product.jpg", { type: "image/jpeg" });
        response = await openai.images.edit({
          model: "gpt-image-1",
          image: imageFile,
          prompt: prompt,
          n: 1,
          size: "1024x1024",
        });
        console.log("IMAGE-TO-IMAGE used for: " + productHandle);
      } catch (editErr) {
        console.log("Image edit failed, falling back to generate: " + editErr.message);
        response = await openai.images.generate({
          model: "gpt-image-1",
          prompt: "Luxury jewelry: " + productHandle.replace(/-/g, " ") + ". " + englishDesc + ". White background, professional studio lighting, photorealistic, 8K.",
          n: 1,
          size: "1024x1024",
        });
      }
    } else {
      response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: "Luxury jewelry: " + productHandle.replace(/-/g, " ") + ". " + englishDesc + ". White background, professional studio lighting, photorealistic, 8K.",
        n: 1,
        size: "1024x1024",
      });
    }

    sessionImageCount[sessionId]++;
    const imageUrl = response.data[0].url || ("data:image/png;base64," + response.data[0].b64_json);

    res.json({
      imageUrl: imageUrl,
      count: sessionImageCount[sessionId],
      remaining: Math.max(0, 3 - sessionImageCount[sessionId]),
    });

  } catch (err) {
    console.log("CUSTOMIZE ERROR: " + err.message);
    res.status(500).json({ error: "Image generation failed." });
  }
});

app.post("/save-email", async (req, res) => {
  const sessionId = req.body.sessionId;
  const email = req.body.email;
  if (sessionId && email) sessionEmails[sessionId] = email;
  res.json({ ok: true });
});

app.post("/generate-image", async (req, res) => {
  try {
    const sessionId = req.body.sessionId || "";
    const productTitle = req.body.productTitle || "";
    const productDescription = req.body.productDescription || "";
    const email = req.body.email || "";

    if (!sessionImageCount[sessionId]) sessionImageCount[sessionId] = 0;
    const count = sessionImageCount[sessionId];

    if (count >= 2 && !sessionEmails[sessionId]) return res.json({ requireEmail: true });
    if (email) sessionEmails[sessionId] = email;
    if (count >= 3) return res.json({ blocked: true });

    const prompt = "Luxury jewelry product photo. " + productTitle + ". " + productDescription.slice(0, 100) + ". White background. Professional studio lighting. Ultra detailed.";

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });

    sessionImageCount[sessionId]++;
    const imageUrl = response.data[0].url || ("data:image/png;base64," + response.data[0].b64_json);

    res.json({
      imageUrl: imageUrl,
      count: sessionImageCount[sessionId],
      remaining: Math.max(0, 3 - sessionImageCount[sessionId]),
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Image generation failed." });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message || "";
    const sessionId = req.body.sessionId || crypto.randomUUID();
    const normalizedMessage = normalizeText(userMessage);
    const language = detectLanguage(userMessage);

    if (!conversations[sessionId]) conversations[sessionId] = [];
    if (!sessionProducts[sessionId]) {
      sessionProducts[sessionId] = { queue: [], lastSearch: "", lastIntent: null };
    }
    sessionTimestamps[sessionId] = Date.now();

    const isGreeting = userMessage === "__greeting__";
    if (!isGreeting) conversations[sessionId].push({ role: "user", content: userMessage });
    if (conversations[sessionId].length > 20) conversations[sessionId] = conversations[sessionId].slice(-10);

    if (conversations[sessionId].length > 10) {
      const summaryCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "Summarize this luxury jewelry customer profile. Keep: style, taste, materials, budget. Be concise." },
          { role: "user", content: JSON.stringify(conversations[sessionId]) },
        ],
      });
      summaries[sessionId] = summaryCompletion.choices[0].message.content;
    }

    let discountContext = "";
    if (shouldAskDiscount(userMessage)) {
      const discounts = await getActiveDiscounts();
      discountContext = discounts.length > 0
        ? "ACTIVE DISCOUNTS: " + JSON.stringify(discounts, null, 2)
        : "No active discounts right now.";
    }

    let currentProduct = null;
    const isNextRequest = shouldShowNext(userMessage);
    const isNewSearch = !isGreeting && shouldSearchProducts(normalizedMessage) && !isNextRequest;

    if (isNextRequest) {
      if (sessionProducts[sessionId].queue.length > 0) {
        currentProduct = sessionProducts[sessionId].queue.shift();
      } else if (sessionProducts[sessionId].lastSearch) {
        const candidates = roughFilter(sessionProducts[sessionId].lastSearch, sessionProducts[sessionId].lastIntent, products);
        if (candidates.length > 0) {
          const selected = await aiSelectProducts(sessionProducts[sessionId].lastSearch, sessionProducts[sessionId].lastIntent, candidates);
          sessionProducts[sessionId].queue = selected;
          currentProduct = sessionProducts[sessionId].queue.shift();
        }
      }
    } else if (isNewSearch) {
      const intent = await extractIntent(userMessage);
      sessionProducts[sessionId].lastIntent = intent;
      const candidates = roughFilter(normalizedMessage, intent, products);
      if (candidates.length > 0) {
        const selected = await aiSelectProducts(userMessage, intent, candidates);
        sessionProducts[sessionId].queue = selected;
        sessionProducts[sessionId].lastSearch = normalizedMessage;
        currentProduct = sessionProducts[sessionId].queue.shift();
      }
    }

    const hasMore = sessionProducts[sessionId].queue.length > 0;
    const aiProductForFrontend = currentProduct ? buildProductForFrontend(currentProduct) : null;
    const aiProductDetails = currentProduct ? buildProductDetails(currentProduct) : null;

    const languageInstruction = language === "arabic"
      ? "CRITICAL: Respond ENTIRELY in Arabic only. Zero English words."
      : "CRITICAL: Respond ENTIRELY in English only. Zero Arabic words.";

    let systemPrompt = "You are Alymwndw AI — elite luxury jewelry sales concierge for Alymwndw Jewellery UAE.\n";
    systemPrompt += "PERSONALITY: Warm, elegant, passionate. Max 4 sentences per response.\n";
    systemPrompt += languageInstruction + "\n";
    systemPrompt += "STRICT RULES:\n- NEVER invent products, metals, stones, prices\n- NEVER mention price unless from CURRENT PRODUCT startingPrice\n- NEVER use markdown\n- NEVER mix Arabic and English\n";
    if (isGreeting) {
      systemPrompt += "GREETING MODE: Welcome customer warmly. Ask what they are looking for. Short, warm, luxurious.\n";
    } else if (!aiProductDetails) {
      systemPrompt += "NO PRODUCT MODE: No product available. Ask customer questions to understand their preference better.\n";
    } else {
      systemPrompt += "SELLING MODE - Current product:\n" + JSON.stringify(aiProductDetails, null, 2) + "\n";
      systemPrompt += "1. Emotional hook\n2. Metals available\n3. Stones/shapes\n4. Price EXACTLY: " + aiProductDetails.startingPrice + "\n5. One question\n";
      if (hasMore) systemPrompt += "End with: ask if they want to see another piece.\n";
    }
    if (discountContext) systemPrompt += "DISCOUNT INFO: " + discountContext + "\n";
    systemPrompt += "Customer Memory: " + (summaries[sessionId] || "New customer.");

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        ...(isGreeting ? [{ role: "user", content: "greeting" }] : conversations[sessionId].slice(-8)),
      ],
    });

    const aiReply = completion.choices[0].message.content;
    if (!isGreeting) conversations[sessionId].push({ role: "assistant", content: aiReply });

    res.json({
      reply: aiReply,
      products: aiProductForFrontend ? [aiProductForFrontend] : [],
      hasMore: hasMore,
      sessionId: sessionId,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ reply: "Server error", products: [] });
  }
});

app.listen(PORT, () => { console.log("ALYMWNDW AI RUNNING ON PORT " + PORT); });
