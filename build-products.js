import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

const SHOP =
process.env.SHOPIFY_STORE;

const TOKEN =
process.env.SHOPIFY_ACCESS_TOKEN;

// ======================
// CLEAN HTML
// ======================

function cleanHTML(html = "") {

  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

}

// ======================
// DETECT PRODUCT TYPE
// ======================

function detectProductType(text) {

  text = text.toLowerCase();

  const map = {

    ring: [
      "ring",
      "rings",
      "solitaire",
      "engagement",
      "wedding band",
      "eternity ring",
      "bridal ring",
    ],

    necklace: [
      "necklace",
      "chain",
      "initial necklace",
      "name necklace",
      "pendant necklace",
    ],

    earrings: [
      "earring",
      "earrings",
      "stud earrings",
      "hoop earrings",
    ],

    bracelet: [
      "bracelet",
      "bangle",
      "cuff",
    ],

    pendant: [
      "pendant",
      "pendants",
    ],

  };

  for (const type in map) {

    if (
      map[type].some((w) =>
        text.includes(w)
      )
    ) {

      return type;

    }

  }

  return "other";

}

// ======================
// DETECT METAL
// ======================

function detectMetal(text) {

  text = text.toLowerCase();

  if (
    text.includes("18k") ||
    text.includes("21k") ||
    text.includes("22k") ||
    text.includes("gold")
  ) {

    if (
      text.includes("white gold")
    ) {

      return "white gold";

    }

    if (
      text.includes("rose gold")
    ) {

      return "rose gold";

    }

    return "yellow gold";

  }

  if (
    text.includes("silver") ||
    text.includes("925")
  ) {

    return "silver";

  }

  if (
    text.includes("platinum")
  ) {

    return "platinum";

  }

  return "unknown";

}

// ======================
// DETECT STONE
// ======================

function detectStone(text) {

  text = text.toLowerCase();

  const stones = [

    "moissanite",
    "diamond",
    "ruby",
    "emerald",
    "sapphire",
    "opal",
    "topaz",

  ];

  for (const stone of stones) {

    if (
      text.includes(stone)
    ) {

      return stone;

    }

  }

  return "none";

}

// ======================
// COLORS
// ======================

function detectColors(text) {

  text = text.toLowerCase();

  const colors = [

    "yellow",
    "white",
    "black",
    "blue",
    "green",
    "red",
    "pink",
    "purple",
    "rose gold",
    "yellow gold",
    "white gold",

  ];

  return colors.filter((c) =>
    text.includes(c)
  );

}

// ======================
// BUILD PRODUCTS
// ======================

async function buildProducts() {

  let allProducts = [];

  let since_id = 0;

  let keepLoading = true;

  while (keepLoading) {

    console.log(
      "Loading products:",
      since_id
    );

    const response =
      await fetch(

        `https://${SHOP}/admin/api/2025-01/products.json?limit=250&since_id=${since_id}`,

        {

          headers: {

            "X-Shopify-Access-Token":
              TOKEN,

            "Content-Type":
              "application/json",

          },

        }

      );

    const data =
      await response.json();

    const products =
      data.products || [];

    if (
      products.length === 0
    ) {

      keepLoading = false;
      break;

    }

    allProducts.push(
      ...products
    );

    since_id =
      products[
        products.length - 1
      ].id;

    if (
      products.length < 250
    ) {

      keepLoading = false;

    }

  }

  console.log(
    "TOTAL PRODUCTS:",
    allProducts.length
  );

  // ======================
  // PRODUCT BRAIN
  // ======================

  const brain =
    allProducts.map((p) => {

      const rawText = `

        ${p.title}
        ${cleanHTML(p.body_html)}
        ${p.tags}
        ${p.product_type}
        ${p.handle}

      `;

      const productType =
        detectProductType(
          rawText
        );

      const metal =
        detectMetal(
          rawText
        );

      const stone =
        detectStone(
          rawText
        );

      const colors =
        detectColors(
          rawText
        );

      // ======================
      // VARIANTS
      // ======================

      const variants =
        (p.variants || []).map(
          (v) => {

            let image =
              p.images?.[0]?.src || "";

            if (
              v.image_id
            ) {

              const img =
                p.images.find(
                  (i) =>
                    i.id ===
                    v.image_id
                );

              if (img) {

                image =
                  img.src;

              }

            }

            const variantText = `

              ${v.title}
              ${v.option1}
              ${v.option2}
              ${v.option3}
              ${metal}
              ${stone}

            `;

            return {

              id: v.id,

              title:
                v.title,

              price:
                v.price,

              available:
                v.inventory_quantity > 0,

              image,

              option1:
                v.option1,

              option2:
                v.option2,

              option3:
                v.option3,

              semanticText:
                variantText
                  .toLowerCase(),

            };

          }
        );

      // ======================
      // SEMANTIC TEXT
      // ======================

      const semanticText = `

        ${p.title}

        ${cleanHTML(
          p.body_html
        )}

        ${p.tags}

        ${productType}

        ${metal}

        ${stone}

        ${colors.join(" ")}

        luxury jewelry

        fine jewelry

      `
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      return {

        id: p.id,

        title: p.title,

        description:
          cleanHTML(
            p.body_html
          ),

        handle:
          p.handle,

        productType,

        metal,

        stone,

        colors,

        tags:
          p.tags
            ?.split(",")
            .map((t) =>
              t.trim()
            ) || [],

        image:
          p.images?.[0]?.src || "",

        url:
          `https://${SHOP}/products/${p.handle}`,

        semanticText,

        variants,

      };

    });

  // ======================
  // SAVE JSON
  // ======================

  fs.writeFileSync(

    "./products.json",

    JSON.stringify(
      brain,
      null,
      2
    )

  );

  console.log(
    "PRODUCT BRAIN BUILT SUCCESSFULLY"
  );

}

buildProducts();
