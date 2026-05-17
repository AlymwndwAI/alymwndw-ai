function enrichProduct(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
    ${product.vendor}
    ${product.type}
    ${(product.variants || []).map((v) => v.title).join(" ")}
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
  if (text.includes("ring"))      enrichment.jewelryType = "ring";
  if (text.includes("necklace"))  enrichment.jewelryType = "necklace";
  if (text.includes("bracelet"))  enrichment.jewelryType = "bracelet";
  if (text.includes("earring"))   enrichment.jewelryType = "earring";
  if (text.includes("pendant"))   enrichment.jewelryType = "pendant";
  if (text.includes("chain"))     enrichment.jewelryType = "chain";

  // MATERIALS
  const materials = [
    "gold", "yellow gold", "white gold", "rose gold",
    "18k", "21k", "22k", "silver", "925 silver",
    "platinum", "diamond", "lab diamond", "lab grown diamond",
    "moissanite", "pearl",
  ];

  materials.forEach((m) => {
    if (text.includes(m)) enrichment.jewelryMaterials.push(m);
  });

  // GEMSTONES
  const gemstones = [
    "diamond", "moissanite", "ruby", "emerald", "sapphire",
    "opal", "onyx", "amethyst", "topaz", "aquamarine", "garnet", "pearl",
  ];

  gemstones.forEach((s) => {
    if (text.includes(s)) enrichment.jewelryGemstones.push(s);
  });

  // COLORS
  const colors = ["white", "yellow", "pink", "blue", "green", "purple", "black", "red", "orange"];

  colors.forEach((c) => {
    if (text.includes(c)) enrichment.jewelryStoneColors.push(c);
  });

  // SHAPES
  const shapes = [
    "round", "oval", "pear", "emerald cut", "radiant",
    "princess", "cushion", "heart", "marquise", "asscher",
  ];

  shapes.forEach((s) => {
    if (text.includes(s)) enrichment.jewelryShapes.push(s);
  });

  // AUDIENCE
  if (text.includes(" men") || text.includes("men's") || text.includes("groom")) {
    enrichment.jewelryAudience.push("men");
  }
  if (text.includes("kids") || text.includes("children") || text.includes("baby")) {
    enrichment.jewelryAudience.push("kids");
  }
  if (text.includes("couple") || text.includes("matching") || text.includes("pair")) {
    enrichment.jewelryAudience.push("couple");
  }

  // OCCASIONS
  if (text.includes("birthday")) enrichment.jewelryOccasions.push("birthday");
  if (text.includes("anniversary")) enrichment.jewelryOccasions.push("anniversary");
  if (text.includes("gift")) enrichment.jewelryOccasions.push("gift");
  if (text.includes("graduation")) enrichment.jewelryOccasions.push("graduation");
  if (text.includes("mother") || text.includes("mom")) enrichment.jewelryOccasions.push("mother");

  // LUXURY
  if (
    text.includes("luxury") ||
    text.includes("diamond") ||
    text.includes("moissanite") ||
    text.includes("platinum")
  ) {
    enrichment.luxury = true;
    enrichment.luxuryLevel = "high";
    enrichment.jewelryStyles.push("luxury", "premium", "elegant");
  }

  // BRIDAL
  if (
    text.includes("engagement") ||
    text.includes("proposal") ||
    text.includes("wedding")
  ) {
    enrichment.bridal = true;
    enrichment.engagement = true;
    enrichment.jewelryOccasions.push("engagement", "proposal", "wedding");
    enrichment.jewelryStyles.push("bridal");
  }

  // CUSTOM
  if (
    text.includes("custom") ||
    text.includes("personalized") ||
    text.includes("name necklace") ||
    text.includes("initial") ||
    text.includes("engraving") ||
    text.includes("name pendant")
  ) {
    enrichment.customJewelry = true;
    enrichment.jewelryThemes.push("custom jewelry", "personalized jewelry");
    enrichment.jewelryStyles.push("custom", "personalized");
  }

  // ARABIC
  if (
    text.includes("arabic") ||
    text.includes("allah") ||
    text.includes("عربي") ||
    text.includes("خط عربي")
  ) {
    enrichment.arabicJewelry = true;
    enrichment.jewelryThemes.push("arabic jewelry");
  }

  // ICED / TENNIS
  if (text.includes("iced") || text.includes("tennis")) {
    enrichment.iced = true;
    enrichment.jewelryVibes.push("celebrity luxury", "iced out");
    enrichment.jewelryStyles.push("tennis");
  }

  // EMOTIONS
  if (text.includes("love") || text.includes("heart") || text.includes("romantic")) {
    enrichment.jewelryEmotions.push("love", "romance");
  }
  if (text.includes("elegant") || text.includes("classic") || text.includes("timeless")) {
    enrichment.jewelryEmotions.push("elegance", "timeless");
  }
  if (text.includes("bold") || text.includes("statement") || text.includes("fashion")) {
    enrichment.jewelryEmotions.push("bold", "statement");
  }

  // AI TAGS — merged useful keywords for search
  enrichment.aiTags = [
    enrichment.jewelryType,
    ...enrichment.jewelryMaterials,
    ...enrichment.jewelryGemstones,
    ...enrichment.jewelryShapes,
    ...enrichment.jewelryStyles,
    ...enrichment.jewelryAudience,
    ...enrichment.jewelryOccasions,
    ...enrichment.jewelryThemes,
  ].filter(Boolean);

  // SEARCH UNDERSTANDING
  enrichment.searchUnderstanding = [
    ...new Set([
      ...enrichment.jewelryMaterials,
      ...enrichment.jewelryGemstones,
      ...enrichment.jewelryStoneColors,
      ...enrichment.jewelryShapes,
      ...enrichment.jewelryStyles,
      ...enrichment.jewelryThemes,
      ...enrichment.jewelryAudience,
      ...enrichment.jewelryOccasions,
    ]),
  ];

  return enrichment;
}

// ES MODULE export (matches build-brain.js import style)
export default enrichProduct;
