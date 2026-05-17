import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {

  res.send("ALYMWNDW AI RUNNING");

});

// =====================================
// GENERATE STOREFRONT TOKEN
// =====================================

app.get("/generate-storefront-token", async (req, res) => {

  const mutation = `
    mutation {

      storefrontAccessTokenCreate(
        input: {
          title: "Alymwndw AI Token"
        }
      ) {

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
      "https://" + SHOP + "/admin/api/2025-01/graphql.json",
      {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": TOKEN,
        },

        body: JSON.stringify({
          query: mutation,
        }),

      }
    );

    const data = await response.json();

    console.log("=================================");
    console.log("NEW STOREFRONT TOKEN:");
    console.log(JSON.stringify(data, null, 2));
    console.log("=================================");

    res.json(data);

  } catch (err) {

    console.log("TOKEN GENERATION ERROR:");
    console.log(err);

    res.status(500).json({
      error: err.message,
    });

  }

});

// =====================================
// START SERVER
// =====================================

app.listen(PORT, () => {

  console.log("=================================");
  console.log("ALYMWNDW AI RUNNING");
  console.log("PORT:", PORT);
  console.log("SHOP:", SHOP);
  console.log("TOKEN EXISTS:", !!TOKEN);
  console.log("=================================");

});
