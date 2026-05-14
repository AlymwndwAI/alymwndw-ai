import express from "express";
import fetch from "node-fetch";

const app = express();

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

app.get("/", (req, res) => {
  res.send(`
    <h1>ALYMWNDW AI RUNNING</h1>
    <a href="/auth">INSTALL APP</a>
  `);
});

app.get("/auth", (req, res) => {
  const redirectUri =
    "https://alymwndw-ai.onrender.com/auth/callback";

  const installUrl =
    `https://${SHOPIFY_STORE}/admin/oauth/authorize` +
    `?client_id=${SHOPIFY_CLIENT_ID}` +
    `&scope=read_products,write_products,read_orders` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(installUrl);
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: SHOPIFY_CLIENT_ID,
          client_secret: SHOPIFY_CLIENT_SECRET,
          code,
        }),
      }
    );

    const data = await response.json();

    console.log("SHOPIFY ACCESS TOKEN:");
    console.log(data.access_token);

    res.send(`
      <h1>TOKEN GENERATED SUCCESSFULLY</h1>
      <p>Check Render Logs</p>
    `);
  } catch (err) {
    console.log(err);
    res.send("ERROR");
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT", PORT);
});
