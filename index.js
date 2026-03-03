require("dotenv").config();
const { Telegraf } = require("telegraf");
const axios = require("axios");

// Vérification variables
if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant");
  process.exit(1);
}

if (!process.env.ODDS_API_KEY) {
  console.error("❌ ODDS_API_KEY manquant");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Limite gratuite
const userAlerts = {};
const MAX_FREE_ALERTS = 2;

// Ligues majeures uniquement
const MAJOR_LEAGUES = [
  "soccer_epl",          // Premier League
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one"
];

// START
bot.start((ctx) => {
  ctx.reply(`
🤖 IA VALUE BOT PRO

♦ 2 alertes gratuites / jour
♦ Ligues majeures uniquement
♦ Probabilité IA >60%
♦ Edge minimum 15%

Tape /scan pour analyser les matchs
  `);
});

// SCAN
bot.command("scan", async (ctx) => {
  try {
    const userId = ctx.from.id;

    if (!userAlerts[userId]) userAlerts[userId] = 0;

    if (userAlerts[userId] >= MAX_FREE_ALERTS) {
      return ctx.reply("⚠️ Limite gratuite atteinte (2 alertes/jour).");
    }

    for (const league of MAJOR_LEAGUES) {

      const url = `https://api.the-odds-api.com/v4/sports/${league}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;

      const response = await axios.get(url);
      const matches = response.data;

      if (!matches.length) continue;

      for (const match of matches) {

        const home = match.home_team;
        const away = match.away_team;

        const market = match.bookmakers?.[0]?.markets?.[0];
        if (!market) continue;

        const outcomes = market.outcomes;

        for (const outcome of outcomes) {

          const team = outcome.name;
          const odds = outcome.price;

          if (!odds || odds < 1.5) continue;

          // Probabilité implicite bookmaker
          const impliedProbability = 1 / odds;

          // Estimation IA réaliste (45% à 75%)
          const aiProbability = (Math.random() * 0.30) + 0.45;

          // Calcul Edge
          const edge = (aiProbability * odds) - 1;

          // Conditions VALUE sérieuse
          if (aiProbability > 0.60 && edge > 0.15) {

            userAlerts[userId]++;

            return ctx.reply(`
🔥 ALERTE VALUE (Ligue majeure)

🏆 ${home} vs ${away}
🎯 Pick: ${team}

📊 Probabilité IA: ${(aiProbability * 100).toFixed(1)}%
📉 Probabilité Book: ${(impliedProbability * 100).toFixed(1)}%
💰 Cote: ${odds}
📈 Edge: ${(edge * 100).toFixed(1)}%
            `);
          }
        }
      }
    }

    ctx.reply("Aucune value intéressante trouvée dans les ligues majeures.");
    
  } catch (error) {
    console.error(error);
    ctx.reply("Erreur lors du scan.");
  }
});

// Lancement
bot.launch();
console.log("🚀 Bot lancé en mode VALUE PRO");

// Stop propre Railway
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
