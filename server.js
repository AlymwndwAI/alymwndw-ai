// ======================
// CHAT
// ======================

app.post("/chat", async (req, res) => {

  try {

    const message =
      req.body.message || "";

    // ======================
    // GREETINGS
    // ======================

    const greetings = [

      "hi",
      "hello",
      "hey",
      "hola",

      "مرحبا",
      "هاي",
      "السلام عليكم",
      "اهلا",
      "أهلا",
      "هلا",

    ];

    if (
      greetings.includes(
        message
          .toLowerCase()
          .trim()
      )
    ) {

      return res.json({

        reply:
          "Welcome to Alymwndw Jewellery 💎 How can I help you find your perfect piece today?",

        products: [],

      });

    }

    // ======================
    // REFRESH CACHE
    // ======================

    if (
      Date.now() - lastUpdate >
      1000 * 60 * 15
    ) {

      await loadProducts();

    }

    if (
      productsCache.length === 0
    ) {

      await loadProducts();

    }

    // ======================
    // SEARCH
    // ======================

    const matchedProducts =
      searchProducts(message);

    // ======================
    // CLEAN PRODUCTS
    // ======================

    const cleanProducts =
      matchedProducts.map((p) => ({

        title:
          p.title,

        description:
          p.description,

        productType:
          p.productType,

        price:
          p.price,

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

        variants:
          p.matchedVariants?.length
            ? p.matchedVariants
            : p.variants,

      }));

    // ======================
    // NO RESULTS
    // ======================

    if (
      cleanProducts.length === 0
    ) {

      return res.json({

        reply:
          "Sorry, no matching products were found.",

        products: [],

      });

    }

    // ======================
    // AI PROMPT
    // ======================

    const systemPrompt = `

You are Alymwndw Jewellery AI.

You are an elite luxury jewellery sales expert.

STRICT RULES:

1- NEVER invent products.
2- NEVER invent colors.
3- NEVER invent metals.
4- NEVER invent gemstones.
5- NEVER invent prices.
6- NEVER invent variants.
7- ONLY recommend existing products.
8- Use ONLY provided products.
9- Speak naturally and elegantly.
10- Keep replies shorter and luxury.
11- Upsell smartly.
12- If user speaks Arabic answer Arabic.
13- Mention price when useful.
14- Mention metal and stone accurately.
15- If unavailable politely say unavailable.
16- Recommend closest alternatives if needed.
17- NEVER output markdown image syntax.
18- NEVER output raw image URLs.
19- ALWAYS use variant data accurately.
20- ALWAYS respect product type.

AVAILABLE PRODUCTS:

${JSON.stringify(cleanProducts)}

`;

    // ======================
    // OPENAI
    // ======================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.2,

        messages: [

          {
            role: "system",
            content:
              systemPrompt,
          },

          {
            role: "user",
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
        completion.choices[0]
          .message.content,

      products:
        cleanProducts,

    });

  } catch (error) {

    console.log(error);

    res.json({

      reply:
        "AI Error",

      products: [],

    });

  }

});
