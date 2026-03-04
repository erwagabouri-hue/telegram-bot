const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")

console.log("🚀 IA VALUE BOT PRO START")

const bot = new Telegraf(process.env.BOT_TOKEN)

const ODDS_API_KEY = process.env.ODDS_API_KEY
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY

const MAX_FREE_SCANS = 2
const userStats = {}

const LEAGUES = [
"soccer_epl",
"soccer_spain_la_liga",
"soccer_germany_bundesliga",
"soccer_italy_serie_a",
"soccer_france_ligue_one"
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

ctx.reply(`🤖 IA VALUE BOT PRO

Analyse intelligente des cotes
Détection automatique de value bets

━━━━━━━━━━━━

🆓 2 scans gratuits / jour
💎 Premium = scans illimités

━━━━━━━━━━━━`,menu)

})


// RECUPERER STATS EQUIPE (API FOOTBALL)

async function getTeamBoost(team){

try{

const res = await axios.get(
`https://v3.football.api-sports.io/teams?search=${team}`,
{
headers:{
"x-apisports-key": FOOTBALL_API_KEY
}
})

if(!res.data.response || res.data.response.length === 0){
return 1
}

// petit boost si équipe connue
return 1.05

}catch(err){

return 1

}

}


// SCAN MATCHS

bot.hears("🔎 Scanner les matchs", async (ctx)=>{

const user = ctx.from.id

if(!userStats[user]){
userStats[user] = 0
}

if(userStats[user] >= MAX_FREE_SCANS){
return ctx.reply("⚠️ Limite gratuite atteinte (2 scans/jour). Passe Premium pour scans illimités.")
}

try{

let found = false

for(const league of LEAGUES){

const url = `https://api.the-odds-api.com/v4/sports/${league}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`

const res = await axios.get(url)

const matches = res.data

if(!matches || matches.length === 0) continue

for(const match of matches){

const home = match.home_team
const away = match.away_team

if(!match.bookmakers) continue

// récupération stats équipe
const homeBoost = await getTeamBoost(home)
const awayBoost = await getTeamBoost(away)

for(const bookmaker of match.bookmakers){

if(!bookmaker.markets) continue

for(const market of bookmaker.markets){

if(!market.outcomes) continue

for(const outcome of market.outcomes){

const odds = outcome.price
const pick = outcome.name

if(!odds || odds < 1.5) continue

const bookProb = 1 / odds

let aiProb = bookProb

if(pick === home){
aiProb *= homeBoost
}

if(pick === away){
aiProb *= awayBoost
}

if(odds >= 3){
aiProb *= 1.30
}else if(odds >= 2){
aiProb *= 1.20
}

if(aiProb > 0.82){
aiProb = 0.82
}

const edge = (aiProb * odds) - 1

if(aiProb > 0.62 && edge > 0.18){

userStats[user]++

found = true

return ctx.reply(`🔥 VALUE BET IA

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
ctx.reply("❌ Aucune value intéressante trouvée.")
}

}catch(err){

console.log("SCAN ERROR:", err.response?.data || err.message)

ctx.reply("❌ Erreur lors du scan.")

}

})


// STATS

bot.hears("📊 Mes statistiques",(ctx)=>{

const user = ctx.from.id
const used = userStats[user] || 0

ctx.reply(`📊 TES STATISTIQUES

Analyses utilisées : ${used}/2

Statut : 🆓 Gratuit`)

})


// TOP VALUE

bot.hears("🔥 Top Value Bets",(ctx)=>{

ctx.reply(`🔥 TOP VALUE BETS

Fonction en cours de développement.

Les meilleures analyses seront envoyées automatiquement chaque jour.`)

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


// FIX TELEGRAM

bot.telegram.deleteWebhook()

// START BOT

bot.launch()

console.log("✅ BOT LANCÉ")

process.once("SIGINT",()=>bot.stop("SIGINT"))
process.once("SIGTERM",()=>bot.stop("SIGTERM"))
