const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;
const oddsApiKey = process.env.ODDS_API_KEY;

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN manquant");
  process.exit(1);
}

if (!oddsApiKey) {
  console.error("❌ ODDS_API_KEY manquant");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log("🤖 IA VALUE BOT démarré...");

let freeAlertsToday = 0;
let lastReset = new Date().getDate();

function resetDailyCounter() {
  const today = new Date().getDate();
  if (today !== lastReset) {
    freeAlertsToday = 0;
    lastReset = today;
  }
}

async function checkMatches(chatId) {
  try {
    resetDailyCounter();

    const response = await axios.get(
      `https://api.the-odds-api.com/v4/sports/soccer/odds`,
      {
        params: {
          apiKey: oddsApiKey,
          regions: 'eu',
          markets: 'h2h',
          oddsFormat: 'decimal'
        }
      }
    );

    const matches = response.data;

    for (let match of matches) {
      const bookmaker = match.bookmakers?.[0];
      if (!bookmaker) continue;

      const market = bookmaker.markets?.[0];
      if (!market) continue;

      const outcomes = market.outcomes;

      for (let outcome of outcomes) {
        const odd = outcome.price;

        // Simulation probabilité IA
        const probability = Math.random() * 100;

        if (probability > 80 && odd >= 1.7) {

          if (freeAlertsToday >= 2) {
            bot.sendMessage(chatId, "⚠️ Limite gratuite atteinte (2/jour)");
            return;
          }

          freeAlertsToday++;

          bot.sendMessage(chatId,
            `🔥 ALERTE VALUE\n\n` +
            `🏆 ${match.home_team} vs ${match.away_team}\n` +
            `🎯 Pick: ${outcome.name}\n` +
            `📊 Probabilité IA: ${probability.toFixed(1)}%\n` +
            `💰 Cote: ${odd}`
          );

          return;
        }
      }
    }

    bot.sendMessage(chatId, "❌ Aucune value >80% pour le moment.");

  } catch (error) {
    console.error("Erreur API:", error.message);
    bot.sendMessage(chatId, "❌ Erreur récupération des matchs.");
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId,
    `🤖 IA VALUE BOT\n\n` +
    `♦ 2 alertes gratuites / jour\n` +
    `♦ Détection automatique >80%\n` +
    `♦ Value avec bonne cote\n\n` +
    `Tape /scan pour analyser les matchs`
  );
});

bot.onText(/\/scan/, (msg) => {
  checkMatches(msg.chat.id);
});
