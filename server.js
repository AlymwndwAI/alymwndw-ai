import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static("public"));

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
// LOAD PRODUCT BRAIN
// ======================

const productsCache =
JSON.parse(

  fs.readFileSync(
    "./products.json",
    "utf8"
  )

);

console.log(
  "PRODUCT BRAIN LOADED:",
  productsCache.length
);

// ======================
// ARABIC NORMALIZATION
// ======================

function normalizeArabic(text){

  let msg =
  text.toLowerCase();

  const map = {

    // RINGS

    "خاتم":"ring",
    "خواتم":"ring",
    "دبلة":"ring",
    "محبس":"ring",
    "سوليتير":"solitaire ring",

    // NECKLACES

    "سلسلة":"necklace",
    "عقد":"necklace",
    "قلادة":"necklace",

    // EARRINGS

    "حلق":"earring",
    "أقراط":"earring",
    "اقراط":"earring",

    // BRACELETS

    "اسورة":"bracelet",
    "سوار":"bracelet",

    // STONES

    "موزانيت":"moissanite",
    "مويسانيت":"moissanite",

    "الماس":"diamond",
    "دايموند":"diamond",

    "ياقوت":"ruby",
    "حجر احمر":"ruby",
    "حجر أحمر":"ruby",

    "زمرد":"emerald",

    "ياقوت ازرق":"sapphire",

    // METALS

    "ذهب":"gold",

    "ذهب اصفر":"yellow gold",
    "ذهب أبيض":"white gold",
    "ذهب ابيض":"white gold",

    "روز جولد":"rose gold",

    // COLORS

    "احمر":"red",
    "أحمر":"red",

    "ازرق":"blue",
    "أزرق":"blue",

    "اخضر":"green",
    "أخضر":"green",

    "ابيض":"white",
    "أبيض":"white",

    "اسود":"black",

  };

  Object.entries(map)
  .forEach(([ar,en])=>{

    msg =
    msg.replaceAll(ar,en);

  });

  return msg;

}

// ======================
// SEMANTIC SEARCH
// ======================

function semanticSearch(message){

  const msg =
  normalizeArabic(message);

  const words =
  msg
    .split(" ")
    .filter(Boolean);

  let results =
  productsCache.map((p)=>{

    let score = 0;

    const text =
    p.semanticText;

    // ======================
    // PRODUCT TYPE
    // ======================

    if(

      msg.includes("ring") &&
      p.productType === "ring"

    ){

      score += 120;

    }

    if(

      msg.includes("necklace") &&
      p.productType === "necklace"

    ){

      score += 120;

    }

    if(

      msg.includes("earring") &&
      p.productType === "earrings"

    ){

      score += 120;

    }

    if(

      msg.includes("bracelet") &&
      p.productType === "bracelet"

    ){

      score += 120;

    }

    // ======================
    // METALS
    // ======================

    if(

      msg.includes("gold") &&
      p.metal.includes("gold")

    ){

      score += 80;

    }

    if(

      msg.includes("silver") &&
      p.metal === "silver"

    ){

      score += 80;

    }

    if(

      msg.includes("platinum") &&
      p.metal === "platinum"

    ){

      score += 80;

    }

    // ======================
    // STONES
    // ======================

    if(

      msg.includes("moissanite") &&
      p.stone === "moissanite"

    ){

      score += 120;

    }

    if(

      msg.includes("diamond") &&
      p.stone === "diamond"

    ){

      score += 120;

    }

    if(

      msg.includes("ruby") &&
      p.stone === "ruby"

    ){

      score += 120;

    }

    if(

      msg.includes("emerald") &&
      p.stone === "emerald"

    ){

      score += 120;

    }

    if(

      msg.includes("sapphire") &&
      p.stone === "sapphire"

    ){

      score += 120;

    }

    // ======================
    // GENERAL WORDS
    // ======================

    words.forEach((w)=>{

      if(

        w.length > 2 &&
        text.includes(w)

      ){

        score += 10;

      }

    });

    // ======================
    // VARIANT MATCHING
    // ======================

    let matchedVariants =
    [];

    (p.variants || [])
    .forEach((v)=>{

      let variantScore =
      0;

      const variantText =
      v.semanticText;

      words.forEach((w)=>{

        if(

          w.length > 2 &&
          variantText.includes(w)

        ){

          variantScore += 25;

        }

      });

      if(
        variantScore > 0
      ){

        matchedVariants.push({

          ...v,
          variantScore

        });

        score +=
        variantScore;

      }

    });

    matchedVariants.sort(
      (a,b)=>
      b.variantScore -
      a.variantScore
    );

    // ======================
    // RANDOM DIVERSITY
    // ======================

    score +=
    Math.random() * 5;

    return {

      ...p,

      matchedVariants,

      score,

    };

  });

  // ======================
  // MINIMUM SCORE
  // ======================

  let minimumScore =
  30;

  if(

    msg.includes("ring") ||
    msg.includes("necklace") ||
    msg.includes("moissanite") ||
    msg.includes("diamond") ||
    msg.includes("ruby")

  ){

    minimumScore =
    80;

  }

  results =
  results
    .filter(
      (p)=>
      p.score >= minimumScore
    )
    .sort(
      (a,b)=>
      b.score - a.score
    );

  return results.slice(0,4);

}

// ======================
// CHAT
// ======================

app.post(
  "/chat",
  async (req,res)=>{

    try{

      const message =
      req.body.message || "";

      // ======================
      // GREETINGS
      // ======================

      const greetings = [

        "hi",
        "hello",
        "hey",

        "هاي",
        "مرحبا",
        "اهلا",
        "أهلا",
        "السلام عليكم",

      ];

      if(

        greetings.includes(
          message
            .toLowerCase()
            .trim()
        )

      ){

        return res.json({

          reply:
          "Welcome to Alymwndw Jewellery 💎 How can I help you today?",

          products: [],

        });

      }

      // ======================
      // SEARCH
      // ======================

      const matchedProducts =
      semanticSearch(message);

      // ======================
      // NO RESULTS
      // ======================

      if(
        matchedProducts.length === 0
      ){

        return res.json({

          reply:
          "Sorry, I could not find matching jewelry pieces in our collection right now.",

          products: [],

        });

      }

      // ======================
      // CLEAN PRODUCTS
      // ======================

      const cleanProducts =
      matchedProducts.map((p)=>({

        title:
        p.title,

        description:
        p.description,

        productType:
        p.productType,

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

        price:
        p.variants?.[0]?.price || "",

        variants:

        p.matchedVariants
          ?.length

          ?

          p.matchedVariants

          :

          p.variants,

      }));

      // ======================
      // AI PROMPT
      // ======================

      const systemPrompt = `

You are Alymwndw Jewellery AI.

You are a luxury jewellery sales expert.

STRICT RULES:

1- NEVER invent products.
2- ONLY use provided products.
3- NEVER recommend wrong product types.
4- NEVER recommend necklaces if user asks for rings.
5- NEVER invent gemstones or metals.
6- Mention matching variants naturally.
7- Answer Arabic if user speaks Arabic.
8- Keep answers elegant and short.
9- Upsell naturally.
10- Focus on luxury jewelry sales.

AVAILABLE PRODUCTS:

${JSON.stringify(cleanProducts)}

`;

      // ======================
      // OPENAI
      // ======================

      const completion =
      await openai.chat.completions.create({

        model:
        "gpt-4.1-mini",

        temperature:
        0.3,

        messages:[

          {

            role:"system",

            content:
            systemPrompt,

          },

          {

            role:"user",

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

    }

    catch(error){

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

app.listen(PORT,()=>{

  console.log(
    "ALYMWNDW AI RUNNING"
  );

});
