const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");

console.log("🚀 BOT START");

const bot = new Telegraf(process.env.BOT_TOKEN);

const menu = Markup.keyboard([
["🔎 Scanner les matchs"],
["🔥 Top Value Bets"],
["📊 Mes statistiques"],
["💎 Passer Premium"]
]).resize();

bot.start((ctx)=>{
ctx.reply(`🤖 IA VALUE BOT

Bot actif et fonctionnel.`, menu);
});

bot.hears("🔎 Scanner les matchs", async (ctx)=>{

try {

const res = await axios.get(
"https://api.the-odds-api.com/v4/sports/soccer_epl/odds",
{
params:{
apiKey:process.env.ODDS_API_KEY,
regions:"eu",
markets:"h2h",
oddsFormat:"decimal"
}
}
);

const matches = res.data;

if(!matches || matches.length === 0){
return ctx.reply("❌ Aucun match trouvé.");
}

const match = matches[0];

ctx.reply(`🔥 TEST SCAN

🏆 ${match.home_team} vs ${match.away_team}

Bot fonctionne correctement.`);

} catch(err){

console.log("SCAN ERROR:", err.message);
ctx.reply("❌ Erreur scan.");

}

});

bot.launch();

console.log("✅ BOT LANCÉ");
