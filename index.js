const { Telegraf } = require("telegraf");
const axios = require("axios");
const Stripe = require("stripe");

console.log("IA VALUE BOT PRO DEMARRE");

const bot = new Telegraf(process.env.BOT_TOKEN);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_FREE_ALERTS = 2;

const userAlerts = {};
const premiumUsers = new Set();

const MAJOR_LEAGUES = [
"soccer_epl",
"soccer_spain_la_liga",
"soccer_germany_bundesliga",
"soccer_italy_serie_a",
"soccer_france_ligue_one"
];


// MENU

bot.start(async (ctx)=>{

ctx.reply(
`🤖 IA VALUE BOT PRO

🎯 Analyse intelligente des cotes
📊 Détection de Value Bets

━━━━━━━━━━━━━━

🆓 2 scans gratuits / jour
💎 Premium = scans illimités

━━━━━━━━━━━━━━`,
{
reply_markup:{
inline_keyboard:[
[{ text:"🔎 Scanner les matchs", callback_data:"scan"}],
[{ text:"🔥 Top Value Bets", callback_data:"top"}],
[{ text:"📊 Mes statistiques", callback_data:"stats"}],
[{ text:"💎 Passer Premium", callback_data:"premium"}]
]
}
}
);

});


// STATS

bot.action("stats",(ctx)=>{

const userId = ctx.from.id;
const used = userAlerts[userId] || 0;

ctx.reply(
`📊 TES STATISTIQUES

Analyses utilisées : ${used}/${MAX_FREE_ALERTS}

Statut : ${premiumUsers.has(userId) ? "💎 Premium" : "🆓 Gratuit"}`
);

});


// PREMIUM

bot.action("premium", async(ctx)=>{

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

Accès illimité aux analyses.

Clique ici pour payer :

${session.url}`
);

}catch(error){

console.log(error);
ctx.reply("❌ Impossible de créer le paiement.");

}

});


// SCAN BOUTON

bot.action("scan", async(ctx)=>{
await ctx.answerCbQuery();
scanMatches(ctx);
});


// COMMANDE SCAN

bot.command("scan",(ctx)=>{
scanMatches(ctx);
});


// SCAN

async function scanMatches(ctx){

try{

const userId = ctx.from.id;

if(!premiumUsers.has(userId)){

if(!userAlerts[userId]) userAlerts[userId] = 0;

if(userAlerts[userId] >= MAX_FREE_ALERTS){

return ctx.reply("⚠️ Limite gratuite atteinte (2 scans/jour).\nPasse Premium pour continuer.");

}

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

if(!premiumUsers.has(userId)){
userAlerts[userId]++;
}

return ctx.reply(

`🔥 VALUE BET

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

}catch(error){

console.log(error);
ctx.reply("Erreur lors du scan.");

}

}


// TOP VALUE

bot.action("top",(ctx)=>{

ctx.reply(
`🔥 TOP VALUE BETS

Fonction en cours de développement.

Les meilleures analyses seront bientôt envoyées automatiquement.`
);

});


// SCAN AUTOMATIQUE PREMIUM (1 HEURE)

setInterval(()=>{

console.log("Scan automatique Premium");

},3600000);



// LANCEMENT BOT

bot.telegram.deleteWebhook().then(()=>{

bot.launch();

console.log("BOT TELEGRAM LANCE");

});

process.once("SIGINT",()=>bot.stop("SIGINT"));
process.once("SIGTERM",()=>bot.stop("SIGTERM"));