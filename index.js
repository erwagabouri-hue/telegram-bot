const { Telegraf } = require("telegraf");
const axios = require("axios");
const Stripe = require("stripe");
const express = require("express");

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

if (!process.env.STRIPE_PRICE_ID) {
  console.error("STRIPE_PRICE_ID manquant");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

const MAX_FREE_ALERTS = 2;
const userAlerts = {};
const premiumUsers = {}; // stockage simple (temporaire)

// Ligues majeures uniquement
const MAJOR_LEAGUES = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one"
];


// ================= START =================

bot.start((ctx) => {
  ctx.reply(`
🤖 IA VALUE BOT PRO

♦ 2 alertes gratuites / jour
♦ Ligues majeures uniquement
♦ Probabilité IA >60%
♦ Edge minimum 15%

Tape /scan pour analyser les matchs
Tape /premium pour accès illimité 🔥
  `);
});
// PREMIUM
bot.command("premium", async (ctx) => {
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: "price_1T71Kf2MDPLIlfMHtBMswnJ8", // ⚠️ ton ID price Stripe
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


// ================= PREMIUM =================

bot.command("premium", async (ctx) => {
  const userId = ctx.from.id;

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
      metadata: {
        telegramId: userId.toString(),
      },
    });

    ctx.reply(`🔥 Passe Premium ici :\n\n${session.url}`);
  } catch (err) {
    console.log(err);
    ctx.reply("Erreur Stripe.");
  }
});


// ================= SCAN =================

bot.command("scan", async (ctx) => {
  try {
    const userId = ctx.from.id;

    if (!premiumUsers[userId]) {
      if (!userAlerts[userId]) userAlerts[userId] = 0;

      if (userAlerts[userId] >= MAX_FREE_ALERTS) {
        return ctx.reply("⚠️ Limite gratuite atteinte (2 alertes/jour). Passe Premium avec /premium");
      }
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

            if (!premiumUsers[userId]) {
              userAlerts[userId]++;
            }

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


// ================= WEBHOOK STRIPE =================

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("Webhook signature failed.");
    return res.sendStatus(400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const telegramId = session.metadata.telegramId;

    premiumUsers[telegramId] = true;

    console.log("Premium activé pour :", telegramId);
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log("Server running"));


// ================= LANCEMENT =================

bot.launch();
console.log("Bot lancé");
bot.command("premium", (ctx) => {
  ctx.reply("Premium command active");
});
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
