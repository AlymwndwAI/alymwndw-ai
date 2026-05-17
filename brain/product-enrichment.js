function enrichProduct(product) {

  const text = `
    ${product.title}
    ${product.description}
    ${product.type}
    ${product.vendor}
    ${product.tags?.join(" ")}
  `.toLowerCase();

  const enrichment = {

    gemstones: [],
    gemstoneColors: [],
    metals: [],
    luxuryStyles: [],
    occasions: [],
    emotions: [],
    celebrityStyles: [],
    customCapabilities: [],
    jewelryVibes: [],
    fashionStyles: [],
    bridalStyles: [],
    stackable: false,
    customizable: false,
    luxuryLevel: "standard",

  };

  // ========================================
  // METALS
  // ========================================

  if (text.includes("gold")) {
    enrichment.metals.push("gold");
  }

  if (text.includes("white gold")) {
    enrichment.metals.push("white gold");
  }

  if (text.includes("rose gold")) {
    enrichment.metals.push("rose gold");
  }

  if (text.includes("yellow gold")) {
    enrichment.metals.push("yellow gold");
  }

  if (text.includes("silver")) {
    enrichment.metals.push("silver");
  }

  if (text.includes("platinum")) {
    enrichment.metals.push("platinum");
  }

  // ========================================
  // GEMSTONES
  // ========================================

  if (text.includes("diamond")) {
    enrichment.gemstones.push("diamond");
  }

  if (text.includes("moissanite")) {
    enrichment.gemstones.push("moissanite");
  }

  if (text.includes("ruby")) {
    enrichment.gemstones.push("ruby");
  }

  if (text.includes("emerald")) {
    enrichment.gemstones.push("emerald");
  }

  if (text.includes("sapphire")) {
    enrichment.gemstones.push("sapphire");
  }

  if (text.includes("opal")) {
    enrichment.gemstones.push("opal");
  }

  if (text.includes("pearl")) {
    enrichment.gemstones.push("pearl");
  }

  // ========================================
  // GEMSTONE COLORS
  // ========================================

  if (text.includes("blue")) {
    enrichment.gemstoneColors.push("blue");
  }

  if (text.includes("green")) {
    enrichment.gemstoneColors.push("green");
  }

  if (text.includes("pink")) {
    enrichment.gemstoneColors.push("pink");
  }

  if (text.includes("yellow")) {
    enrichment.gemstoneColors.push("yellow");
  }

  if (text.includes("red")) {
    enrichment.gemstoneColors.push("red");
  }

  if (text.includes("black")) {
    enrichment.gemstoneColors.push("black");
  }

  if (text.includes("white")) {
    enrichment.gemstoneColors.push("white");
  }

  if (text.includes("purple")) {
    enrichment.gemstoneColors.push("purple");
  }

  // ========================================
  // LUXURY STYLES
  // ========================================

  if (
    text.includes("luxury") ||
    text.includes("premium")
  ) {

    enrichment.luxuryStyles.push(
      "luxury"
    );

  }

  if (
    text.includes("minimal")
  ) {

    enrichment.luxuryStyles.push(
      "minimal"
    );

  }

  if (
    text.includes("vintage")
  ) {

    enrichment.luxuryStyles.push(
      "vintage"
    );

  }

  if (
    text.includes("tennis")
  ) {

    enrichment.luxuryStyles.push(
      "iced"
    );

    enrichment.celebrityStyles.push(
      "celebrity luxury"
    );

  }

  // ========================================
  // OCCASIONS
  // ========================================

  if (
    text.includes("engagement")
  ) {

    enrichment.occasions.push(
      "engagement"
    );

    enrichment.bridalStyles.push(
      "proposal ring"
    );

  }

  if (
    text.includes("wedding")
  ) {

    enrichment.occasions.push(
      "wedding"
    );

  }

  if (
    text.includes("gift")
  ) {

    enrichment.occasions.push(
      "gift"
    );

  }

  if (
    text.includes("birthday")
  ) {

    enrichment.occasions.push(
      "birthday"
    );

  }

  // ========================================
  // EMOTIONS
  // ========================================

  if (
    text.includes("love")
  ) {

    enrichment.emotions.push(
      "love"
    );

  }

  if (
    text.includes("forever")
  ) {

    enrichment.emotions.push(
      "forever"
    );

  }

  if (
    text.includes("elegance")
  ) {

    enrichment.emotions.push
