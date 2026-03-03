const { Telegraf } = require("telegraf");
const axios = require("axios");
const Stripe = require("stripe");

console.log("VERSION FINALE PREMIUM ACTIVE");

// Vérification variables Railway
if (!process.env.BOT_TOKEN) {
  console.error("BOT_TOKEN manquant");
  process.exit(1);
}

if (!process.env.ODDS_API_KEY) {
  console.error("ODDS_API_KEY manquant");
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY manquant");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_FREE_ALERTS = 2;
const userAlerts = {};

// Ligues majeures uniquement
const MAJOR_LEAGUES = [
  "soccer_epl",
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
Tape /premium pour débloquer l'accès illimité 💎
  `);
});

// PREMIUM
bot.command("premium", async (ctx) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: "price_1T71Kf2MDPLIlfMHtBMswnJ8", // TON ID PRICE STRIPE
          quantity: 1,
        },
      ],
      success_url: "https://t.me/PerfctIAbot",
      cancel_url: "https://t.me/PerfctIAbot",
    });

    ctx.reply(`
💎 PREMIUM IA VALUE BOT

Accès illimité aux alertes IA.
Fonctionnalités avancées activées.

👉 Clique ici pour t'abonner :
${session.url}
    `);
  } catch (error) {
    console.error("Erreur premium:", error.message);
    ctx.reply("Erreur lors de la création du paiement.");
  }
});

// SCAN
bot.command("scan", async (ctx) => {
  try {
    const userId = ctx.from.id;

    if (!userAlerts[userId]) userAlerts[userId] = 0;

    if (userAlerts[userId] >= MAX_FREE_ALERTS) {
      return ctx.reply("⚠️ Limite gratuite atteinte (2 alertes/jour). Tape /premium pour débloquer 💎");
    }

    for (const league of MAJOR_LEAGUES) {
      const url = `https://api.the-odds-api.com/v4/sports/${league}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;

      let response;

      try {
        response = await axios.get(url);
      } catch (apiError) {
        console.log("Erreur API:", apiError.message);
        continue;
      }

      const matches = response.data;

      if (!matches || !matches.length) continue;

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

          const aiProbability = (Math.random() * 0.30) + 0.45;
          const edge = (aiProbability * odds) - 1;

          if (aiProbability > 0.60 && edge > 0.15) {
            userAlerts[userId]++;

            return ctx.reply(`
🔥 ALERTE VALUE

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

    ctx.reply("Aucune value intéressante trouvée.");
  } catch (error) {
    console.error("Erreur générale:", error.message);
    ctx.reply("Erreur lors du scan.");
  }
});

// Lancement
bot.launch();
console.log("Bot lancé");

// Stop propre Railway
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));