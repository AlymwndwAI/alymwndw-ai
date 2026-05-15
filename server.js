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

Your job:
Find the BEST matching jewelry products.

IMPORTANT:
- Use aiFeatures FIRST.
- Understand luxury style.
- Understand emotions.
- Understand gifting intent.
- Understand soft luxury.
- Understand old money aesthetic.
- Understand feminine elegant style.
- Understand personalized jewelry.
- Understand collections.
- Understand custom jewelry.

DO NOT rely only on titles.

Use:
- aiFeatures.styles
- aiFeatures.intent
- aiFeatures.category
- aiFeatures.searchKeywords
- aiFeatures.collection
- aiFeatures.materials
- aiFeatures.emotionalTriggers

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

  const data = JSON.parse(

    completion.choices[0]
      .message.content

  );

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
    // AI PRODUCT RETRIEVAL
    // =========================

    let matchedProducts =
      await aiRetrieveProducts(
        userMessage,
        products
      );

    // =========================
    // FALLBACK SEARCH
    // =========================

    if (
      matchedProducts.length === 0
    ) {

      const msg =
        userMessage.toLowerCase();

      const fallback =
        products.filter((p) => {

          const text = `
            ${p.title || ""}
            ${p.description || ""}
            ${p.type || ""}
            ${
              p.aiFeatures
                ?.searchKeywords
                ?.join(" ") || ""
            }
            ${
              p.aiFeatures
                ?.styles
                ?.join(" ") || ""
            }
            ${
              p.aiFeatures
                ?.category || ""
            }
            ${
              p.aiFeatures
                ?.collection || ""
            }
          `.toLowerCase();

          return text.includes(msg);

        });

      matchedProducts =
        fallback.slice(0, 4);

    }

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

          p.price ||

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

    // =========================
    // RECENT MEMORY
    // =========================

    const recentConversation =
      conversations[
        sessionId
      ].slice(-8);

    // =========================
    // MAIN AI
    // =========================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.8,

        messages: [

          {
            role: "system",

            content: `

You are Alymwndw AI.

You are a luxury jewelry stylist and sales expert.

IMPORTANT:
- Speak naturally like ChatGPT.
- Be elegant and premium.
- Be emotionally intelligent.
- Keep replies concise.
- Arabic must sound luxurious.
- NEVER invent products.
- ONLY use AVAILABLE PRODUCTS.
- Recommend products naturally.
- Frontend already displays products separately.
- Do not dump product lists.
- Focus on helping customer choose.

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
