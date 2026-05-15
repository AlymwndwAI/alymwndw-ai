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

    .replaceAll("الماس", "diamond")

    .replaceAll("موزانيت", "moissanite")
    .replaceAll("مويسانيت", "moissanite")
    .replaceAll("موزنايت", "moissanite")

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

function shouldSearchProducts(
  message
) {

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
    "moissanite",

    "gift",
    "luxury",
    "bridal",
    "wedding",

    "show",
    "recommend",
    "suggest",
    "products",

    "خاتم",
    "عقد",
    "سلسله",
    "اسوره",
    "حلق",

    "ذهب",
    "فضه",
    "الماس",
    "موزانيت",

    "هديه",
    "هدية",

    "عايز",
    "عاوز",

    "وريني",
    "شوف",

  ];

  return keywords.some((w) =>
    msg.includes(
      normalizeText(w)
    )
  );

}

// =====================================
// SMART COLLECTION INTELLIGENCE
// =====================================

const INTELLIGENCE = {

  // =====================================
  // SOFT LUXURY
  // =====================================

  "soft luxury": {

    triggers: [

      "soft luxury",
      "minimal",
      "simple",
      "elegant",
      "classy",
      "feminine",

      "ناعم",
      "ناعمه",
      "رقيق",
      "راقي",
      "شيك",

    ],

    boosts: [

      "minimal",
      "luxury",
      "elegance",
      "timeless beauty",

    ],

  },

  // =====================================
  // OLD MONEY
  // =====================================

  "old money": {

    triggers: [

      "old money",
      "classic luxury",
      "timeless",

      "كلاسيك",
      "فخم",

    ],

    boosts: [

      "classic",
      "luxury",
      "diamond",
      "white gold",
      "pearl",

    ],

  },

  // =====================================
  // GIFT
  // =====================================

  "gift jewelry": {

    triggers: [

      "gift",
      "birthday",
      "anniversary",

      "هديه",
      "هدية",

    ],

    boosts: [

      "gift jewelry",
      "personalized",
      "minimal",
      "feminine",

    ],

  },

  // =====================================
  // NAME NECKLACES
  // =====================================

  "name necklace": {

    triggers: [

      "name necklace",
      "initial necklace",
      "custom jewelry",

      "سلسله اسم",
      "سلسلة اسم",
      "سلسله حرف",
      "سلسلة حرف",

    ],

    boosts: [

      "personalized",
      "alpha gold",
      "custom jewelry",
      "initial necklace",

    ],

  },

  // =====================================
  // BRIDAL
  // =====================================

  "bridal": {

    triggers: [

      "engagement",
      "wedding",
      "bridal",

      "خطوبه",
      "زواج",

    ],

    boosts: [

      "bridal",
      "engagement",
      "diamond ring",
      "wedding ring",

    ],

  },

  // =====================================
  // MOISSANITE
  // =====================================

  "moissanite": {

    triggers: [

      "moissanite",
      "gra certified",

      "موزانيت",
      "مويسانيت",

    ],

    boosts: [

      "moissanite",
      "gra certified",
      "diamond alternative",
      "high brilliance",

    ],

  },

};

// =====================================
// SMART PRODUCT SEARCH
// =====================================

function searchProducts(
  userMessage,
  products
) {

  const msg =
    normalizeText(
      userMessage
    );

  const words =
    msg.split(" ");

  let scoredProducts =

    products.map((p) => {

      const text = normalizeText(`

        ${p.title || ""}

        ${p.description || ""}

        ${p.type || ""}

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

        ${
          p.aiFeatures
            ?.emotionalTriggers
            ?.join(" ")
          || ""
        }

      `);

      let score = 0;

      // =====================================
      // BASIC WORD MATCH
      // =====================================

      words.forEach((word) => {

        if (
          text.includes(word)
        ) {

          score += 10;

        }

      });

      // =====================================
      // SMART INTELLIGENCE ENGINE
      // =====================================

      Object.values(INTELLIGENCE)

      .forEach((intent) => {

        const triggered =

          intent.triggers.some((t) =>

            msg.includes(
              normalizeText(t)
            )

          );

        if (triggered) {

          intent.boosts.forEach((b) => {

            if (

              text.includes(
                normalizeText(b)
              )

            ) {

              score += 150;

            }

          });

        }

      });

      // =====================================
      // CATEGORY BOOST
      // =====================================

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

        msg.includes("bracelet")

        &&

        text.includes("bracelet")

      ) {

        score += 80;

      }

      if (

        msg.includes("earring")

        &&

        text.includes("earring")

      ) {

        score += 80;

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

    // =====================================
    // INIT MEMORY
    // =====================================

    if (
      !conversations[sessionId]
    ) {

      conversations[
        sessionId
      ] = [];

    }

    // =====================================
    // SAVE USER MESSAGE
    // =====================================

    conversations[
      sessionId
    ].push({

      role: "user",

      content:
        userMessage,

    });

    // =====================================
    // CLEANUP MEMORY
    // =====================================

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

    // =====================================
    // MEMORY SUMMARY
    // =====================================

    if (

      conversations[
        sessionId
      ].length > 10

    ) {

      const summaryCompletion =

        await openai.chat.completions.create({

          model: "gpt-4.1-mini",

          temperature: 0.2,

          messages: [

            {
              role: "system",

              content: `

Summarize this luxury jewelry customer.

Keep:
- style
- jewelry taste
- gifting preferences
- luxury preferences
- favorite materials

`,
            },

            {
              role: "user",

              content:
                JSON.stringify(
                  conversations[
                    sessionId
                  ]
                ),
            },

          ],

        });

      summaries[
        sessionId
      ] =

        summaryCompletion
          .choices[0]
          .message.content;

    }

    // =====================================
    // FAST LOCAL SEARCH
    // =====================================

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

    // =====================================
    // LIGHT PRODUCTS
    // =====================================

    const aiProducts =

      matchedProducts.map((p) => ({

        title:
          p.title,

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
            ?.slice(0, 3)
            ?.map((v) => ({

              title:
                v.title,

              price:
                v.price,

            })),

      }));

    // =====================================
    // MAIN AI CHAT
    // =====================================

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

- Sound human.
- Sound premium.
- Be emotionally intelligent.
- Be elegant.
- Keep replies concise.
- Arabic should sound premium.
- English should sound premium.
- NEVER invent products.
- NEVER invent prices.
- NEVER invent variants.
- Recommend products naturally.

Frontend already shows products separately.

Customer Memory:

${summaries[sessionId] || ""}

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

    // =====================================
    // SAVE AI RESPONSE
    // =====================================

    conversations[
      sessionId
    ].push({

      role: "assistant",

      content:
        aiReply,

    });

    // =====================================
    // RESPONSE
    // =====================================

    res.json({

      reply:
        aiReply,

      products:
        matchedProducts,

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
