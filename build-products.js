import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";

dotenv.config();

const SHOP = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;





function cleanHTML(html) {

  if (!html) return "";

  return html
    .replace(/<[^>]*>?/gm, "")
    .replace(/\s+/g, " ")
    .trim();

}





async function getAllProducts() {

  let allProducts = [];

  let since_id = 0;

  while (true) {

    console.log("Loading products after ID:", since_id);

    const response = await fetch(
      `https://${SHOP}/admin/api/2025-01/products.json?limit=250&since_id=${since_id}`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    const products = data.products || [];

    if (products.length === 0) {
      break;
    }

    allProducts.push(...products);

    since_id = products[products.length - 1].id;

    console.log("Loaded:", allProducts.length);

  }

  return allProducts;

}





async function buildBrain() {

  try {

    const products = await getAllProducts();

    console.log("TOTAL PRODUCTS:", products.length);





    const brain = products.map((product) => {

      const variants = product.variants || [];

      const images = product.images || [];





      const variantData = variants.map((v) => ({

        id: v.id,

        title: v.title,

        price: v.price,

        sku: v.sku,

        option1: v.option1,

        option2: v.option2,

        option3: v.option3,

      }));





      const imageData = images.map((img) => ({
        src: img.src,
        alt: img.alt || "",
      }));





      const searchableText = `
        ${product.title}
        ${cleanHTML(product.body_html)}
        ${product.vendor}
        ${product.product_type}
        ${product.tags}
        ${variantData.map(v => v.title).join(" ")}
      `;





      return {

        id: product.id,

        title: product.title,

        handle: product.handle,

        description: cleanHTML(product.body_html),

        vendor: product.vendor,

        productType: product.product_type,

        tags: product.tags,

        url: `https://${SHOP}/products/${product.handle}`,

        featuredImage: images?.[0]?.src || "",

        images: imageData,

        variants: variantData,

        searchableText,

      };

    });





    fs.writeFileSync(
      "products.json",
      JSON.stringify(brain, null, 2)
    );





    console.log("================================");
    console.log("PRODUCT BRAIN BUILT SUCCESSFULLY");
    console.log("TOTAL:", brain.length);
    console.log("================================");

  } catch (error) {

    console.log(error);

  }

}





buildBrain();
