import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

// ======================
// SHOPIFY
// ======================

const SHOP =
process.env.SHOPIFY_STORE;

const TOKEN =
process.env.SHOPIFY_ACCESS_TOKEN;

// ======================
// CLEAN HTML
// ======================

function cleanHTML(html){

  if(!html) return "";

  return html
    .replace(/<[^>]*>/g," ")
    .replace(/\s+/g," ")
    .trim();

}

// ======================
// SYNONYMS
// ======================

const synonyms = {

  // PRODUCT TYPES

  ring: [

    "ring",
    "rings",

    "خاتم",
    "خواتم",

    "دبلة",
    "محبس",

    "solitaire",
    "engagement ring",
    "wedding band",
    "bridal ring",

  ],

  necklace: [

    "necklace",
    "necklaces",

    "chain",
    "pendant",

    "سلسلة",
    "عقد",
    "قلادة",

  ],

  earrings: [

    "earring",
    "earrings",

    "حلق",
    "اقراط",
    "أقراط",

  ],

  bracelet: [

    "bracelet",
    "bangle",

    "اسورة",
    "سوار",

  ],

  // STONES

  diamond: [

    "diamond",
    "lab diamond",

    "الماس",
    "دايموند",

  ],

  moissanite: [

    "moissanite",

    "موزانيت",
    "مويسانيت",

  ],

  ruby: [

    "ruby",
    "red stone",
    "red gemstone",

    "ياقوت",
    "حجر احمر",
    "حجر أحمر",

  ],

  sapphire: [

    "sapphire",
    "blue stone",

    "ياقوت ازرق",

  ],

  emerald: [

    "emerald",
    "green stone",

    "زمرد",

  ],

  // METALS

  gold: [

    "gold",
    "18k",
    "21k",
    "22k",

    "ذهب",

  ],

  silver: [

    "silver",
    "925 silver",

    "فضة",

  ],

  platinum: [

    "platinum",

  ],

};

// ======================
// DETECT PRODUCT TYPE
// ======================

function detectProductType(text){

  text =
  text.toLowerCase();

  if(

    synonyms.ring.some(
      w => text.includes(w)
    )

  ){

    return "ring";

  }

  if(

    synonyms.necklace.some(
      w => text.includes(w)
    )

  ){

    return "necklace";

  }

  if(

    synonyms.earrings.some(
      w => text.includes(w)
    )

  ){

    return "earrings";

  }

  if(

    synonyms.bracelet.some(
      w => text.includes(w)
    )

  ){

    return "bracelet";

  }

  return "other";

}

// ======================
// DETECT METAL
// ======================

function detectMetal(text){

  text =
  text.toLowerCase();

  if(

    synonyms.gold.some(
      w => text.includes(w)
    )

  ){

    return "gold";

  }

  if(

    synonyms.silver.some(
      w => text.includes(w)
    )

  ){

    return "silver";

  }

  if(

    synonyms.platinum.some(
      w => text.includes(w)
    )

  ){

    return "platinum";

  }

  return "unknown";

}

// ======================
// DETECT STONE
// ======================

function detectStone(text){

  text =
  text.toLowerCase();

  if(

    synonyms.moissanite.some(
      w => text.includes(w)
    )

  ){

    return "moissanite";

  }

  if(

    synonyms.diamond.some(
      w => text.includes(w)
    )

  ){

    return "diamond";

  }

  if(

    synonyms.ruby.some(
      w => text.includes(w)
    )

  ){

    return "ruby";

  }

  if(

    synonyms.sapphire.some(
      w => text.includes(w)
    )

  ){

    return "sapphire";

  }

  if(

    synonyms.emerald.some(
      w => text.includes(w)
    )

  ){

    return "emerald";

  }

  return "none";

}

// ======================
// COLORS
// ======================

function detectColors(text){

  text =
  text.toLowerCase();

  const colors = [];

  const colorList = [

    "red",
    "blue",
    "green",
    "pink",
    "yellow",
    "white",
    "black",

    "rose gold",
    "yellow gold",
    "white gold",

  ];

  colorList.forEach((c)=>{

    if(
      text.includes(c)
    ){

      colors.push(c);

    }

  });

  return colors;

}

// ======================
// LOAD PRODUCTS
// ======================

async function loadProducts(){

  let allProducts = [];

  let since_id = 0;

  let keepLoading =
  true;

  while(keepLoading){

    console.log(
      "Loading after:",
      since_id
    );

    const response =
    await fetch(

      `https://${SHOP}/admin/api/2025-01/products.json?limit=250&since_id=${since_id}`,

      {

        headers: {

          "X-Shopify-Access-Token":
          TOKEN,

          "Content-Type":
          "application/json",

        },

      }

    );

    const data =
    await response.json();

    const products =
    data.products || [];

    console.log(
      "Loaded:",
      products.length
    );

    if(
      products.length === 0
    ){

      keepLoading =
      false;

      break;

    }

    allProducts.push(
      ...products
    );

    since_id =
    products[
      products.length - 1
    ].id;

    if(
      products.length < 250
    ){

      keepLoading =
      false;

    }

  }

  return allProducts;

}

// ======================
// BUILD PRODUCTS
// ======================

async function build(){

  const products =
  await loadProducts();

  const finalProducts =
  products.map((p)=>{

    const description =
    cleanHTML(
      p.body_html
    );

    const baseText = `

      ${p.title}

      ${description}

      ${p.tags}

      ${p.product_type}

      ${p.handle}

    `.toLowerCase();

    // ======================
    // DETECT
    // ======================

    const productType =
    detectProductType(
      baseText
    );

    const metal =
    detectMetal(
      baseText
    );

    const stone =
    detectStone(
      baseText
    );

    const colors =
    detectColors(
      baseText
    );

    // ======================
    // IMAGES
    // ======================

    const mainImage =
    p.images?.[0]?.src || "";

    // ======================
    // VARIANTS
    // ======================

    const variants =
    (p.variants || [])
    .map((v)=>{

      const variantText = `

        ${v.title}

        ${v.option1}

        ${v.option2}

        ${v.option3}

        ${metal}

        ${stone}

        ${colors.join(" ")}

      `.toLowerCase();

      let variantImage =
      mainImage;

      if(v.image_id){

        const img =
        p.images.find(
          i => i.id === v.image_id
        );

        if(img){

          variantImage =
          img.src;

        }

      }

      return {

        id:
        v.id,

        title:
        v.title,

        price:
        v.price,

        available:
        v.inventory_quantity > 0,

        option1:
        v.option1,

        option2:
        v.option2,

        option3:
        v.option3,

        image:
        variantImage,

        semanticText:
        variantText,

      };

    });

    // ======================
    // SEMANTIC TEXT
    // ======================

    const semanticText = `

      ${p.title}

      ${description}

      ${p.tags}

      ${productType}

      ${metal}

      ${stone}

      ${colors.join(" ")}

      ${synonyms[productType]?.join(" ") || ""}

      ${synonyms[metal]?.join(" ") || ""}

      ${synonyms[stone]?.join(" ") || ""}

      ${(variants || [])
        .map(v => v.semanticText)
        .join(" ")}

    `
    .toLowerCase()
    .replace(/\s+/g," ")
    .trim();

    // ======================
    // FINAL
    // ======================

    return {

      id:
      p.id,

      title:
      p.title,

      description,

      tags:
      p.tags,

      handle:
      p.handle,

      productType,

      metal,

      stone,

      colors,

      image:
      mainImage,

      semanticText,

      url:
      `https://${SHOP}/products/${p.handle}`,

      variants,

    };

  });

  // ======================
  // SAVE
  // ======================

  fs.writeFileSync(

    "./products.json",

    JSON.stringify(
      finalProducts,
      null,
      2
    )

  );

  console.log(
    "PRODUCT BRAIN BUILT:",
    finalProducts.length
  );

}

// ======================
// START
// ======================

build();
