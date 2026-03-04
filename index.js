const { Telegraf } = require("telegraf");
const axios = require("axios");
const Stripe = require("stripe");

console.log("BOT IA VALUE PRO DEMARRE");

// VARIABLES ENV
const bot = new Telegraf(process.env.BOT_TOKEN);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_FREE_ALERTS = 2;
const userAlerts = {};

// LIGUES
const MAJOR_LEAGUES = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one"
];


// ================= START MENU =================

bot.start(async (ctx) => {

  ctx.reply(
`🤖 IA VALUE BOT PRO

🎯 Analyse intelligente des cotes
📊 Détection de value bets

━━━━━━━━━━━━━━

🆓 2 analyses gratuites / jour

💎 Premium = scans illimités

━━━━━━━━━━━━━━`,
{
reply_markup:{
inline_keyboard:[
[
{ text:"🔎 Scanner les matchs", callback_data:"scan" }
],
[
{ text:"💎 Passer Premium", callback_data:"premium" }
],
[
{ text:"📊 Mes statistiques", callback_data:"stats" }
]
]
}
});

});


// ================= STATS =================

bot.action("stats", async (ctx)=>{

const userId = ctx.from.id;
const used = userAlerts[userId] || 0;

ctx.reply(
`📊 TES STATS

Alertes utilisées : ${used}/${MAX_FREE_ALERTS}

Tape 🔎 Scanner pour analyser les matchs`
);

});


// ================= PREMIUM =================

bot.action("premium", async (ctx)=>{

try{

const session = await stripe.checkout.sessions.create({

payment_method_types:["card"],

mode:"subscription",

line_items:[
{
price:process.env.STRIPE_PRICE_ID,
quantity:1
}
],

success_url:"https://t.me/PerfctIAbot",

cancel_url:"https://t.me/PerfctIAbot"

});

ctx.reply(
`💎 PREMIUM IA VALUE BOT

Accès illimité aux analyses IA.

Clique ici pour activer Premium :

${session.url}`
);

}catch(err){

console.log(err);

ctx.reply("Erreur lors de la création du paiement.");

}

});


// ================= SCAN BUTTON =================

bot.action("scan", async (ctx)=>{
await ctx.answerCbQuery();
scanMatches(ctx);
});


// ================= SCAN COMMAND =================

bot.command("scan", async (ctx)=>{
scanMatches(ctx);
});


// ================= SCAN LOGIC =================

async function scanMatches(ctx){

try{

const userId = ctx.from.id;

if(!userAlerts[userId]) userAlerts[userId] = 0;

if(userAlerts[userId] >= MAX_FREE_ALERTS){

return ctx.reply(
"⚠️ Limite gratuite atteinte (2 scans/jour).\n\nPasse Premium pour continuer."
);

}

for(const league of MAJOR_LEAGUES){

const url = `https://api.the-odds-api.com/v4/sports/${league}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;

const response = await axios.get(url);

const matches = response.data;

if(!matches) continue;

for(const match of matches){

const home = match.home_team;
const away = match.away_team;

const market = match.bookmakers?.[0]?.markets?.[0];

if(!market) continue;

const outcomes = market.outcomes;

const homeOdds = outcomes.find(o=>o.name===home)?.price;
const drawOdds = outcomes.find(o=>o.name==="Draw")?.price;
const awayOdds = outcomes.find(o=>o.name===away)?.price;

if(!homeOdds || !drawOdds || !awayOdds) continue;


// PROBABILITES
const pHome = 1/homeOdds;
const pDraw = 1/drawOdds;
const pAway = 1/awayOdds;

const overround = pHome + pDraw + pAway;

const trueHome = pHome/overround;
const trueDraw = pDraw/overround;
const trueAway = pAway/overround;

const selections = [

{team:home, odds:homeOdds, prob:trueHome},
{team:"Draw", odds:drawOdds, prob:trueDraw},
{team:away, odds:awayOdds, prob:trueAway}

];

for(const sel of selections){

const EV = (sel.prob * sel.odds) - 1;

if(EV > 0.08){

userAlerts[userId]++;

return ctx.reply(

`🔥 ALERTE VALUE

🏆 ${home} vs ${away}

🎯 Pick : ${sel.team}

💰 Cote : ${sel.odds}

📊 Probabilité corrigée :
${(sel.prob*100).toFixed(2)}%

📈 Expected Value :
${(EV*100).toFixed(2)}%

📉 Marge bookmaker :
${((overround-1)*100).toFixed(2)}%`

);

}

}

}

}

ctx.reply("Aucune value intéressante trouvée.");

}catch(err){

console.log(err);

ctx.reply("Erreur pendant le scan.");

}

}



// ================= START BOT =================

bot.telegram.deleteWebhook().then(()=>{

bot.launch();

console.log("BOT TELEGRAM LANCE");

});

process.once("SIGINT",()=>bot.stop("SIGINT"));
process.once("SIGTERM",()=>bot.stop("SIGTERM"));