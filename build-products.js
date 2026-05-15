import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

// ========================================
// ENV
// ========================================

const SHOP =
process.env.SHOPIFY_STORE;

const TOKEN =
process.env.SHOPIFY_ACCESS_TOKEN;

// ========================================
// SHOPIFY GRAPHQL
// ========================================

async function shopifyQuery(query){

const response = await fetch(

`https://${SHOP}/admin/api/2025-01/graphql.json`,

{
method:"POST",

headers:{
"Content-Type":"application/json",
"X-Shopify-Access-Token":TOKEN,
},

body:JSON.stringify({
query,
}),

}

);

return response.json();

}

// ========================================
// AI FEATURES
// ========================================

function generateAI(product){

const text = `

${product.title}

${product.description}

${product.tags?.join(" ")}

${product.type}

`.toLowerCase();

const ai = {

category:"",
collection:"",
productType:"",

styles:[],
intent:[],
emotionalTriggers:[],
searchKeywords:[],
materials:[],

variantMetalColors:[],
variantStoneColors:[],
diamondShapes:[],

};

// ========================================
// CATEGORY
// ========================================

if(text.includes("ring")){

ai.category = "rings";
ai.productType = "ring";

}

if(text.includes("necklace")){

ai.category = "necklaces";
ai.productType = "necklace";

}

if(text.includes("bracelet")){

ai.category = "bracelets";
ai.productType = "bracelet";

}

if(text.includes("earring")){

ai.category = "earrings";
ai.productType = "earring";

}

// ========================================
// MOISSANITE
// ========================================

if(

text.includes("moissanite")
||
text.includes("gra")

){

ai.collection = "moissanite";

ai.styles.push(
"luxury",
"bridal",
"sparkle"
);

ai.intent.push(
"engagement",
"diamond alternative"
);

ai.materials.push(
"moissanite"
);

ai.searchKeywords.push(
"moissanite ring",
"gra certified"
);

}

// ========================================
// LAB DIAMOND
// ========================================

if(

text.includes("lab diamond")
||
text.includes("lab grown")

){

ai.collection =
"lab diamond";

ai.styles.push(
"luxury",
"minimal"
);

ai.intent.push(
"engagement",
"wedding"
);

ai.materials.push(
"lab diamond"
);

}

// ========================================
// GOLD
// ========================================

if(
text.includes("gold")
){

ai.materials.push(
"gold"
);

}

// ========================================
// SILVER
// ========================================

if(
text.includes("silver")
){

ai.materials.push(
"silver"
);

}

// ========================================
// PLATINUM
// ========================================

if(
text.includes("platinum")
){

ai.materials.push(
"platinum"
);

}

// ========================================
// TENNIS
// ========================================

if(
text.includes("tennis")
){

ai.styles.push(
"celebrity luxury"
);

ai.searchKeywords.push(
"tennis jewelry"
);

}

// ========================================
// WEDDING
// ========================================

if(

text.includes("wedding")
||
text.includes("engagement")

){

ai.intent.push(
"bridal"
);

ai.emotionalTriggers.push(
"love",
"forever"
);

}

// ========================================
// CUSTOM
// ========================================

if(

text.includes("custom")
||
text.includes("personalized")
||
text.includes("name necklace")

){

ai.intent.push(
"gift jewelry"
);

ai.styles.push(
"personalized"
);

}

// ========================================
// VARIANT ANALYSIS
// ========================================

(product.variants || []).forEach((v)=>{

const variantText = `
${v.title}
${JSON.stringify(v.options)}
`.toLowerCase();

// ========================================
// METALS
// ========================================

if(
variantText.includes("rose gold")
){

ai.variantMetalColors.push(
"rose gold"
);

}

if(
variantText.includes("yellow gold")
){

ai.variantMetalColors.push(
"yellow gold"
);

}

if(
variantText.includes("white gold")
){

ai.variantMetalColors.push(
"white gold"
);

}

if(
variantText.includes("silver")
){

ai.variantMetalColors.push(
"silver"
);

}

if(
variantText.includes("platinum")
){

ai.variantMetalColors.push(
"platinum"
);

}

// ========================================
// STONES
// ========================================

if(
variantText.includes("white")
){

ai.variantStoneColors.push(
"white"
);

}

if(
variantText.includes("yellow")
){

ai.variantStoneColors.push(
"yellow"
);

}

if(
variantText.includes("pink")
){

ai.variantStoneColors.push(
"pink"
);

}

// ========================================
// SHAPES
// ========================================

if(
variantText.includes("oval")
){

ai.diamondShapes.push(
"oval"
);

}

if(
variantText.includes("emerald")
){

ai.diamondShapes.push(
"emerald"
);

}

if(
variantText.includes("radiant")
){

ai.diamondShapes.push(
"radiant"
);

}

if(
variantText.includes("pear")
){

ai.diamondShapes.push(
"pear"
);

}

if(
variantText.includes("round")
){

ai.diamondShapes.push(
"round"
);

}

});

// ========================================
// UNIQUE VALUES
// ========================================

ai.styles = [
...new Set(ai.styles)
];

ai.intent = [
...new Set(ai.intent)
];

ai.materials = [
...new Set(ai.materials)
];

ai.searchKeywords = [
...new Set(ai.searchKeywords)
];

ai.variantMetalColors = [
...new Set(ai.variantMetalColors)
];

ai.variantStoneColors = [
...new Set(ai.variantStoneColors)
];

ai.diamondShapes = [
...new Set(ai.diamondShapes)
];

return ai;

}

// ========================================
// FETCH PRODUCTS
// ========================================

async function fetchProducts(){

let allProducts = [];

let hasNextPage = true;

let cursor = null;

while(hasNextPage){

console.log(
"FETCHING NEXT 250 PRODUCTS..."
);

const query = `
{
products(
first:250
${cursor ? `, after:"${cursor}"` : ""}
){

pageInfo{
hasNextPage
}

edges{

cursor

node{

id
title
handle
description
productType
vendor
tags

collections(first:10){

edges{

node{
title
handle
}

}

}

images(first:20){

edges{

node{
url
altText
}

}

}

variants(first:100){

edges{

node{

id
title
sku
availableForSale
price

selectedOptions{
name
value
}

image{
url
}

}

}

}

}

}

}

}
`;

const data =
await shopifyQuery(query);

const products =
data.data.products.edges;

// ========================================
// LOOP PRODUCTS
// ========================================

for(const item of products){

const p = item.node;

// ========================================
// IMAGES
// ========================================

const images =

p.images.edges.map(
(img)=>({

url:
img.node.url,

alt:
img.node.altText || "",

})
);

// ========================================
// VARIANTS + SMART IMAGE MAP
// ========================================

const variants =

p.variants.edges.map(
(v)=>{

const optionText = `
${v.node.title}
${JSON.stringify(
v.node.selectedOptions
)}
`.toLowerCase();

// ========================================
// METAL
// ========================================

let metal = "";

if(
optionText.includes("rose gold")
){

metal = "rose gold";

}

else if(
optionText.includes("yellow gold")
){

metal = "yellow gold";

}

else if(
optionText.includes("white gold")
){

metal = "white gold";

}

else if(
optionText.includes("silver")
){

metal = "silver";

}

else if(
optionText.includes("platinum")
){

metal = "platinum";

}

// ========================================
// STONE COLOR
// ========================================

let stoneColor = "";

if(
optionText.includes("yellow")
){

stoneColor = "yellow";

}

else if(
optionText.includes("white")
){

stoneColor = "white";

}

else if(
optionText.includes("pink")
){

stoneColor = "pink";

}

// ========================================
// SHAPE
// ========================================

let shape = "";

if(
optionText.includes("oval")
){

shape = "oval";

}

else if(
optionText.includes("emerald")
){

shape = "emerald";

}

else if(
optionText.includes("radiant")
){

shape = "radiant";

}

else if(
optionText.includes("pear")
){

shape = "pear";

}

else if(
optionText.includes("round")
){

shape = "round";

}

// ========================================
// SMART IMAGE MATCHING
// ========================================

let matchedImage =
v.node.image?.url || "";

if(!matchedImage){

const smartImage =
images.find((img)=>{

const alt =
(img.alt || "")
.toLowerCase();

return (

alt.includes(metal)
||
alt.includes(shape)
||
alt.includes(stoneColor)

);

});

matchedImage =
smartImage?.url
||
images?.[0]?.url
||
"";

}

// ========================================
// RETURN
// ========================================

return {

id:
v.node.id,

title:
v.node.title,

price:
`${v.node.price} AED`,

rawPrice:
Number(v.node.price),

currency:
"AED",

sku:
v.node.sku,

available:
v.node.availableForSale,

image:
matchedImage,

mappedImage:
matchedImage,

metal,

stoneColor,

shape,

options:
v.node.selectedOptions,

};

}
);

// ========================================
// PRODUCT
// ========================================

const product = {

id:
p.id,

title:
p.title,

handle:
p.handle,

description:
p.description,

type:
p.productType,

vendor:
p.vendor,

tags:
p.tags,

collections:

p.collections.edges.map(
(c)=>({

title:
c.node.title,

handle:
c.node.handle,

})
),

image:
images?.[0]?.url || "",

images,

variants,

price:
variants?.[0]?.price || "",

rawPrice:
variants?.[0]?.rawPrice || 0,

currency:
"AED",

reviewRating:
4.9,

reviewCount:
Math.floor(
Math.random() * 250
) + 50,

url:
`https://${SHOP}/products/${p.handle}`,

};

// ========================================
// AI FEATURES
// ========================================

product.aiFeatures =
generateAI(product);

// ========================================
// SAVE
// ========================================

allProducts.push(
product
);

}

// ========================================
// PAGINATION
// ========================================

hasNextPage =

data.data.products
.pageInfo
.hasNextPage;

if(

hasNextPage
&&
products.length > 0

){

cursor =

products[
products.length - 1
].cursor;

}

console.log(
"TOTAL PRODUCTS:",
allProducts.length
);

}

return allProducts;

}

// ========================================
// BUILD PRODUCT BRAIN
// ========================================

async function buildBrain(){

try{

console.log(
"STARTING PRODUCT BRAIN..."
);

const products =
await fetchProducts();

// ========================================
// CREATE PUBLIC
// ========================================

if(
!fs.existsSync(
"./public"
)
){

fs.mkdirSync(
"./public"
);

}

// ========================================
// SAVE JSON
// ========================================

fs.writeFileSync(

"./public/products-brain.json",

JSON.stringify(
products,
null,
2
)

);

console.log(
"PRODUCT BRAIN COMPLETE"
);

console.log(
"TOTAL PRODUCTS:",
products.length
);

}catch(err){

console.log(
"BUILD ERROR:"
);

console.log(err);

process.exit(1);

}

}

// ========================================
// START
// ========================================

buildBrain();
