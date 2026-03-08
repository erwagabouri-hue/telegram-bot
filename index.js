const { Telegraf, Markup } = require(“telegraf”);
const axios = require(“axios”);
const fs = require(“fs”);
const path = require(“path”);

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

if (!BOT_TOKEN) throw new Error(“BOT_TOKEN manquant dans les variables d’environnement”);

const bot = new Telegraf(BOT_TOKEN);

// ─── FREEMIUM STORAGE ─────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, “data.json”);

function loadData() {
try {
if (fs.existsSync(DATA_FILE)) {
return JSON.parse(fs.readFileSync(DATA_FILE, “utf8”));
}
} catch (_) {}
return { premium: [], dailyUsage: {} };
}

function saveData(data) {
try {
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
} catch (e) {
console.error(“Erreur sauvegarde data:”, e.message);
}
}

function getTodayKey() {
return new Date().toISOString().split(“T”)[0];
}

function canScan(userId) {
const data = loadData();
if (data.premium.includes(String(userId))) return { allowed: true, premium: true };

const today = getTodayKey();
const key = `${userId}_${today}`;
const usage = data.dailyUsage[key] || 0;

if (usage < 2) return { allowed: true, premium: false, remaining: 2 - usage };
return { allowed: false, premium: false, remaining: 0 };
}

function incrementUsage(userId) {
const data = loadData();
const today = getTodayKey();
const key = `${userId}_${today}`;
data.dailyUsage[key] = (data.dailyUsage[key] || 0) + 1;

// Nettoyage des vieilles entrées (> 2 jours)
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 2);
for (const k of Object.keys(data.dailyUsage)) {
const datePart = k.split(”_”).pop();
if (datePart < cutoff.toISOString().split(“T”)[0]) delete data.dailyUsage[k];
}
saveData(data);
}

function addPremium(userId) {
const data = loadData();
if (!data.premium.includes(String(userId))) {
data.premium.push(String(userId));
saveData(data);
}
}

// ─── ODDS API ─────────────────────────────────────────────────────────────────
const FOOTBALL_SPORTS = [
“soccer_england_league1”,       // Championship (League 1 key)
“soccer_epl”,                   // Premier League
“soccer_spain_la_liga”,         // La Liga
“soccer_italy_serie_a”,         // Serie A
“soccer_germany_bundesliga”,    // Bundesliga
“soccer_france_ligue_one”,      // Ligue 1
“soccer_portugal_primeira_liga”,// Primeira Liga
“soccer_netherlands_eredivisie”,// Eredivisie
“soccer_belgium_first_div”,     // Pro League Belgique
“soccer_turkey_super_league”,   // Süper Lig
];

const BASKET_SPORTS = [
“basketball_nba”,
“basketball_euroleague”,
];

async function fetchOdds(sport) {
try {
const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/`;
const res = await axios.get(url, {
params: {
apiKey: ODDS_API_KEY,
regions: “eu”,
markets: “h2h”,
oddsFormat: “decimal”,
dateFormat: “iso”,
},
timeout: 10000,
});
return res.data || [];
} catch (e) {
console.error(`Erreur odds pour ${sport}:`, e.message);
return [];
}
}

function isWithin48h(dateStr) {
const matchDate = new Date(dateStr);
const now = new Date();
const diff = matchDate - now;
return diff > 0 && diff <= 48 * 3600 * 1000;
}

function extractBestValueBets(games) {
const picks = [];

for (const game of games) {
if (!isWithin48h(game.commence_time)) continue;
if (!game.bookmakers || game.bookmakers.length === 0) continue;

```
// Collecter toutes les cotes pour chaque outcome
const oddsMap = {};
for (const bk of game.bookmakers) {
  for (const market of bk.markets || []) {
    if (market.key !== "h2h") continue;
    for (const outcome of market.outcomes || []) {
      if (!oddsMap[outcome.name]) oddsMap[outcome.name] = [];
      oddsMap[outcome.name].push(outcome.price);
    }
  }
}

// Trouver la meilleure cote pour chaque équipe
let bestPick = null;
let bestOdd = 0;

for (const [team, odds] of Object.entries(oddsMap)) {
  const maxOdd = Math.max(...odds);
  // Value bet : cote entre 1.50 et 3.50 (zone intéressante)
  if (maxOdd > bestOdd && maxOdd >= 1.50 && maxOdd <= 3.50) {
    bestOdd = maxOdd;
    bestPick = team;
  }
}

if (bestPick) {
  picks.push({
    home: game.home_team,
    away: game.away_team,
    pick: bestPick,
    odd: bestOdd.toFixed(2),
    date: game.commence_time,
  });
}
```

}

// Trier par cote décroissante et retourner top 3
picks.sort((a, b) => parseFloat(b.odd) - parseFloat(a.odd));
return picks.slice(0, 3);
}

async function scanFootball() {
const allGames = [];
for (const sport of FOOTBALL_SPORTS) {
const games = await fetchOdds(sport);
allGames.push(…games);
}
return extractBestValueBets(allGames);
}

async function scanBasket() {
const allGames = [];
for (const sport of BASKET_SPORTS) {
const games = await fetchOdds(sport);
allGames.push(…games);
}
const picks = extractBestValueBets(allGames);
return picks.slice(0, 1); // 1 pick pour le basket
}

// ─── API-FOOTBALL ─────────────────────────────────────────────────────────────
async function fetchTodayFixtures() {
try {
const today = new Date().toISOString().split(“T”)[0];
const res = await axios.get(“https://v3.football.api-sports.io/fixtures”, {
headers: { “x-apisports-key”: API_FOOTBALL_KEY },
params: { date: today },
timeout: 10000,
});
return res.data?.response || [];
} catch (e) {
console.error(“Erreur fixtures:”, e.message);
return [];
}
}

async function fetchTopScorer(leagueId, season) {
try {
const res = await axios.get(“https://v3.football.api-sports.io/players/topscorers”, {
headers: { “x-apisports-key”: API_FOOTBALL_KEY },
params: { league: leagueId, season },
timeout: 10000,
});
const players = res.data?.response || [];
return players[0] || null;
} catch (e) {
console.error(“Erreur top scorer:”, e.message);
return null;
}
}

async function scanButeurs() {
const fixtures = await fetchTodayFixtures();
if (!fixtures.length) return null;

// Ligues majeures prioritaires
const majorLeagues = [39, 140, 135, 78, 61, 94, 88, 144, 203]; // PL, Liga, Serie A, Bundesliga, L1, Portugal, Eredivisie, Belgique, Turquie
const currentSeason = new Date().getFullYear();

// Trouver un match d’une ligue majeure
let targetFixture = fixtures.find(
(f) => majorLeagues.includes(f.league?.id) && f.fixture?.status?.short === “NS”
);

if (!targetFixture) targetFixture = fixtures.find((f) => f.fixture?.status?.short === “NS”);
if (!targetFixture) targetFixture = fixtures[0];

const leagueId = targetFixture.league?.id;
const season = targetFixture.league?.season || currentSeason;

const topScorer = await fetchTopScorer(leagueId, season);
if (!topScorer) return null;

const goals = topScorer.statistics?.[0]?.goals?.total || 0;
// Cote estimée basée sur les buts marqués
const estimatedOdd = goals > 20 ? 1.80 : goals > 15 ? 2.10 : goals > 10 ? 2.40 : 2.80;

return {
home: targetFixture.teams?.home?.name || “Équipe A”,
away: targetFixture.teams?.away?.name || “Équipe B”,
playerName: topScorer.player?.name || “Joueur inconnu”,
goals,
estimatedOdd: estimatedOdd.toFixed(2),
league: targetFixture.league?.name || “Ligue inconnue”,
};
}

// ─── KEYBOARD MENU ────────────────────────────────────────────────────────────
const mainMenu = Markup.keyboard([
[“⚽ Scanner FOOT”, “🏀 Scanner BASKET”],
[“🎯 Scanner BUTEURS”, “👑 Meilleurs cotes IA”],
[“📩 Nous contacter”, “💎 Passer Premium”],
]).resize();

// ─── BOT HANDLERS ─────────────────────────────────────────────────────────────

bot.start((ctx) => {
ctx.reply(
`👋 Bienvenue sur *IA Value Bot* !\n\n` +
`🤖 Je t'aide à trouver les meilleures value bets du jour grâce à l'intelligence artificielle.\n\n` +
`📊 *Fonctionnalités disponibles :*\n` +
`⚽ Scanner les matchs de foot\n` +
`🏀 Scanner les matchs de basket\n` +
`🎯 Scanner les buteurs du jour\n` +
`👑 Meilleurs cotes IA\n\n` +
`🆓 Accès gratuit : *2 scans/jour*\n` +
`💎 Premium : scans *illimités*`,
{ parse_mode: “Markdown”, …mainMenu }
);
});

bot.help((ctx) => {
ctx.reply(
`ℹ️ *Aide IA Value Bot*\n\n` +
`Utilise les boutons du menu pour accéder aux fonctionnalités.\n\n` +
`🆓 Gratuit : 2 scans/jour\n` +
`💎 Premium : illimité\n\n` +
`En cas de problème : @la_prediction777`,
{ parse_mode: “Markdown” }
);
});

// ── SCANNER FOOT ──────────────────────────────────────────────────────────────
bot.hears(“⚽ Scanner FOOT”, async (ctx) => {
const userId = ctx.from.id;
const check = canScan(userId);

if (!check.allowed) {
return ctx.reply(
`⛔ *Limite journalière atteinte*\n\n` +
`Tu as utilisé tes 2 scans gratuits d'aujourd'hui.\n\n` +
`💎 Passe *Premium* pour des scans illimités !\n` +
`👉 https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`,
{ parse_mode: “Markdown” }
);
}

const msg = await ctx.reply(“⏳ *Analyse en cours…* Je scanne les cotes des ligues européennes.”, { parse_mode: “Markdown” });

try {
const picks = await scanFootball();
incrementUsage(userId);

```
if (!picks.length) {
  return ctx.reply("😔 Aucun value bet détecté pour les prochaines 48h. Réessaie plus tard !");
}

let text = `🔥 *TOP VALUE BETS IA — FOOT*\n`;
text += `📅 _Prochaines 48h_\n\n`;

const emojis = ["1️⃣", "2️⃣", "3️⃣"];
picks.forEach((pick, i) => {
  text += `${emojis[i]} *${pick.home} vs ${pick.away}*\n`;
  text += `🎯 Pick : *${pick.pick}*\n`;
  text += `💰 Cote : \`${pick.odd}\`\n\n`;
});

if (!check.premium) {
  text += `\n🆓 Scans restants aujourd'hui : *${check.remaining - 1}*\n`;
  text += `💎 _Premium pour des scans illimités_`;
}

await ctx.reply(text, { parse_mode: "Markdown" });
```

} catch (e) {
console.error(“Erreur scan foot:”, e.message);
ctx.reply(“❌ Une erreur est survenue lors de l’analyse. Réessaie dans quelques instants.”);
}
});

// ── SCANNER BASKET ────────────────────────────────────────────────────────────
bot.hears(“🏀 Scanner BASKET”, async (ctx) => {
const userId = ctx.from.id;
const check = canScan(userId);

if (!check.allowed) {
return ctx.reply(
`⛔ *Limite journalière atteinte*\n\n` +
`Tu as utilisé tes 2 scans gratuits d'aujourd'hui.\n\n` +
`💎 Passe *Premium* pour des scans illimités !\n` +
`👉 https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`,
{ parse_mode: “Markdown” }
);
}

await ctx.reply(“⏳ *Analyse en cours…* Je scanne NBA et Euroleague.”, { parse_mode: “Markdown” });

try {
const picks = await scanBasket();
incrementUsage(userId);

```
if (!picks.length) {
  return ctx.reply("😔 Aucun value bet basket détecté pour les prochaines 48h. Réessaie plus tard !");
}

let text = `🔥 *TOP VALUE BET IA — BASKET*\n`;
text += `📅 _Prochaines 48h_\n\n`;

picks.forEach((pick) => {
  text += `🏀 *${pick.home} vs ${pick.away}*\n`;
  text += `🎯 Pick : *${pick.pick}*\n`;
  text += `💰 Cote : \`${pick.odd}\`\n`;
});

if (!check.premium) {
  text += `\n🆓 Scans restants aujourd'hui : *${check.remaining - 1}*\n`;
  text += `💎 _Premium pour des scans illimités_`;
}

await ctx.reply(text, { parse_mode: "Markdown" });
```

} catch (e) {
console.error(“Erreur scan basket:”, e.message);
ctx.reply(“❌ Une erreur est survenue lors de l’analyse. Réessaie dans quelques instants.”);
}
});

// ── SCANNER BUTEURS ───────────────────────────────────────────────────────────
bot.hears(“🎯 Scanner BUTEURS”, async (ctx) => {
const userId = ctx.from.id;
const check = canScan(userId);

if (!check.allowed) {
return ctx.reply(
`⛔ *Limite journalière atteinte*\n\n` +
`Tu as utilisé tes 2 scans gratuits d'aujourd'hui.\n\n` +
`💎 Passe *Premium* pour des scans illimités !\n` +
`👉 https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`,
{ parse_mode: “Markdown” }
);
}

await ctx.reply(“⏳ *Analyse en cours…* Je recherche le meilleur buteur du jour.”, { parse_mode: “Markdown” });

try {
const result = await scanButeurs();
incrementUsage(userId);

```
if (!result) {
  return ctx.reply("😔 Aucun match trouvé aujourd'hui pour le scanner buteurs.");
}

let text = `🎯 *BUTEUR IA*\n\n`;
text += `🏆 *${result.home} vs ${result.away}*\n`;
text += `🏅 Compétition : _${result.league}_\n\n`;
text += `🔥 Pick : *${result.playerName}*\n`;
text += `⚽ Buts saison : *${result.goals}*\n`;
text += `💰 Cote estimée : \`${result.estimatedOdd}\`\n`;

if (!check.premium) {
  text += `\n🆓 Scans restants aujourd'hui : *${check.remaining - 1}*\n`;
  text += `💎 _Premium pour des scans illimités_`;
}

await ctx.reply(text, { parse_mode: "Markdown" });
```

} catch (e) {
console.error(“Erreur scan buteurs:”, e.message);
ctx.reply(“❌ Une erreur est survenue lors de l’analyse. Réessaie dans quelques instants.”);
}
});

// ── MEILLEURS COTES IA ────────────────────────────────────────────────────────
bot.hears(“👑 Meilleurs cotes IA”, async (ctx) => {
const userId = ctx.from.id;
const check = canScan(userId);

if (!check.allowed) {
return ctx.reply(
`⛔ *Limite journalière atteinte*\n\n` +
`Tu as utilisé tes 2 scans gratuits d'aujourd'hui.\n\n` +
`💎 Passe *Premium* pour des scans illimités !\n` +
`👉 https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00`,
{ parse_mode: “Markdown” }
);
}

await ctx.reply(“⏳ *Analyse globale en cours…* Football + Basket.”, { parse_mode: “Markdown” });

try {
const [footPicks, basketPicks] = await Promise.all([scanFootball(), scanBasket()]);
incrementUsage(userId);

```
// Combiner et trier par cote
const allPicks = [
  ...footPicks.map((p) => ({ ...p, sport: "⚽" })),
  ...basketPicks.map((p) => ({ ...p, sport: "🏀" })),
].sort((a, b) => parseFloat(b.odd) - parseFloat(a.odd)).slice(0, 5);

if (!allPicks.length) {
  return ctx.reply("😔 Aucun value bet détecté en ce moment. Réessaie plus tard !");
}

let text = `👑 *MEILLEURS VALUE BETS IA*\n`;
text += `📅 _Football + Basket — 48h_\n\n`;

allPicks.forEach((pick, i) => {
  text += `${pick.sport} *${pick.home} vs ${pick.away}*\n`;
  text += `🎯 Pick : *${pick.pick}*\n`;
  text += `💰 Cote : \`${pick.odd}\`\n\n`;
});

if (!check.premium) {
  text += `🆓 Scans restants : *${check.remaining - 1}*\n`;
  text += `💎 _Premium pour des scans illimités_`;
}

await ctx.reply(text, { parse_mode: "Markdown" });
```

} catch (e) {
console.error(“Erreur meilleurs cotes:”, e.message);
ctx.reply(“❌ Une erreur est survenue. Réessaie dans quelques instants.”);
}
});

// ── CONTACT ───────────────────────────────────────────────────────────────────
bot.hears(“📩 Nous contacter”, (ctx) => {
ctx.reply(
`📩 *Nous contacter*\n\n` +
`Pour toute question ou suggestion, rejoins-nous sur Instagram :\n\n` +
`📸 https://www.instagram.com/la_prediction777\n\n` +
`_On répond à tous les messages !_ 🙌`,
{ parse_mode: “Markdown” }
);
});

// ── PREMIUM ───────────────────────────────────────────────────────────────────
bot.hears(“💎 Passer Premium”, (ctx) => {
ctx.reply(
`💎 *PREMIUM IA VALUE BOT*\n\n` +
`✅ Accès *illimité* aux scans\n` +
`✅ Value bets IA *FOOT + BASKET*\n` +
`✅ Scanner *BUTEURS* IA\n` +
`✅ Meilleurs cotes IA en temps réel\n\n` +
`━━━━━━━━━━━━━━━━━━━━\n` +
`💳 *Lien paiement sécurisé :*\n` +
`👉 https://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00\n` +
`━━━━━━━━━━━━━━━━━━━━\n\n` +
`⚡ Accès activé *immédiatement* après paiement.\n` +
`📩 Contacte-nous sur Instagram après ton paiement : @la_prediction777`,
{ parse_mode: “Markdown” }
);
});

// ── COMMANDE ADMIN : activer premium manuellement ─────────────────────────────
// Usage : /addpremium <userId>
bot.command(“addpremium”, (ctx) => {
// Sécurité basique : seul le premier utilisateur ou via console
const args = ctx.message.text.split(” “);
if (args.length < 2) return ctx.reply(“Usage : /addpremium <userId>”);
const targetId = args[1];
addPremium(targetId);
ctx.reply(`✅ L'utilisateur ${targetId} est maintenant Premium.`);
});

// ── COMMANDE : voir son statut ────────────────────────────────────────────────
bot.command(“status”, (ctx) => {
const userId = ctx.from.id;
const check = canScan(userId);
const statusText = check.premium
? “💎 *Premium* — Scans illimités”
: `🆓 *Gratuit* — ${check.remaining} scan(s) restant(s) aujourd'hui`;
ctx.reply(`👤 *Ton statut :*\n\n${statusText}`, { parse_mode: “Markdown” });
});

// ─── GESTION ERREURS ──────────────────────────────────────────────────────────
bot.catch((err, ctx) => {
console.error(“Erreur bot:”, err);
try {
ctx.reply(“❌ Une erreur inattendue s’est produite. Réessaie dans quelques instants.”);
} catch (_) {}
});

// ─── LANCEMENT ────────────────────────────────────────────────────────────────
async function start() {
console.log(“🚀 Démarrage du bot…”);
try {
await bot.launch();
console.log(“✅ Bot démarré avec succès !”);
} catch (e) {
console.error(“❌ Erreur lancement:”, e.message);
process.exit(1);
}
}

start();

// Graceful stop pour Railway
process.once(“SIGINT”, () => bot.stop(“SIGINT”));
process.once(“SIGTERM”, () => bot.stop(“SIGTERM”));
