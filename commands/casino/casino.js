const {ensureJson,saveJson,randomInt}=require('../_utils');
function wallet(){return ensureJson('wallet.json',{});}
function balance(id){const db=wallet(); return db[id]||1000;}
function setBalance(id,n){const db=wallet(); db[id]=Math.max(0,Math.floor(n)); saveJson('wallet.json',db);}

module.exports={name:'casino',category:'casino',description:'Show casino commands.',async execute(ctx){await ctx.reply(`🎰 *Crystal Casino*\n/balance\n/daily\n/gamble <points>\n/leaderboard\n\nPoints are virtual only and have no cash value.`);}};
