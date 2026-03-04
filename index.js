const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")

console.log("🚀 IA VALUE BOT PRO START")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2

const userStats = {}
const premiumUsers = new Set()

// LIGUES STABLES

const LEAGUES = [

"soccer_epl",
"soccer_spain_la_liga",
"soccer_germany_bundesliga",
"soccer_italy_serie_a",
"soccer_france_ligue_one",

"soccer_netherlands_eredivisie",
"soccer_portugal_primeira_liga",
"soccer_turkey_super_league"

]

// MENU

const menu = Markup.keyboard([
["🔎 Scanner les matchs"],
["🔥 Top Value Bets"],
["📊 Mes statistiques"],
["💎 Passer Premium"]
]).resize()

// START

bot.start((ctx)=>{

const user = ctx.from.id
const param = ctx.startPayload

if(param === "premium"){

premiumUsers.add(user)

ctx.reply(`👑 Bienvenue dans la Team Gagnante !

Ton accès Premium est maintenant activé.

Tu as maintenant accès :

• scans illimités
• alertes exclusives
• value bets avancées

Prépare-toi à encaisser les meilleures opportunités détectées par l’IA.`)

return
}

ctx.reply(`🤖 IA VALUE BOT PRO

Analyse intelligente des cotes
Détection automatique de value bets

━━━━━━━━━━━━

🆓 2 scans gratuits par jour
💎 Premium = scans illimités

━━━━━━━━━━━━`,menu)

})


// SCAN MATCHS

bot.hears("🔎 Scanner les matchs", async (ctx)=>{

const user = ctx.from.id
const isPremium = premiumUsers.has(user)

if(!userStats[user]) userStats[user] = 0

if(!isPremium && userStats[user] >= MAX_FREE_SCANS){

return ctx.reply(`⚠️ Limite gratuite atteinte.

Passe Premium pour accéder aux scans illimités.`)

}

try{

let found = false

for(const league of LEAGUES){

await new Promise(r=>setTimeout(r,2000))

const url = `https://api.the-odds-api.com/v4/sports/${league}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h,totals,btts&oddsFormat=decimal`

const res = await axios.get(url)

const matches = res.data

if(!matches) continue

for(const match of matches){

if(!match.bookmakers) continue

const home = match.home_team
const away = match.away_team

for(const bookmaker of match.bookmakers){

if(!bookmaker.markets) continue

for(const market of bookmaker.markets){

if(!market.outcomes) continue

for(const outcome of market.outcomes){

const odds = outcome.price
const pick = outcome.name

if(!odds || odds < 1.30 || odds > 3.2) continue

const bookProb = 1 / odds

let aiProb = bookProb

if(odds >= 3) aiProb *= 1.30
else if(odds >= 2) aiProb *= 1.20

if(aiProb > 0.82) aiProb = 0.82

const edge = (aiProb * odds) - 1

if(aiProb > 0.62 && edge > 0.15){

found = true

if(!isPremium){
userStats[user]++
}

ctx.reply(`🔥 VALUE BET IA

🏆 ${home} vs ${away}

🎯 Pick : ${pick}

📊 Probabilité IA : ${(aiProb*100).toFixed(1)}%
📉 Probabilité Book : ${(bookProb*100).toFixed(1)}%

💰 Cote : ${odds}
📈 Edge : ${(edge*100).toFixed(1)}%`)

}

}

}

}

}

}

if(!found){

ctx.reply(`❌ Aucune value intéressante trouvée.

🔥 Les meilleures analyses sont envoyées automatiquement aux membres Premium.`)

}

}catch(err){

console.log("SCAN ERROR:",err.message)

ctx.reply("❌ Erreur lors du scan.")

}

})


// STATISTIQUES

bot.hears("📊 Mes statistiques",(ctx)=>{

const user = ctx.from.id
const used = userStats[user] || 0
const premium = premiumUsers.has(user)

ctx.reply(`📊 TES STATISTIQUES

Analyses utilisées : ${used}/2

Statut : ${premium ? "💎 Premium" : "🆓 Gratuit"}`)

})


// TOP VALUE

bot.hears("🔥 Top Value Bets",(ctx)=>{

ctx.reply(`🔥 TOP VALUE BETS

Les meilleures analyses sont envoyées automatiquement chaque jour aux membres Premium.`)

})


// PREMIUM

bot.hears("💎 Passer Premium",(ctx)=>{

ctx.reply(`💎 PREMIUM IA VALUE BOT

Accès illimité aux scans
Value bets IA avancées
Alertes automatiques

Clique ici pour t'abonner :

https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00

Une fois le paiement effectué, ton accès Premium sera activé.`)

})


// ALERTE QUOTIDIENNE PREMIUM

async function dailySafeBet(){

try{

for(const league of LEAGUES){

await new Promise(r=>setTimeout(r,2000))

const url = `https://api.the-odds-api.com/v4/sports/${league}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`

const res = await axios.get(url)

const matches = res.data

if(!matches) continue

for(const match of matches){

const home = match.home_team
const away = match.away_team

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odds = outcome.price

if(odds >= 1.30 && odds <= 1.80){

const message = `✅ CONFIANCE MATCH

🏆 ${home} vs ${away}

🎯 Pick : ${outcome.name}

💰 Cote : ${odds}

📊 Confiance IA : Très élevée`

premiumUsers.forEach(user=>{
bot.telegram.sendMessage(user,message)
})

return

}

}

}

}

}

}

}catch(err){

console.log("AUTO BET ERROR",err.message)

}

}

// 1 FOIS PAR JOUR

setInterval(dailySafeBet,86400000)


// TELEGRAM FIX

bot.telegram.deleteWebhook()

bot.launch()

console.log("✅ BOT LANCÉ")

process.once("SIGINT",()=>bot.stop("SIGINT"))
process.once("SIGTERM",()=>bot.stop("SIGTERM"))
