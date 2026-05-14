import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

const SHOP =
  process.env.SHOPIFY_STORE;

const TOKEN =
  process.env.SHOPIFY_ACCESS_TOKEN;

// =========================
// CLEAN HTML
// =========================

function cleanHtml(html) {

  if (!html) return "";

  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

// =========================
// LOAD PRODUCTS
// =========================

async function buildProductsBrain() {

  try {

    console.log(
      "STARTING PRODUCT BRAIN..."
    );

    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/products.json?limit=250`,
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
      "PRODUCTS FOUND:",
      products.length
    );

    const aiProducts =
      products.map((p) => {

        // =====================
        // CLEAN DESCRIPTION
        // =====================

        const description =
          cleanHtml(
            p.body_html
          );

        // =====================
        // FULL SEARCH TEXT
        // =====================

        const fullText = `
${p.title}
${description}
${p.tags}
${JSON.stringify(p.options)}
${JSON.stringify(p.variants)}
        `.toLowerCase();

        // =====================
        // METALS
        // =====================

        let metals = [];

        if (
          fullText.includes("gold") ||
          fullText.includes("18k")
        ) {

          metals.push("Gold");

        }

        if (
          fullText.includes("silver") ||
          fullText.includes("925")
        ) {

          metals.push("Silver");

        }

        if (
          fullText.includes("platinum")
        ) {

          metals.push(
            "Platinum"
          );

        }

        // =====================
        // STONES
        // =====================

        let stones = [];

        if (
          fullText.includes(
            "moissanite"
          )
        ) {

          stones.push(
            "Moissanite"
          );

        }

        if (
          fullText.includes(
            "diamond"
          )
        ) {

          stones.push(
            "Diamond"
          );

        }

        if (
          fullText.includes(
            "ruby"
          )
        ) {

          stones.push("Ruby");

        }

        if (
          fullText.includes(
            "sapphire"
          )
        ) {

          stones.push(
            "Sapphire"
          );

        }

        // =====================
        // COLORS
        // =====================

        let colors = [];

        [
          "red",
          "blue",
          "green",
          "pink",
          "purple",
          "yellow",
          "black",
          "white"
        ].forEach((color) => {

          if (
            fullText.includes(
              color
            )
          ) {

            colors.push(
              color
            );

          }

        });

        // =====================
        // VARIANTS
        // =====================

        const variants =
          (p.variants || []).map(
            (v) => {

              // variant image
              let variantImage =
                p.images?.[0]
                  ?.src || "";

              if (
                v.image_id &&
                p.images
              ) {

                const foundImage =
                  p.images.find(
                    (img) =>
                      img.id ===
                      v.image_id
                  );

                if (
                  foundImage
                ) {

                  variantImage =
                    foundImage.src;

                }

              }

              return {

                id: v.id,

                title:
                  v.title,

                price:
                  v.price,

                sku:
                  v.sku,

                available:
                  v.available,

                image:
                  variantImage,

              };

            }
          );

        // =====================
        // FINAL PRODUCT
        // =====================

        return {

          id: p.id,

          title: p.title,

          description,

          productType:
            p.product_type,

          tags: p.tags,

          price:
            p.variants?.[0]
              ?.price || "",

          metals,

          stones,

          colors,

          options:
            p.options || [],

          variants,

          images:
            p.images || [],

          image:
            p.images?.[0]
              ?.src || "",

          handle:
            p.handle,

          url:
`https://${SHOP}/products/${p.handle}`,

        };

      });

    // =====================
    // SAVE FILE
    // =====================

    fs.writeFileSync(

      "products-brain.json",

      JSON.stringify(
        aiProducts,
        null,
        2
      )

    );

    console.log(
      "PRODUCT BRAIN CREATED"
    );

    console.log(
      "TOTAL PRODUCTS:",
      aiProducts.length
    );

  } catch (error) {

    console.log(error);

  }

}

// =========================
// START
// =========================

buildProductsBrain();
