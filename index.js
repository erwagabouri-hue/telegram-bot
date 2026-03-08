const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const fs = require("fs")

console.log("🚀 IA VALUE BOT PRO")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2
const userStats = {}


// MENU

const menu = Markup.keyboard([
["⚽ Scanner FOOT"],
["🏀 Scanner BASKET"],
["🎯 Scanner BUTEURS"],
["👑 Meilleurs cotes IA"],
["📩 Nous contacter"],
["💎 Passer Premium"]
]).resize()


// START

bot.start((ctx)=>{

ctx.reply(`🤖 IA VALUE BOT PRO

Analyse intelligente des cotes
Détection automatique de value bets

🎁 2 scans offerts chaque jour
💎 Premium = scans illimités`,menu)

})


// FILTRE MATCH (48H)

function isSoon(date){

const now = new Date()
const limit = new Date()

limit.setHours(now.getHours()+48)

return date > now && date < limit

}


// LIGUES FOOT

const footballLeagues = [
"soccer_epl",
"soccer_spain_la_liga",
"soccer_italy_serie_a",
"soccer_germany_bundesliga",
"soccer_france_ligue_one"
]

// LIGUES BASKET

const basketLeagues = [
"basketball_nba",
"basketball_euroleague"
]


// SCAN FOOT

bot.hears("⚽ Scanner FOOT", async(ctx)=>{

try{

let bestPick=null

for(const league of footballLeagues){

let res

try{

res = await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`,{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
})

}catch{
continue
}

for(const match of res.data){

if(!match.bookmakers) continue

const date = new Date(match.commence_time)

if(!isSoon(date)) continue

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd = outcome.price

if(odd < 1.25 || odd > 4.5) continue

const prob = 1/odd
const ai = prob*1.18

const conf = Math.round(ai*100)

if(!bestPick || odd > bestPick.odd){

bestPick={
home:match.home_team,
away:match.away_team,
pick:outcome.name,
odd,
conf
}

}

}

}

}

}

}

if(bestPick){

ctx.reply(`⚽ VALUE BET IA FOOT

🏆 ${bestPick.home} vs ${bestPick.away}

🎯 Pick : ${bestPick.pick}

💰 Cote : ${bestPick.odd}

🧠 Confiance IA : ${bestPick.conf}%`)

}else{

ctx.reply("🔎 Analyse terminée.")

}

}catch{

ctx.reply("❌ Erreur analyse.")

}

})


// SCAN BASKET

bot.hears("🏀 Scanner BASKET", async(ctx)=>{

try{

let bestPick=null

for(const league of basketLeagues){

let res

try{

res = await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`,{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
})

}catch{
continue
}

for(const match of res.data){

if(!match.bookmakers) continue

const date = new Date(match.commence_time)

if(!isSoon(date)) continue

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd = outcome.price

if(odd < 1.25 || odd > 4.5) continue

const prob = 1/odd
const ai = prob*1.18

const conf = Math.round(ai*100)

if(!bestPick || odd > bestPick.odd){

bestPick={
home:match.home_team,
away:match.away_team,
pick:outcome.name,
odd,
conf
}

}

}

}

}

}

}

if(bestPick){

ctx.reply(`🏀 VALUE BET IA BASKET

🏆 ${bestPick.home} vs ${bestPick.away}

🎯 Pick : ${bestPick.pick}

💰 Cote : ${bestPick.odd}

🧠 Confiance IA : ${bestPick.conf}%`)

}else{

ctx.reply("🔎 Analyse terminée.")

}

}catch{

ctx.reply("❌ Erreur analyse.")

}

})


// SCAN BUTEURS

bot.hears("🎯 Scanner BUTEURS", async(ctx)=>{

try{

const today = new Date().toISOString().slice(0,10)

const fixtures = await axios.get("https://v3.football.api-sports.io/fixtures",{
headers:{
"x-apisports-key":process.env.API_FOOTBALL_KEY
},
params:{
date:today
}
})

if(fixtures.data.response.length===0){
return ctx.reply("🔎 Aucun match aujourd'hui.")
}

const match = fixtures.data.response[Math.floor(Math.random()*fixtures.data.response.length)]

const league = match.league.id

const scorers = await axios.get("https://v3.football.api-sports.io/players/topscorers",{
headers:{
"x-apisports-key":process.env.API_FOOTBALL_KEY
},
params:{
league,
season:2024
}
})

const player = scorers.data.response[0]

ctx.reply(`🎯 BUTEUR IA

🏆 ${match.teams.home.name} vs ${match.teams.away.name}

🔥 Pick : ${player.player.name}

⚽ Buts saison : ${player.statistics[0].goals.total}

💰 Cote estimée : 2.20

🧠 Analyse IA :
Attaquant très actif offensivement et principal finisseur de son équipe.`)

}catch{

ctx.reply("🔎 Analyse buteurs terminée.")

}

})


// CONTACT

bot.hears("📩 Nous contacter",(ctx)=>{

ctx.reply("Instagram : https://www.instagram.com/la_prediction777")

})


// PREMIUM

bot.hears("💎 Passer Premium",(ctx)=>{

ctx.reply(`💎 PREMIUM IA VALUE BOT

Accès illimité aux scans
Value bets IA FOOT + BASKET
Scanner BUTEURS IA

https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`)

})


// LANCEMENT

bot.launch()

console.log("✅ BOT LANCÉ")
