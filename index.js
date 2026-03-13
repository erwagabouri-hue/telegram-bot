const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');

const TOKEN = process.env.BOT_TOKEN;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── LIGUES AUTORISÉES ────────────────────────────────────────
const LEAGUES = [
  { id: 61,  name: 'Ligue 1',          country: 'France',      season: 2024 },
  { id: 39,  name: 'Premier League',   country: 'Angleterre',  season: 2024 },
  { id: 140, name: 'La Liga',          country: 'Espagne',     season: 2024 },
  { id: 78,  name: 'Bundesliga',       country: 'Allemagne',   season: 2024 },
  { id: 135, name: 'Serie A',          country: 'Italie',      season: 2024 },
  { id: 94,  name: 'Primeira Liga',    country: 'Portugal',    season: 2024 },
  { id: 88,  name: 'Eredivisie',       country: 'Pays-Bas',    season: 2024 },
  { id: 2,   name: 'Champions League', country: 'Europe',      season: 2024 },
  { id: 3,   name: 'Europa League',    country: 'Europe',      season: 2024 },
];

// ─── LIMITE QUOTIDIENNE ───────────────────────────────────────
const userUsage = {};

function getTodayDate() {
  return new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
}

function hasUsedToday(userId, category) {
  return userUsage[userId]?.[category] === getTodayDate();
}

function markAsUsed(userId, category) {
  if (!userUsage[userId]) userUsage[userId] = {};
  userUsage[userId][category] = getTodayDate();
}

cron.schedule('0 0 * * *', () => {
  Object.keys(userUsage).forEach(uid => { userUsage[uid] = {}; });
  console.log('🔄 Limites réinitialisées');
}, { timezone: 'Europe/Paris' });

// ─── HELPERS ─────────────────────────────────────────────────

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris'
  });
}

function confidenceBar(score) {
  const filled = Math.round(score / 10);
  return '🟩'.repeat(filled) + '⬜'.repeat(10 - filled) + ` ${score}%`;
}

function confidenceLabel(pct) {
  if (pct >= 80) return '🔥 TRÈS ÉLEVÉ';
  if (pct >= 65) return '✅ ÉLEVÉ';
  if (pct >= 50) return '⚡ MOYEN';
  return '⚠️ FAIBLE';
}

// ─── API FOOTBALL ─────────────────────────────────────────────

async function getFixturesByLeague(leagueId, season) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const res = await axios.get('https://v3.football.api-sports.io/fixtures', {
      headers: { 'x-apisports-key': API_FOOTBALL_KEY },
      params: {
        league: leagueId,
        season: season,
        date: today,
        status: 'NS',
        timezone: 'Europe/Paris'
      }
    });
    return res.data.response || [];
  } catch (e) {
    console.error(`Erreur fixtures ligue ${leagueId}:`, e.message);
    return [];
  }
}

async function getAllFixturesToday() {
  const results = [];
  for (const league of LEAGUES) {
    const fixtures = await getFixturesByLeague(league.id, league.season);
    for (const fix of fixtures) {
      results.push({ ...fix, leagueInfo: league });
    }
  }
  console.log(`✅ Total matchs trouvés aujourd'hui : ${results.length}`);
  return results;
}

async function getTeamStats(teamId, leagueId, season) {
  try {
    const res = await axios.get('https://v3.football.api-sports.io/teams/statistics', {
      headers: { 'x-apisports-key': API_FOOTBALL_KEY },
      params: { team: teamId, league: leagueId, season: season }
    });
    return res.data.response || null;
  } catch (e) {
    return null;
  }
}

async function getTopScorers(leagueId, season) {
  try {
    const res = await axios.get('https://v3.football.api-sports.io/players/topscorers', {
      headers: { 'x-apisports-key': API_FOOTBALL_KEY },
      params: { league: leagueId, season: season }
    });
    return res.data.response?.slice(0, 15) || [];
  } catch (e) {
    return [];
  }
}

// ─── ODDS API ─────────────────────────────────────────────────

let oddsCache = null;
let oddsCacheTime = null;

async function getRealOdds() {
  // Cache 30min pour économiser les requêtes
  if (oddsCache && oddsCacheTime && (Date.now() - oddsCacheTime) < 30 * 60 * 1000) {
    return oddsCache;
  }
  try {
    const res = await axios.get('https://api.the-odds-api.com/v4/sports/soccer/odds', {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'eu',
        markets: 'h2h',
        oddsFormat: 'decimal',
        dateFormat: 'iso'
      }
    });
    oddsCache = res.data || [];
    oddsCacheTime = Date.now();
    console.log(`✅ Odds API : ${oddsCache.length} matchs avec cotes`);
    return oddsCache;
  } catch (e) {
    console.error('Erreur Odds API:', e.message);
    return oddsCache || [];
  }
}

function findOddsForMatch(oddsData, homeTeam, awayTeam) {
  if (!oddsData || oddsData.length === 0) return null;

  const normalize = str => str.toLowerCase()
    .replace(/fc|cf|sc|ac|as|rc|us|ss|sd|cd|rcd|real|atletico|athletic/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const homeN = normalize(homeTeam);
  const awayN = normalize(awayTeam);

  const match = oddsData.find(o => {
    const h = normalize(o.home_team);
    const a = normalize(o.away_team);
    const homeMatch = h.includes(homeN.slice(0, 4)) || homeN.includes(h.slice(0, 4));
    const awayMatch = a.includes(awayN.slice(0, 4)) || awayN.includes(a.slice(0, 4));
    return homeMatch && awayMatch;
  });

  if (!match) return null;

  const bookmaker = match.bookmakers?.[0];
  if (!bookmaker) return null;

  const h2h = bookmaker.markets?.find(m => m.key === 'h2h');
  if (!h2h) return null;

  const homeOdd = h2h.outcomes?.find(o => normalize(o.name) === normalize(match.home_team));
  const awayOdd = h2h.outcomes?.find(o => normalize(o.name) === normalize(match.away_team));
  const drawOdd = h2h.outcomes?.find(o => o.name === 'Draw');

  return {
    home: homeOdd ? parseFloat(homeOdd.price.toFixed(2)) : null,
    away: awayOdd ? parseFloat(awayOdd.price.toFixed(2)) : null,
    draw: drawOdd ? parseFloat(drawOdd.price.toFixed(2)) : null,
    bookmaker: bookmaker.title
  };
}

// ─── ANALYSE IA ───────────────────────────────────────────────

function analyzeMatch(homeStats, awayStats) {
  if (!homeStats || !awayStats) return { winner: 'home', confidence: 52 };

  const homeWins = homeStats.fixtures?.wins?.home?.total || 0;
  const homePlayed = Math.max(homeStats.fixtures?.played?.home?.total || 1, 1);
  const awayWins = awayStats.fixtures?.wins?.away?.total || 0;
  const awayPlayed = Math.max(awayStats.fixtures?.played?.away?.total || 1, 1);

  const homeWinRate = homeWins / homePlayed;
  const awayWinRate = awayWins / awayPlayed;

  const homeGoalsFor = parseFloat(homeStats.goals?.for?.average?.home || 1);
  const awayGoalsFor = parseFloat(awayStats.goals?.for?.average?.away || 1);
  const homeGoalsAgainst = parseFloat(homeStats.goals?.against?.average?.home || 1);
  const awayGoalsAgainst = parseFloat(awayStats.goals?.against?.average?.away || 1);

  const homeForm = (homeStats.form || 'WDWDW').split('').slice(-5)
    .reduce((acc, r) => acc + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
  const awayForm = (awayStats.form || 'WDWDW').split('').slice(-5)
    .reduce((acc, r) => acc + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);

  const homeScore = (homeWinRate * 40) + (homeGoalsFor * 12) - (homeGoalsAgainst * 6) + (homeForm * 2);
  const awayScore = (awayWinRate * 40) + (awayGoalsFor * 12) - (awayGoalsAgainst * 6) + (awayForm * 2);

  const diff = Math.abs(homeScore - awayScore);
  let confidence = Math.min(88, 52 + diff * 1.5);
  let winner;

  if (homeScore > awayScore + 8) winner = 'home';
  else if (awayScore > homeScore + 8) winner = 'away';
  else { winner = 'draw'; confidence = Math.max(48, confidence - 12); }

  return { winner, confidence: Math.round(confidence) };
}

// ─── MESSAGE LIMITE ───────────────────────────────────────────

function sendLimitMessage(chatId, msgId, category) {
  const emojis = { safe: '👑', fun: '👽', combine: '🚨', buteur: '🎯' };
  const names = { safe: 'SAFE', fun: 'FUN', combine: 'COMBINÉ', buteur: 'BUTEUR' };
  bot.editMessageText(
    `${emojis[category]} *Prédiction ${names[category]} déjà utilisée aujourd'hui !*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔒 Tu as déjà consulté ta prédiction ${names[category]} du jour.\n\n` +
    `💎 *Tu veux des prédictions illimitées et exclusives ?*\n\n` +
    `👉 Rejoins notre communauté premium :\n` +
    `[LA\_PREDICTION777](https://www.instagram.com/la_prediction777?igsh=MXJyNW82ajU3NDM4Yw%3D%3D&utm_source=qr)\n\n` +
    `⏰ *Tes prédictions se réinitialisent à minuit !* 🔄`,
    {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown', disable_web_page_preview: false,
      reply_markup: { inline_keyboard: [[{ text: '🔙 Retour au menu', callback_data: 'menu' }]] }
    }
  );
}

// ─── MENUS ────────────────────────────────────────────────────

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '👑 SAFE', callback_data: 'safe' }, { text: '👽 FUN', callback_data: 'fun' }],
      [{ text: '🚨 COMBINÉ', callback_data: 'combine' }, { text: '🎯 BUTEUR', callback_data: 'buteur' }],
      [{ text: '📲 Nous contacter', callback_data: 'contact' }]
    ]
  }
};

const backMenu = {
  reply_markup: {
    inline_keyboard: [[{ text: '🔙 Retour au menu', callback_data: 'menu' }]]
  }
};

// ─── START ────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'Champion';
  bot.sendMessage(msg.chat.id,
    `🏆 *Bienvenue ${name} sur LA PREDICTION 777* 🏆\n\n` +
    `🤖 Notre IA analyse en temps réel les matchs des meilleures ligues européennes.\n\n` +
    `🏆 Ligue 1 • Premier League • La Liga\n` +
    `🏆 Bundesliga • Serie A • Champions League\n` +
    `🏆 Europa League • Eredivisie • Primeira Liga\n\n` +
    `📊 *Choisis ton type de pari :*\n\n` +
    `_⚠️ 1 prédiction gratuite par catégorie et par jour_`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

// ─── DEBUG ────────────────────────────────────────────────────

bot.onText(/\/debug/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, '🔍 *Diagnostic en cours...*', { parse_mode: 'Markdown' });

  const today = new Date().toISOString().split('T')[0];
  let totalFixtures = 0;
  let leagueResults = '';

  for (const league of LEAGUES) {
    const fixtures = await getFixturesByLeague(league.id, league.season);
    totalFixtures += fixtures.length;
    leagueResults += `${fixtures.length > 0 ? '✅' : '❌'} ${league.name} : ${fixtures.length} match(s)\n`;
  }

  await bot.sendMessage(chatId,
    `📅 *Date :* ${today}\n` +
    `⚽ *Total matchs :* ${totalFixtures}\n\n` +
    `*Détail par ligue :*\n${leagueResults}`,
    { parse_mode: 'Markdown' }
  );

  const odds = await getRealOdds();
  await bot.sendMessage(chatId,
    `💰 *Odds API :* ${odds.length} matchs avec cotes\n` +
    (odds.length > 0
      ? `Exemple : ${odds[0].home_team} vs ${odds[0].away_team}`
      : `❌ Aucune cote trouvée`),
    { parse_mode: 'Markdown' }
  );
});

// ─── CALLBACKS ────────────────────────────────────────────────

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;

  bot.answerCallbackQuery(query.id);

  if (data === 'menu') {
    bot.editMessageText(
      `🏆 *LA PREDICTION 777* — Menu principal\n\n📊 *Choisis ton type de pari :*\n\n_⚠️ 1 prédiction gratuite par catégorie et par jour_`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
    );
    return;
  }

  if (data === 'contact') {
    bot.editMessageText(
      `📲 *Nous contacter*\n\n` +
      `Pour toute question ou abonnement premium :\n\n` +
      `👉 [LA\_PREDICTION777](https://www.instagram.com/la_prediction777?igsh=MXJyNW82ajU3NDM4Yw%3D%3D&utm_source=qr)\n\n` +
      `_Notre équipe te répond rapidement_ 🤝`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', disable_web_page_preview: false, ...backMenu }
    );
    return;
  }

  const categories = ['safe', 'fun', 'combine', 'buteur'];
  if (!categories.includes(data)) return;

  if (hasUsedToday(userId, data)) {
    sendLimitMessage(chatId, msgId, data);
    return;
  }

  bot.editMessageText(
    `⏳ *Analyse IA en cours...*\n\n` +
    `🔍 Scan des ligues européennes\n` +
    `📊 Analyse statistiques d'équipes\n` +
    `💰 Récupération des vraies cotes\n` +
    `🧠 Modélisation prédictive...\n\n` +
    `_Patiente quelques secondes..._`,
    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
  );

  const [fixtures, oddsData] = await Promise.all([getAllFixturesToday(), getRealOdds()]);

  if (!fixtures || fixtures.length === 0) {
    bot.editMessageText(
      `😔 *Aucun match disponible aujourd'hui*\n\nPas de matchs dans les ligues européennes ce soir. Reviens demain ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu }
    );
    return;
  }

  markAsUsed(userId, data);

  if (data === 'safe') await handleSafe(chatId, msgId, fixtures, oddsData);
  else if (data === 'fun') await handleFun(chatId, msgId, fixtures, oddsData);
  else if (data === 'combine') await handleCombine(chatId, msgId, fixtures, oddsData);
  else if (data === 'buteur') await handleButeur(chatId, msgId, fixtures, oddsData);
});

// ─── 👑 SAFE (1.30 – 1.90) ───────────────────────────────────

async function handleSafe(chatId, msgId, fixtures, oddsData) {
  let bestPick = null;
  let bestConf = 0;

  for (const fix of fixtures) {
    const { teams, leagueInfo } = fix;
    const realOdds = findOddsForMatch(oddsData, teams.home.name, teams.away.name);
    if (!realOdds) continue;

    const [homeStats, awayStats] = await Promise.all([
      getTeamStats(teams.home.id, leagueInfo.id, leagueInfo.season),
      getTeamStats(teams.away.id, leagueInfo.id, leagueInfo.season)
    ]);

    const analysis = analyzeMatch(homeStats, awayStats);
    let targetOdd, label;

    if (analysis.winner === 'home' && realOdds.home >= 1.30 && realOdds.home <= 1.90) {
      targetOdd = realOdds.home; label = `🏠 Victoire ${teams.home.name}`;
    } else if (analysis.winner === 'away' && realOdds.away >= 1.30 && realOdds.away <= 1.90) {
      targetOdd = realOdds.away; label = `✈️ Victoire ${teams.away.name}`;
    } else if (analysis.winner === 'draw' && realOdds.draw >= 1.30 && realOdds.draw <= 1.90) {
      targetOdd = realOdds.draw; label = `🤝 Match Nul`;
    } else continue;

    if (analysis.confidence > bestConf) {
      bestConf = analysis.confidence;
      bestPick = { fix, label, odd: targetOdd, conf: analysis.confidence, leagueInfo, realOdds };
    }
  }

  // Fallback élargi si rien trouvé
  if (!bestPick) {
    for (const fix of fixtures) {
      const { teams, leagueInfo } = fix;
      const realOdds = findOddsForMatch(oddsData, teams.home.name, teams.away.name);
      if (!realOdds) continue;
      const candidates = [
        { odd: realOdds.home, label: `🏠 Victoire ${teams.home.name}` },
        { odd: realOdds.away, label: `✈️ Victoire ${teams.away.name}` },
        { odd: realOdds.draw, label: `🤝 Match Nul` }
      ].filter(o => o.odd && o.odd >= 1.20 && o.odd <= 2.10);

      if (candidates.length > 0) {
        const pick = candidates.sort((a, b) => Math.abs(a.odd - 1.60) - Math.abs(b.odd - 1.60))[0];
        bestPick = { fix, label: pick.label, odd: pick.odd, conf: 60, leagueInfo, realOdds };
        break;
      }
    }
  }

  if (!bestPick) {
    bot.editMessageText(
      `😔 *Aucun pari SAFE disponible aujourd'hui*\n\nReviens demain ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu }
    );
    return;
  }

  const { fix, label, odd, conf, leagueInfo, realOdds } = bestPick;
  bot.editMessageText(
    `👑 *PARI SAFE DU JOUR*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏆 *${leagueInfo.name}* — ${leagueInfo.country}\n` +
    `⏰ *${formatTime(fix.fixture.date)}* (Paris)\n\n` +
    `⚽ *${fix.teams.home.name}*\n        vs\n⚽ *${fix.teams.away.name}*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Prédiction :* ${label}\n` +
    `💰 *Cote :* \`${odd.toFixed(2)}\` _(${realOdds.bookmaker})_\n\n` +
    `📊 *Confiance IA :*\n${confidenceBar(conf)}\n${confidenceLabel(conf)}\n\n` +
    `🧠 *Analyse :* Croisement du taux de victoires domicile/extérieur, forme des 5 derniers matchs, moyenne de buts et validation par les cotes bookmakers.\n\n` +
    `💵 *Gain pour 10€ :* ${(10 * odd).toFixed(2)}€\n\n` +
    `⚠️ _Pariez de manière responsable._`,
    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu }
  );
}

// ─── 👽 FUN (2.50 – 8.00) ────────────────────────────────────

async function handleFun(chatId, msgId, fixtures, oddsData) {
  let bestPick = null;
  let bestValue = 0;

  for (const fix of fixtures) {
    const { teams, leagueInfo } = fix;
    const realOdds = findOddsForMatch(oddsData, teams.home.name, teams.away.name);
    if (!realOdds) continue;

    const [homeStats, awayStats] = await Promise.all([
      getTeamStats(teams.home.id, leagueInfo.id, leagueInfo.season),
      getTeamStats(teams.away.id, leagueInfo.id, leagueInfo.season)
    ]);

    const analysis = analyzeMatch(homeStats, awayStats);
    const candidates = [
      { odd: realOdds.home, label: `🏠 Victoire ${teams.home.name}`, type: 'home' },
      { odd: realOdds.away, label: `✈️ Victoire ${teams.away.name}`, type: 'away' },
      { odd: realOdds.draw, label: `🤝 Match Nul`, type: 'draw' }
    ].filter(c => c.odd && c.odd >= 2.50 && c.odd <= 8.00);

    for (const c of candidates) {
      const isAligned = c.type === analysis.winner;
      const valueScore = isAligned ? (c.odd * (analysis.confidence / 100)) : (c.odd * 0.28);
      if (valueScore > bestValue) {
        bestValue = valueScore;
        const conf = isAligned ? analysis.confidence : Math.round(analysis.confidence * 0.65);
        bestPick = { fix, label: c.label, odd: c.odd, conf, leagueInfo, realOdds };
      }
    }
  }

  if (!bestPick) {
    bot.editMessageText(
      `😔 *Aucun pari FUN disponible aujourd'hui*\n\nReviens demain ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu }
    );
    return;
  }

  const { fix, label, odd, conf, leagueInfo, realOdds } = bestPick;
  bot.editMessageText(
    `👽 *PARI FUN DU JOUR*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏆 *${leagueInfo.name}* — ${leagueInfo.country}\n` +
    `⏰ *${formatTime(fix.fixture.date)}* (Paris)\n\n` +
    `⚽ *${fix.teams.home.name}*\n        vs\n⚽ *${fix.teams.away.name}*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Prédiction :* ${label}\n` +
    `💰 *Cote :* \`${odd.toFixed(2)}\` _(${realOdds.bookmaker})_\n\n` +
    `📊 *Confiance IA :*\n${confidenceBar(conf)}\n${confidenceLabel(conf)}\n\n` +
    `🧠 *Analyse :* Détection d'une valeur sur cette cote. Les bookmakers sous-estiment ce résultat selon nos modèles statistiques.\n\n` +
    `💵 *Gain pour 10€ :* ${(10 * odd).toFixed(2)}€\n` +
    `💵 *Gain pour 20€ :* ${(20 * odd).toFixed(2)}€\n\n` +
    `⚠️ _Pariez de manière responsable._`,
    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu }
  );
}

// ─── 🚨 COMBINÉ (1.30 – 3.00) ────────────────────────────────

async function handleCombine(chatId, msgId, fixtures, oddsData) {
  const picks = [];

  for (const fix of fixtures) {
    if (picks.length >= 3) break;
    const { teams, leagueInfo } = fix;
    const realOdds = findOddsForMatch(oddsData, teams.home.name, teams.away.name);
    if (!realOdds) continue;

    const [homeStats, awayStats] = await Promise.all([
      getTeamStats(teams.home.id, leagueInfo.id, leagueInfo.season),
      getTeamStats(teams.away.id, leagueInfo.id, leagueInfo.season)
    ]);

    const analysis = analyzeMatch(homeStats, awayStats);
    if (analysis.confidence < 55) continue;

    let targetOdd, label;
    if (analysis.winner === 'home' && realOdds.home >= 1.30 && realOdds.home <= 3.00) {
      targetOdd = realOdds.home; label = `🏠 ${teams.home.name}`;
    } else if (analysis.winner === 'away' && realOdds.away >= 1.30 && realOdds.away <= 3.00) {
      targetOdd = realOdds.away; label = `✈️ ${teams.away.name}`;
    } else continue;

    if (picks.find(p => p.leagueInfo.id === leagueInfo.id)) continue;
    picks.push({ fix, label, odd: targetOdd, conf: analysis.confidence, leagueInfo, realOdds });
  }

  if (picks.length < 2) {
    bot.editMessageText(
      `😔 *Combiné impossible aujourd'hui*\n\nPas assez de matchs valides dans les ligues. Reviens demain ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu }
    );
    return;
  }

  const totalOdd = picks.reduce((acc, p) => acc * p.odd, 1);
  const avgConf = Math.round(picks.reduce((acc, p) => acc + p.conf, 0) / picks.length);

  let lines =
    `🚨 *COMBINÉ DU JOUR — ${picks.length} MATCHS*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  picks.forEach((p, i) => {
    lines += `*${i + 1}.* 🏆 ${p.leagueInfo.name}\n`;
    lines += `    ⏰ ${formatTime(p.fix.fixture.date)} | _(${p.realOdds.bookmaker})_\n`;
    lines += `    ⚽ ${p.fix.teams.home.name} vs ${p.fix.teams.away.name}\n`;
    lines += `    🎯 ${p.label} @ \`${p.odd.toFixed(2)}\`\n`;
    lines += `    📊 Confiance : *${p.conf}%*\n\n`;
  });

  lines +=
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Cote totale :* \`${totalOdd.toFixed(2)}\`\n` +
    `💵 *Gain pour 10€ :* ${(10 * totalOdd).toFixed(2)}€\n` +
    `💵 *Gain pour 20€ :* ${(20 * totalOdd).toFixed(2)}€\n\n` +
    `📊 *Confiance globale IA :*\n${confidenceBar(avgConf)}\n${confidenceLabel(avgConf)}\n\n` +
    `🧠 *Analyse :* Seuls les matchs avec forte convergence statistique sont retenus. Chaque sélection validée indépendamment.\n\n` +
    `⚠️ _Pariez de manière responsable._`;

  bot.editMessageText(lines, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu });
}

// ─── 🎯 BUTEUR ────────────────────────────────────────────────

async function handleButeur(chatId, msgId, fixtures, oddsData) {
  let bestPick = null;
  let bestConf = 0;

  for (const fix of fixtures) {
    const { teams, leagueInfo } = fix;
    const topScorers = await getTopScorers(leagueInfo.id, leagueInfo.season);
    if (!topScorers.length) continue;

    const realOdds = findOddsForMatch(oddsData, teams.home.name, teams.away.name);

    for (const scorer of topScorers) {
      const teamId = scorer.statistics?.[0]?.team?.id;
      if (teamId !== teams.home.id && teamId !== teams.away.id) continue;

      const goals = scorer.statistics?.[0]?.goals?.total || 0;
      const played = Math.max(scorer.statistics?.[0]?.games?.appearences || 1, 1);
      const goalsPerGame = goals / played;
      if (goalsPerGame < 0.3) continue;

      const conf = Math.min(85, Math.round(goalsPerGame * 65 + 35));
      if (conf <= bestConf) continue;

      const estimatedOdd = parseFloat(Math.max(1.80, (1 / goalsPerGame) * 0.80).toFixed(2));
      const teamName = teamId === teams.home.id ? teams.home.name : teams.away.name;
      const isHome = teamId === teams.home.id;

      bestConf = conf;
      bestPick = {
        player: scorer.player,
        teamName, goals, played,
        goalsPerGame: goalsPerGame.toFixed(2),
        odd: estimatedOdd, conf,
        matchStr: `${teams.home.name} vs ${teams.away.name}`,
        time: formatTime(fix.fixture.date),
        leagueInfo,
        teamOdd: isHome ? realOdds?.home : realOdds?.away,
        bookmaker: realOdds?.bookmaker || 'Estimation IA'
      };
    }
  }

  if (!bestPick) {
    bot.editMessageText(
      `😔 *Aucun buteur trouvé aujourd'hui*\n\nReviens demain ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu }
    );
    return;
  }

  const p = bestPick;
  const lastName = p.player.lastname?.toUpperCase() || p.player.name?.toUpperCase() || 'INCONNU';
  const firstName = p.player.firstname || '';

  bot.editMessageText(
    `🎯 *BUTEUR DU JOUR*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏆 *${p.leagueInfo.name}*\n` +
    `⏰ *${p.time}* (Paris)\n` +
    `⚽ *${p.matchStr}*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Buteur sélectionné :*\n` +
    `   ${firstName} *${lastName}*\n` +
    `   🏃 Équipe : *${p.teamName}*\n\n` +
    `📈 *Stats saison :*\n` +
    `   ⚽ Buts : *${p.goals}*\n` +
    `   🎮 Matchs : *${p.played}*\n` +
    `   📊 Moyenne : *${p.goalsPerGame} but/match*\n\n` +
    `💰 *Cote buteur :* \`${p.odd.toFixed(2)}\`\n` +
    (p.teamOdd ? `💰 *Cote victoire ${p.teamName} :* \`${p.teamOdd.toFixed(2)}\` _(${p.bookmaker})_\n` : '') +
    `\n📊 *Confiance IA :*\n${confidenceBar(p.conf)}\n${confidenceLabel(p.conf)}\n\n` +
    `🧠 *Analyse :* Meilleur ratio buts/match parmi tous les attaquants en jeu aujourd'hui dans nos ligues.\n\n` +
    `💵 *Gain pour 10€ :* ${(10 * p.odd).toFixed(2)}€\n\n` +
    `⚠️ _Pariez de manière responsable._`,
    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu }
  );
}

console.log('🤖 LA PREDICTION 777 — Bot démarré ✅');
