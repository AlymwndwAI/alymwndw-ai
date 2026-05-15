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

  ];

  return keywords.some((w) =>
    msg.includes(w)
  );

}

// =====================================
// AI PRODUCT RETRIEVAL
// =====================================

async function aiRetrieveProducts(
  userMessage,
  products
) {

  const slimProducts =

    products.map((p) => ({

      index:
        products.indexOf(p),

      title:
        p.title,

      type:
        p.type,

      description:
        p.description?.slice(0, 120),

      aiFeatures:
        p.aiFeatures,

    }));

  const completion =

    await openai.chat.completions.create({

      model: "gpt-4o-mini",

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
- Understand luxury style.
- Understand fashion.
- Understand gifting.
- Understand women jewelry taste.
- Understand old money.
- Understand soft luxury.
- Understand elegant feminine jewelry.
- Understand minimal luxury.
- Understand collections.
- Understand emotional buying.

Use aiFeatures FIRST.

Use:
- aiFeatures.styles
- aiFeatures.intent
- aiFeatures.category
- aiFeatures.collection
- aiFeatures.searchKeywords
- aiFeatures.materials
- aiFeatures.emotionalTriggers

Return ONLY JSON.

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
            userMessage,

        },

      ],

    });

  const data = JSON.parse(

    completion.choices[0]
      .message.content

  );

  return data.matches

    ?.map(
      (i) => products[i]
    )

    ?.filter(Boolean)

    || [];

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

          model: "gpt-4o-mini",

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
    // SEARCH PRODUCTS ONLY WHEN NEEDED
    // =====================================

    let matchedProducts = [];

    if (

      shouldSearchProducts(
        userMessage
      )

    ) {

      matchedProducts =

        await aiRetrieveProducts(
          userMessage,
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
        userMessage
      )
    ) {

      const msg =
        userMessage.toLowerCase();

      matchedProducts =

        products.filter((p) => {

          const text = `

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

          `.toLowerCase();

          return text.includes(msg);

        })

        .slice(0, 4);

    }

    // =====================================
    // CLEAN PRODUCTS
    // =====================================

    const cleanProducts =

      matchedProducts.map((p) => ({

        title:
          p.title,

        price:

          p.variants?.[0]
            ?.price

          ||

          p.price

          ||

          "N/A",

        collection:
          p.aiFeatures
            ?.collection,

        category:
          p.aiFeatures
            ?.category,

        styles:
          p.aiFeatures
            ?.styles,

        materials:
          p.aiFeatures
            ?.materials,

        emotionalTriggers:
          p.aiFeatures
            ?.emotionalTriggers,

      }));

    // =====================================
    // MAIN AI CHAT
    // =====================================

    const completion =

      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.8,

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
- Be emotionally intelligent.
- Be elegant.
- Be conversational.
- Sound human.
- Ask follow-up questions naturally.
- Understand luxury fashion deeply.
- Keep replies concise.
- Arabic should sound premium.
- English should sound premium.

CRITICAL:

- If AVAILABLE PRODUCTS exist:
recommend them naturally.

- If no products:
continue normal conversation naturally.

- NEVER say:
"I cannot find products"
unless customer explicitly asked.

- NEVER sound robotic.

- Frontend already shows products separately.

Customer Memory:

${summaries[sessionId] || ""}

AVAILABLE PRODUCTS:

${JSON.stringify(cleanProducts)}

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
