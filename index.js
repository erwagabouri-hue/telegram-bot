const { Telegraf } = require("telegraf");
const axios = require("axios");
const Stripe = require("stripe");

console.log("ENGINE PROBABILISTE VRAI ACTIF");

// ===== ENV CHECK =====
if (!process.env.BOT_TOKEN) process.exit(1);
if (!process.env.ODDS_API_KEY) process.exit(1);
if (!process.env.STRIPE_SECRET_KEY) process.exit(1);

const bot = new Telegraf(process.env.BOT_TOKEN);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_FREE_ALERTS = 2;
const userAlerts = {};

// Ligues majeures
const MAJOR_LEAGUES = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one"
];

// ================= MENU =================

bot.start((ctx) => {
  const userId = ctx.from.id;
  const used = userAlerts[userId] || 0;
  const remaining = MAX_FREE_ALERTS - used;

  ctx.reply(
`🤖 IA VALUE BOT PRO

━━━━━━━━━━━━━━━━━━

👤 Statut : Gratuit
🎯 Alertes restantes : ${remaining}/${MAX_FREE_ALERTS}

━━━━━━━━━━━━━━━━━━`,
{
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔎 Scanner", callback_data: "scan" }],
      [{ text: "📊 Stats", callback_data: "stats" }],
      [{ text: "💎 Premium", callback_data: "premium" }]
    ]
  }
});
});

bot.action("scan", async (ctx) => {
  await ctx.answerCbQuery();
  scanMatches(ctx);
});

bot.action("stats", async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const used = userAlerts[userId] || 0;

  ctx.reply(
`📊 STATISTIQUES

Alertes utilisées : ${used}
Limite gratuite : ${MAX_FREE_ALERTS}`
  );
});

bot.action("premium", async (ctx) => {
  await ctx.answerCbQuery();
  createPremiumSession(ctx);
});

// ================= PREMIUM =================

async function createPremiumSession(ctx) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        { price: "price_1T71Kf2MDPLIlfMHtBMswnJ8", quantity: 1 }
      ],
      success_url: "https://t.me/PerfctIAbot",
      cancel_url: "https://t.me/PerfctIAbot",
    });

    ctx.reply(`💎 Passe Premium ici :\n${session.url}`);
  } catch (error) {
    ctx.reply("Erreur Stripe.");
  }
}

// ================= SCAN =================

bot.command("scan", async (ctx) => {
  scanMatches(ctx);
});

async function scanMatches(ctx) {
  try {
    const userId = ctx.from.id;

    if (!userAlerts[userId]) userAlerts[userId] = 0;

    if (userAlerts[userId] >= MAX_FREE_ALERTS) {
      return ctx.reply("🚨 Limite gratuite atteinte. Passe Premium.");
    }

    for (const league of MAJOR_LEAGUES) {

      const url = `https://api.the-odds-api.com/v4/sports/${league}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h,totals,btts&oddsFormat=decimal`;

      const response = await axios.get(url);
      const matches = response.data;
      if (!matches) continue;

      for (const match of matches) {

        const home = match.home_team;
        const away = match.away_team;

        const market = match.bookmakers?.[0]?.markets;
        if (!market) continue;

        for (const m of market) {

          const outcomes = m.outcomes;
          if (!outcomes || outcomes.length < 2) continue;

          // ===== 1X2 =====
          if (m.key === "h2h") {

            const homeOdds = outcomes.find(o => o.name === home)?.price;
            const drawOdds = outcomes.find(o => o.name === "Draw")?.price;
            const awayOdds = outcomes.find(o => o.name === away)?.price;

            if (!homeOdds || !drawOdds || !awayOdds) continue;

            const pHome = 1 / homeOdds;
            const pDraw = 1 / drawOdds;
            const pAway = 1 / awayOdds;

            const overround = pHome + pDraw + pAway;

            const trueHome = pHome / overround;
            const trueDraw = pDraw / overround;
            const trueAway = pAway / overround;

            const selections = [
              { team: home, odds: homeOdds, prob: trueHome },
              { team: "Draw", odds: drawOdds, prob: trueDraw },
              { team: away, odds: awayOdds, prob: trueAway }
            ];

            for (const sel of selections) {
              const EV = (sel.prob * sel.odds) - 1;

              if (EV > 0.08) {

                userAlerts[userId]++;

                return ctx.reply(
`🔥 VALUE PRO

🏆 ${home} vs ${away}
🎯 Pick: ${sel.team}

📊 Probabilité corrigée : ${(sel.prob * 100).toFixed(2)}%
💰 Cote : ${sel.odds}
📈 EV : ${(EV * 100).toFixed(2)}%
📉 Marge book : ${((overround - 1) * 100).toFixed(2)}%`
                );
              }
            }
          }

          // ===== BTTS =====
          if (m.key === "btts") {

            const yesOdds = outcomes.find(o => o.name === "Yes")?.price;
            const noOdds = outcomes.find(o => o.name === "No")?.price;
            if (!yesOdds || !noOdds) continue;

            const pYes = 1 / yesOdds;
            const pNo = 1 / noOdds;
            const overround = pYes + pNo;

            const trueYes = pYes / overround;
            const trueNo = pNo / overround;

            const selections = [
              { team: "BTTS Yes", odds: yesOdds, prob: trueYes },
              { team: "BTTS No", odds: noOdds, prob: trueNo }
            ];

            for (const sel of selections) {
              const EV = (sel.prob * sel.odds) - 1;
              if (EV > 0.08) {
                userAlerts[userId]++;
                return ctx.reply(
`🔥 VALUE BTTS

🏆 ${home} vs ${away}
🎯 ${sel.team}

📊 Probabilité : ${(sel.prob * 100).toFixed(2)}%
💰 Cote : ${sel.odds}
📈 EV : ${(EV * 100).toFixed(2)}%`
                );
              }
            }
          }

        }
      }
    }

    ctx.reply("Aucune value trouvée.");

  } catch (error) {
    ctx.reply("Erreur scan.");
  }
}

// ================= START BOT =================

bot.launch();
console.log("Bot lancé");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
