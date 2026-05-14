import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("HOME WORKING");
});

app.get("/get-token", (req, res) => {
  res.send("TOKEN ROUTE WORKING");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Running");
});
