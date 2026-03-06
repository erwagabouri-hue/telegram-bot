const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const fs = require("fs")

console.log("🚀 IA VALUE BOT PRO")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2

const userStats = {}
const users = new Set()

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

const menu = Markup.keyboard([
["⚽ Scanner FOOT"],
["🏀 Scanner BASKET"],
["🎯 Scanner BUTEURS IA"],
["👑 Meilleurs cotes IA"],
["📩 Nous contacter"],
["💎 Passer Premium"]
]).resize()

bot.start((ctx)=>{

const user = ctx.from.id
users.add(user)

const param = ctx.startPayload

if(param === "premium"){

const expire = Date.now() + (30*24*60*60*1000)

db.premiumUsers[user] = expire
saveDB()

ctx.reply(`👑 Bienvenue dans la Team Gagnante !

Ton accès Premium est activé pour 30 jours.

Scans illimités
Alertes automatiques
Value bets IA avancées`)

return
}

ctx.reply(`🤖 IA VALUE BOT PRO

Analyse intelligente des cotes
Détection automatique de value bets

🎁 2 scans offerts chaque jour
💎 Premium = scans illimités`,menu)

})

const footballLeagues = [
"soccer_epl",
"soccer_spain_la_liga",
"soccer_italy_serie_a",
"soccer_germany_bundesliga",
"soccer_france_ligue_one",
"soccer_uefa_champions_league",
"soccer_uefa_europa_league"
]

const basketLeagues = [
"basketball_nba",
"basketball_euroleague",
"basketball_ncaab"
]

const scorerLeagues = [
39,
140,
135,
78,
61
]

bot.hears("⚽ Scanner FOOT", async (ctx)=>{

const user = ctx.from.id
const premium = isPremium(user)

if(!userStats[user]) userStats[user] = 0

if(!premium && userStats[user] >= MAX_FREE_SCANS){
return ctx.reply("⚠️ Limite gratuite atteinte.")
}

try{

let bestPick = null
let bestEdge = 0

for(const league of footballLeagues){

const res = await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`,{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
})

const matches = res.data

if(!matches) continue

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

if(edge > bestEdge){

bestEdge = edge

bestPick = {
home,
away,
pick: outcome.name,
odd,
confidence: Math.round(aiProb*100)
}

}

}

}

}

}

}

if(!bestPick){
return ctx.reply("❌ Aucun match intéressant trouvé.")
}

if(!premium){
userStats[user]++
}

ctx.reply(`⚽ VALUE BET IA

🏆 ${bestPick.home} vs ${bestPick.away}

🎯 Pick : ${bestPick.pick}

💰 Cote : ${bestPick.odd}

🧠 Confiance IA : ${bestPick.confidence}%`)

}catch(err){

console.log(err.message)
ctx.reply("❌ Erreur scan.")

}

})

bot.hears("🏀 Scanner BASKET", async (ctx)=>{

try{

let bestPick = null
let bestEdge = 0

for(const league of basketLeagues){

const res = await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`,{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
})

const matches = res.data

if(!matches) continue

for(const match of matches){

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

const odd = outcome.price

if(odd < 1.30 || odd > 3) continue

const bookProb = 1 / odd
const aiProb = bookProb * 1.15
const edge = (aiProb * odd) - 1

if(edge > bestEdge){

bestEdge = edge

bestPick = {
home: match.home_team,
away: match.away_team,
pick: outcome.name,
odd,
confidence: Math.round(aiProb*100)
}

}

}

}

}

}

}

if(!bestPick){
return ctx.reply("❌ Aucun match basket intéressant.")
}

ctx.reply(`🏀 VALUE BET IA

🏆 ${bestPick.home} vs ${bestPick.away}

🎯 Pick : ${bestPick.pick}

💰 Cote : ${bestPick.odd}

🧠 Confiance IA : ${bestPick.confidence}%`)

}catch(err){

console.log(err.message)
ctx.reply("❌ Erreur scan basket.")

}

})

bot.hears("🎯 Scanner BUTEURS IA", async (ctx)=>{

try{

let bestPlayer = null
let bestRatio = 0

for(const league of scorerLeagues){

const res = await axios.get("https://v3.football.api-sports.io/players/topscorers",{
headers:{
"x-apisports-key":process.env.API_FOOTBALL_KEY
},
params:{
league:league,
season:2024
}
})

const players = res.data.response

for(const p of players){

const goals = p.statistics[0].goals.total
const games = p.statistics[0].games.appearences

if(!goals || !games) continue

const ratio = goals/games

if(ratio > bestRatio){

bestRatio = ratio

bestPlayer = {
name: p.player.name,
team: p.statistics[0].team.name,
goals,
games,
ratio: ratio.toFixed(2)
}

}

}

}

if(!bestPlayer){
return ctx.reply("❌ Aucun buteur intéressant trouvé.")
}

const confidence = Math.min(90,Math.round(bestRatio*100))

ctx.reply(`🎯 MEILLEUR BUTEUR IA

👤 Joueur : ${bestPlayer.name}
🏟 Équipe : ${bestPlayer.team}

⚽ Buts : ${bestPlayer.goals}
📊 Matchs : ${bestPlayer.games}

📈 Ratio buts/match : ${bestPlayer.ratio}

🎯 Pick IA :
${bestPlayer.name} BUTEUR

💰 Cote estimée : 2.10
🧠 Confiance IA : ${confidence}%`)

}catch(err){

console.log(err.message)
ctx.reply("❌ Erreur scanner buteurs.")

}

})

bot.hears("👑 Meilleurs cotes IA",(ctx)=>{

ctx.reply(`👑 MEILLEURS COTES IA

Les meilleures analyses IA sont réservées aux membres Premium.

💎 Accès Premium :

⚽ scans illimités
🏀 basket
🎯 buteurs IA
🚨 alertes exclusives

https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`)

})

bot.hears("📩 Nous contacter",(ctx)=>{

ctx.reply(`📩 CONTACT

Instagram :

https://www.instagram.com/la_prediction777`)

})

bot.hears("💎 Passer Premium",(ctx)=>{

ctx.reply(`💎 PREMIUM IA VALUE BOT

Accès illimité aux scans
Value bets IA avancées

Rejoins la team gagnante :

https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`)

})

setInterval(()=>{

const now = new Date()

if(now.getUTCHours() === 23 && now.getUTCMinutes() === 0){

for(const user in userStats){
userStats[user] = 0
}

console.log("RESET SCANS")

}

},60000)

async function startBot(){

await bot.telegram.deleteWebhook({drop_pending_updates:true})

bot.launch({
dropPendingUpdates:true
})

console.log("BOT LANCÉ")

}

startBot()
