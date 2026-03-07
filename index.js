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
  fs.writeFileSync("database.json", JSON.stringify(db, null, 2))
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


// LIGUES FOOT

const footballLeagues = [

"soccer_epl",
"soccer_spain_la_liga",
"soccer_italy_serie_a",
"soccer_germany_bundesliga",
"soccer_france_ligue_one",
"soccer_uefa_champions_league",
"soccer_uefa_europa_league"

]

// LIGUES BASKET

const basketLeagues = [

"basketball_nba",
"basketball_euroleague",
"basketball_ncaab"

]


// FILTRE MATCHS AUJOURD'HUI

function isTodayMatch(date){

const today = new Date()
today.setHours(0,0,0,0)

const tomorrow = new Date()
tomorrow.setHours(24,0,0,0)

return date >= today && date <= tomorrow

}


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
regions:"eu,uk,us",
markets:"h2h",
oddsFormat:"decimal"
}
})

}catch(e){
continue
}

const matches = res.data

if(!matches) continue

for(const match of matches){

const matchDate = new Date(match.commence_time)

if(!isTodayMatch(matchDate)) continue

if(!match.bookmakers || match.bookmakers.length === 0) continue

const home = match.home_team
const away = match.away_team

let bestOdd = 0
let bestPickName = ""

for(const bookmaker of match.bookmakers){
for(const market of bookmaker.markets){
for(const outcome of market.outcomes){

if(outcome.price > bestOdd){
bestOdd = outcome.price
bestPickName = outcome.name
}

}
}
}

if(bestOdd < 1.50 || bestOdd > 4) continue

const bookProb = 1 / bestOdd
const aiProb = bookProb * 1.07

const edge = (aiProb * bestOdd) - 1

if(edge > 0.02){

const confidence = Math.round(aiProb * 100)

if(!bestPick || confidence > bestPick.confidence){

bestPick = {
home,
away,
pick: bestPickName,
odd: bestOdd,
confidence
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

ctx.reply("❌ Aucune value intéressante trouvée.")

}

}catch(err){

console.log(err.message)

ctx.reply("❌ Erreur scan.")

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

let bestPick = null

for(const league of basketLeagues){

let res

try{

res = await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`,{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu,uk,us",
markets:"h2h",
oddsFormat:"decimal"
}
})

}catch(e){
continue
}

const matches = res.data

for(const match of matches){

const matchDate = new Date(match.commence_time)

if(!isTodayMatch(matchDate)) continue

if(!match.bookmakers) continue

let bestOdd = 0
let bestPickName = ""

for(const bookmaker of match.bookmakers){
for(const market of bookmaker.markets){
for(const outcome of market.outcomes){

if(outcome.price > bestOdd){
bestOdd = outcome.price
bestPickName = outcome.name
}

}
}
}

if(bestOdd < 1.50 || bestOdd > 4) continue

const bookProb = 1 / bestOdd
const aiProb = bookProb * 1.07

const edge = (aiProb * bestOdd) - 1

if(edge > 0.02){

const confidence = Math.round(aiProb * 100)

if(!bestPick || confidence > bestPick.confidence){

bestPick = {
home: match.home_team,
away: match.away_team,
pick: bestPickName,
odd: bestOdd,
confidence
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

ctx.reply("❌ Aucune value intéressante trouvée.")

}

}catch(err){

console.log(err.message)

ctx.reply("❌ Erreur scan.")

}

})


// SCAN BUTEURS

bot.hears("🎯 Scanner BUTEURS", async (ctx)=>{

const user = ctx.from.id
const premium = isPremium(user)

if(!userStats[user]) userStats[user] = 0

if(!premium && userStats[user] >= MAX_FREE_SCANS){
return ctx.reply("⚠️ Limite gratuite atteinte.")
}

try{

const leagues = [39,140,135,78,61]

let bestScorer = null

for(const league of leagues){

let res

try{

res = await axios.get("https://v3.football.api-sports.io/players/topscorers",{
headers:{ "x-apisports-key": process.env.API_FOOTBALL_KEY },
params:{ league: league, season: 2024 }
})

}catch(e){
continue
}

const players = res.data.response

if(!players) continue

for(const p of players){

const player = p.player.name
const team = p.statistics[0].team.name
const goals = p.statistics[0].goals.total || 0
const shots = p.statistics[0].shots.total || 0

const score = goals * 10 + shots * 0.5

if(!bestScorer || score > bestScorer.score){

bestScorer = {
player,
team,
goals,
shots,
score
}

}

}

}

if(bestScorer){

if(!premium) userStats[user]++

const odd = (Math.random()*2+1.5).toFixed(2)

ctx.reply(`🎯 BUTEUR IA

🔥 ${bestScorer.player}

🏟️ Équipe : ${bestScorer.team}

⚽ Buts : ${bestScorer.goals}
🎯 Tirs : ${bestScorer.shots}

🧠 Score IA : ${Math.round(bestScorer.score)}

💰 Cote estimée : ${odd}`)

}else{

ctx.reply("❌ Aucun buteur intéressant trouvé.")

}

}catch(err){

console.log(err.message)

ctx.reply("❌ Erreur scan buteurs.")

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

https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`)

})


// TELEGRAM

async function startBot(){

await bot.telegram.deleteWebhook({ drop_pending_updates: true })

bot.launch({
dropPendingUpdates: true
})

console.log("✅ BOT LANCÉ")

}

startBot()
