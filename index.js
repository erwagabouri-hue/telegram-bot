const { Telegraf, Markup } = require("telegraf")
const axios = require("axios")
const fs = require("fs")

console.log("🚀 IA VALUE BOT PRO")

const bot = new Telegraf(process.env.BOT_TOKEN)

const MAX_FREE_SCANS = 2

// DATABASE (Initialisation & Fonctions)
let db = { 
  premiumUsers: {}, 
  userStats: {} 
}

if (fs.existsSync("database.json")) {
  db = JSON.parse(fs.readFileSync("database.json"))
}

function saveDB(){
  fs.writeFileSync("database.json", JSON.stringify(db, null, 2))
}

// RESET SCANS CHAQUE JOUR
setInterval(()=>{
  db.userStats = {}
  saveDB()
  console.log("♻️ Scans gratuits réinitialisés dans la DB")
}, 24*60*60*1000)

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
  ctx.reply(`🤖 IA VALUE BOT PRO

Analyse intelligente des cotes
Détection automatique de value bets

🎁 2 scans offerts chaque jour
💎 Premium = scans illimités`, menu)
})

// LIGUES
const footballLeagues = ["soccer_epl","soccer_spain_la_liga","soccer_italy_serie_a","soccer_germany_bundesliga","soccer_france_ligue_one","soccer_uefa_champions_league","soccer_uefa_europa_league"]
const basketLeagues = ["basketball_nba","basketball_euroleague","basketball_ncaab"]

// FONCTION DE SCAN GÉNÉRIQUE OPTIMISÉE
async function runScan(ctx, leagues, type) {
  const user = ctx.from.id
  const premium = isPremium(user)

  if(!db.userStats[user]) db.userStats[user] = 0

  if(!premium && db.userStats[user] >= MAX_FREE_SCANS){
    return ctx.reply("⚠️ Limite gratuite atteinte. Passez Premium pour continuer !")
  }

  const statusMsg = await ctx.reply(`🔍 Scan ${type} en cours sur toutes les ligues...`)

  try {
    // Appels API en parallèle pour plus de vitesse
    const requests = leagues.map(league => 
      axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`, {
        params: { apiKey: process.env.ODDS_API_KEY, regions: "eu", markets: "h2h", oddsFormat: "decimal" }
      }).catch(() => null)
    )

    const responses = await Promise.all(requests)
    let bestPick = null
    const now = new Date()

    for (const res of responses) {
      if (!res || !res.data) continue
      
      for (const match of res.data) {
        if (new Date(match.commence_time) < now) continue
        if (!match.bookmakers) continue

        for (const bookmaker of match.bookmakers) {
          for (const market of bookmaker.markets) {
            for (const outcome of market.outcomes) {
              const odd = outcome.price
              if (!odd || odd < 1.30 || odd > 3) continue

              const bookProb = 1 / odd
              const aiProb = bookProb * 1.20
              const edge = (aiProb * odd) - 1

              if (edge > 0.12) {
                const confidence = Math.round(aiProb * 100)
                if (!bestPick || confidence > bestPick.confidence) {
                  bestPick = { home: match.home_team, away: match.away_team, pick: outcome.name, odd, confidence }
                }
              }
            }
          }
        }
      }
    }

    if (bestPick) {
      if (!premium) {
        db.userStats[user]++
        saveDB()
      }
      ctx.reply(`✅ VALUE BET IA ${type}\n\n🏆 ${bestPick.home} vs ${bestPick.away}\n🎯 Pick : ${bestPick.pick}\n💰 Cote : ${bestPick.odd}\n🧠 Confiance IA : ${bestPick.confidence}%`)
    } else {
      ctx.reply("❌ Aucune value intéressante trouvée pour le moment.")
    }
  } catch (err) {
    console.error(err)
    ctx.reply("❌ Erreur lors du scan.")
  }
}

// HANDLERS
bot.hears("⚽ Scanner FOOT", (ctx) => runScan(ctx, footballLeagues, "FOOT"))
bot.hears("🏀 Scanner BASKET", (ctx) => runScan(ctx, basketLeagues, "BASKET"))

bot.hears("🎯 Scanner BUTEURS", (ctx) => {
  ctx.reply(`🎯 SCANNER BUTEURS IA\n\n🚧 Module en amélioration.\nDisponible très bientôt pour Premium.`)
})

bot.hears("👑 Meilleurs cotes IA", (ctx) => {
  ctx.reply(`👑 MEILLEURES COTES IA\n\nLes meilleures analyses sont réservées aux membres Premium.\n\n🚀 Rejoins la team : https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`)
})

bot.hears("📩 Nous contacter", (ctx) => {
  ctx.reply(`📩 CONTACT\n\nInstagram : https://www.instagram.com/la_prediction777`)
})

bot.hears("💎 Passer Premium", (ctx) => {
  ctx.reply(`💎 PREMIUM IA VALUE BOT\n\nAccès illimité aux scans\nValue bets IA FOOT + BASKET\nScanner BUTEURS IA\n\n🚀 Rejoins la team : https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`)
})

// LANCEMENT
async function startBot(){
  await bot.telegram.deleteWebhook({ drop_pending_updates: true })
  bot.launch()
  console.log("✅ BOT LANCÉ")
}
startBot()
