import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";

dotenv.config();

// ======================
// APP
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
// NORMALIZE ARABIC
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
    "اقراط":"earring",
    "أقراط":"earring",

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

    // METALS

    "ذهب":"gold",

    "ذهب ابيض":"white gold",
    "ذهب أبيض":"white gold",

    "ذهب اصفر":"yellow gold",

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
// SEARCH
// ======================

function semanticSearch(message){

  const msg =
    normalizeArabic(message);

  const words =
    msg
      .split(" ")
      .filter(Boolean);

  // ======================
  // REQUESTED TYPE
  // ======================

  let requestedType =
    "";

  if(

    msg.includes("ring") ||
    msg.includes("solitaire") ||
    msg.includes("engagement")

  ){

    requestedType =
      "ring";

  }

  if(
    msg.includes("necklace")
  ){

    requestedType =
      "necklace";

  }

  if(
    msg.includes("earring")
  ){

    requestedType =
      "earrings";

  }

  if(
    msg.includes("bracelet")
  ){

    requestedType =
      "bracelet";

  }

  // ======================
  // SCORE PRODUCTS
  // ======================

  let results =
    productsCache.map((p)=>{

      let score = 0;

      // ======================
      // HARD FILTER
      // ======================

      if(

        requestedType &&
        p.productType !==
          requestedType

      ){

        return {

          ...p,

          matchedVariants:
            [],

          score: -999,

        };

      }

      // ======================
      // PRODUCT TEXT
      // ======================

      const productText = `

${p.title}
${p.description}
${p.tags}
${p.productType}
${p.metal}
${p.stone}
${p.colors?.join(" ")}

`
      .toLowerCase();

      // ======================
      // WORD MATCH
      // ======================

      words.forEach((w)=>{

        if(

          w.length > 2 &&
          productText.includes(w)

        ){

          score += 15;

        }

      });

      // ======================
      // PRODUCT TYPE BOOST
      // ======================

      if(

        requested
