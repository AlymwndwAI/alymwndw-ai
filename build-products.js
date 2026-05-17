import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

import {
  enrichProduct
} from "./brain/product-enrichment.js";

dotenv.config();

const SHOP =
  process.env.SHOPIFY_STORE;

const TOKEN =
  process.env.SHOPIFY_ACCESS_TOKEN;

// ========================================
// SHOPIFY GRAPHQL
// ========================================

async function shopifyQuery(query) {

  const response = await fetch(

    `https://${SHOP}/admin/api/2025-01/graphql.json`,

    {

      method: "POST",

      headers: {

        "Content-Type":
          "application/json",

        "X-Shopify-Access-Token":
          TOKEN,

      },

      body:
        JSON.stringify({ query }),

    }

  );

  return response.json();

}
