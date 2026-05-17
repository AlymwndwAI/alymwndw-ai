const fs = require("fs");

function enrichProduct(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.tags?.join(" ")}
    ${product.type}
    ${product.vendor}
  `.toLowerCase();

  const enrichment = {

    // MAIN INTELLIGENCE
    semanticTags: [],
    luxuryStyles: [],
    occasions: [],
    emotions: [],
    audience: [],
    searchIntent: [],
    vibes: [],

    // JEWELRY UNDERSTANDING
    jewelryTypes: [],
    gemstones: [],
    materials: [],
    luxuryLevel: [],
    fashionStyles: [],
    gifting: [],
    bridal: [],
    celebrityStyles: [],
    customization: [],
    wearingStyle: [],
    symbolism: [],
    moods: [],
    aiKeywords: []

  };

  // ========================================
  // JEWELRY TYPES
  // ========================================

  if (
    text.includes("ring") ||
    text.includes("خاتم")
  ) {
    enrichment.jewelryTypes.push("ring");
  }

  if (
    text.includes("necklace") ||
    text.includes("chain") ||
    text.includes("عقد") ||
    text.includes("سلسلة")
  ) {
    enrichment.jewelryTypes.push("necklace");
  }

  if (
    text.includes("bracelet") ||
    text.includes("اسورة")
  ) {
    enrichment.jewelryTypes.push("bracelet");
  }

  if (
    text.includes("earring") ||
    text.includes("حلق")
  ) {
    enrichment.jewelryTypes.push("earring");
  }

  if (text.includes("pendant")) {
    enrichment.jewelryTypes.push("pendant");
  }

  // ========================================
  // GOLD TYPES
  // ========================================

  if (
    text.includes("18k") ||
    text.includes("18k gold") ||
    text.includes("750 gold")
  ) {

    enrichment.materials.push("18k gold");
    enrichment.luxuryLevel.push("fine jewelry");

  }

  if (
    text.includes("21k") ||
    text.includes("21k gold")
  ) {

    enrichment.materials.push("21k gold");

  }

  if (text.includes("22k")) {
    enrichment.materials.push("22k gold");
  }

  if (text.includes("24k")) {
    enrichment.materials.push("24k gold");
  }

  // ========================================
  // GOLD COLORS
  // ========================================

  if (text.includes("white gold")) {
    enrichment.materials.push("white gold");
  }

  if (text.includes("rose gold")) {
    enrichment.materials.push("rose gold");
  }

  if (text.includes("yellow gold")) {
    enrichment.materials.push("yellow gold");
  }

  // ========================================
  // PLATINUM
  // ========================================

  if (text.includes("platinum")) {

    enrichment.materials.push("platinum");
    enrichment.luxuryLevel.push("ultra luxury");

  }

  // ========================================
  // SILVER
  // ========================================

  if (
    text.includes("silver") ||
    text.includes("925")
  ) {

    enrichment.materials.push(
      "silver",
      "925 silver",
      "sterling silver"
    );

  }

  // ========================================
  // VERMEIL
  // ========================================

  if (text.includes("vermeil")) {
    enrichment.materials.push("gold vermeil");
  }

  // ========================================
  // STAINLESS STEEL
  // ========================================

  if (text.includes("stainless steel")) {
    enrichment.materials.push("stainless steel");
  }

  // ========================================
  // TITANIUM
  // ========================================

  if (text.includes("titanium")) {
    enrichment.materials.push("titanium");
  }

  // ========================================
  // TUNGSTEN
  // ========================================

  if (text.includes("tungsten")) {
    enrichment.materials.push("tungsten");
  }

  // ========================================
  // RHODIUM
  // ========================================

  if (text.includes("rhodium")) {
    enrichment.materials.push("rhodium plated");
  }

  // ========================================
  // DIAMOND
  // ========================================

  if (
    text.includes("diamond") ||
    text.includes("lab diamond")
  ) {

    enrichment.gemstones.push(
      "diamond",
      "lab diamond"
    );

    enrichment.semanticTags.push(
      "fine jewelry",
      "luxury diamond jewelry"
    );

    enrichment.luxuryStyles.push(
      "luxury",
      "premium",
      "timeless"
    );

    enrichment.occasions.push(
      "engagement",
      "gift",
      "anniversary"
    );

  }

  // ========================================
  // MOISSANITE
  // ========================================

  if (
    text.includes("moissanite") ||
    text.includes("gra")
  ) {

    enrichment.gemstones.push(
      "moissanite"
    );

    enrichment.semanticTags.push(
      "diamond alternative",
      "high brilliance"
    );

    enrichment.searchIntent.push(
      "affordable luxury",
      "diamond look"
    );

  }

  // ========================================
  // SAPPHIRE
  // ========================================

  if (
    text.includes("sapphire") ||
    text.includes("ياقوت")
  ) {

    enrichment.gemstones.push(
      "sapphire"
    );

  }

  // ========================================
  // EMERALD
  // ========================================

  if (
    text.includes("emerald") ||
    text.includes("زمرد")
  ) {

    enrichment.gemstones.push(
      "emerald"
    );

  }

  // ========================================
  // RUBY
  // ========================================

  if (
    text.includes("ruby") ||
    text.includes("روبي")
  ) {

    enrichment.gemstones.push(
      "ruby"
    );

  }

  // ========================================
  // PEARL
  // ========================================

  if (
    text.includes("pearl") ||
    text.includes("لؤلؤ")
  ) {

    enrichment.gemstones.push(
      "pearl"
    );

    enrichment.luxuryStyles.push(
      "royal",
      "classic",
      "quiet luxury"
    );

  }

  // ========================================
  // OPAL
  // ========================================

  if (text.includes("opal")) {
    enrichment.gemstones.push("opal");
  }

  // ========================================
  // AMETHYST
  // ========================================

  if (text.includes("amethyst")) {
    enrichment.gemstones.push("amethyst");
  }

  // ========================================
  // TOPAZ
  // ========================================

  if (text.includes("topaz")) {
    enrichment.gemstones.push("topaz");
  }

  // ========================================
  // AQUAMARINE
  // ========================================

  if (text.includes("aquamarine")) {
    enrichment.gemstones.push("aquamarine");
  }

  // ========================================
  // MORGANITE
  // ========================================

  if (text.includes("morganite")) {
    enrichment.gemstones.push("morganite");
  }

  // ========================================
  // TANZANITE
  // ========================================

  if (text.includes("tanzanite")) {
    enrichment.gemstones.push("tanzanite");
  }

  // ========================================
  // STONE COLORS
  // ========================================

  if (text.includes("white")) {
    enrichment.aiKeywords.push("white stone");
  }

  if (text.includes("blue")) {
    enrichment.aiKeywords.push("blue stone");
  }

  if (text.includes("green")) {
    enrichment.aiKeywords.push("green stone");
  }

  if (text.includes("red")) {
    enrichment.aiKeywords.push("red stone");
  }

  if (text.includes("pink")) {
    enrichment.aiKeywords.push("pink stone");
  }

  if (text.includes("yellow")) {
    enrichment.aiKeywords.push("yellow stone");
  }

  if (text.includes("black")) {
    enrichment.aiKeywords.push("black stone");
  }

  if (text.includes("purple")) {
    enrichment.aiKeywords.push("purple stone");
  }

  if (text.includes("champagne")) {
    enrichment.aiKeywords.push("champagne stone");
  }

  // ========================================
  // SOLITAIRE
  // ========================================

  if (text.includes("solitaire")) {

    enrichment.semanticTags.push(
      "engagement ring",
      "proposal ring"
    );

    enrichment.bridal.push(
      "bridal",
      "engagement"
    );

    enrichment.emotions.push(
      "love",
      "romantic"
    );

  }

  // ========================================
  // TENNIS
  // ========================================

  if (text.includes("tennis")) {

    enrichment.semanticTags.push(
      "tennis jewelry",
      "celebrity jewelry"
    );

    enrichment.celebrityStyles.push(
      "rapper luxury",
      "red carpet"
    );

    enrichment.vibes.push(
      "flashy",
      "rich"
    );

  }

  // ========================================
  // CUSTOM
  // ========================================

  if (
    text.includes("custom") ||
    text.includes("personalized") ||
    text.includes("make for you")
  ) {

    enrichment.customization.push(
      "custom jewelry",
      "name necklace",
      "engraving"
    );

    enrichment.gifting.push(
      "gift for girlfriend",
      "gift for wife"
    );

  }

  // ========================================
  // MINIMAL
  // ========================================

  if (
    text.includes("minimal") ||
    text.includes("simple")
  ) {

    enrichment.fashionStyles.push(
      "minimal",
      "modern",
      "clean"
    );

    enrichment.vibes.push(
      "quiet luxury"
    );

  }

  // ========================================
  // HIP HOP / ICED
  // ========================================

  if (
    text.includes("hip hop") ||
    text.includes("iced")
  ) {

    enrichment.fashionStyles.push(
      "street luxury",
      "hip hop"
    );

    enrichment.vibes.push(
      "rapper style",
      "flashy"
    );

  }

  // ========================================
  // MEN
  // ========================================

  if (
    text.includes("men") ||
    text.includes("mens")
  ) {

    enrichment.audience.push(
      "men"
    );

  }

  // ========================================
  // UNIQUE VALUES
  // ========================================

  Object.keys(enrichment).forEach((key) => {
    enrichment[key] = [...new Set(enrichment[key])];
  });

  return enrichment;

}

module.exports = {
  enrichProduct
};
