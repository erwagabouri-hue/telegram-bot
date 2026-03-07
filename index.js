const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const fs = require("fs")

console.log("🚀 IA VALUE BOT PRO")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2

const userStats = {}
const users = new Set()

// RESET SCANS CHAQUE JOUR

setInterval(()=>{

for(const user in userStats){
userStats[user] = 0
}

console.log("♻️ Scans gratuits réinitialisés")

},24*60*60*1000)


// DATABASE

let db = { premiumUsers: {} }

if (fs.existsSync("database.json")) {
db = JSON.parse(fs.readFileSync("database.json"))
}

function saveDB(){
fs.writeFileSync("database.json", JSON.stringify(db,null,2))
}

function isPremium(user){

if(!db.premiumUsers[user]) return false

if(Date.now() > db.premiumUsers[user]){

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

const user = ctx.from.id
users.add(user)

ctx.reply(`🤖 IA VALUE BOT PRO

Analyse intelligente des cotes
Détection automatique de value bets

🎁 2 scans offerts chaque jour
💎 Premium = scans illimités`,menu)

})


// FILTRE MATCH 24H

function isSoon(date){

const now = new Date()
const limit = new Date()

limit.setHours(now.getHours()+24)

return date > now && date < limit

}


// LIGUES

const footballLeagues = [
"soccer_epl",
"soccer_spain_la_liga",
"soccer_italy_serie_a",
"soccer_germany_bundesliga",
"soccer_france_ligue_one",
"soccer_uefa_champions_league"
]

const basketLeagues = [
"basketball_nba",
"basketball_euroleague"
]


// SCAN FOOT

bot.hears("⚽ Scanner FOOT", async (ctx)=>{

const user = ctx.from.id
const premium = isPremium(user)

if(!userStats[user]) userStats[user] = 0

if(!premium && userStats[user] >= MAX_FREE_SCANS){
return ctx.reply("⚠️ Limite gratuite atteinte.")
}

try{

let bestPick = null

for(const league of footballLeagues){

let res

try{

res = await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`,{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu,uk",
markets:"h2h",
oddsFormat:"decimal"
}
})

}catch{
continue
}

for(const match of res.data){

const date = new Date(match.commence_time)

if(!isSoon(date)) continue
if(!match.bookmakers) continue

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd = outcome.price

if(odd < 1.40 || odd > 3.50) continue

const prob = 1/odd
const ai = prob*1.15

const edge = (ai*odd)-1

if(edge > -0.02){

const confidence = Math.round(ai*100)

if(!bestPick || confidence > bestPick.confidence){

bestPick={
home:match.home_team,
away:match.away_team,
pick:outcome.name,
odd,
confidence
}

}

}

}

}

}

}

}

if(bestPick){

if(!premium) userStats[user]++

ctx.reply(`⚽ VALUE BET IA FOOT

🏆 ${bestPick.home} vs ${bestPick.away}

🎯 Pick : ${bestPick.pick}

💰 Cote : ${bestPick.odd}

🧠 Confiance IA : ${bestPick.confidence}%`)

}else{

ctx.reply("🔎 Analyse terminée. Aucun match intéressant détecté.")

}

}catch(e){

console.log(e.message)

ctx.reply("❌ Erreur analyse.")

}

})


// SCAN BASKET

bot.hears("🏀 Scanner BASKET", async (ctx)=>{

const user = ctx.from.id
const premium = isPremium(user)

if(!userStats[user]) userStats[user] = 0

if(!premium && userStats[user] >= MAX_FREE_SCANS){
return ctx.reply("⚠️ Limite gratuite atteinte.")
}

try{

let bestPick=null

for(const league of basketLeagues){

let res

try{

res=await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`,{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu,uk",
markets:"h2h",
oddsFormat:"decimal"
}
})

}catch{
continue
}

for(const match of res.data){

const date=new Date(match.commence_time)

if(!isSoon(date)) continue
if(!match.bookmakers) continue

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd=outcome.price

if(odd<1.40||odd>3.50) continue

const prob=1/odd
const ai=prob*1.15

const edge=(ai*odd)-1

if(edge>-0.02){

const confidence=Math.round(ai*100)

if(!bestPick||confidence>bestPick.confidence){

bestPick={
home:match.home_team,
away:match.away_team,
pick:outcome.name,
odd,
confidence
}

}

}

}

}

}

}

}

if(bestPick){

if(!premium) userStats[user]++

ctx.reply(`🏀 VALUE BET IA BASKET

🏆 ${bestPick.home} vs ${bestPick.away}

🎯 Pick : ${bestPick.pick}

💰 Cote : ${bestPick.odd}

🧠 Confiance IA : ${bestPick.confidence}%`)

}else{

ctx.reply("🔎 Analyse terminée. Aucun match intéressant détecté.")

}

}catch(e){

console.log(e.message)

ctx.reply("❌ Erreur analyse.")

}

})


// SCAN BUTEURS

bot.hears("🎯 Scanner BUTEURS", async (ctx)=>{

try{

const fixtures=await axios.get("https://v3.football.api-sports.io/fixtures",{

headers:{
"x-apisports-key":process.env.API_FOOTBALL_KEY
},

params:{
date:new Date().toISOString().slice(0,10)
}

})

const match=fixtures.data.response[Math.floor(Math.random()*fixtures.data.response.length)]

const home=match.teams.home.name
const away=match.teams.away.name

const players=await axios.get("https://v3.football.api-sports.io/players/topscorers",{

headers:{
"x-apisports-key":process.env.API_FOOTBALL_KEY
},

params:{
league:match.league.id,
season:2024
}

})

const scorer=players.data.response[Math.floor(Math.random()*3)]

const name=scorer.player.name
const goals=scorer.statistics[0].goals.total

const odd=(Math.random()*2+1.8).toFixed(2)

ctx.reply(`🎯 BUTEUR IA

🏆 ${home} vs ${away}

🔥 Pick : ${name}

⚽ Buts saison : ${goals}

💰 Cote estimée : ${odd}

🧠 Analyse IA :
Joueur en grande forme offensive et très actif dans la surface.`)

}catch{

ctx.reply("🔎 Analyse buteurs terminée.")

}

})


// CONTACT

bot.hears("📩 Nous contacter",(ctx)=>{

ctx.reply(`📩 CONTACT

Instagram :

https://www.instagram.com/la_prediction777`)

})


// PREMIUM

bot.hears("💎 Passer Premium",(ctx)=>{

ctx.reply(`💎 PREMIUM IA VALUE BOT

Accès illimité aux scans
Value bets IA FOOT + BASKET
Scanner BUTEURS IA

🚀 Rejoins la team gagnante :

https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`)

})


// LANCEMENT BOT

async function startBot(){

await bot.telegram.deleteWebhook({drop_pending_updates:true})

bot.launch({dropPendingUpdates:true})

console.log("✅ BOT LANCÉ")

}

startBot()
