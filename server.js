import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import crypto from "crypto";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

// =====================================
// OPENAI
// =====================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =====================================
// MEMORY
// =====================================

const conversations = {};
const summaries = {};

// =====================================
// LOAD PRODUCT BRAIN
// =====================================

let products = [];

try {

  const raw = fs.readFileSync(
    "./public/products-brain.json",
    "utf8"
  );

  products = JSON.parse(raw);

  console.log(
    `PRODUCT BRAIN LOADED: ${products.length}`
  );

} catch (err) {

  console.log(
    "NO PRODUCTS BRAIN FOUND"
  );

}

// =====================================
// NORMALIZE TEXT
// =====================================

function normalizeText(text = "") {

  return text

    .toLowerCase()

    .replaceAll("أ", "ا")
    .replaceAll("إ", "ا")
    .replaceAll("آ", "ا")

    .replaceAll("ة", "ه")

    .replaceAll("ى", "ي")

    .replaceAll("خاتم", "ring")
    .replaceAll("دبله", "ring")
    .replaceAll("محبس", "ring")

    .replaceAll("عقد", "necklace")
    .replaceAll("سلسله", "necklace")
    .replaceAll("سلسلة", "necklace")

    .replaceAll("اسوره", "bracelet")

    .replaceAll("حلق", "earring")

    .replaceAll("ذهب", "gold")
    .replaceAll("فضه", "silver")
    .replaceAll("بلاتين", "platinum")

    .replaceAll("الماس", "diamond")

    .replaceAll("موزانيت", "moissanite")
    .replaceAll("مويسانيت", "moissanite")
    .replaceAll("موزنايت", "moissanite")

    .replaceAll("روز جولد", "rose gold")
    .replaceAll("روز", "rose gold")

    .replaceAll("اصفر", "yellow gold")
    .replaceAll("ابيض", "white gold")

    .replaceAll("سلسله اسم", "name necklace")
    .replaceAll("سلسلة اسم", "name necklace")

    .replaceAll("سلسله حرف", "initial necklace")
    .replaceAll("سلسلة حرف", "initial necklace")

    .replaceAll("خاتم خطوبه", "engagement ring")

    .replaceAll("هديه", "gift jewelry")
    .replaceAll("هدية", "gift jewelry");

}

// =====================================
// SHOULD SEARCH PRODUCTS
// =====================================

function shouldSearchProducts(message) {

  const msg =
    normalizeText(message);

  const keywords = [

    "ring",
    "necklace",
    "bracelet",
    "earring",

    "diamond",
    "gold",
    "silver",
    "platinum",
    "rose gold",
    "moissanite",

    "gift",
    "luxury",
    "bridal",
    "wedding",

    "show",
    "recommend",
    "suggest",
    "products",

  ];

  return keywords.some((w) =>
    msg.includes(
      normalizeText(w)
    )
  );

}

// =====================================
// SEARCH PRODUCTS
// =====================================

function searchProducts(
  userMessage,
  products
) {

  const msg =
    normalizeText(userMessage);

  const words =
    msg.split(" ");

  let scoredProducts =

    products.map((p) => {

      const text = normalizeText(`

        ${p.title || ""}

        ${p.description || ""}

        ${p.type || ""}

        ${p.tags?.join(" ") || ""}

        ${
          p.aiFeatures
            ?.category || ""
        }

        ${
          p.aiFeatures
            ?.collection || ""
        }

        ${
          p.aiFeatures
            ?.styles
            ?.join(" ")
          || ""
        }

        ${
          p.aiFeatures
            ?.intent
            ?.join(" ")
          || ""
        }

        ${
          p.aiFeatures
            ?.searchKeywords
            ?.join(" ")
          || ""
        }

      `);

      let score = 0;

      words.forEach((word) => {

        if (
          text.includes(word)
        ) {

          score += 10;

        }

      });

      if (
        msg.includes("ring")
        &&
        text.includes("ring")
      ) {

        score += 80;

      }

      if (
        msg.includes("necklace")
        &&
        text.includes("necklace")
      ) {

        score += 80;

      }

      if (
        msg.includes("rose gold")
        &&
        text.includes("rose")
      ) {

        score += 200;

      }

      if (
        msg.includes("yellow gold")
        &&
        text.includes("yellow")
      ) {

        score += 200;

      }

      if (
        msg.includes("white gold")
        &&
        text.includes("white")
      ) {

        score += 200;

      }

      if (
        msg.includes("platinum")
        &&
        text.includes("platinum")
      ) {

        score += 220;

      }

      if (
        msg.includes("moissanite")
        &&
        text.includes("moissanite")
      ) {

        score += 250;

      }

      return {

        ...p,

        score,

      };

    });

  scoredProducts =

    scoredProducts

      .filter((p) =>
        p.score > 0
      )

      .sort(
        (a, b) =>
          b.score - a.score
      )

      .slice(0, 4);

  return scoredProducts;

}

// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {

  res.send(
    "ALYMWNDW AI RUNNING"
  );

});

// =====================================
// CHAT API
// =====================================

app.post("/chat", async (req, res) => {

  try {

    const userMessage =
      req.body.message || "";

    const sessionId =
      req.body.sessionId ||
      crypto.randomUUID();

    const normalizedMessage =
      normalizeText(
        userMessage
      );

    if (
      !conversations[sessionId]
    ) {

      conversations[
        sessionId
      ] = [];

    }

    conversations[
      sessionId
    ].push({

      role: "user",

      content:
        userMessage,

    });

    if (

      conversations[
        sessionId
      ].length > 20

    ) {

      conversations[
        sessionId
      ] =

        conversations[
          sessionId
        ].slice(-10);

    }

    let matchedProducts = [];

    if (

      shouldSearchProducts(
        normalizedMessage
      )

    ) {

      matchedProducts =

        searchProducts(
          normalizedMessage,
          products
        );

    }

    const aiProducts =

    matchedProducts.map((p) => ({

      title:
        p.title,

      handle:
        p.handle,

      description:
        p.description,

      image:
        p.image,

      images:
        p.images || [],

      url:
        p.url,

      reviewRating:
        p.reviewRating || 4.9,

      reviewCount:
        p.reviewCount || 120,

      category:
        p.aiFeatures
          ?.category || "",

      collection:
        p.aiFeatures
          ?.collection || "",

      styles:
        p.aiFeatures
          ?.styles || [],

      emotionalTriggers:
        p.aiFeatures
          ?.emotionalTriggers || [],

      price:

        p.variants?.[0]
          ?.price

        ||

        p.price

        ||

        "",

      variants:

        p.variants
          ?.slice(0, 10)
          ?.map((v) => ({

            id:
              v.id,

            title:
              v.title,

            price:
              v.price,

            image:

              v.mappedImage

              ||

              v.image

              ||

              p.image,

            mappedImage:

              v.mappedImage

              ||

              v.image

              ||

              p.image,

            available:
              v.available,

            metal:
              v.metal || "",

            stoneColor:
              v.stoneColor || "",

            shape:
              v.shape || "",

            options:
              v.options || [],

          })),

    }));

    const completion =

      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.5,

        messages: [

          {
            role: "system",

            content: `

You are Alymwndw AI.

You are a luxury jewelry AI sales expert.

IMPORTANT:

- Sound premium.
- Sound elegant.
- Keep replies concise.
- NEVER invent products.
- NEVER invent prices.
- NEVER invent variants.
- Recommend products naturally.
- Focus on emotional luxury selling.

Frontend already shows products separately.

AVAILABLE PRODUCTS:

${JSON.stringify(aiProducts)}

`,
          },

          ...conversations[
            sessionId
          ].slice(-6),

        ],

      });

    const aiReply =

      completion.choices[0]
        .message.content;

    conversations[
      sessionId
    ].push({

      role: "assistant",

      content:
        aiReply,

    });

    res.json({

      reply:
        aiReply,

      products:
        aiProducts,

      sessionId,

    });

  } catch (err) {

    console.log(err);

    res.status(500).json({

      reply:
        "Server error",

      products: [],

    });

  }

});

// =====================================
// START SERVER
// =====================================

app.listen(PORT, () => {

  console.log(
    `ALYMWNDW AI RUNNING ON PORT ${PORT}`
  );

});
