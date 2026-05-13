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

// ================= CHAT + DESIGN =================
app.post("/chat", async (req, res) => {

  try {

    console.log("📩 REQUEST:", req.body);

    const message = req.body.message;

    if (!message) {
      return res.json({
        type: "error",
        text: "لا يوجد رسالة"
      });
    }

    // ================= AI DECISION =================
    const decision = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
حدد هل المستخدم يريد تصميم مجوهرات أم محادثة عادية.

إذا تصميم → اكتب DESIGN
غير ذلك → CHAT
          `
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const mode = decision.choices[0].message.content;

    console.log("🧠 MODE:", mode);

    // ================= DESIGN MODE =================
    if (mode.includes("DESIGN")) {

      const image = await client.images.generate({
        model: "gpt-image-1",
        prompt: `
Luxury jewelry design:

${message}

- ultra realistic jewelry
- gold 18k
- diamonds
- studio lighting
- white background
        `,
        size: "1024x1024"
      });

      console.log("🎨 IMAGE GENERATED");

      return res.json({
        type: "design",
        text: "💎 تم إنشاء تصميم مجوهرات لك",
        image: image.data[0].url
      });
    }

    // ================= CHAT MODE =================
    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت مساعد مجوهرات فاخر.
ردك قصير وراقي.
          `
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const reply = chat.choices[0].message.content;

    console.log("🤖 CHAT:", reply);

    res.json({
      type: "chat",
      text: reply
    });

  } catch (err) {

    console.log("🔥 ERROR:", err);

    res.status(500).json({
      type: "error",
      text: "حصل خطأ في السيرفر"
    });
  }

});

// ================= START =================
app.listen(3000, () => {
  console.log("🚀 AI Jewelry System Running on port 3000");
});
