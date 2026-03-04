const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const Stripe = require("stripe")

console.log("🚀 IA VALUE BOT PRO START")

// VARIABLES
const bot = new Telegraf(process.env.BOT_TOKEN)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const MAX_FREE_SCANS = 2
const userStats = {}

// LIGUES (IDS OFFICIELS THE ODDS API)
const LEAGUES = [
"soccer_epl",
"soccer_spain_la_liga",
"soccer_germany_bundesliga",
"soccer_italy_serie_a",
"soccer_france_ligue_one"
]

// MENU TELEGRAM
const mainMenu = Markup.keyboard([
["🔎 Scanner les matchs"],
["🔥 Top Value Bets"],
["📊 Mes statistiques"],
["💎 Passer Premium"]
]).resize()

// START
bot.start((ctx)=>{

ctx.reply(`🤖 IA VALUE BOT PRO

📊 Analyse intelligente des cotes
🎯 Détection automatique de value bets

━━━━━━━━━━━━

🆓 2 scans gratuits / jour
💎 Premium = scans illimités

━━━━━━━━━━━━`,
mainMenu)

})

// SCAN MATCHS
bot.hears("🔎 Scanner les matchs", async (ctx)=>{

const user = ctx.from.id

if(!userStats[user]){
userStats[user] = 0
}

if(userStats[user] >= MAX_FREE_SCANS){

return ctx.reply("⚠️ Limite gratuite atteinte (2 scans/jour).\nPasse Premium pour scans illimités.")

}

try{

for(const league of LEAGUES){

const url = `https://api.the-odds-api.com/v4/sports/${league}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`

const res = await axios.get(url)

const matches = res.data

if(!matches || matches.length === 0){
continue
}

for(const match of matches){

const home = match.home_team
const away = match.away_team

const market = match.bookmakers?.[0]?.markets?.[0]

if(!market) continue

for(const outcome of market.outcomes){

const odds = outcome.price
const team = outcome.name

if(!odds || odds < 1.5) continue

// PROBA BOOKMAKER
const bookProb = 1 / odds

// PROBA IA
let aiProb = bookProb

if(odds >= 3){
aiProb *= 1.25
}

if(odds >=2 && odds <3){
aiProb *= 1.15
}

if(aiProb > 0.8){
aiProb = 0.8
}

// EDGE
const edge = (aiProb * odds) - 1

if(aiProb > 0.60 && edge > 0.15){

userStats[user]++

return ctx.reply(`🔥 VALUE BET DÉTECTÉ

🏆 ${home} vs ${away}

🎯 Pick : ${team}

📊 Probabilité IA : ${(aiProb*100).toFixed(1)}%
📉 Probabilité Book : ${(bookProb*100).toFixed(1)}%

💰 Cote : ${odds}
📈 Edge : ${(edge*100).toFixed(1)}%`)

}

}

}

}

ctx.reply("❌ Aucune value intéressante trouvée.")

}catch(err){

console.log("SCAN ERROR:", err.message)

ctx.reply("❌ Erreur lors du scan.")

}

})

// STATS
bot.hears("📊 Mes statistiques",(ctx)=>{

const user = ctx.from.id
const used = userStats[user] || 0

ctx.reply(`📊 TES STATISTIQUES

Analyses utilisées : ${used}/2

Statut : 🆓 Gratuit`)

})

// TOP VALUE BETS
bot.hears("🔥 Top Value Bets",(ctx)=>{

ctx.reply(`🔥 TOP VALUE BETS

Fonction en cours de développement.

Les meilleures analyses seront envoyées automatiquement chaque jour.`)

})

// PREMIUM STRIPE
bot.hears("💎 Passer Premium", async (ctx)=>{

try{

const session = await stripe.checkout.sessions.create({

payment_method_types:["card"],

mode:"subscription",

line_items:[
{
price: process.env.STRIPE_PRICE_ID,
quantity:1
}
],

success_url:"https://t.me/PerfctIAbot",
cancel_url:"https://t.me/PerfctIAbot"

})

ctx.reply(`💎 PREMIUM IA VALUE BOT

Accès illimité aux scans
Alertes value bets IA
Analyses avancées

Clique ici pour t'abonner :

${session.url}`)

}catch(error){

console.log("STRIPE ERROR:", error)

ctx.reply("❌ Impossible de créer le paiement.")

}

})

// CORRECTION ERREUR TELEGRAM 409
bot.telegram.deleteWebhook()

// LANCEMENT BOT
bot.launch()

console.log("✅ BOT LANCÉ")

process.once("SIGINT",()=>bot.stop("SIGINT"))
process.once("SIGTERM",()=>bot.stop("SIGTERM"))
