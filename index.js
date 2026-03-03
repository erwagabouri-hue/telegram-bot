const { Telegraf } = require("telegraf");

console.log("🔥 VERSION TEST ULTRA VISIBLE 🔥");

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("🔥 VERSION TEST ULTRA ACTIVE 🔥");
});

bot.launch();