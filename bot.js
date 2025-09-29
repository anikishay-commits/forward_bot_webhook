// Full Telegram Forward Bot with Webhook + MongoDB (fixed multiline string)
const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID);
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "telegrambot";

if (!BOT_TOKEN || !OWNER_ID || !MONGO_URI) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(bodyParser.json());

const mongo = new MongoClient(MONGO_URI);

let sourceChatId = null;
let sourceMessageId = null;
let intervalMinutes = 30;
let job = null;
let targets = [];

function isOwner(msg) {
  return msg.from && msg.from.id === OWNER_ID;
}

async function colTargets() {
  await mongo.connect();
  return mongo.db(MONGO_DB).collection("targets");
}

async function loadTargets() {
  try {
    const col = await colTargets();
    const docs = await col.find({}).toArray();
    targets = docs.map(d => d.chat_id);
    console.log("Loaded targets:", targets);
  } catch (e) {
    console.error("Failed loading targets:", e);
  }
}
async function addTarget(chatId) {
  try {
    const col = await colTargets();
    await col.updateOne({ chat_id: chatId }, { $set: { chat_id: chatId } }, { upsert: true });
    if (!targets.includes(chatId)) targets.push(chatId);
  } catch (e) {
    console.error("Failed adding target:", chatId, e);
  }
}
async function removeTarget(chatId) {
  try {
    const col = await colTargets();
    await col.deleteOne({ chat_id: chatId });
    targets = targets.filter(id => id !== chatId);
  } catch (e) {
    console.error("Failed removing target:", chatId, e);
  }
}

function startJob() {
  return setInterval(async () => {
    if (!sourceChatId || !sourceMessageId) return;
    const list = [...targets];
    for (const target of list) {
      try {
        await bot.forwardMessage(target, sourceChatId, sourceMessageId);
      } catch (e) {
        try {
          await bot.copyMessage(target, sourceChatId, sourceMessageId);
        } catch (err) {
          console.error("Failed sending to", target, err.message);
        }
      }
    }
  }, intervalMinutes * 60 * 1000);
}

async function handleCommand(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  if (text === "/start") {
    bot.sendMessage(chatId, `היי 👋 אני בוט שמעביר הודעות אוטומטיות.
פקודות:
/add_here – הוסף את הקבוצה/ערוץ לרשימת היעדים
/remove_here – הסר את הקבוצה/ערוץ (רק מנהל)
/list – הצג את היעדים
/set_message – קבע הודעה להעברה (מנהל בלבד)
/set_interval <דקות> – קבע מרווח (מנהל בלבד)
/start_forward – הפעל שליחה (מנהל בלבד)
/stop_forward – עצור שליחה (מנהל בלבד)
/status – סטטוס נוכחי
/id – הצגת chat_id`);
  }

  if (text === "/id") {
    bot.sendMessage(chatId, `chat_id = ${chatId}`);
  }

  if (text === "/add_here") {
    await addTarget(chatId);
    bot.sendMessage(chatId, "✅ הקבוצה/הערוץ נוספו לרשימת היעדים");
  }

  if (text === "/remove_here") {
    if (!isOwner(msg)) return bot.sendMessage(chatId, "❌ אין לך הרשאה.");
    await removeTarget(chatId);
    bot.sendMessage(chatId, "❌ הקבוצה/הערוץ הוסרו מהרשימה");
  }

  if (text === "/list") {
    try {
      const col = await colTargets();
      const docs = await col.find({}).toArray();
      if (docs.length === 0) {
        await bot.sendMessage(chatId, "אין יעדים עדיין.");
        return;
      }
      const lines = await Promise.all(docs.map(async d => {
        const id = d.chat_id;
        try {
          const chat = await bot.getChat(id);
          const name = chat.title || chat.username || "(ללא שם)";
          return `${id} | ${name}`;
        } catch (e) {
          return `${id} | (שם לא זמין)`;
        }
      }));
      const textResp = "📋 רשימת יעדים:\n" + lines.join("\n");
      await bot.sendMessage(chatId, textResp);
    } catch (e) {
      console.error("list error", e);
      await bot.sendMessage(chatId, "שגיאה בעת טעינת היעדים.");
    }
  }

  if (text.startsWith("/set_message")) {
    if (!isOwner(msg)) return bot.sendMessage(chatId, "❌ אין לך הרשאה.");
    if (!msg.reply_to_message) return bot.sendMessage(chatId, "עשה reply להודעה לקיבוע.");
    sourceChatId = chatId;
    sourceMessageId = msg.reply_to_message.message_id;
    bot.sendMessage(chatId, "ההודעה נשמרה ✅");
  }

  if (text.startsWith("/set_interval")) {
    if (!isOwner(msg)) return bot.sendMessage(chatId, "❌ אין לך הרשאה.");
    const parts = text.split(" ");
    if (parts.length >= 2) {
      intervalMinutes = parseInt(parts[1]);
      bot.sendMessage(chatId, `⏱️ המרווח עודכן ל-${intervalMinutes} דקות`);
      if (job) {
        clearInterval(job);
        job = startJob();
      }
    }
  }

  if (text === "/start_forward") {
    if (!isOwner(msg)) return bot.sendMessage(chatId, "❌ אין לך הרשאה.");
    if (!sourceChatId || !sourceMessageId) return bot.sendMessage(chatId, "קבע הודעה קודם עם /set_message.");
    if (targets.length === 0) return bot.sendMessage(chatId, "אין יעדים – הוסף עם /add_here.");
    if (job) clearInterval(job);
    job = startJob();
    bot.sendMessage(chatId, "🔄 התחלתי לשלוח הודעות");
  }

  if (text === "/stop_forward") {
    if (!isOwner(msg)) return bot.sendMessage(chatId, "❌ אין לך הרשאה.");
    if (job) clearInterval(job);
    job = null;
    bot.sendMessage(chatId, "✋ השליחה נעצרה");
  }

  if (text === "/status") {
    bot.sendMessage(chatId, `
📊 סטטוס:
יעדים: ${targets.length}
מקור: ${sourceChatId || "לא נקבע"}
מרווח: ${intervalMinutes} דקות
סטטוס: ${job ? "פעיל ✅" : "כבוי ❌"}
`);
  }
}

// webhook endpoint
app.post(`/webhook`, async (req, res) => {
  const update = req.body;
  if (update.message) {
    await handleCommand(update.message);
  }
  res.sendStatus(200);
});

// health check
app.get("/health", (req, res) => {
  res.send("Bot is alive (webhook mode)");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("Server running on port", PORT);
  await loadTargets();
});
