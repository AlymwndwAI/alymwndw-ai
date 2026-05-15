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

  // SMALLER AI DATA
  const slimProducts =
    products.slice(0, 200).map((p) => ({

      title:
        p.title,

      handle:
        p.handle,

      type:
        p.type,

      description:
        p.description?.slice(0, 300),

      aiFeatures:
        p.aiFeatures,

      variants:
        p.variants?.slice(0, 5),

      image:
        p.image,

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

Your job:
- deeply understand customer request
- select BEST matching luxury jewelry
- prioritize emotional fit
- prioritize luxury style
- understand Arabic and English naturally
- understand gifting
- understand romance
- understand personalization
- understand jewelry fashion

Return ONLY JSON:

{
  "matches": [0,1,2,3]
}

Indexes represent product positions.

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

        // BASIC
        title:
          p.title,

        handle:
          p.handle,

        url:
          `https://alymwndw.com/products/${p.handle}`,

        type:
          p.type,

        description:
          p.description,

        image:
          p.image,

        // AI FEATURES
        collection:
          p.aiFeatures
            ?.collection,

        category:
          p.aiFeatures
            ?.category,

        productType:
          p.aiFeatures
            ?.productType,

        materials:
          p.aiFeatures
            ?.materials,

        styles:
          p.aiFeatures
            ?.styles,

        intent:
          p.aiFeatures
            ?.intent,

        emotionalTriggers:
          p.aiFeatures
            ?.emotionalTriggers,

        searchKeywords:
          p.aiFeatures
            ?.searchKeywords,

        supportedLanguages:
          p.aiFeatures
            ?.supportedLanguages,

        // PRICE
        price:

          p.variants?.[0]
            ?.price ||

          "N/A",

        // VARIANTS
        variants:

          p.variants?.map(
            (v) => ({

              title:
                v.title,

              price:
                v.price,

              available:
                v.available,

              image:
                v.image,

              options:
                v.options,

            })
          ),

      }));

    // =========================
    // MAIN AI RESPONSE
    // =========================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

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

You understand:
- emotions
- gifting
- romance
- luxury fashion
- personalization
- jewelry trends
- relationships
- special occasions

IMPORTANT BEHAVIOR:

- Talk naturally.
- Continue conversations naturally.
- Remember previous messages.
- Never sound robotic.
- Never repeat generic greetings.
- Ask smart follow-up questions.
- Guide customer like real luxury consultant.
- Recommend products naturally inside conversation.
- Explain WHY pieces fit customer.
- Mention emotions and luxury feeling.
- Arabic must feel natural and premium.
- English must feel premium and elegant.
- Never invent products.
- ONLY use AVAILABLE PRODUCTS.

You can:
- compare products
- recommend gifts
- suggest matching jewelry
- upsell elegantly
- explain materials
- explain luxury styling
- help choose between products

AVAILABLE PRODUCTS:

${JSON.stringify(cleanProducts)}

`,
          },

          ...conversations[
            sessionId
          ],

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
