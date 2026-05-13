const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= AI CHAT + DESIGN =================
app.post("/chat", async (req, res) => {

  try {

    const message = req.body.message;

    // ================= 1. AI decides if design needed =================
    const decision = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد مجوهرات.

إذا المستخدم طلب تصميم مجوهرات → رد DESIGN
غير ذلك → رد CHAT
          `
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const mode = decision.choices[0].message.content.trim();

    // ================= 2. DESIGN MODE =================
    if (mode.includes("DESIGN")) {

      const image = await client.images.generate({
        model: "gpt-image-1",
        prompt: `
Luxury jewelry design:

${message}

18k gold, diamonds, ultra realistic, studio lighting, premium product photography
        `,
        size: "1024x1024"
      });

      return res.json({
        type: "design",
        text: "💎 تم إنشاء تصميم مجوهرات لك",
        image: image.data[0].url
      });
    }

    // ================= 3. NORMAL CHAT =================
    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد مجوهرات فاخر.

- رد مختصر
- بيع بطريقة راقية
- كأنك موظف VIP
          `
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    res.json({
      type: "chat",
      text: chat.choices[0].message.content
    });

  } catch (err) {

    console.log(err.message);

    res.json({
      type: "error",
      text: "حدث خطأ"
    });

  }

});

app.listen(3000, () => {
  console.log("🚀 AI Jewelry Chat Designer Running");
});
