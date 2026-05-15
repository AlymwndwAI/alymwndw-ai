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

  // =========================
  // FULL PRODUCT BRAIN
  // =========================

  const slimProducts =

    products.map((p) => ({

      id:
        p.id,

      title:
        p.title,

      handle:
        p.handle,

      type:
        p.type,

      description:
        p.description?.slice(0, 80),

      aiFeatures:
        p.aiFeatures,

    }));

  // =========================
  // AI RETRIEVAL
  // =========================

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

You MUST use aiFeatures as the primary intelligence layer.

Understand:
- style
- emotion
- collection vibe
- luxury mood
- personalization
- gifting
- feminine style
- old money
- soft luxury
- modern elegance

Do NOT rely only on titles.

Choose products by:
- aiFeatures.styles
- aiFeatures.intent
- aiFeatures.emotionalTriggers
- aiFeatures.collection
- aiFeatures.category
- aiFeatures.searchKeywords
- aiFeatures.materials

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

          content:
            userMessage,

        },

      ],

    });

  // =========================
  // PARSE RESULTS
  // =========================

  const data = JSON.parse(

    completion.choices[0]
      .message.content

  );

  // =========================
  // RETURN PRODUCTS
  // =========================

  return data.matches

    .map(
      (i) => products[i]
    )

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
- gifting intent
- personalization requests
- luxury taste
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

      conversations[
        sessionId
      ] =
        conversations[
          sessionId
        ].slice(-4);

    }

    // =========================
    // PRODUCT RETRIEVAL
    // =========================

    const matchedProducts =
      await aiRetrieveProducts(
        userMessage,
        products
      );

    // =========================
    // NO PRODUCTS
    // =========================

    if (
      matchedProducts.length === 0
    ) {

      return res.json({

        reply:
          "لم أجد قطعة مطابقة تماماً حالياً ✨ لكن يمكنني مساعدتك في اختيار أقرب تصميم فاخر مناسب.",

        products: [],

      });

    }

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

        intent:
          p.aiFeatures
            ?.intent,

        emotionalTriggers:
          p.aiFeatures
            ?.emotionalTriggers,

      }));

    // =========================
    // RECENT MEMORY
    // =========================

    const recentConversation =
      conversations[
        sessionId
      ].slice(-8);

    // =========================
    // MAIN AI RESPONSE
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
- Never sound robotic.
- Ask smart follow-up questions.
- Understand luxury fashion deeply.
- Recommend jewelry naturally.
- Mention luxury emotions naturally.
- Keep replies elegant and concise.
- Arabic must feel natural and premium.
- English must feel premium and elegant.
- NEVER invent products.
- ONLY use AVAILABLE PRODUCTS.
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
