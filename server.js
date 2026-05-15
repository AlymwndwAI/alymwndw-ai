import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";

dotenv.config();

// ======================
// EXPRESS
// ======================

const app = express();

app.use(express.json());

app.use(
  express.static("public")
);

const PORT =
  process.env.PORT || 10000;

// ======================
// OPENAI
// ======================

const openai =
  new OpenAI({

    apiKey:
      process.env.OPENAI_API_KEY,

  });

// ======================
// LOAD PRODUCTS
// ======================

let products = [];

try {

  products =
    JSON.parse(

      fs.readFileSync(
        "products.json",
        "utf8"
      )

    );

  console.log(
    "PRODUCT BRAIN LOADED:",
    products.length
  );

} catch (e) {

  console.log(
    "NO PRODUCTS.JSON FOUND"
  );

}

// ======================
// NORMALIZE
// ======================

function normalize(text = "") {

  return text
    .toLowerCase()

    .replaceAll("أ", "ا")
    .replaceAll("إ", "ا")
    .replaceAll("آ", "ا")
    .replaceAll("ة", "ه")
    .replaceAll("ى", "ي")

    .trim();

}

// ======================
// SEARCH
// ======================

function searchProducts(message) {

  const msg =
    normalize(message);

  // ======================
  // ARABIC MAP
  // ======================

  const arabicMap = {

    "خاتم": "ring",
    "خواتم": "ring",
    "دبله": "ring",

    "عقد": "necklace",
    "سلسله": "necklace",

    "حلق": "earring",

    "ذهب": "gold",
    "فضه": "silver",

    "موزنايت": "moissanite",
    "مويسانيت": "moissanite",

    "الماس": "diamond",

    "احمر": "ruby",

  };

  let finalMsg = msg;

  Object.entries(
    arabicMap
  ).forEach(([ar, en]) => {

    finalMsg =
      finalMsg.replaceAll(
        ar,
        en
      );

  });

  const keywords =
    finalMsg
      .split(" ")
      .filter(Boolean);

  let requestedType =
    "";

  // ======================
  // TYPE DETECTION
  // ======================

  if (
    finalMsg.includes("ring")
  ) {

    requestedType =
      "ring";

  }

  if (
    finalMsg.includes(
      "necklace"
    )
  ) {

    requestedType =
      "necklace";

  }

  if (
    finalMsg.includes(
      "earring"
    )
  ) {

    requestedType =
      "earring";

  }

  // ======================
  // SCORE
  // ======================

  let scoredProducts =
    products.map((p) => {

      let score = 0;

      // ======================
      // HARD FILTER
      // ======================

      if (
        requestedType &&
        p.productType !==
          requestedType
      ) {

        return {

          ...p,

          score: -999,

        };

      }

      // ======================
      // PRODUCT SCORE
      // ======================

      keywords.forEach((k) => {

        if (
          p.searchText.includes(k)
        ) {

          score += 10;

        }

      });

      // ======================
      // TYPE BOOST
      // ======================

      if (
        requestedType &&
        p.productType ===
          requestedType
      ) {

        score += 100;

      }

      // ======================
      // VARIANTS
      // ======================

      let matchedVariants =
        [];

      (
        p.variants || []
      ).forEach((v) => {

        let variantScore =
          0;

        keywords.forEach(
          (k) => {

            if (
              v.searchText.includes(
                k
              )
            ) {

              variantScore +=
                30;

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

  // ======================
  // FILTER + SORT
  // ======================

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
        req.body.message || "";

      // ======================
      // GREETINGS
      // ======================

      const greetings = [

        "hi",
        "hello",
        "hey",

        "مرحبا",
        "اهلا",
        "هلا",
        "هاي",

      ];

      if (

        greetings.includes(
          normalize(message)
        )

      ) {

        return res.json({

          reply:
            "Welcome to Alymwndw Jewellery 💎",

          products: [],

        });

      }

      // ======================
      // SEARCH
      // ======================

      const matchedProducts =
        searchProducts(
          message
        );

      // ======================
      // NO PRODUCTS
      // ======================

      if (
        matchedProducts.length ===
        0
      ) {

        return res.json({

          reply:

            normalize(message)
              .match(/[ء-ي]/)

              ?

              "لم اجد منتجات مطابقة حاليا"

              :

              "No matching products found",

          products: [],

        });

      }

      // ======================
      // CLEAN PRODUCTS
      // ======================

      const cleanProducts =
        matchedProducts.map(
          (p) => ({

            title:
              p.title,

            description:
              p.description,

            price:
              p.variants?.[0]
                ?.price || "",

            image:
              p.variants?.[0]
                ?.image ||
              p.image,

            metal:
              p.metal,

            stone:
              p.stone,

            url:
              p.url,

            variants:
              p.matchedVariants
                ?.length

                ?

                p.matchedVariants

                :

                p.variants,

          })
        );

      // ======================
      // AI
      // ======================

      const completion =
        await openai.chat.completions.create({

          model:
            "gpt-4.1-mini",

          temperature:
            0.2,

          messages: [

            {

              role:
                "system",

              content: `

You are Alymwndw Jewellery AI.

STRICT RULES:

1- NEVER invent products.
2- ONLY recommend provided products.
3- NEVER recommend necklaces when user asks for rings.
4- NEVER lie about products.
5- Answer same language as user.
6- Be elegant and luxury.

AVAILABLE PRODUCTS:

${JSON.stringify(cleanProducts)}

              `,

            },

            {

              role:
                "user",

              content:
                message,

            },

          ],

        });

      // ======================
      // RESPONSE
      // ======================

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
// START
// ======================

app.listen(

  PORT,

  () => {

    console.log(
      "ALYMWNDW AI RUNNING"
    );

  }

);
