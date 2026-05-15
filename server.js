import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";

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
// SHOULD SEARCH PRODUCTS
// =====================================

function shouldSearchProducts(
  message
) {

  const msg =
    message.toLowerCase();

  const keywords = [

    // ENGLISH

    "ring",
    "necklace",
    "bracelet",
    "earring",
    "diamond",
    "gold",
    "silver",
    "moissanite",
    "gift",
    "show",
    "recommend",
    "suggest",
    "collection",
    "products",
    "luxury",
    "bridal",
    "wedding",

    // ARABIC

    "خاتم",
    "عقد",
    "سلسلة",
    "اسورة",
    "حلق",
    "ذهب",
    "فضة",
    "هديه",
    "هدية",
    "وريني",
    "عاوز",
    "عايز",
    "منتجات",
    "قطع",
    "كولكشن",
    "المزيد",
    "شوفني",
    "موزانيت",
    "الماس",
    "زواج",
    "خطوبة",

  ];

  return keywords.some((w) =>
    msg.includes(w)
  );

}

// =====================================
// NORMALIZE TEXT
// =====================================

function normalizeText(text) {

  return text

    .toLowerCase()

    .replaceAll("أ", "ا")
    .replaceAll("إ", "ا")
    .replaceAll("آ", "ا")

    .replaceAll("ة", "ه")

    .replaceAll("ى", "ي")

    .replaceAll("موزنايت", "moissanite")
    .replaceAll("موزانيت", "moissanite")
    .replaceAll("مويسانيت", "moissanite")

    .replaceAll("الماس", "diamond")

    .replaceAll("خاتم", "ring")
    .replaceAll("دبله", "ring")

    .replaceAll("عقد", "necklace")
    .replaceAll("سلسله", "necklace")

    .replaceAll("اسوره", "bracelet")

    .replaceAll("حلق", "earring");

}

// =====================================
// AI PRODUCT RETRIEVAL
// =====================================

async function aiRetrieveProducts(
  userMessage,
  products
) {

  const slimProducts =

    products.map((p, index) => ({

      index,

      title:
        p.title,

      type:
        p.type,

      aiFeatures:
        p.aiFeatures,

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

  const completion =

    await openai.chat.completions.create({

      model: "gpt-4.1-mini",

      temperature: 0,

      response_format: {
        type: "json_object",
      },

      messages: [

        {
          role: "system",

          content: `

You are Alymwndw AI retrieval engine.

Your ONLY job:
choose the BEST matching jewelry products.

IMPORTANT:

- Understand luxury jewelry.
- Understand elegant feminine jewelry.
- Understand minimal luxury.
- Understand bridal jewelry.
- Understand gifting.
- Understand Arabic and English.
- Use aiFeatures FIRST.
- Focus on product relevance.
- Return ONLY JSON.

Example:

{
  "matches": [1,5,8,12]
}

PRODUCTS:

${JSON.stringify(slimProducts)}

`,
        },

        {
          role: "user",

          content:
            normalizeText(
              userMessage
            ),

        },

      ],

    });

  try {

    const data = JSON.parse(

      completion.choices[0]
        .message.content

    );

    return data.matches

      ?.map(
        (i) => products[i]
      )

      ?.filter(Boolean)

      ?.slice(0, 4)

      || [];

  } catch {

    return [];

  }

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

    const normalizedMessage =
      normalizeText(
        userMessage
      );

    const sessionId =
      req.body.sessionId ||
      "default";

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
    // MEMORY SUMMARY
    // =====================================

    if (

      conversations[
        sessionId
      ].length > 12

    ) {

      const summaryCompletion =

        await openai.chat.completions.create({

          model: "gpt-4.1-mini",

          temperature: 0.3,

          messages: [

            {
              role: "system",

              content: `

Summarize this luxury jewelry conversation.

Keep:
- taste
- favorite styles
- gifting preferences
- luxury preferences
- metal preferences
- personalization requests

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

      conversations[
        sessionId
      ] =

        conversations[
          sessionId
        ].slice(-6);

    }

    // =====================================
    // PRODUCT SEARCH
    // =====================================

    let matchedProducts = [];

    if (

      shouldSearchProducts(
        normalizedMessage
      )

    ) {

      matchedProducts =

        await aiRetrieveProducts(

          normalizedMessage,

          products

        );

    }

    // =====================================
    // FALLBACK SEARCH
    // =====================================

    if (

      matchedProducts.length === 0

      &&

      shouldSearchProducts(
        normalizedMessage
      )

    ) {

      matchedProducts =

        products.filter((p) => {

          const text = normalizeText(`

            ${p.title || ""}
            ${p.description || ""}
            ${p.type || ""}

            ${
              p.aiFeatures
                ?.searchKeywords
                ?.join(" ")
              || ""
            }

            ${
              p.aiFeatures
                ?.styles
                ?.join(" ")
              || ""
            }

            ${
              p.aiFeatures
                ?.category
              || ""
            }

            ${
              p.aiFeatures
                ?.collection
              || ""
            }

          `);

          return normalizedMessage
            .split(" ")
            .some((word) =>
              text.includes(word)
            );

        })

        .slice(0, 4);

    }

    // =====================================
    // LIGHT PRODUCTS FOR OPENAI
    // =====================================

    const aiProducts =

      matchedProducts.map((p) => ({

        title:
          p.title,

        productType:

          p.type ||

          p.aiFeatures
            ?.productType ||

          "",

        category:
          p.aiFeatures
            ?.category || "",

        price:

          p.variants?.[0]
            ?.price

          ||

          p.price

          ||

          "",

        styles:
          p.aiFeatures
            ?.styles || [],

        emotionalTriggers:
          p.aiFeatures
            ?.emotionalTriggers || [],

        searchKeywords:
          p.aiFeatures
            ?.searchKeywords || [],

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

You are a luxury jewelry AI sales agent.

You behave like ChatGPT,
but specialized in jewelry.

IMPORTANT:

- Talk naturally.
- Sound human.
- Be elegant.
- Be emotionally intelligent.
- Keep replies concise.
- Arabic should sound premium.
- English should sound premium.
- Understand luxury deeply.
- Recommend products naturally.
- NEVER invent products.
- NEVER invent variants.
- NEVER invent prices.
- NEVER sound robotic.

Frontend already shows products separately.

Customer Memory:

${summaries[sessionId] || ""}

AVAILABLE PRODUCTS:

${JSON.stringify(aiProducts)}

`,
          },

          ...conversations[
            sessionId
          ].slice(-8),

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
