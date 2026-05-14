import express from "express";

const app = express();

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("Alymwndw AI Running");
});

app.get("/get-token", async (req, res) => {
  try {
    const response = await fetch(
      "https://alymwndw.myshopify.com/admin/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          grant_type: "client_credentials",
        }),
      }
    );

    const data = await response.json();

    res.json(data);
  } catch (err) {
    res.send(err.toString());
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
