import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 10000;

const SHOP = process.env.SHOPIFY_STORE;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

app.get("/", (req, res) => {
  res.send("ALYMWNDW AI RUNNING");
});

// INSTALL APP
app.get("/auth", (req, res) => {

  const scopes =
    "read_products,read_product_listings,read_inventory,read_orders";

  const redirectUri =
    "https://alymwndw-ai.onrender.com/auth/callback";

  const installUrl =
    `https://${SHOP}/admin/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&scope=${scopes}` +
    `&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

// CALLBACK
app.get("/auth/callback", async (req, res) => {

  const code = req.query.code;

  if (!code) {
    return res.send("NO CODE");
  }

  try {

    const response = await fetch(
      `https://${SHOP}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
        }),
      }
    );

    const data = await response.json();

    console.log("SHOPIFY TOKEN:", data.access_token);

    res.send(`
      <h1>APP INSTALLED SUCCESSFULLY</h1>
      <p>Token generated successfully.</p>
    `);

  } catch (error) {

    console.log(error);

    res.send("ERROR");
  }
});

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT " + PORT);
});
