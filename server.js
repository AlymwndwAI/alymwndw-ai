import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import crypto from "crypto";
import fetch from "node-fetch";

dotenv.config();

// حط الجزء هنا
console.log("====================================");
console.log("SHOPIFY STOREFRONT TOKEN:");
console.log(process.env.SHOPIFY_STOREFRONT_TOKEN);
console.log("====================================");

const app = express();
