import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static("public"));

const PORT =
  process.env.PORT || 10000;

const openai = new OpenAI({

  apiKey:
    process.env.OPENAI_API_KEY,

});

const SHOP =
  process.env.SHOPIFY_STORE;

const TOKEN =
  process.env.SHOPIFY_ACCESS_TOKEN;

// ======================
// CACHE
// ======================

let productsCache = [];

let lastUpdate = 0;

// ======================
// LOAD PRODUCTS
// ======================

async function loadProducts() {

  try {

    let allProducts = [];

    let since_id = 0;

    let keepLoading = true;

    while (keepLoading) {

      console.log(
        "Loading products after ID:",
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

    // ======================
    // BUILD PRODUCT BRAIN
    // ======================

    productsCache =
      allProducts.map((p) => {

        const text = `

          ${p.title}
          ${p.body_html}
          ${p.tags}
          ${p.product_type}
          ${p.handle}

          ${(p.options || [])
            .map((o) =>
              o.values?.join(" ")
            )
            .join(" ")}

        `.toLowerCase();

        // ======================
        // PRODUCT TYPE
        // ======================

        let productType =
          "other";

        const ringWords = [

          "ring",
          "rings",
          "solitaire",
          "engagement",
          "wedding band",
          "eternity ring",
          "halo ring",

        ];

        const necklaceWords = [

          "necklace",
          "necklaces",
          "chain",

        ];

        const earringWords = [

          "earring",
          "earrings",

        ];

        const braceletWords = [

          "bracelet",
          "bracelets",
          "bangle",

        ];

        const pendantWords = [

          "pendant",
          "pendants",

        ];

        if (
          ringWords.some((word) =>
            text.includes(word)
          )
        ) {

          productType =
            "ring";

        }

        else if (
          necklaceWords.some((word) =>
            text.includes(word)
          )
        ) {

          productType =
            "necklace";

        }

        else if (
          earringWords.some((word) =>
            text.includes(word)
          )
        ) {

          productType =
            "earrings";

        }

        else if (
          braceletWords.some((word) =>
            text.includes(word)
          )
        ) {

          productType =
            "bracelet";

        }

        else if (
          pendantWords.some((word) =>
            text.includes(word)
          )
        ) {

          productType =
            "pendant";

        }

        // ======================
        // METAL
        // ======================

        let metal =
          "Unknown";

        if (

          text.includes("gold") ||
          text.includes("18k") ||
          text.includes("21k") ||
          text.includes("22k")

        ) {

          metal = "Gold";

        }

        if (

          text.includes("silver") ||
          text.includes("925")

        ) {

          metal =
            "Silver";

        }

        if (
          text.includes("platinum")
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
          text.includes(
            "moissanite"
          )
        ) {

          stone =
            "Moissanite";

        }

        if (
          text.includes(
            "diamond"
          )
        ) {

          stone =
            "Diamond";

        }

        if (
          text.includes(
            "ruby"
          )
        ) {

          stone =
            "Ruby";

        }

        if (
          text.includes(
            "sapphire"
          )
        ) {

          stone =
            "Sapphire";

        }

        // ======================
        // COLORS
        // ======================

        let colors = [];

        const colorList = [

          "gold",
          "yellow gold",
          "white gold",
          "rose gold",

          "silver",

          "red",
          "blue",
          "green",
          "pink",
          "purple",
          "yellow",
          "black",
          "white",

        ];

        colorList.forEach((c) => {

          if (
            text.includes(c)
          ) {

            colors.push(c);

          }

        });

        // ======================
        // MAIN IMAGE
        // ======================

        const mainImage =
          p.images?.[0]?.src ||
          "";

        // ======================
        // VARIANTS
        // ======================

        const variants =
          (p.variants || []).map(
            (v) => {

              const variantText = `

                ${v.title}
                ${v.option1}
                ${v.option2}
                ${v.option3}

              `.toLowerCase();

              let variantColor =
                "";

              colorList.forEach(
                (c) => {

                  if (
                    variantText.includes(
                      c
                    )
                  ) {

                    variantColor =
                      c;

                  }

                }
              );

              let variantImage =
                mainImage;

              // IMAGE ID

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

              // COLOR ALT MATCH

              if (
                !v.image_id
              ) {

                const colorImage =
                  p.images?.find(
                    (img) => {

                      const alt =
                        (
                          img.alt ||
                          ""
                        ).toLowerCase();

                      return (
                        alt.includes(
                          variantColor
                        )
                      );

                    }
                  );

                if (
                  colorImage
                ) {

                  variantImage =
                    colorImage.src;

                }

              }

              const searchText = `

                ${v.title}
                ${v.option1}
                ${v.option2}
                ${v.option3}

                ${variantColor}
                ${metal}
                ${stone}

              `.toLowerCase();

              return {

                id:
                  v.id,

                title:
                  v.title,

                price:
                  v.price,

                available:
                  v.inventory_quantity >
                  0,

                image:
                  variantImage,

                color:
                  variantColor,

                option1:
                  v.option1,

                option2:
                  v.option2,

                option3:
                  v.option3,

                searchText,

              };

            }
          );

        return {

          id:
            p.id,

          title:
            p.title,

          description:
            p.body_html
              ?.replace(
                /<[^>]+>/g,
                ""
              )
              || "",

          tags:
            p.tags,

          handle:
            p.handle,

          productType,

          price:
            p.variants?.[0]
              ?.price || "",

          metal,

          stone,

          colors,

          image:
            mainImage,

          url:
            `https://${SHOP}/products/${p.handle}`,

          variants,

        };

      });

    lastUpdate =
      Date.now();

    console.log(
      "FINAL PRODUCTS:",
      productsCache.length
    );

  } catch (error) {

    console.log(
      "LOAD PRODUCTS ERROR"
    );

    console.log(error);

  }

}

// ======================
// SEARCH
// ======================

function searchProducts(message) {

  let msg =
    message.toLowerCase().trim();

  // ======================
  // ARABIC NORMALIZATION
  // ======================

  const arabicMap = {

    "خاتم": "ring",
    "خواتم": "ring",
    "دبلة": "ring",
    "دبل": "wedding band",
    "محبس": "ring",
    "محابس": "ring",

    "شبكة": "wedding ring",
    "خطوبة": "engagement ring",
    "سوليتير": "solitaire ring",

    "سلسلة": "necklace",
    "سلسال": "necklace",
    "عقد": "necklace",
    "قلادة": "necklace",

    "حلق": "earring",
    "اقراط": "earring",
    "أقراط": "earring",

    "اسورة": "bracelet",
    "سوار": "bracelet",

    "موزانيت": "moissanite",
    "مويسانيت": "moissanite",

    "الماس": "diamond",
    "ألماس": "diamond",
    "دايموند": "diamond",

    "ذهب": "gold",
    "دهب": "gold",

    "ذهب اصفر":
      "yellow gold",

    "ذهب أبيض":
      "white gold",

    "ذهب ابيض":
      "white gold",

    "روز جولد":
      "rose gold",

    "ابيض": "white",
    "أبيض": "white",

    "اسود": "black",

    "وردي": "pink",

    "اصفر": "yellow",

  };

  Object.entries(arabicMap).forEach(
    ([ar, en]) => {

      msg =
        msg.replaceAll(ar, en);

    }
  );

  const keywords =
    msg
      .split(" ")
      .filter(Boolean);

  // ======================
  // DETECT TYPE
  // ======================

  let requestedType =
    "";

  if (

    msg.includes("ring") ||
    msg.includes("solitaire") ||
    msg.includes("engagement") ||
    msg.includes("wedding band")

  ) {

    requestedType =
      "ring";

  }

  if (

    msg.includes("necklace") ||
    msg.includes("chain")

  ) {

    requestedType =
      "necklace";

  }

  if (
    msg.includes("earring")
  ) {

    requestedType =
      "earrings";

  }

  if (
    msg.includes("bracelet")
  ) {

    requestedType =
      "bracelet";

  }

  if (
    msg.includes("pendant")
  ) {

    requestedType =
      "pendant";

  }

  // ======================
  // SCORE PRODUCTS
  // ======================

  let scoredProducts =
    productsCache.map((p) => {

      let score = 0;

      // HARD FILTER

      if (

        requestedType &&
        p.productType !==
          requestedType

      ) {

        return {

          ...p,

          matchedVariants:
            [],

          score: -999,

        };

      }

      const productText = `

        ${p.title}
        ${p.description}
        ${p.tags}

        ${p.productType}
        ${p.metal}
        ${p.stone}

        ${p.colors.join(" ")}

      `.toLowerCase();

      keywords.forEach((word) => {

        if (
          productText.includes(
            word
          )
        ) {

          score += 5;

        }

        // LUXURY BOOST

        if (
          [

            "luxury",
            "luxurious",
            "elegant",

            "شيك",
            "فخم",
            "راقي",

          ].includes(word)
        ) {

          score += 15;

        }

      });

      // TYPE BOOST

      if (

        requestedType &&
        p.productType ===
          requestedType

      ) {

        score += 100;

      }

      // METAL BOOST

      if (
        msg.includes("gold") &&
        p.metal === "Gold"
      ) {

        score += 40;

      }

      if (
        msg.includes("silver") &&
        p.metal === "Silver"
      ) {

        score += 40;

      }

      if (
        msg.includes("platinum") &&
        p.metal === "Platinum"
      ) {

        score += 40;

      }

      // STONE BOOST

      if (
        msg.includes(
          "moissanite"
        ) &&
        p.stone ===
          "Moissanite"
      ) {

        score += 50;

      }

      if (
        msg.includes(
          "diamond"
        ) &&
        p.stone ===
          "Diamond"
      ) {

        score += 50;

      }

      // VARIANTS

      let matchedVariants =
        [];

      (
        p.variants || []
      ).forEach((v) => {

        const variantText =
          v.searchText;

        let variantScore =
          0;

        keywords.forEach(
          (word) => {

            if (
              variantText.includes(
                word
              )
            ) {

              variantScore +=
                20;

            }

          }
        );

        if (
          variantScore > 0
        ) {

          matchedVariants.push({

            ...v,

            variantScore,

          });

          score +=
            variantScore;

        }

        // FALLBACK

        else if (
          matchedVariants.length === 0
        ) {

          matchedVariants.push({

            ...v,

            variantScore: 1,

          });

        }

      });

      matchedVariants.sort(
        (a, b) =>
          b.variantScore -
          a.variantScore
      );

      return {

        ...p,

        matchedVariants,

        score,

      };

    });

  scoredProducts =
    scoredProducts
      .filter(
        (p) =>
          p.score > 0
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  if (
    scoredProducts.length === 0
  ) {

    return productsCache
      .slice(0, 4)
      .map((p) => ({

        ...p,

        matchedVariants:
          p.variants || [],

        score: 1,

      }));

  }

  return scoredProducts.slice(
    0,
    4
  );

}

// ======================
// CHAT
// ======================

app.post(
  "/chat",
  async (req, res) => {

    try {

      const message =
        req.body.message ||
        "";

      // GREETINGS

      const greetings = [

        "hi",
        "hello",
        "hey",

        "مرحبا",
        "هاي",
        "السلام عليكم",

        "اهلا",
        "أهلا",
        "هلا",

      ];

      if (
        greetings.includes(
          message
            .toLowerCase()
            .trim()
        )
      ) {

        return res.json({

          reply:
            "Welcome to Alymwndw Jewellery 💎 How can I help you today?",

          products: [],

        });

      }

      // REFRESH CACHE

      if (

        Date.now() -
          lastUpdate >
        1000 *
          60 *
          15

      ) {

        await loadProducts();

      }

      if (
        productsCache.length ===
        0
      ) {

        await loadProducts();

      }

      // SEARCH

      const matchedProducts =
        searchProducts(
          message
        );

      // CLEAN PRODUCTS

      const cleanProducts =
        matchedProducts.map(
          (p) => ({

            title:
              p.title,

            description:
              p.description,

            productType:
              p.productType,

            price:
              p.price,

            metal:
              p.metal,

            stone:
              p.stone,

            colors:
              p.colors,

            image:
              p.image,

            url:
              p.url,

            variants:
              p
                .matchedVariants
                ?.length
                ? p
                    .matchedVariants
                : p.variants,

          })
        );

      // AI PROMPT

      const systemPrompt = `

You are Alymwndw Jewellery AI.

You are a luxury jewellery sales expert.

STRICT RULES:

1- NEVER invent products.
2- ONLY use provided products.
3- ALWAYS respect product type.
4- NEVER recommend necklaces when user asks for rings.
5- NEVER recommend wrong variants.
6- Speak elegantly.
7- If user speaks Arabic answer Arabic.
8- Mention price naturally.
9- Mention metal and stone accurately.
10- Upsell naturally.

AVAILABLE PRODUCTS:

${JSON.stringify(
  cleanProducts
)}

`;

      // OPENAI

      const completion =
        await openai.chat.completions.create(
          {

            model:
              "gpt-4.1-mini",

            temperature:
              0.2,

            messages: [

              {
                role:
                  "system",

                content:
                  systemPrompt,

              },

              // IMPORTANT
              // SEND ORIGINAL MESSAGE

              {
                role:
                  "user",

                content:
                  message,

              },

            ],

          }
        );

      // RESPONSE

      res.json({

        reply:
          completion
            .choices[0]
            .message
            .content,

        products:
          cleanProducts,

      });

    } catch (error) {

      console.log(error);

      res.json({

        reply:
          "AI Error",

        products: [],

      });

    }

  }
);

// ======================
// START SERVER
// ======================

app.listen(
  PORT,
  async () => {

    console.log(
      "ALYMWNDW AI RUNNING"
    );

    await loadProducts();

  }
);
