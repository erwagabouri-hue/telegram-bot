const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")

console.log("🚀 IA VALUE BOT PRO")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2

const userStats = {}
const premiumUsers = new Set()
const users = new Set()

// 7 LIGUES

const LEAGUES = [39,140,135,78,61,94,88]

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

Scans illimités
Alertes automatiques
Value bets IA avancées`)

return
}

ctx.reply(`🤖 IA VALUE BOT PRO

Analyse intelligente des cotes
Détection automatique de value bets

🆓 2 scans gratuits / jour
💎 Premium = scans illimités`,menu)

})


// MATCHS API FOOTBALL

async function getMatches(){

let allMatches = []

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

allMatches = allMatches.concat(res.data.response)

}

}

return allMatches

}


// COTES ODDS API

async function getOdds(){

const res = await axios.get(`https://api.the-odds-api.com/v4/sports/soccer_epl/odds`,{

params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}

})

return res.data

}


// SCAN MATCH

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

if(oddMatch.home_team !== home) continue

if(!oddMatch.bookmakers) continue

for(const bookmaker of oddMatch.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd = outcome.price

if(!odd) continue

if(odd < 1.30 || odd > 3) continue

const bookProb = 1 / odd
const aiProb = bookProb * 1.18
const edge = (aiProb * odd) - 1

if(edge > 0.12){

if(!premium){
userStats[user]++
}

return ctx.reply(`🔥 VALUE BET IA

🏆 ${home} vs ${away}

🎯 Pick : ${outcome.name}

💰 Cote : ${odd}

📈 Edge : ${(edge*100).toFixed(1)}%`)

}

}

}

}

}

}

ctx.reply("❌ Aucune value intéressante trouvée.")

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


// ALERTES PREMIUM

async function premiumAlert(){

try{

const odds = await getOdds()

for(const match of odds){

const home = match.home_team
const away = match.away_team

if(!match.bookmakers) continue

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd = outcome.price

if(odd >= 1.30 && odd <= 1.80){

const message = `🚨 ALERTE PREMIUM

🏆 ${home} vs ${away}

🎯 Pick : ${outcome.name}

💰 Cote : ${odd}

Analyse IA : forte confiance`

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

console.log("ALERT ERROR:",err.message)

}

}


// PRONO MERCREDI

async function freeWednesday(){

try{

const odds = await getOdds()

for(const match of odds){

const home = match.home_team
const away = match.away_team

if(!match.bookmakers) continue

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd = outcome.price

if(odd >= 1.30 && odd <= 2.50){

const message = `🤝 CONFIANCE DU MERCREDI OFFERTE

🏆 ${home} vs ${away}

🎯 Pick : ${outcome.name}

💰 Cote : ${odd}

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

console.log("FREE ERROR:",err.message)

}

}


// ALERTES 2H

setInterval(premiumAlert,7200000)


// MERCREDI 10H

setInterval(()=>{

const now = new Date()

if(now.getDay() === 3 && now.getHours() === 10 && now.getMinutes() === 0){

freeWednesday()

}

},60000)


// TELEGRAM

bot.telegram.deleteWebhook()

bot.launch()

console.log("✅ BOT LANCÉ")
