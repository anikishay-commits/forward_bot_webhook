# Forward Bot Webhook Version

## Setup
1. Upload to Render or another server.
2. Set Environment Variables:
   - `BOT_TOKEN`
   - `OWNER_ID`
   - `MONGO_URI`
   - `MONGO_DB` (default: telegrambot)
3. Deploy and get your service URL (example: https://your-app.onrender.com/webhook).
4. Run the following command once to set the webhook:

```
curl -F "url=https://your-app.onrender.com/webhook" https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
```

Replace `<BOT_TOKEN>` with your real bot token.
