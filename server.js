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

// =========================
// OPENAI
// =========================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =========================
// MEMORY
// =========================

let conversations = {};
let conversationSummaries = {};

// =========================
// LOAD PRODUCT BRAIN
// =========================

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

// =========================
// AI PRODUCT RETRIEVAL
// =========================

async function aiRetrieveProducts(
  userMessage,
  products
) {

  // SMALLER DATASET

  const slimProducts =
    products.slice(0, 50).map((p) => ({

      title:
        p.title,

      handle:
        p.handle,

      type:
        p.type,

      description:
        p.description?.slice(0, 120),

      aiFeatures:
        p.aiFeatures,

      price:

        p.variants?.[0]
          ?.price ||

        "N/A",

    }));

  // AI RETRIEVAL

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

Understand customer intent deeply.

Find BEST matching luxury jewelry.

Understand:
- Arabic
- English
- gifting
- romance
- personalization
- luxury fashion
- emotions

Return ONLY JSON:

{
  "matches": [0,1,2,3]
}

PRODUCTS:

${JSON.stringify(slimProducts)}

`,
        },

        {
          role: "user",
          content: userMessage,
        },

      ],

    });

  const data = JSON.parse(
    completion.choices[0]
      .message.content
  );

  // RETURN REAL PRODUCTS

  return data.matches
    .map((i) => products[i])
    .filter(Boolean);

}

// =========================
// HOME
// =========================

app.get("/", (req, res) => {

  res.send(
    "ALYMWNDW AI RUNNING"
  );

});

// =========================
// CHAT API
// =========================

app.post("/chat", async (req, res) => {

  try {

    const userMessage =
      req.body.message || "";

    const sessionId =
      req.body.sessionId ||
      "default";

    // =========================
    // MEMORY INIT
    // =========================

    if (
      !conversations[sessionId]
    ) {

      conversations[
        sessionId
      ] = [];

    }

    // =========================
    // SAVE USER MESSAGE
    // =========================

    conversations[
      sessionId
    ].push({

      role: "user",

      content:
        userMessage,

    });

    // =========================
    // MEMORY SUMMARY
    // =========================

    if (
      conversations[
        sessionId
      ].length > 10
    ) {

      const summaryCompletion =
        await openai.chat.completions.create({

          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",

              content: `
Summarize this jewelry conversation.

Keep:
- customer preferences
- favorite styles
- budget
- relationship context
- gifting intent
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

      conversationSummaries[
        sessionId
      ] =
        summaryCompletion
          .choices[0]
          .message.content;

      // KEEP LAST MESSAGES ONLY

      conversations[
        sessionId
      ] =
        conversations[
          sessionId
        ].slice(-4);

    }

    // =========================
    // AI RETRIEVE PRODUCTS
    // =========================

    const matchedProducts =
      await aiRetrieveProducts(
        userMessage,
        products
      );

    // =========================
    // CLEAN PRODUCTS
    // =========================

    const cleanProducts =
      matchedProducts.map((p) => ({

        title:
          p.title,

        price:

          p.variants?.[0]
            ?.price ||

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

        personalization:
          p.aiFeatures
            ?.features,

      }));

    // =========================
    // RECENT MEMORY
    // =========================

    const recentConversation =
      conversations[
        sessionId
      ].slice(-10);

    // =========================
    // MAIN AI
    // =========================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.9,

        messages: [

          {
            role: "system",

            content: `

You are Alymwndw AI.

You are a highly intelligent luxury jewelry advisor.

You speak naturally like ChatGPT,
but specialized in luxury jewelry.

You are:
- conversational
- emotionally intelligent
- elegant
- persuasive
- warm
- premium
- fashionable
- human-like

IMPORTANT:

- Talk naturally.
- Continue conversations naturally.
- Remember previous messages.
- Never sound robotic.
- Never repeat greetings.
- Ask smart follow-up questions.
- Guide customer naturally.
- Recommend jewelry naturally.
- Mention luxury emotions naturally.
- Arabic must feel natural.
- English must feel premium.
- NEVER invent products.
- ONLY use AVAILABLE PRODUCTS.
- Never print raw URLs.
- Never print image links.
- Frontend displays products separately.

Customer Memory:

${conversationSummaries[sessionId] || ""}

AVAILABLE PRODUCTS:

${JSON.stringify(cleanProducts)}

`,
          },

          ...recentConversation,

        ],

      });

    const aiReply =
      completion.choices[0]
        .message.content;

    // =========================
    // SAVE AI RESPONSE
    // =========================

    conversations[
      sessionId
    ].push({

      role: "assistant",

      content:
        aiReply,

    });

    // =========================
    // RESPONSE
    // =========================

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

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {

  console.log(
    `ALYMWNDW AI RUNNING ON PORT ${PORT}`
  );

});
