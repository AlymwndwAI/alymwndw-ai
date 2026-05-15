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

  return (
    html || ""
  )

    .replace(
      /<[^>]*>/g,
      " "
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim();

}

// ======================
// LOAD ALL PRODUCTS
// ======================

async function loadProducts() {

  try {

    let allProducts =
      [];

    let since_id = 0;

    let keepLoading =
      true;

    while (
      keepLoading
    ) {

      console.log(
        "Loading after:",
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
        data.products ||
        [];

      console.log(
        "Loaded:",
        products.length
      );

      if (
        products.length ===
        0
      ) {

        keepLoading =
          false;

        break;

      }

      allProducts.push(
        ...products
      );

      since_id =
        products[
          products.length -
            1
        ].id;

      if (
        products.length <
        250
      ) {

        keepLoading =
          false;

      }

    }

    // ======================
    // BUILD PRODUCT BRAIN
    // ======================

    const productsBrain =
      allProducts.map(
        (p) => {

          // ======================
          // CLEAN TEXT
          // ======================

          const title =
            (
              p.title || ""
            ).toLowerCase();

          const tags =
            (
              p.tags || ""
            ).toLowerCase();

          const type =
            (
              p.product_type ||
              ""
            ).toLowerCase();

          const desc =
            cleanHTML(
              p.body_html
            ).toLowerCase();

          const combined = `

${title}
${tags}
${type}
${desc}

`;

          // ======================
          // PRODUCT TYPE
          // ======================

          let productType =
            "other";

          // RINGS

          if (

            combined.includes(
              "ring"
            ) ||

            combined.includes(
              "rings"
            ) ||

            combined.includes(
              "خاتم"
            ) ||

            combined.includes(
              "خواتم"
            ) ||

            combined.includes(
              "دبلة"
            ) ||

            combined.includes(
              "محبس"
            ) ||

            combined.includes(
              "solitaire"
            ) ||

            combined.includes(
              "engagement"
            ) ||

            combined.includes(
              "wedding band"
            )

          ) {

            productType =
              "ring";

          }

          // NECKLACES

          else if (

            combined.includes(
              "necklace"
            ) ||

            combined.includes(
              "necklaces"
            ) ||

            combined.includes(
              "chain"
            ) ||

            combined.includes(
              "سلسلة"
            ) ||

            combined.includes(
              "عقد"
            ) ||

            combined.includes(
              "قلادة"
            )

          ) {

            productType =
              "necklace";

          }

          // EARRINGS

          else if (

            combined.includes(
              "earring"
            ) ||

            combined.includes(
              "earrings"
            ) ||

            combined.includes(
              "حلق"
            ) ||

            combined.includes(
              "أقراط"
            ) ||

            combined.includes(
              "اقراط"
            )

          ) {

            productType =
              "earrings";

          }

          // BRACELETS

          else if (

            combined.includes(
              "bracelet"
            ) ||

            combined.includes(
              "bracelets"
            ) ||

            combined.includes(
              "اسورة"
            ) ||

            combined.includes(
              "سوار"
            )

          ) {

            productType =
              "bracelet";

          }

          // ======================
          // METAL
          // ======================

          let metal =
            "Unknown";

          if (

            combined.includes(
              "gold"
            ) ||

            combined.includes(
              "ذهب"
            ) ||

            combined.includes(
              "18k"
            ) ||

            combined.includes(
              "21k"
            ) ||

            combined.includes(
              "22k"
            )

          ) {

            metal =
              "Gold";

          }

          if (

            combined.includes(
              "silver"
            ) ||

            combined.includes(
              "فضة"
            ) ||

            combined.includes(
              "925"
            )

          ) {

            metal =
              "Silver";

          }

          if (

            combined.includes(
              "platinum"
            )

          ) {

            metal =
              "Platinum";

          }

          // ======================
          // STONE
          // ======================

          let stone =
            "None";

          if (

            combined.includes(
              "moissanite"
            ) ||

            combined.includes(
              "موزانيت"
            )

          ) {

            stone =
              "Moissanite";

          }

          if (

            combined.includes(
              "diamond"
            ) ||

            combined.includes(
              "الماس"
            )

          ) {

            stone =
              "Diamond";

          }

          if (

            combined.includes(
              "ruby"
            ) ||

            combined.includes(
              "ياقوت"
            )

          ) {

            stone =
              "Ruby";

          }

          // ======================
          // COLORS
          // ======================

          let colors =
            [];

          const colorList =
            [

              "red",
              "blue",
              "green",
              "pink",
              "purple",
              "yellow",
              "black",
              "white",

              "gold",
              "silver",

              "احمر",
              "ازرق",
              "اخضر",
              "وردي",
              "اصفر",
              "ابيض",
              "اسود",

            ];

          colorList.forEach(
            (c) => {

              if (
                combined.includes(
                  c
                )
              ) {

                colors.push(
                  c
                );

              }

            }
          );

          // ======================
          // MAIN IMAGE
          // ======================

          const mainImage =
            p.images?.[0]
              ?.src || "";

          // ======================
          // VARIANTS
          // ======================

          const variants =
            (
              p.variants ||
              []
            ).map((v) => {

              let variantImage =
                mainImage;

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
                  v.title,

                price:
                  v.price,

                image:
                  variantImage,

                option1:
                  v.option1,

                option2:
                  v.option2,

                option3:
                  v.option3,

                available:
                  v.inventory_quantity >
                  0,

              };

            });

          // ======================
          // RETURN PRODUCT
          // ======================

          return {

            id: p.id,

            title:
              p.title,

            description:
              cleanHTML(
                p.body_html
              ),

            tags:
              p.tags,

            handle:
              p.handle,

            productType,

            metal,

            stone,

            colors,

            image:
              mainImage,

            price:
              p.variants?.[0]
                ?.price || "",

            url:
`https://${SHOP}/products/${p.handle}`,

            variants,

          };

        }
      );

    // ======================
    // SAVE JSON
    // ======================

    fs.writeFileSync(

      "./products.json",

      JSON.stringify(
        productsBrain,
        null,
        2
      )

    );

    console.log(

      "PRODUCT BRAIN CREATED:",

      productsBrain.length

    );

  } catch (error) {

    console.log(
      "ERROR:",
      error
    );

  }

}

// ======================
// RUN
// ======================

loadProducts();
