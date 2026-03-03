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
function calculateValue(probability, odds) {
  return (probability / 100 * odds) - 1;
}

function processLiveMatch(match) {

  const probability = analyzeMatch(match);
  const value = calculateValue(probability, match.odds);

  if (probability >= 80 && value >= 0.15) {
    sendAlert(match, probability, value);
  }
}bot.sendMessage(id, `
🚨 LIVE VALUE DÉTECTÉ

⚽ ${match.name}
📊 Probabilité IA: ${probability}%
💰 Cote: ${match.odds}
🔥 Value: ${(value * 100).toFixed(1)}%

Entrée recommandée maintenant ⚡
`);
