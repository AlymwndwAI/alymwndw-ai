app.get("/generate-storefront-token", async (req, res) => {

  const mutation = `
    mutation {
      storefrontAccessTokenCreate(input: {
        title: "Alymwndw AI Token"
      }) {
        storefrontAccessToken {
          accessToken
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {

    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": TOKEN
        },
        body: JSON.stringify({
          query: mutation
        })
      }
    );

    const data = await response.json();

    console.log(data);

    res.json(data);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: err.message
    });

  }

});
