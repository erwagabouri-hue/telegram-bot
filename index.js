const { Telegraf, Markup } = require(“telegraf”);
const axios = require(“axios”);
const fs = require(“fs”);
const path = require(“path”);

const BOT_TOKEN = process.env.BOT_TOKEN;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

if (!BOT_TOKEN) {
console.error(“BOT_TOKEN manquant”);
process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const DATA_FILE = path.join(__dirname, “data.json”);

function loadData() {
try {
if (fs.existsSync(DATA_FILE)) {
return JSON.parse(fs.readFileSync(DATA_FILE, “utf8”));
}
} catch (e) {}
return { premium: [], dailyUsage: {} };
}

function saveData(data) {
try {
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
} catch (e) {
console.error(“Erreur sauvegarde:”, e.message);
}
}

function getTodayKey() {
return new Date().toISOString().split(“T”)[0];
}

function canScan(userId) {
const data = loadData();
if (data.premium.includes(String(userId))) {
return { allowed: true, premium: true };
}
const today = getTodayKey();
const key = String(userId) + “_” + today;
const usage = data.dailyUsage[key] || 0;
if (usage < 2) {
return { allowed: true, premium: false, remaining: 2 - usage };
}
return { allowed: false, premium: false, remaining: 0 };
}

function incrementUsage(userId) {
const data = loadData();
const today = getTodayKey();
const key = String(userId) + “_” + today;
data.dailyUsage[key] = (data.dailyUsage[key] || 0) + 1;
saveData(data);
}

function addPremium(userId) {
const data = loadData();
if (!data.premium.includes(String(userId))) {
data.premium.push(String(userId));
saveData(data);
}
}

const FOOTBALL_SPORTS = [
“soccer_epl”,
“soccer_england_league1”,
“soccer_spain_la_liga”,
“soccer_italy_serie_a”,
“soccer_germany_bundesliga”,
“soccer_france_ligue_one”,
“soccer_portugal_primeira_liga”,
“soccer_netherlands_eredivisie”,
“soccer_belgium_first_div”,
“soccer_turkey_super_league”
];

const BASKET_SPORTS = [
“basketball_nba”,
“basketball_euroleague”
];

async function fetchOdds(sport) {
try {
const res = await axios.get(“https://api.the-odds-api.com/v4/sports/” + sport + “/odds/”, {
params: {
apiKey: ODDS_API_KEY,
regions: “eu”,
markets: “h2h”,
oddsFormat: “decimal”,
dateFormat: “iso”
},
timeout: 10000
});
return res.data || [];
} catch (e) {
console.error(“Erreur odds “ + sport + “: “ + e.message);
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
const oddsMap = {};
for (const bk of game.bookmakers) {
for (const market of bk.markets || []) {
if (market.key !== “h2h”) continue;
for (const outcome of market.outcomes || []) {
if (!oddsMap[outcome.name]) oddsMap[outcome.name] = [];
oddsMap[outcome.name].push(outcome.price);
}
}
}
let bestPick = null;
let bestOdd = 0;
for (const team in oddsMap) {
const maxOdd = Math.max.apply(null, oddsMap[team]);
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
odd: bestOdd.toFixed(2)
});
}
}
picks.sort(function(a, b) { return parseFloat(b.odd) - parseFloat(a.odd); });
return picks.slice(0, 3);
}

async function scanFootball() {
const allGames = [];
for (const sport of FOOTBALL_SPORTS) {
const games = await fetchOdds(sport);
for (const g of games) allGames.push(g);
}
return extractBestValueBets(allGames);
}

async function scanBasket() {
const allGames = [];
for (const sport of BASKET_SPORTS) {
const games = await fetchOdds(sport);
for (const g of games) allGames.push(g);
}
return extractBestValueBets(allGames).slice(0, 1);
}

async function fetchTodayFixtures() {
try {
const today = new Date().toISOString().split(“T”)[0];
const res = await axios.get(“https://v3.football.api-sports.io/fixtures”, {
headers: { “x-apisports-key”: API_FOOTBALL_KEY },
params: { date: today },
timeout: 10000
});
return res.data && res.data.response ? res.data.response : [];
} catch (e) {
console.error(“Erreur fixtures: “ + e.message);
return [];
}
}

async function fetchTopScorer(leagueId, season) {
try {
const res = await axios.get(“https://v3.football.api-sports.io/players/topscorers”, {
headers: { “x-apisports-key”: API_FOOTBALL_KEY },
params: { league: leagueId, season: season },
timeout: 10000
});
const players = res.data && res.data.response ? res.data.response : [];
return players[0] || null;
} catch (e) {
console.error(“Erreur top scorer: “ + e.message);
return null;
}
}

async function scanButeurs() {
const fixtures = await fetchTodayFixtures();
if (!fixtures.length) return null;
const majorLeagues = [39, 140, 135, 78, 61, 94, 88, 144, 203];
const currentSeason = new Date().getFullYear();
let target = null;
for (const f of fixtures) {
if (majorLeagues.indexOf(f.league && f.league.id) !== -1 && f.fixture && f.fixture.status && f.fixture.status.short === “NS”) {
target = f;
break;
}
}
if (!target) {
for (const f of fixtures) {
if (f.fixture && f.fixture.status && f.fixture.status.short === “NS”) {
target = f;
break;
}
}
}
if (!target) target = fixtures[0];
const leagueId = target.league && target.league.id;
const season = (target.league && target.league.season) || currentSeason;
const topScorer = await fetchTopScorer(leagueId, season);
if (!topScorer) return null;
const goals = (topScorer.statistics && topScorer.statistics[0] && topScorer.statistics[0].goals && topScorer.statistics[0].goals.total) || 0;
const estimatedOdd = goals > 20 ? 1.80 : goals > 15 ? 2.10 : goals > 10 ? 2.40 : 2.80;
return {
home: (target.teams && target.teams.home && target.teams.home.name) || “Equipe A”,
away: (target.teams && target.teams.away && target.teams.away.name) || “Equipe B”,
playerName: (topScorer.player && topScorer.player.name) || “Joueur inconnu”,
goals: goals,
estimatedOdd: estimatedOdd.toFixed(2),
league: (target.league && target.league.name) || “Ligue inconnue”
};
}

const mainMenu = Markup.keyboard([
[”\u26BD Scanner FOOT”, “\uD83C\uDFC0 Scanner BASKET”],
[”\uD83C\uDFAF Scanner BUTEURS”, “\uD83D\uDC51 Meilleurs cotes IA”],
[”\uD83D\uDCE9 Nous contacter”, “\uD83D\uDC8E Passer Premium”]
]).resize();

const LIMIT_MSG = “Limite journaliere atteinte\n\nTu as utilise tes 2 scans gratuits d’aujourd’hui.\n\nPasse Premium pour des scans illimites !\nhttps://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00”;

bot.start(function(ctx) {
ctx.reply(
“Bienvenue sur IA Value Bot !\n\nJe t’aide a trouver les meilleures value bets du jour.\n\nAcces gratuit : 2 scans/jour\nPremium : scans illimites”,
mainMenu
);
});

bot.help(function(ctx) {
ctx.reply(“Aide IA Value Bot\n\nUtilise les boutons du menu.\n\nGratuit : 2 scans/jour\nPremium : illimite”);
});

bot.hears(”\u26BD Scanner FOOT”, async function(ctx) {
const userId = ctx.from.id;
const check = canScan(userId);
if (!check.allowed) return ctx.reply(LIMIT_MSG);
await ctx.reply(“Analyse en cours… Je scanne les ligues europeennes.”);
try {
const picks = await scanFootball();
incrementUsage(userId);
if (!picks.length) return ctx.reply(“Aucun value bet detecte pour les prochaines 48h. Reessaie plus tard !”);
let text = “TOP VALUE BETS IA - FOOT\nProchaines 48h\n\n”;
const nums = [“1.”, “2.”, “3.”];
picks.forEach(function(pick, i) {
text += nums[i] + “ “ + pick.home + “ vs “ + pick.away + “\n”;
text += “Pick : “ + pick.pick + “\n”;
text += “Cote : “ + pick.odd + “\n\n”;
});
if (!check.premium) text += “\nScans restants : “ + (check.remaining - 1);
ctx.reply(text);
} catch (e) {
console.error(“Erreur scan foot:”, e.message);
ctx.reply(“Une erreur est survenue. Reessaie dans quelques instants.”);
}
});

bot.hears(”\uD83C\uDFC0 Scanner BASKET”, async function(ctx) {
const userId = ctx.from.id;
const check = canScan(userId);
if (!check.allowed) return ctx.reply(LIMIT_MSG);
await ctx.reply(“Analyse en cours… Je scanne NBA et Euroleague.”);
try {
const picks = await scanBasket();
incrementUsage(userId);
if (!picks.length) return ctx.reply(“Aucun value bet basket detecte. Reessaie plus tard !”);
let text = “TOP VALUE BET IA - BASKET\nProchaines 48h\n\n”;
picks.forEach(function(pick) {
text += pick.home + “ vs “ + pick.away + “\n”;
text += “Pick : “ + pick.pick + “\n”;
text += “Cote : “ + pick.odd + “\n”;
});
if (!check.premium) text += “\nScans restants : “ + (check.remaining - 1);
ctx.reply(text);
} catch (e) {
console.error(“Erreur scan basket:”, e.message);
ctx.reply(“Une erreur est survenue. Reessaie dans quelques instants.”);
}
});

bot.hears(”\uD83C\uDFAF Scanner BUTEURS”, async function(ctx) {
const userId = ctx.from.id;
const check = canScan(userId);
if (!check.allowed) return ctx.reply(LIMIT_MSG);
await ctx.reply(“Analyse en cours… Je recherche le meilleur buteur du jour.”);
try {
const result = await scanButeurs();
incrementUsage(userId);
if (!result) return ctx.reply(“Aucun match trouve aujourd’hui.”);
let text = “BUTEUR IA\n\n”;
text += result.home + “ vs “ + result.away + “\n”;
text += “Competition : “ + result.league + “\n\n”;
text += “Pick : “ + result.playerName + “\n”;
text += “Buts saison : “ + result.goals + “\n”;
text += “Cote estimee : “ + result.estimatedOdd + “\n”;
if (!check.premium) text += “\nScans restants : “ + (check.remaining - 1);
ctx.reply(text);
} catch (e) {
console.error(“Erreur scan buteurs:”, e.message);
ctx.reply(“Une erreur est survenue. Reessaie dans quelques instants.”);
}
});

bot.hears(”\uD83D\uDC51 Meilleurs cotes IA”, async function(ctx) {
const userId = ctx.from.id;
const check = canScan(userId);
if (!check.allowed) return ctx.reply(LIMIT_MSG);
await ctx.reply(“Analyse globale en cours… Football + Basket.”);
try {
const footPicks = await scanFootball();
const basketPicks = await scanBasket();
incrementUsage(userId);
const allPicks = [];
footPicks.forEach(function(p) { allPicks.push({ sport: “FOOT”, home: p.home, away: p.away, pick: p.pick, odd: p.odd }); });
basketPicks.forEach(function(p) { allPicks.push({ sport: “BASKET”, home: p.home, away: p.away, pick: p.pick, odd: p.odd }); });
allPicks.sort(function(a, b) { return parseFloat(b.odd) - parseFloat(a.odd); });
const top = allPicks.slice(0, 5);
if (!top.length) return ctx.reply(“Aucun value bet detecte en ce moment.”);
let text = “MEILLEURS VALUE BETS IA\nFootball + Basket - 48h\n\n”;
top.forEach(function(pick) {
text += “[” + pick.sport + “] “ + pick.home + “ vs “ + pick.away + “\n”;
text += “Pick : “ + pick.pick + “\n”;
text += “Cote : “ + pick.odd + “\n\n”;
});
if (!check.premium) text += “Scans restants : “ + (check.remaining - 1);
ctx.reply(text);
} catch (e) {
console.error(“Erreur meilleurs cotes:”, e.message);
ctx.reply(“Une erreur est survenue. Reessaie dans quelques instants.”);
}
});

bot.hears(”\uD83D\uDCE9 Nous contacter”, function(ctx) {
ctx.reply(“Nous contacter\n\nRejoins-nous sur Instagram :\nhttps://www.instagram.com/la_prediction777”);
});

bot.hears(”\uD83D\uDC8E Passer Premium”, function(ctx) {
ctx.reply(
“PREMIUM IA VALUE BOT\n\n” +
“Acces illimite aux scans\n” +
“Value bets IA FOOT + BASKET\n” +
“Scanner BUTEURS IA\n\n” +
“Lien paiement :\nhttps://buy.stripe.com/5kQ4gs1fl6Ld7deaQQ0ZW00\n\n” +
“Contacte-nous apres paiement : @la_prediction777”
);
});

bot.command(“addpremium”, function(ctx) {
const args = ctx.message.text.split(” “);
if (args.length < 2) return ctx.reply(“Usage : /addpremium <userId>”);
addPremium(args[1]);
ctx.reply(“Utilisateur “ + args[1] + “ est maintenant Premium.”);
});

bot.command(“status”, function(ctx) {
const userId = ctx.from.id;
const check = canScan(userId);
const txt = check.premium ? “Premium - Scans illimites” : “Gratuit - “ + check.remaining + “ scan(s) restant(s) aujourd’hui”;
ctx.reply(“Ton statut : “ + txt);
});

bot.catch(function(err, ctx) {
console.error(“Erreur bot:”, err);
try { ctx.reply(“Une erreur inattendue. Reessaie.”); } catch (e) {}
});

console.log(“Demarrage du bot…”);
bot.launch().then(function() {
console.log(“Bot demarre avec succes !”);
}).catch(function(e) {
console.error(“Erreur lancement:”, e.message);
process.exit(1);
});

process.once(“SIGINT”, function() { bot.stop(“SIGINT”); });
process.once(“SIGTERM”, function() { bot.stop(“SIGTERM”); });
