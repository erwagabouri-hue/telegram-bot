const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN manquant !");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log("🤖 Bot IA démarré...");

// =======================
// STOCKAGE UTILISATEURS
// =======================
const users = new Map();

// =======================
// COMMANDE START
// =======================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (!users.has(chatId)) {
    users.set(chatId, {
      dailyAlertCount: 0,
      lastAlertDate: new Date().toDateString(),
      isPremium: false
    });
  }

  bot.sendMessage(chatId, `
🤖 IA VALUE BOT

🔹 2 alertes gratuites / jour
🔹 Premium = alertes live illimitées
🔹 Détection automatique >80%
🔹 Détection value cote

Bot actif 🚀
  `);
});

// =======================
// ACTIVER PREMIUM (test)
// =======================
bot.onText(/\/premium/, (msg) => {
  const chatId = msg.chat.id;

  if (users.has(chatId)) {
    users.get(chatId).isPremium = true;
    bot.sendMessage(chatId, "💎 Premium activé (mode test)");
  }
});

// =======================
// ANALYSE IA
// =======================
function analyzeMatch(match) {
  let score = 0;

  if (match.homeForm > 70) score += 25;
  if (match.awayWeakness > 60) score += 20;
  if (match.xGDiff > 1.2) score += 20;
  if (match.odds > 1.8 && match.odds < 3.5) score += 15;
  if (match.momentum > 70) score += 20;

  return score; // max 100
}

// =======================
// CALCUL VALUE
// =======================
function calculateValue(probability, odds) {
  return (probability / 100 * odds) - 1;
}

// =======================
// ENVOI ALERTES
// =======================
function sendAlert(match, probability, value) {

  users.forEach((user, chatId) => {

    const today = new Date().toDateString();

    // reset compteur chaque jour
    if (user.lastAlertDate !== today) {
      user.dailyAlertCount = 0;
      user.lastAlertDate = today;
    }

    if (probability >= 80 && value >= 0.15) {

      if (user.dailyAlertCount < 2 || user.isPremium) {

        bot.sendMessage(chatId, `
🚨 VALUE DÉTECTÉE

⚽ ${match.name}
📊 Probabilité IA : ${probability}%
💰 Cote : ${match.odds}
🔥 Value : ${(value * 100).toFixed(1)}%

Entrée recommandée maintenant ⚡
        `);

        if (!user.isPremium) {
          user.dailyAlertCount++;
        }
      }
    }
  });
}

// =======================
// SIMULATION MATCH LIVE
// =======================
function simulateMatch() {

  const match = {
    name: "PSG vs OM",
    homeForm: Math.random() * 100,
    awayWeakness: Math.random() * 100,
    xGDiff: Math.random() * 2,
    odds: (Math.random() * 2 + 1.5).toF
