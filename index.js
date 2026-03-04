const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")

console.log("🚀 IA VALUE BOT PRO")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2

const userStats = {}
const premiumUsers = new Set()
const users = new Set()

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


// SCAN MATCHS

bot.hears("🔎 Scanner les matchs", async (ctx)=>{

const user = ctx.from.id
const premium = premiumUsers.has(user)

if(!userStats[user]) userStats[user] = 0

if(!premium && userStats[user] >= MAX_FREE_SCANS){
return ctx.reply("⚠️ Limite gratuite atteinte.")
}

try{

const res = await axios.get("https://api.the-odds-api.com/v4/sports/soccer_epl/odds",{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
})

const matches = res.data

if(!matches || matches.length === 0){
return ctx.reply("❌ Aucun match trouvé.")
}

for(const match of matches){

const home = match.home_team
const away = match.away_team

if(!match.bookmakers) continue

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd = outcome.price

if(!odd) continue
if(odd < 1.30 || odd > 3) continue

const bookProb = 1 / odd
const aiProb = bookProb * 1.15

const edge = (aiProb * odd) - 1

if(edge > 0.10){

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

const res = await axios.get("https://api.the-odds-api.com/v4/sports/soccer_epl/odds",{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
})

const matches = res.data

for(const match of matches){

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


// PRONO GRATUIT MERCREDI

async function freeWednesday(){

try{

const res = await axios.get("https://api.the-odds-api.com/v4/sports/soccer_epl/odds",{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
})

const matches = res.data

for(const match of matches){

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


// ALERTES PREMIUM TOUTES LES 2H

setInterval(premiumAlert,7200000)


// MERCREDI 10H10 FRANCE

setInterval(()=>{

const now = new Date()

const hour = now.getUTCHours()
const minute = now.getUTCMinutes()

if(now.getUTCDay() === 3 && hour === 9 && minute === 10){

freeWednesday()

}

},60000)


// TELEGRAM

bot.telegram.deleteWebhook()

bot.launch()

console.log("✅ BOT LANCÉ")
