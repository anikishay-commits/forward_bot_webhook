# Telegram Forward Bot (Full Webhook, fixed)

## Setup (Render)
1. Upload this project to GitHub.
2. Create new Web Service in Render.
   - Build Command: npm install
   - Start Command: npm start
3. Environment Variables:
   - BOT_TOKEN = your bot token
   - OWNER_ID = your user id
   - MONGO_URI = MongoDB Atlas connection string
   - MONGO_DB = telegrambot
4. After deploy, set webhook once:
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-app>.onrender.com/webhook
