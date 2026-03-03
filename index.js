const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

console.log("Bot démarré...");

bot.on("message", (msg) => {
  bot.sendMessage(msg.chat.id, "Bot actif 🚀");
});
