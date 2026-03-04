const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
const Stripe = require("stripe");

console.log("IA VALUE BOT PRO STARTING");

// VARIABLES
const bot = new Telegraf(process.env.BOT_TOKEN);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_FREE_ALERTS = 2;
const userAlerts = {};

const MAJOR_LEAGUES = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one"
];

// MENU BOUTONS
function mainMenu() {
  return Markup.keyboard([
    ["🔎 Scanner les matchs"],
    ["🔥 Top Value Bets"],
    ["📊 Mes statistiques"],
    ["💎 Passer Premium"]
  ]).resize();
}

// START
bot.start((ctx) => {
  ctx.reply(
`🤖 IA VALUE BOT PRO

🎯 Analyse intelligente des cotes
📊 Détection de value bets

━━━━━━━━━━━━

🆓 2 scans gratuits / jour
💎 Premium = scans illimités

━━━━━━━━━━━━`,
mainMenu()
);
});

// SCAN MATCHS
bot.hears("🔎 Scanner les matchs", async (ctx) => {

  const userId = ctx.from.id;

  if (!userAlerts[userId]) userAlerts[userId] = 0;

  if (userAlerts[userId] >= MAX_FREE_ALERTS) {
    return ctx.reply("⚠️ Limite gratuite atteinte (2 scans/jour). Passe Premium.");
  }

  try {

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

          const impliedProbability = 1 / odds;

          let aiProbability = impliedProbability;

          if (odds >= 3) aiProbability *= 1.25;
          if (odds >= 2 && odds < 3) aiProbability *= 1.15;

          if (aiProbability > 0.8) aiProbability = 0.8;

          const edge = (aiProbability * odds) - 1;

          if (aiProbability > 0.60 && edge > 0.15) {

            userAlerts[userId]++;

            return ctx.reply(

`🔥 ALERTE VALUE

🏆 ${home} vs ${away}
🎯 Pick : ${team}

📊 Probabilité IA : ${(aiProbability*100).toFixed(1)}%
📉 Probabilité Book : ${(impliedProbability*100).toFixed(1)}%

💰 Cote : ${odds}
📈 Edge : ${(edge*100).toFixed(1)}%`

            );

          }

        }

      }

    }

    ctx.reply("Aucune value intéressante trouvée.");

  } catch (error) {

    console.log(error);
    ctx.reply("Erreur lors du scan.");

  }

});

// STATS
bot.hears("📊 Mes statistiques", (ctx) => {

  const userId = ctx.from.id;
  const used = userAlerts[userId] || 0;

  ctx.reply(
`📊 TES STATISTIQUES

Analyses utilisées : ${used}/2

Statut : 🆓 Gratuit`
  );

});

// TOP VALUE BETS
bot.hears("🔥 Top Value Bets", (ctx) => {

  ctx.reply(
`🔥 TOP VALUE BETS

Fonction en cours de développement.

Les meilleures analyses seront bientôt envoyées automatiquement.`
  );

});

// PREMIUM STRIPE
bot.hears("💎 Passer Premium", async (ctx) => {

  try {

    const session = await stripe.checkout.sessions.create({

      payment_method_types: ["card"],
      mode: "subscription",

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],

      success_url: "https://t.me/PerfctIAbot",
      cancel_url: "https://t.me/PerfctIAbot",

    });

    ctx.reply(
`💎 PREMIUM IA VALUE BOT

Accès illimité aux scans
Alertes IA avancées
Value bets premium

Clique ici pour t'abonner :

${session.url}`
    );

  } catch (error) {

    console.log("STRIPE ERROR:", error);
    ctx.reply("❌ Impossible de créer le paiement.");

  }

});

// LANCEMENT BOT
bot.launch();

console.log("BOT LANCÉ");

// STOP PROPRE
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));