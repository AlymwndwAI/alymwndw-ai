function enrichProduct(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
    ${product.vendor}
    ${product.type}
  `.toLowerCase();

  const enrichment = {

    jewelryType: "",
    luxuryLevel: "",

    jewelryStyles: [],
    jewelryOccasions: [],
    jewelryEmotions: [],
    jewelryAudience: [],
    jewelryMaterials: [],
    jewelryGemstones: [],
    jewelryStoneColors: [],
    jewelryShapes: [],
    jewelryThemes: [],
    jewelryVibes: [],
    aiTags: [],
    searchUnderstanding: [],

    bridal: false,
    engagement: false,
    customJewelry: false,
    luxury: false,
    iced: false,
    arabicJewelry: false,

  };

  // PRODUCT TYPE

  if (text.includes("ring")) {
    enrichment.jewelryType = "ring";
  }

  if (text.includes("necklace")) {
    enrichment.jewelryType = "necklace";
  }

  if (text.includes("bracelet")) {
    enrichment.jewelryType = "bracelet";
  }

  if (text.includes("earring")) {
    enrichment.jewelryType = "earring";
  }

  if (text.includes("pendant")) {
    enrichment.jewelryType = "pendant";
  }

  // MATERIALS

  const materials = [

    "gold",
    "yellow gold",
    "white gold",
    "rose gold",
    "18k",
    "21k",
    "22k",
    "silver",
    "925 silver",
    "platinum",
    "diamond",
    "lab diamond",
    "lab grown diamond",
    "moissanite",
    "pearl",

  ];

  materials.forEach((material) => {

    if (text.includes(material)) {
      enrichment.jewelryMaterials.push(material);
    }

  });

  // GEMSTONES

  const gemstones = [

    "diamond",
    "moissanite",
    "ruby",
    "emerald",
    "sapphire",
    "opal",
    "onyx",
    "amethyst",
    "topaz",
    "aquamarine",
    "garnet",
    "pearl",

  ];

  gemstones.forEach((stone) => {

    if (text.includes(stone)) {
      enrichment.jewelryGemstones.push(stone);
    }

  });

  // COLORS

  const colors = [

    "white",
    "yellow",
    "pink",
    "blue",
    "green",
    "purple",
    "black",
    "red",

  ];

  colors.forEach((color) => {

    if (text.includes(color)) {
      enrichment.jewelryStoneColors.push(color);
    }

  });

  // SHAPES

  const shapes = [

    "round",
    "oval",
    "pear",
    "emerald",
    "radiant",
    "princess",
    "cushion",
    "heart",
    "marquise",

  ];

  shapes.forEach((shape) => {

    if (text.includes(shape)) {
      enrichment.jewelryShapes.push(shape);
    }

  });

  // LUXURY

  if (

    text.includes("luxury") ||
    text.includes("diamond") ||
    text.includes("moissanite") ||
    text.includes("platinum")

  ) {

    enrichment.luxury = true;

    enrichment.luxuryLevel = "high";

    enrichment.jewelryStyles.push(
      "luxury",
      "premium",
      "elegant"
    );

  }

  // BRIDAL

  if (

    text.includes("engagement") ||
    text.includes("proposal") ||
    text.includes("wedding")

  ) {

    enrichment.bridal = true;

    enrichment.engagement = true;

    enrichment.jewelryOccasions.push(
      "engagement",
      "proposal",
      "wedding"
    );

  }

  // CUSTOM

  if (

    text.includes("custom") ||
    text.includes("personalized") ||
    text.includes("name necklace")

  ) {

    enrichment.customJewelry = true;

    enrichment.jewelryThemes.push(
      "custom jewelry",
      "personalized jewelry"
    );

  }

  // ARABIC

  if (

    text.includes("arabic") ||
    text.includes("allah") ||
    text.includes("عربي")

  ) {

    enrichment.arabicJewelry = true;

    enrichment.jewelryThemes.push(
      "arabic jewelry"
    );

  }

  // ICED

  if (

    text.includes("iced") ||
    text.includes("tennis")

  ) {

    enrichment.iced = true;

    enrichment.jewelryVibes.push(
      "celebrity luxury"
    );

  }

  // SEARCH UNDERSTANDING

  enrichment.searchUnderstanding = [

    ...enrichment.jewelryMaterials,
    ...enrichment.jewelryGemstones,
    ...enrichment.jewelryStoneColors,
    ...enrichment.jewelryShapes,
    ...enrichment.jewelryStyles,
    ...enrichment.jewelryThemes,

  ];

  return enrichment;

}

module.exports = {
  enrichProduct
};
