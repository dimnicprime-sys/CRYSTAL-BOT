const {randomInt,ensureJson,saveJson}=require('../_utils');
module.exports={name:'slots',category:'games',description:'slots game.',async execute(ctx){const s=['🍒','🍋','🔔','⭐','7️⃣']; const a=[s[randomInt(0,4)],s[randomInt(0,4)],s[randomInt(0,4)]]; await ctx.reply(`🎰 | ${a.join(' | ')} |\n${a[0]===a[1]&&a[1]===a[2]?'JACKPOT! 🎉':'Try again!'}`);}};
