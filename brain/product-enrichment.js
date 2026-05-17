function enrichProduct(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
    ${product.vendor}
    ${product.type}
    ${(product.collections || []).map((c) => c.title).join(" ")}
    ${(product.variants || []).map((v) => v.title).join(" ")}
  `.toLowerCase();

  const tagsText = (product.tags || []).join(" ").toLowerCase();
  const collectionsText = (product.collections || []).map((c) => c.title).join(" ").toLowerCase();
  const variantsText = (product.variants || []).map((v) => v.title + " " + JSON.stringify(v.optionsMap || {})).join(" ").toLowerCase();

  const enrichment = {

    jewelryType: "",
    luxuryLevel: "standard",

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
    jewelryCollections: [],
    aiTags: [],
    searchUnderstanding: [],
    arabicKeywords: [],

    bridal: false,
    engagement: false,
    customJewelry: false,
    luxury: false,
    iced: false,
    arabicJewelry: false,
    labGrown: false,
    certified: false,
    nameJewelry: false,
    pearlJewelry: false,
    heartShape: false,
    mensJewelry: false,
    kidsJewelry: false,
    coupleJewelry: false,

  };

  // =====================
  // JEWELRY TYPE
  // =====================
  if (text.includes("ring") || tagsText.includes("ring"))           enrichment.jewelryType = "ring";
  if (text.includes("necklace") || tagsText.includes("necklace"))   enrichment.jewelryType = "necklace";
  if (text.includes("bracelet") || tagsText.includes("bracelet"))   enrichment.jewelryType = "bracelet";
  if (text.includes("earring") || tagsText.includes("earring") || tagsText.includes("earing")) enrichment.jewelryType = "earring";
  if (text.includes("pendant") || tagsText.includes("pendant"))     enrichment.jewelryType = "pendant";
  if (text.includes("chain") || tagsText.includes("chain"))         enrichment.jewelryType = "chain";

  // =====================
  // COLLECTIONS (your actual Shopify collections)
  // =====================
  const collectionMap = {
    "moissanite": ["moissanite", "massonite", "mossanite", "موزانيت", "مويسانيت"],
    "lab grown diamond": ["lab grown", "lab diamond", "certified lab", "الماس"],
    "pearl": ["pearl", "diana pearl", "لؤلؤ"],
    "make for you": ["make for you", "custom", "name", "initial", "personalized"],
    "heart shape": ["heart shape", "heart", "قلب"],
    "silver": ["silver collection", "silver 925", "new silver", "فضه", "فضة"],
    "gold": ["woman gold", "women gold", "gold collection", "ذهب"],
    "men": ["men", "men's chain", "men's bracelet", "رجالي"],
    "kids": ["kids", "اطفال"],
    "couple": ["couple", "زوجين"],
    "engagement": ["engagement", "luxury engagement", "sample engagement", "خطوبه"],
    "wedding": ["wedding", "luxury wedding", "زواج"],
    "mother day": ["mother day", "عيد الام"],
    "flash sale": ["flash sale", "خصم"],
    "bracelet": ["bracelet", "s bracelet", "اسوره"],
    "earring": ["earring", "s earring", "حلق"],
    "necklace": ["necklace", "s necklace", "سلسله"],
    "rings": ["rings", "s rings", "woman silver rings", "خاتم"],
  };

  Object.keys(collectionMap).forEach((col) => {
    const keywords = collectionMap[col];
    if (keywords.some((kw) => collectionsText.includes(kw) || text.includes(kw))) {
      enrichment.jewelryCollections.push(col);
    }
  });

  // =====================
  // MATERIALS
  // =====================
  const materials = [
    "gold", "yellow gold", "white gold", "rose gold",
    "18k", "21k", "22k", "silver", "925 silver", "sterling silver",
    "platinum", "gold plated",
  ];
  materials.forEach((m) => {
    if (text.includes(m) || variantsText.includes(m)) enrichment.jewelryMaterials.push(m);
  });

  // =====================
  // GEMSTONES
  // =====================
  const gemstones = [
    "diamond", "moissanite", "ruby", "emerald", "sapphire",
    "opal", "onyx", "amethyst", "topaz", "aquamarine", "garnet",
    "pearl", "zircon", "zirconia", "cubic zirconia", "moonstone",
  ];
  gemstones.forEach((s) => {
    if (text.includes(s) || tagsText.includes(s)) enrichment.jewelryGemstones.push(s);
  });

  // =====================
  // STONE COLORS
  // =====================
  const colors = [
    "white", "yellow", "pink", "blue", "green", "purple",
    "black", "red", "orange", "rose", "champagne",
  ];
  colors.forEach((c) => {
    if (text.includes(c)) enrichment.jewelryStoneColors.push(c);
  });

  // =====================
  // SHAPES
  // =====================
  const shapes = [
    "round", "oval", "pear", "emerald", "radiant",
    "princess", "cushion", "heart", "marquise", "asscher", "hexagonal",
  ];
  shapes.forEach((s) => {
    if (text.includes(s) || tagsText.includes(s) || collectionsText.includes(s)) {
      enrichment.jewelryShapes.push(s);
    }
  });

  // =====================
  // AUDIENCE
  // =====================
  if (text.includes(" men") || text.includes("men's") || text.includes("groom") ||
      tagsText.includes("men") || collectionsText.includes("men")) {
    enrichment.jewelryAudience.push("men");
    enrichment.mensJewelry = true;
  }
  if (text.includes("kids") || text.includes("children") || text.includes("baby") ||
      tagsText.includes("kids") || collectionsText.includes("kids")) {
    enrichment.jewelryAudience.push("kids");
    enrichment.kidsJewelry = true;
  }
  if (text.includes("couple") || text.includes("matching") || text.includes("pair") ||
      tagsText.includes("couple") || collectionsText.includes("couple")) {
    enrichment.jewelryAudience.push("couple");
    enrichment.coupleJewelry = true;
  }
  if (text.includes("women") || text.includes("woman") || text.includes("ladies") ||
      tagsText.includes("women")) {
    enrichment.jewelryAudience.push("women");
  }

  // =====================
  // OCCASIONS
  // =====================
  if (text.includes("birthday") || tagsText.includes("birthday")) enrichment.jewelryOccasions.push("birthday");
  if (text.includes("anniversary") || tagsText.includes("anniversary")) enrichment.jewelryOccasions.push("anniversary");
  if (text.includes("gift") || tagsText.includes("gift")) enrichment.jewelryOccasions.push("gift");
  if (text.includes("graduation")) enrichment.jewelryOccasions.push("graduation");
  if (text.includes("mother") || text.includes("mom") || collectionsText.includes("mother day")) {
    enrichment.jewelryOccasions.push("mother day");
  }
  if (text.includes("valentine")) enrichment.jewelryOccasions.push("valentine");
  if (text.includes("uae national") || collectionsText.includes("uae national")) {
    enrichment.jewelryOccasions.push("uae national day");
  }

  // =====================
  // LUXURY / CERTIFIED
  // =====================
  if (text.includes("luxury") || text.includes("diamond") || text.includes("moissanite") || text.includes("platinum")) {
    enrichment.luxury = true;
    enrichment.luxuryLevel = "high";
    enrichment.jewelryStyles.push("luxury", "premium", "elegant");
  }
  if (text.includes("certified") || text.includes("lab grown") || text.includes("lab diamond") ||
      collectionsText.includes("certified")) {
    enrichment.certified = true;
    enrichment.labGrown = true;
    enrichment.jewelryThemes.push("certified", "lab grown");
  }

  // =====================
  // BRIDAL / ENGAGEMENT
  // =====================
  if (text.includes("engagement") || text.includes("proposal") || text.includes("wedding") ||
      collectionsText.includes("engagement") || collectionsText.includes("wedding")) {
    enrichment.bridal = true;
    enrichment.engagement = true;
    enrichment.jewelryOccasions.push("engagement", "wedding");
    enrichment.jewelryStyles.push("bridal");
  }

  // =====================
  // CUSTOM / NAME
  // =====================
  if (text.includes("custom") || text.includes("personalized") ||
      text.includes("name necklace") || text.includes("name pendant") ||
      text.includes("initial") || text.includes("engraving") ||
      text.includes("make for you") || collectionsText.includes("make for you")) {
    enrichment.customJewelry = true;
    enrichment.nameJewelry = true;
    enrichment.jewelryThemes.push("custom jewelry", "personalized jewelry", "name jewelry");
    enrichment.jewelryStyles.push("custom", "personalized", "name", "initial");
  }

  // =====================
  // HEART SHAPE
  // =====================
  if (text.includes("heart") || tagsText.includes("heart") || collectionsText.includes("heart")) {
    enrichment.heartShape = true;
    enrichment.jewelryThemes.push("heart shape", "romantic jewelry");
    enrichment.jewelryShapes.push("heart");
    enrichment.jewelryEmotions.push("love", "romance");
  }

  // =====================
  // PEARL
  // =====================
  if (text.includes("pearl") || tagsText.includes("pearl") || collectionsText.includes("pearl")) {
    enrichment.pearlJewelry = true;
    enrichment.jewelryThemes.push("pearl jewelry", "classic elegance");
    enrichment.jewelryGemstones.push("pearl");
  }

  // =====================
  // ARABIC JEWELRY
  // =====================
  if (text.includes("arabic") || text.includes("allah") || text.includes("كوفي") ||
      text.includes("عربي") || text.includes("خط عربي") || text.includes("اسلامي")) {
    enrichment.arabicJewelry = true;
    enrichment.jewelryThemes.push("arabic jewelry", "islamic jewelry");
    enrichment.arabicKeywords.push("arabic calligraphy", "islamic");
  }

  // =====================
  // ICED / TENNIS
  // =====================
  if (text.includes("iced") || text.includes("tennis") || tagsText.includes("tennis")) {
    enrichment.iced = true;
    enrichment.jewelryVibes.push("celebrity luxury", "iced out");
    enrichment.jewelryStyles.push("tennis");
  }

  // =====================
  // EMOTIONS & VIBES
  // =====================
  if (text.includes("love") || text.includes("romantic")) {
    enrichment.jewelryEmotions.push("love", "romance");
  }
  if (text.includes("elegant") || text.includes("classic") || text.includes("timeless")) {
    enrichment.jewelryEmotions.push("elegance", "timeless");
  }
  if (text.includes("bold") || text.includes("statement") || text.includes("fashion")) {
    enrichment.jewelryEmotions.push("bold", "statement");
  }
  if (text.includes("minimal") || text.includes("simple") || text.includes("delicate")) {
    enrichment.jewelryVibes.push("minimalist", "delicate");
  }
  if (text.includes("vintage") || text.includes("antique")) {
    enrichment.jewelryVibes.push("vintage");
  }
  if (text.includes("modern") || text.includes("contemporary")) {
    enrichment.jewelryVibes.push("modern");
  }

  // =====================
  // ANIMAL / NATURE THEMES (swan, whale, snake, butterfly, etc.)
  // =====================
  const animalThemes = ["swan", "whale", "snake", "butterfly", "flower", "floral", "anchor", "serpent", "bird", "bee", "clover", "bow"];
  animalThemes.forEach((theme) => {
    if (text.includes(theme) || tagsText.includes(theme)) {
      enrichment.jewelryThemes.push(theme);
      enrichment.jewelryVibes.push("nature inspired");
    }
  });

  // =====================
  // LUXURY LEVEL SCORING
  // =====================
  let luxScore = 0;
  if (text.includes("18k") || text.includes("gold")) luxScore += 2;
  if (text.includes("platinum")) luxScore += 3;
  if (text.includes("diamond") || text.includes("lab grown")) luxScore += 3;
  if (text.includes("moissanite") || text.includes("certified")) luxScore += 2;
  if (text.includes("pearl")) luxScore += 1;
  if (text.includes("silver") || text.includes("925")) luxScore += 1;

  if (luxScore >= 5) enrichment.luxuryLevel = "ultra luxury";
  else if (luxScore >= 3) enrichment.luxuryLevel = "high";
  else if (luxScore >= 1) enrichment.luxuryLevel = "mid";
  else enrichment.luxuryLevel = "standard";

  // =====================
  // AI TAGS - merged useful keywords for search
  // =====================
  enrichment.aiTags = [
    ...new Set([
      enrichment.jewelryType,
      ...enrichment.jewelryMaterials,
      ...enrichment.jewelryGemstones,
      ...enrichment.jewelryShapes,
      ...enrichment.jewelryStyles,
      ...enrichment.jewelryAudience,
      ...enrichment.jewelryOccasions,
      ...enrichment.jewelryThemes,
      ...enrichment.jewelryCollections,
      enrichment.certified ? "certified" : "",
      enrichment.labGrown ? "lab grown" : "",
      enrichment.nameJewelry ? "name jewelry" : "",
      enrichment.heartShape ? "heart" : "",
      enrichment.pearlJewelry ? "pearl" : "",
    ]),
  ].filter(Boolean);

  // =====================
  // SEARCH UNDERSTANDING - everything needed for AI matching
  // =====================
  enrichment.searchUnderstanding = [
    ...new Set([
      enrichment.jewelryType,
      ...enrichment.jewelryMaterials,
      ...enrichment.jewelryGemstones,
      ...enrichment.jewelryStoneColors,
      ...enrichment.jewelryShapes,
      ...enrichment.jewelryStyles,
      ...enrichment.jewelryThemes,
      ...enrichment.jewelryAudience,
      ...enrichment.jewelryOccasions,
      ...enrichment.jewelryVibes,
      ...enrichment.jewelryCollections,
      ...enrichment.arabicKeywords,
    ]),
  ].filter(Boolean);

  return enrichment;
}

export default enrichProduct;
