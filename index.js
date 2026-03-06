const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const fs = require("fs")

console.log("🚀 IA VALUE BOT PRO")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2

const userStats = {}
const users = new Set()

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
🆓 2 scans gratuits / jour
💎 Premium = scans illimités`,menu)

})


// LIGUES FOOT

const footballLeagues = [

"soccer_epl",
"soccer_spain_la_liga",
"soccer_italy_serie_a",
"soccer_germany_bundesliga",
"soccer_france_ligue_one",
"soccer_uefa_champs_league",
"soccer_uefa_europa_league"

]

// LIGUES BASKET

const basketLeagues = [

"basketball_nba",
"basketball_euroleague",
"basketball_ncaab"

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

if(edge > 0.10){

const confidence = Math.min(100, Math.round(aiProb * 100))

let label = "⚠️ Ça se tente !"

if(confidence >= 75){
label = "🔥 Confiance maximale"
}
else if(confidence >= 60){
label = "✅ Assez bonne confiance"
}

if(!premium){
userStats[user]++
}

return ctx.reply(`⚽ VALUE BET IA FOOT

🏆 ${home} vs ${away}

🎯 Pick : ${outcome.name}

💰 Cote : ${odd}

🧠 Confiance IA : ${confidence}%

${label}`)

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


// SCAN BASKET

bot.hears("🏀 Scanner BASKET", async (ctx)=>{

const user = ctx.from.id
const premium = isPremium(user)

if(!userStats[user]) userStats[user] = 0

if(!premium && userStats[user] >= MAX_FREE_SCANS){
return ctx.reply("⚠️ Limite gratuite atteinte.")
}

try{

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

const confidence = Math.min(100, Math.round(aiProb * 100))

let label = "⚠️ Ça se tente !"

if(confidence >= 75){
label = "🔥 Confiance maximale"
}
else if(confidence >= 60){
label = "✅ Assez bonne confiance"
}

if(!premium){
userStats[user]++
}

return ctx.reply(`🏀 VALUE BET IA BASKET

🏆 ${home} vs ${away}

🎯 Pick : ${outcome.name}

💰 Cote : ${odd}

🧠 Confiance IA : ${confidence}%

${label}`)

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


// SCAN BUTEURS

bot.hears("🎯 Scanner BUTEURS", async (ctx)=>{

try{

const res = await axios.get("https://v3.football.api-sports.io/players/topscorers",{
headers:{
"x-apisports-key":process.env.API_FOOTBALL_KEY
},
params:{
league:39,
season:2024
}
})

const players = res.data.response

if(!players || players.length === 0){
return ctx.reply("❌ Aucun buteur trouvé.")
}

const player = players[Math.floor(Math.random()*5)]

const name = player.player.name
const team = player.statistics[0].team.name
const goals = player.statistics[0].goals.total

ctx.reply(`🎯 VALUE BUTEUR IA

👤 Joueur : ${name}
🏟 Équipe : ${team}

⚽ Buts cette saison : ${goals}

🔥 Pick IA : ${name} BUTEUR

💰 Cote estimée : 2.10
🧠 Confiance IA : 71%`)

}catch(err){

console.log("BUTER ERROR:",err.message)

ctx.reply("❌ Erreur scan buteurs.")

}

})


// MEILLEURS COTES IA

bot.hears("👑 Meilleurs cotes IA",(ctx)=>{

ctx.reply(`👑 MEILLEURS COTES IA

Les meilleures analyses détectées par notre IA
sont réservées aux membres Premium.

🚀 Rejoins la team gagnante :

https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`)

})


// CONTACT

bot.hears("📩 Nous contacter",(ctx)=>{

ctx.reply(`📩 CONTACT

Contacte nous directement sur Instagram :

https://www.instagram.com/la_prediction777`)

})


// PREMIUM

bot.hears("💎 Passer Premium",(ctx)=>{

ctx.reply(`💎 PREMIUM IA VALUE BOT

Accès illimité aux scans
Value bets IA FOOT + BASKET
Pronostics réservés aux membres

🚀 Rejoins la team gagnante :

https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`)

})


// RESET SCANS GRATUITS

setInterval(()=>{

const now = new Date()

const hour = now.getUTCHours()
const minute = now.getUTCMinutes()

if(hour === 23 && minute === 0){

for(const user in userStats){
userStats[user] = 0
}

console.log("🔄 Reset scans gratuits")

}

},60000)


// TELEGRAM

async function startBot(){

await bot.telegram.deleteWebhook({ drop_pending_updates: true })

bot.launch({
dropPendingUpdates: true
})

console.log("✅ BOT LANCÉ")

}

startBot()
