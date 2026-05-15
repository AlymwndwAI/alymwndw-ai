import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

// ======================
// SHOPIFY
// ======================

const SHOP =
  process.env.SHOPIFY_STORE;

const TOKEN =
  process.env.SHOPIFY_ACCESS_TOKEN;

// ======================
// CLEAN HTML
// ======================

function cleanHTML(html) {

  if (!html) return "";

  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

// ======================
// NORMALIZE
// ======================

function normalize(text = "") {

  return text
    .toLowerCase()

    // Arabic normalize
    .replaceAll("أ", "ا")
    .replaceAll("إ", "ا")
    .replaceAll("آ", "ا")
    .replaceAll("ة", "ه")
    .replaceAll("ى", "ي")

    // English normalize
    .replaceAll("-", " ")
    .replaceAll("/", " ")

    .trim();

}

// ======================
// DETECT PRODUCT TYPE
// ======================

function detectProductType(text) {

  if (
    text.includes("ring") ||
    text.includes("خاتم") ||
    text.includes("دبله") ||
    text.includes("محبس")
  ) {

    return "ring";

  }

  if (
    text.includes("necklace") ||
    text.includes("سلسله") ||
    text.includes("عقد") ||
    text.includes("قلاده")
  ) {

    return "necklace";

  }

  if (
    text.includes("earring") ||
    text.includes("حلق")
  ) {

    return "earring";

  }

  if (
    text.includes("bracelet") ||
    text.includes("اسوره")
  ) {

    return "bracelet";

  }

  return "other";

}

// ======================
// DETECT METAL
// ======================

function detectMetal(text) {

  if (
    text.includes("gold") ||
    text.includes("ذهب") ||
    text.includes("18k") ||
    text.includes("21k") ||
    text.includes("22k")
  ) {

    return "gold";

  }

  if (
    text.includes("silver") ||
    text.includes("فضه") ||
    text.includes("925")
  ) {

    return "silver";

  }

  if (
    text.includes("platinum")
  ) {

    return "platinum";

  }

  return "";

}

// ======================
// DETECT STONE
// ======================

function detectStone(text) {

  if (
    text.includes("moissanite") ||
    text.includes("موزنايت") ||
    text.includes("مويسانيت")
  ) {

    return "moissanite";

  }

  if (
    text.includes("diamond") ||
    text.includes("الماس")
  ) {

    return "diamond";

  }

  if (
    text.includes("ruby") ||
    text.includes("ياقوت") ||
    text.includes("احمر")
  ) {

    return "ruby";

  }

  if (
    text.includes("emerald")
  ) {

    return "emerald";

  }

  return "";

}

// ======================
// LOAD PRODUCTS
// ======================

async function buildProducts() {

  try {

    let allProducts = [];

    let since_id = 0;

    let keepLoading = true;

    while (keepLoading) {

      console.log(
        "Loading after:",
        since_id
      );

      const response = await fetch(

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

      console.log(
        "Loaded:",
        products.length
      );

      if (
        products.length === 0
      ) {

        keepLoading = false;

        break;

      }

      allProducts.push(...products);

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

    // ======================
    // BUILD PRODUCT BRAIN
    // ======================

    const productBrain =
      allProducts.map((p) => {

        const rawText = `

          ${p.title}
          ${cleanHTML(p.body_html)}
          ${p.tags}
          ${p.product_type}

        `;

        const text =
          normalize(rawText);

        const productType =
          detectProductType(text);

        const metal =
          detectMetal(text);

        const stone =
          detectStone(text);

        // ======================
        // VARIANTS
        // ======================

        const variants =
          (p.variants || []).map(
            (v) => {

              const variantText =
                normalize(`

                  ${v.title}
                  ${v.option1}
                  ${v.option2}
                  ${v.option3}

                `);

              let variantImage =
                p.images?.[0]?.src || "";

              // ======================
              // IMAGE ID
              // ======================

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

                  variantImage =
                    img.src;

                }

              }

              return {

                id: v.id,

                title:
                  v.title || "",

                price:
                  v.price || "",

                image:
                  variantImage,

                available:
                  v.inventory_quantity > 0,

                option1:
                  v.option1 || "",

                option2:
                  v.option2 || "",

                option3:
                  v.option3 || "",

                searchText:
                  variantText,

              };

            }
          );

        return {

          id: p.id,

          title:
            p.title || "",

          description:
            cleanHTML(
              p.body_html
            ),

          handle:
            p.handle || "",

          tags:
            p.tags || "",

          productType,

          metal,

          stone,

          image:
            p.images?.[0]?.src || "",

          url:
            `https://${SHOP}/products/${p.handle}`,

          variants,

          searchText:
            text,

        };

      });

    // ======================
    // SAVE
    // ======================

    fs.writeFileSync(

      "products.json",

      JSON.stringify(
        productBrain,
        null,
        2
      )

    );

    console.log(
      "PRODUCT BRAIN CREATED:",
      productBrain.length
    );

  } catch (error) {

    console.log(
      "BUILD ERROR",
      error
    );

  }

}

buildProducts();
