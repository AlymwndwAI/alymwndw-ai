// =====================================
// AI PRODUCTS
// =====================================

const aiProducts =

matchedProducts.map((p) => ({

  id:
    p.id || "",

  title:
    p.title || "",

  handle:
    p.handle || "",

  description:
    p.description || "",

  type:
    p.type || "",

  vendor:
    p.vendor || "",

  image:
    p.image || "",

  images:
    p.images || [],

  url:
    p.url || `https://alymwndw.com/products/${p.handle}`,

  reviewRating:
    p.reviewRating || 4.9,

  reviewCount:
    p.reviewCount || 120,

  category:
    p.aiFeatures
      ?.category || "",

  collection:
    p.aiFeatures
      ?.collection || "",

  styles:
    p.aiFeatures
      ?.styles || [],

  emotionalTriggers:
    p.aiFeatures
      ?.emotionalTriggers || [],

  searchKeywords:
    p.aiFeatures
      ?.searchKeywords || [],

  intent:
    p.aiFeatures
      ?.intent || [],

  price:

    p.variants?.[0]
      ?.price

    ||

    p.price

    ||

    "",

  rawPrice:

    p.variants?.[0]
      ?.rawPrice

    ||

    p.rawPrice

    ||

    0,

  currency:
    p.currency || "AED",

  // =====================================
  // VARIANTS
  // =====================================

  variants:

    p.variants
      ?.slice(0, 20)
      ?.map((v) => ({

        id:
          v.id || "",

        title:
          v.title || "",

        sku:
          v.sku || "",

        available:
          v.available,

        price:
          v.price || "",

        rawPrice:
          v.rawPrice || 0,

        currency:
          v.currency || "AED",

        image:

          v.mappedImage

          ||

          v.image

          ||

          p.image

          ||

          "",

        mappedImage:

          v.mappedImage

          ||

          v.image

          ||

          p.image

          ||

          "",

        metal:
          v.metal || "",

        stoneColor:
          v.stoneColor || "",

        shape:
          v.shape || "",

        options:
          v.options || [],

      })) || [],

}));
