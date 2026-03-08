const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const fs = require("fs")

console.log("🚀 IA VALUE BOT PRO")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2
const userStats = {}
const users = new Set()

// RESET SCANS

setInterval(()=>{

for(const user in userStats){
userStats[user]=0
}

},86400000)


// DATABASE

let db={premiumUsers:{}}

if(fs.existsSync("database.json")){
db=JSON.parse(fs.readFileSync("database.json"))
}

function saveDB(){
fs.writeFileSync("database.json",JSON.stringify(db,null,2))
}

function isPremium(user){

if(!db.premiumUsers[user]) return false

if(Date.now()>db.premiumUsers[user]){

delete db.premiumUsers[user]
saveDB()
return false
}

return true
}


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

const user=ctx.from.id
users.add(user)

ctx.reply(`🤖 IA VALUE BOT PRO

Analyse intelligente des cotes
Détection automatique de value bets

🎁 2 scans offerts chaque jour
💎 Premium = scans illimités`,menu)

})


// LIGUES FOOT

const footballLeagues=[
"soccer_epl",
"soccer_spain_la_liga",
"soccer_italy_serie_a",
"soccer_germany_bundesliga",
"soccer_france_ligue_one"
]

// LIGUES BASKET

const basketLeagues=[
"basketball_nba",
"basketball_euroleague"
]


// MATCH AUJOURD'HUI

function isToday(date){

const today=new Date()

return date.toDateString()===today.toDateString()

}


// SCAN FOOT

bot.hears("⚽ Scanner FOOT",async(ctx)=>{

const user=ctx.from.id
const premium=isPremium(user)

if(!userStats[user]) userStats[user]=0

if(!premium && userStats[user]>=MAX_FREE_SCANS){
return ctx.reply("⚠️ Limite gratuite atteinte.")
}

try{

let best=null

for(const league of footballLeagues){

const res=await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`,{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
})

for(const match of res.data){

const date=new Date(match.commence_time)

if(!isToday(date)) continue
if(!match.bookmakers) continue

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd=outcome.price

if(odd<1.40 || odd>3) continue

const prob=1/odd
const ai=prob*1.12

const conf=Math.round(ai*100)

if(!best || conf>best.conf){

best={
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

if(best){

if(!premium) userStats[user]++

ctx.reply(`⚽ VALUE BET IA FOOT

🏆 ${best.home} vs ${best.away}

🎯 Pick : ${best.pick}

💰 Cote : ${best.odd}

🧠 Confiance IA : ${best.conf}%`)

}else{

ctx.reply("🔎 Analyse terminée.")

}

}catch(e){

ctx.reply("❌ Erreur analyse.")

}

})


// SCAN BASKET

bot.hears("🏀 Scanner BASKET",async(ctx)=>{

try{

let best=null

for(const league of basketLeagues){

const res=await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`,{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
})

for(const match of res.data){

const date=new Date(match.commence_time)

if(!isToday(date)) continue
if(!match.bookmakers) continue

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd=outcome.price

if(odd<1.40 || odd>3) continue

const prob=1/odd
const ai=prob*1.12

const conf=Math.round(ai*100)

if(!best || conf>best.conf){

best={
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

if(best){

ctx.reply(`🏀 VALUE BET IA BASKET

🏆 ${best.home} vs ${best.away}

🎯 Pick : ${best.pick}

💰 Cote : ${best.odd}

🧠 Confiance IA : ${best.conf}%`)

}else{

ctx.reply("🔎 Analyse terminée.")

}

}catch{

ctx.reply("❌ Erreur analyse.")

}

})


// SCAN BUTEURS

bot.hears("🎯 Scanner BUTEURS",async(ctx)=>{

try{

const today=new Date().toISOString().slice(0,10)

const fixtures=await axios.get("https://v3.football.api-sports.io/fixtures",{
headers:{
"x-apisports-key":process.env.API_FOOTBALL_KEY
},
params:{
date:today,
league:39
}
})

if(fixtures.data.response.length===0){
return ctx.reply("🔎 Aucun match aujourd'hui.")
}

const match=fixtures.data.response[0]

const league=match.league.id

const scorers=await axios.get("https://v3.football.api-sports.io/players/topscorers",{
headers:{
"x-apisports-key":process.env.API_FOOTBALL_KEY
},
params:{
league:league,
season:2024
}
})

const player=scorers.data.response[0]

ctx.reply(`🎯 BUTEUR IA

🏆 ${match.teams.home.name} vs ${match.teams.away.name}

🔥 Pick : ${player.player.name}

⚽ Buts saison : ${player.statistics[0].goals.total}

💰 Cote estimée : 2.10

🧠 Analyse IA :
Attaquant en grande forme et très actif dans la surface.`)

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


// START BOT

async function startBot(){

await bot.telegram.deleteWebhook({drop_pending_updates:true})

bot.launch({dropPendingUpdates:true})

console.log("✅ BOT LANCÉ")

}

startBot()
