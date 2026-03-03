const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

console.log("Bot démarré...");

bot.on("message", (msg) => {
  bot.sendMessage(msg.chat.id, "Bot actif 🚀");
});

// 👇 Mini serveur pour Railway
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot is running");
}).listen(process.env.PORT || 3000);
