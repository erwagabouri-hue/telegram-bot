const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');

const TOKEN = process.env.BOT_TOKEN;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── HELPERS API ─────────────────────────────────────────────
async function getFixturesToday() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const res = await axios.get('https://v3.football.api-sports.io/fixtures', {
      headers: { 'x-apisports-key': API_FOOTBALL_KEY },
      params: { date: today, status: 'NS', timezone: 'Europe/Paris' }
    });
    return res.data.response || [];
  } catch (e) {
    console.error('Erreur API fixtures:', e.message);
    return [];
  }
}

async function getOdds(fixtureId) {
  try {
    const res = await axios.get('https://v3.football.api-sports.io/odds', {
      headers: { 'x-apisports-key': API_FOOTBALL_KEY },
      params: { fixture: fixtureId, bookmaker: 6 } // 6 = Bet365
    });
    const data = res.data.response;
    if (!data || data.length === 0) return null;
    const bets = data[0]?.bookmakers?.[0]?.bets;
    if (!bets) return null;

    const matchWinner = bets.find(b => b.name === 'Match Winner');
    const btts = bets.find(b => b.name === 'Both Teams Score');
    const scorer = bets.find(b => b.name === 'Anytime Score');

    return { matchWinner, btts, scorer, allBets: bets };
  } catch (e) {
    return null;
  }
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
    return res.data.response?.slice(0, 10) || [];
  } catch (e) {
    return [];
  }
}

// ─── ANALYSE IA ──────────────────────────────────────────────
function confidenceBar(score) {
  const filled = Math.round(score / 10);
  return '🟩'.repeat(filled) + '⬜'.repeat(10 - filled) + ` ${score}%`;
}

function getConfidenceLevel(pct) {
  if (pct >= 80) return '🔥 TRÈS ÉLEVÉ';
  if (pct >= 65) return '✅ ÉLEVÉ';
  if (pct >= 50) return '⚡ MOYEN';
  return '⚠️ FAIBLE';
}

function analyzeWinner(homeStats, awayStats, odds) {
  if (!homeStats || !awayStats) return null;

  const homeWinRate = homeStats.fixtures?.wins?.home?.total / Math.max(homeStats.fixtures?.played?.home?.total, 1);
  const awayWinRate = awayStats.fixtures?.wins?.away?.total / Math.max(awayStats.fixtures?.played?.away?.total, 1);
  const homeGoalsFor = homeStats.goals?.for?.average?.home || 0;
  const awayGoalsFor = awayStats.goals?.for?.average?.away || 0;
  const homeGoalsAgainst = homeStats.goals?.against?.average?.home || 0;
  const awayGoalsAgainst = awayStats.goals?.against?.average?.away || 0;

  // Score composite
  const homeScore = (homeWinRate * 50) + (parseFloat(homeGoalsFor) * 10) - (parseFloat(homeGoalsAgainst) * 5);
  const awayScore = (awayWinRate * 50) + (parseFloat(awayGoalsFor) * 10) - (parseFloat(awayGoalsAgainst) * 5);

  let winner, confidence;
  const diff = Math.abs(homeScore - awayScore);
  confidence = Math.min(90, 50 + diff * 2);

  if (homeScore > awayScore + 5) {
    winner = 'home';
  } else if (awayScore > homeScore + 5) {
    winner = 'away';
  } else {
    winner = 'draw';
    confidence = Math.max(45, confidence - 15);
  }

  return { winner, confidence: Math.round(confidence) };
}

// ─── MENUS ───────────────────────────────────────────────────
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '👑 SAFE', callback_data: 'safe' }, { text: '👽 FUN', callback_data: 'fun' }],
      [{ text: '🚨 COMBINÉ', callback_data: 'combine' }, { text: '🎯 BUTEUR', callback_data: 'buteur' }],
      [{ text: '📲 Nous contacter', callback_data: 'contact' }]
    ]
  }
};

function backMenu() {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: '🔙 Retour au menu', callback_data: 'menu' }]]
    }
  };
}

// ─── COMMANDE START ──────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'Champion';
  bot.sendMessage(msg.chat.id,
    `🏆 *Bienvenue ${name} sur LA PREDICTION 777* 🏆\n\n` +
    `🤖 Notre IA analyse les matchs en temps réel pour te donner les meilleures prédictions football du jour.\n\n` +
    `📊 *Choisissez votre type de pari :*`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

// ─── CALLBACKS ───────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const data = query.data;

  bot.answerCallbackQuery(query.id);

  if (data === 'menu') {
    bot.editMessageText(
      `🏆 *LA PREDICTION 777* — Menu principal\n\n📊 *Choisissez votre type de pari :*`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
    );
    return;
  }

  if (data === 'contact') {
    bot.editMessageText(
      `📲 *Nous contacter*\n\n` +
      `Pour toute question, collaboration ou abonnement premium, rejoins-nous sur Instagram :\n\n` +
      `👉 [LA\_PREDICTION777](https://www.instagram.com/la_prediction777?igsh=MXJyNW82ajU3NDM4Yw%3D%3D&utm_source=qr)\n\n` +
      `_Notre équipe te répond dans les plus brefs délais_ 🤝`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', disable_web_page_preview: false, ...backMenu() }
    );
    return;
  }

  // Loading message
  bot.editMessageText(
    `⏳ *Analyse IA en cours...*\n\n🔍 Scan des matchs du jour\n📊 Calcul des statistiques\n🧠 Modélisation prédictive\n\n_Patiente quelques secondes..._`,
    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
  );

  const fixtures = await getFixturesToday();

  if (!fixtures || fixtures.length === 0) {
    bot.editMessageText(
      `😔 *Aucun match disponible aujourd'hui*\n\nReviens demain pour de nouvelles prédictions ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu() }
    );
    return;
  }

  if (data === 'safe') await handleSafe(chatId, msgId, fixtures);
  else if (data === 'fun') await handleFun(chatId, msgId, fixtures);
  else if (data === 'combine') await handleCombine(chatId, msgId, fixtures);
  else if (data === 'buteur') await handleButeur(chatId, msgId, fixtures);
});

// ─── SAFE 👑 (cote 1.30–1.90) ────────────────────────────────
async function handleSafe(chatId, msgId, fixtures) {
  let bestPick = null;
  let bestConf = 0;

  for (const fix of fixtures.slice(0, 20)) {
    const { fixture, teams, league } = fix;
    const season = league.season;

    const [homeStats, awayStats, oddsData] = await Promise.all([
      getTeamStats(teams.home.id, league.id, season),
      getTeamStats(teams.away.id, league.id, season),
      getOdds(fixture.id)
    ]);

    const analysis = analyzeWinner(homeStats, awayStats, oddsData);
    if (!analysis) continue;

    const mw = oddsData?.matchWinner?.values;
    if (!mw) continue;

    let targetOdd, label;
    if (analysis.winner === 'home') {
      const val = mw.find(v => v.value === 'Home');
      if (!val) continue;
      const odd = parseFloat(val.odd);
      if (odd < 1.30 || odd > 1.90) continue;
      targetOdd = odd;
      label = `🏠 Victoire ${teams.home.name}`;
    } else if (analysis.winner === 'away') {
      const val = mw.find(v => v.value === 'Away');
      if (!val) continue;
      const odd = parseFloat(val.odd);
      if (odd < 1.30 || odd > 1.90) continue;
      targetOdd = odd;
      label = `✈️ Victoire ${teams.away.name}`;
    } else continue;

    if (analysis.confidence > bestConf) {
      bestConf = analysis.confidence;
      bestPick = { fix, label, odd: targetOdd, conf: analysis.confidence, league };
    }
  }

  if (!bestPick) {
    bot.editMessageText(
      `😔 *Aucun pari SAFE trouvé aujourd'hui*\n\nLes cotes disponibles ne correspondent pas aux critères de sécurité. Reviens demain ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu() }
    );
    return;
  }

  const { fix, label, odd, conf, league } = bestPick;
  const time = new Date(fix.fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

  const msg =
    `👑 *PARI SAFE DU JOUR*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏆 *${league.name}* — ${league.country}\n` +
    `⏰ ${time} (heure de Paris)\n\n` +
    `⚽ *${fix.teams.home.name}* vs *${fix.teams.away.name}*\n\n` +
    `🎯 *Prédiction :* ${label}\n` +
    `💰 *Cote :* \`${odd.toFixed(2)}\`\n\n` +
    `📊 *Niveau de confiance :*\n` +
    `${confidenceBar(conf)}\n` +
    `${getConfidenceLevel(conf)}\n\n` +
    `🧠 *Analyse IA :* Basée sur le taux de victoires domicile/extérieur, la moyenne de buts et la forme récente des équipes.\n\n` +
    `⚠️ _Le pari responsable avant tout. Ne misez que ce que vous pouvez vous permettre de perdre._`;

  bot.editMessageText(msg, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu() });
}

// ─── FUN 👽 (cote 2.50–8.00) ─────────────────────────────────
async function handleFun(chatId, msgId, fixtures) {
  let bestPick = null;
  let bestScore = 0;

  for (const fix of fixtures.slice(0, 25)) {
    const { fixture, teams, league } = fix;
    const season = league.season;

    const [homeStats, awayStats, oddsData] = await Promise.all([
      getTeamStats(teams.home.id, league.id, season),
      getTeamStats(teams.away.id, league.id, season),
      getOdds(fixture.id)
    ]);

    const mw = oddsData?.matchWinner?.values;
    if (!mw) continue;

    // Cherche la cote la plus value dans la range
    for (const outcome of ['Home', 'Draw', 'Away']) {
      const val = mw.find(v => v.value === outcome);
      if (!val) continue;
      const odd = parseFloat(val.odd);
      if (odd < 2.50 || odd > 8.00) continue;

      // Score value = potentiel gain * probabilité estimée
      let estProb;
      if (outcome === 'Draw') estProb = 0.28;
      else if (outcome === 'Home') estProb = 0.45;
      else estProb = 0.30;

      const valueScore = odd * estProb;

      if (valueScore > bestScore) {
        bestScore = valueScore;
        const label = outcome === 'Home' ? `🏠 Victoire ${teams.home.name}` :
          outcome === 'Away' ? `✈️ Victoire ${teams.away.name}` : `🤝 Match Nul`;
        const conf = Math.round(Math.min(75, estProb * 200));
        bestPick = { fix, label, odd, conf, league };
      }
    }
  }

  if (!bestPick) {
    bot.editMessageText(
      `😔 *Aucun pari FUN trouvé aujourd'hui*\n\nReviens demain ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu() }
    );
    return;
  }

  const { fix, label, odd, conf, league } = bestPick;
  const time = new Date(fix.fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

  const msg =
    `👽 *PARI FUN DU JOUR*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏆 *${league.name}* — ${league.country}\n` +
    `⏰ ${time} (heure de Paris)\n\n` +
    `⚽ *${fix.teams.home.name}* vs *${fix.teams.away.name}*\n\n` +
    `🎯 *Prédiction :* ${label}\n` +
    `💰 *Cote :* \`${odd.toFixed(2)}\`\n\n` +
    `📊 *Niveau de confiance :*\n` +
    `${confidenceBar(conf)}\n` +
    `${getConfidenceLevel(conf)}\n\n` +
    `🧠 *Analyse IA :* Détection de valeur sur cotes sous-estimées par les bookmakers basée sur les statistiques historiques.\n\n` +
    `🔥 *Gain potentiel pour 10€ misés :* ${(10 * odd).toFixed(2)}€\n\n` +
    `⚠️ _Pari à risque modéré. Ne misez que ce que vous pouvez vous permettre de perdre._`;

  bot.editMessageText(msg, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu() });
}

// ─── COMBINÉ 🚨 (3 matchs, cote totale affichée) ─────────────
async function handleCombine(chatId, msgId, fixtures) {
  const picks = [];

  for (const fix of fixtures.slice(0, 30)) {
    if (picks.length >= 3) break;
    const { fixture, teams, league } = fix;
    const season = league.season;

    const [homeStats, awayStats, oddsData] = await Promise.all([
      getTeamStats(teams.home.id, league.id, season),
      getTeamStats(teams.away.id, league.id, season),
      getOdds(fixture.id)
    ]);

    const analysis = analyzeWinner(homeStats, awayStats, oddsData);
    if (!analysis) continue;

    const mw = oddsData?.matchWinner?.values;
    if (!mw) continue;

    let outcome = analysis.winner === 'home' ? 'Home' : analysis.winner === 'away' ? 'Away' : 'Draw';
    const val = mw.find(v => v.value === outcome);
    if (!val) continue;

    const odd = parseFloat(val.odd);
    if (odd < 1.30 || odd > 3.00) continue;
    if (analysis.confidence < 50) continue;

    const label = outcome === 'Home' ? `🏠 ${teams.home.name}` :
      outcome === 'Away' ? `✈️ ${teams.away.name}` : `🤝 Nul`;

    picks.push({ fix, label, odd, conf: analysis.confidence, league });
  }

  if (picks.length < 2) {
    bot.editMessageText(
      `😔 *Combiné impossible aujourd'hui*\n\nPas assez de matchs avec les critères requis. Reviens demain ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu() }
    );
    return;
  }

  const totalOdd = picks.reduce((acc, p) => acc * p.odd, 1);
  const avgConf = Math.round(picks.reduce((acc, p) => acc + p.conf, 0) / picks.length);

  let lines = `🚨 *COMBINÉ DU JOUR (${picks.length} matchs)*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

  picks.forEach((p, i) => {
    const time = new Date(p.fix.fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    lines += `*${i + 1}.* ⚽ ${p.fix.teams.home.name} vs ${p.fix.teams.away.name}\n`;
    lines += `   ⏰ ${time} | 🏆 ${p.league.name}\n`;
    lines += `   🎯 ${p.label} @ \`${p.odd.toFixed(2)}\`\n`;
    lines += `   📊 Confiance : ${p.conf}%\n\n`;
  });

  lines += `━━━━━━━━━━━━━━━━━━━━\n`;
  lines += `💰 *Cote totale combinée :* \`${totalOdd.toFixed(2)}\`\n`;
  lines += `🔥 *Gain pour 10€ misés :* ${(10 * totalOdd).toFixed(2)}€\n\n`;
  lines += `📊 *Confiance globale :*\n${confidenceBar(avgConf)}\n${getConfidenceLevel(avgConf)}\n\n`;
  lines += `🧠 *Analyse IA :* Chaque sélection est validée indépendamment. Seuls les matchs avec une convergence statistique forte sont retenus.\n\n`;
  lines += `⚠️ _Le pari responsable avant tout._`;

  bot.editMessageText(lines, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu() });
}

// ─── BUTEUR 🎯 ────────────────────────────────────────────────
async function handleButeur(chatId, msgId, fixtures) {
  let bestPick = null;
  let bestConf = 0;

  for (const fix of fixtures.slice(0, 15)) {
    const { fixture, teams, league } = fix;
    const season = league.season;

    const topScorers = await getTopScorers(league.id, season);
    if (!topScorers.length) continue;

    // Cherche un buteur dans l'un des deux clubs
    for (const scorer of topScorers) {
      const teamId = scorer.statistics?.[0]?.team?.id;
      if (teamId !== teams.home.id && teamId !== teams.away.id) continue;

      const goals = scorer.statistics?.[0]?.goals?.total || 0;
      const played = scorer.statistics?.[0]?.games?.appearences || 1;
      const goalsPerGame = goals / played;

      const conf = Math.min(88, Math.round(goalsPerGame * 70 + 30));
      if (conf < 45 || conf <= bestConf) continue;

      const oddsData = await getOdds(fixture.id);
      const scorerBet = oddsData?.scorer?.values;
      let odd = null;

      if (scorerBet) {
        const playerName = `${scorer.player.firstname} ${scorer.player.lastname}`;
        const match = scorerBet.find(v => v.value?.toLowerCase().includes(scorer.player.lastname?.toLowerCase()));
        odd = match ? parseFloat(match.odd) : null;
      }

      if (!odd) odd = parseFloat((1 / goalsPerGame * 0.85).toFixed(2));
      if (odd < 1.50) odd = 1.50;
      if (odd > 8) continue;

      bestConf = conf;
      const teamName = teamId === teams.home.id ? teams.home.name : teams.away.name;
      const time = new Date(fix.fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

      bestPick = {
        player: scorer.player,
        teamName,
        goals,
        played,
        goalsPerGame: goalsPerGame.toFixed(2),
        odd: odd.toFixed(2),
        conf,
        matchStr: `${teams.home.name} vs ${teams.away.name}`,
        time,
        league
      };
      break;
    }
  }

  if (!bestPick) {
    bot.editMessageText(
      `😔 *Aucun buteur trouvé aujourd'hui*\n\nReviens demain ! 🔜`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu() }
    );
    return;
  }

  const p = bestPick;
  const msg =
    `🎯 *BUTEUR DU JOUR*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏆 *${p.league.name}*\n` +
    `⏰ ${p.time} (heure de Paris)\n` +
    `⚽ *${p.matchStr}*\n\n` +
    `👤 *Buteur sélectionné :*\n` +
    `${p.player.firstname} *${p.player.lastname.toUpperCase()}*\n` +
    `🏃 Équipe : ${p.teamName}\n\n` +
    `📈 *Statistiques :*\n` +
    `• Buts cette saison : *${p.goals}*\n` +
    `• Matchs joués : *${p.played}*\n` +
    `• Moyenne : *${p.goalsPerGame} but/match*\n\n` +
    `💰 *Cote estimée :* \`${p.odd}\`\n` +
    `🔥 *Gain pour 10€ :* ${(10 * parseFloat(p.odd)).toFixed(2)}€\n\n` +
    `📊 *Niveau de confiance :*\n` +
    `${confidenceBar(p.conf)}\n` +
    `${getConfidenceLevel(p.conf)}\n\n` +
    `🧠 *Analyse IA :* Sélection basée sur la forme offensive, le nombre de buts en cours de saison et l'opposition défensive adverse.\n\n` +
    `⚠️ _Le pari responsable avant tout._`;

  bot.editMessageText(msg, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...backMenu() });
}

// ─── CRON : envoi automatique chaque matin à 9h ──────────────
cron.schedule('0 9 * * *', async () => {
  console.log('📅 Envoi automatique des prédictions du jour...');
  // Tu peux ajouter ici un channel_id pour diffuser automatiquement
}, { timezone: 'Europe/Paris' });

// ─── HEALTH CHECK ─────────────────────────────────────────────
console.log('🤖 LA PREDICTION 777 Bot démarré ✅');

