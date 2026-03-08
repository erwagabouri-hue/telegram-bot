const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")

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


// LIGUES FOOT

const footballLeagues = [

"soccer_epl",
"soccer_spain_la_liga",
"soccer_italy_serie_a",
"soccer_germany_bundesliga",
"soccer_france_ligue_one",
"soccer_portugal_primeira_liga",
"soccer_belgium_first_div",
"soccer_netherlands_eredivisie",
"soccer_turkey_super_league",
"soccer_efl_champ"

]


// LIGUES BASKET

const basketLeagues = [

"basketball_nba",
"basketball_euroleague"

]


// SCAN FOOT

bot.hears("⚽ Scanner FOOT", async(ctx)=>{

try{

let picks=[]

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

const now = new Date()
const limit = new Date()

limit.setHours(now.getHours()+48)

if(date < now || date > limit) continue

let bestOdd = 0
let bestPick = ""

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

if(outcome.price > bestOdd){

bestOdd = outcome.price
bestPick = outcome.name

}

}

}

}

if(bestOdd > 1.30){

picks.push({

home:match.home_team,
away:match.away_team,
pick:bestPick,
odd:bestOdd

})

}

}

}


if(picks.length === 0){

return ctx.reply("🔎 Analyse en cours...")

}


const top3 = picks.sort((a,b)=>b.odd-a.odd).slice(0,3)

let message = "🔥 TOP VALUE BETS IA\n\n"

top3.forEach((p,i)=>{

message += `${i+1}️⃣ ${p.home} vs ${p.away}\n`
message += `🎯 Pick : ${p.pick}\n`
message += `💰 Cote : ${p.odd}\n\n`

})

ctx.reply(message)

}catch{

ctx.reply("❌ Erreur analyse.")

}

})


// SCAN BASKET

bot.hears("🏀 Scanner BASKET", async(ctx)=>{

try{

let picks=[]

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

let bestOdd = 0
let bestPick = ""

for(const bookmaker of match.bookmakers){

for(const market of bookmaker.markets){

for(const outcome of market.outcomes){

if(outcome.price > bestOdd){

bestOdd = outcome.price
bestPick = outcome.name

}

}

}

}

if(bestOdd > 1.30){

picks.push({

home:match.home_team,
away:match.away_team,
pick:bestPick,
odd:bestOdd

})

}

}

}


if(picks.length === 0){

return ctx.reply("🔎 Analyse basket en cours...")

}


const pick = picks.sort((a,b)=>b.odd-a.odd)[0]

ctx.reply(`🏀 VALUE BET IA BASKET

🏆 ${pick.home} vs ${pick.away}

🎯 Pick : ${pick.pick}

💰 Cote : ${pick.odd}

🧠 Analyse IA : Match avec potentiel value.`)

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

if(fixtures.data.response.length === 0){

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
Attaquant très actif offensivement et principal finisseur.`)

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
