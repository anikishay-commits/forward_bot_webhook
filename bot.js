const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { MongoClient } = require('mongodb');

const token = process.env.BOT_TOKEN;
const ownerId = process.env.OWNER_ID;
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB || 'telegrambot';

const bot = new TelegramBot(token);
const app = express();

let targets = [];

(async () => {
  const client = new MongoClient(mongoUri);
  await client.connect();
  console.log("Connected to MongoDB");
  const db = client.db(dbName);
  const targetsCol = db.collection("targets");

  // Load existing targets
  targets = await targetsCol.find({}).toArray();
  console.log("Loaded targets:", targets);

  app.use(express.json());

  // Webhook endpoint
  app.post('/webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  // Commands
  bot.onText(/\/add_here/, async (msg) => {
    if (!targets.find(t => t.chatId === msg.chat.id)) {
      const entry = { chatId: msg.chat.id, title: msg.chat.title || msg.chat.username || "Unknown" };
      await targetsCol.insertOne(entry);
      targets.push(entry);
      bot.sendMessage(msg.chat.id, "✅ הקבוצה נוספה לרשימה");
    }
  });

  bot.onText(/\/list/, async (msg) => {
    if (msg.from.id.toString() !== ownerId) return;
    if (targets.length === 0) {
      bot.sendMessage(msg.chat.id, "אין קבוצות ברשימה.");
      return;
    }
    let list = targets.map(t => `${t.chatId} - ${t.title}`).join("\n");
    bot.sendMessage(msg.chat.id, "📋 רשימת קבוצות:\n" + list);
  });

  // Start server
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();