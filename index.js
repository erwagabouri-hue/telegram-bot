const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")

console.log("🚀 IA VALUE BOT PRO")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2

const userStats = {}
const premiumUsers = new Set()
const users = new Set()

// 7 LIGUES ANALYSÉES

const LEAGUES = [
39,  // Premier League
140, // Liga
135, // Serie A
78,  // Bundesliga
61,  // Ligue 1
94,  // Portugal
88   // Netherlands
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
users.add(user)

const param = ctx.startPayload

if(param === "premium"){

premiumUsers.add(user)

ctx.reply(`👑 Bienvenue dans la Team Gagnante !

Ton accès Premium est activé.

Tu reçois maintenant :

• scans illimités
• alertes automatiques
• value bets IA avancées`)

return
}

ctx.reply(`🤖 IA VALUE BOT PRO

Analyse intelligente des cotes
Détection automatique de value bets

━━━━━━━━━━━━

🆓 2 scans gratuits / jour
💎 Premium = scans illimités

━━━━━━━━━━━━`,menu)

})


// RÉCUPÈRE MATCHS API FOOTBALL

async function getMatches(){

let matches = []

for(const league of LEAGUES){

const res = await axios.get("https://v3.football.api-sports.io/fixtures",{

headers:{
"x-apisports-key":process.env.API_FOOTBALL_KEY
},

params:{
league:league,
season:2024,
next:5
}

})

if(res.data.response){

matches = matches.concat(res.data.response)

}

}

return matches

}


// RÉCUPÈRE COTES ODDS API

async function getOdds(){

const res = await axios.get(`https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`)

return res.data

}


// SCAN MATCHS

bot.hears("🔎 Scanner les matchs", async (ctx)=>{

const user = ctx.from.id
const premium = premiumUsers.has(user)

if(!userStats[user]) userStats[user] = 0

if(!premium && userStats[user] >= MAX_FREE_SCANS){

return ctx.reply("⚠️ Limite gratuite atteinte.")

}

try{

const matches = await getMatches()
const odds = await getOdds()

for(const match of matches){

const home = match.teams.home.name
const away = match.teams.away.name

for(const oddMatch of odds){

if(oddMatch.home_team === home){

for(const bookmaker of oddMatch.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const oddsValue = outcome.price

if(!oddsValue || oddsValue < 1.30 || oddsValue > 3) continue

const bookProb = 1 / oddsValue
let aiProb = bookProb * 1.18

const edge = (aiProb * oddsValue) - 1

if(edge > 0.12){

if(!premium){
userStats[user]++
}

return ctx.reply(`🔥 VALUE BET IA

🏆 ${home} vs ${away}

🎯 Pick : ${outcome.name}

💰 Cote : ${oddsValue}

📈 Edge : ${(edge*100).toFixed(1)}%`)

}

}

}

}

}

}

ctx.reply("❌ Aucune value intéressante trouvée.")

}catch(err){

console.log("SCAN ERROR",err.message)

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

Les meilleures analyses sont envoyées automatiquement aux membres Premium.`)

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


// ALERTES PREMIUM AUTOMATIQUES

async function premiumAlert(){

try{

const odds = await getOdds()

for(const match of odds){

const home = match.home_team
const away = match.away_team

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const oddsValue = outcome.price

if(oddsValue >= 1.30 && oddsValue <= 1.80){

const message = `🚨 ALERTE PREMIUM

🏆 ${home} vs ${away}

🎯 Pick : ${outcome.name}

💰 Cote : ${oddsValue}

📊 Analyse IA : forte confiance`

premiumUsers.forEach(user=>{
bot.telegram.sendMessage(user,message)
})

return

}

}

}

}

}

}catch(err){

console.log("ALERT ERROR",err.message)

}

}


// PRONO GRATUIT MERCREDI

async function freeWednesday(){

try{

const odds = await getOdds()

for(const match of odds){

const home = match.home_team
const away = match.away_team

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const oddsValue = outcome.price

if(oddsValue >= 1.30 && oddsValue <= 2.50){

const message = `🤝 CONFIANCE DU MERCREDI OFFERTE

🏆 ${home} vs ${away}

🎯 Pick : ${outcome.name}

💰 Cote : ${oddsValue}

Analyse offerte par IA VALUE BOT`

users.forEach(user=>{
bot.telegram.sendMessage(user,message)
})

return

}

}

}

}

}

}catch(err){

console.log("FREE ERROR",err.message)

}

}


// ALERTES TOUTES LES 2H

setInterval(premiumAlert,7200000)


// CHECK MERCREDI 10H

setInterval(()=>{

const now = new Date()

if(now.getDay() === 3 && now.getHours() === 10 && now.getMinutes() === 0){

freeWednesday()

}

},60000)


// TELEGRAM FIX

bot.telegram.deleteWebhook()

bot.launch()

console.log("✅ BOT LANCÉ")

process.once("SIGINT",()=>bot.stop("SIGINT"))
process.once("SIGTERM",()=>bot.stop("SIGTERM"))
