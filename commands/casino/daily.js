const {ensureJson,saveJson,randomInt}=require('../_utils');
function wallet(){return ensureJson('wallet.json',{});}
function balance(id){const db=wallet(); return db[id]||1000;}
function setBalance(id,n){const db=wallet(); db[id]=Math.max(0,Math.floor(n)); saveJson('wallet.json',db);}

module.exports={name:'daily',category:'casino',description:'Claim daily points.',async execute(ctx){const db=ensureJson('casino-daily.json',{}),now=Date.now();if(now-(db[ctx.sender]||0)<86400000)return ctx.reply('⏳ Daily already claimed.');db[ctx.sender]=now;saveJson('casino-daily.json',db);setBalance(ctx.sender,balance(ctx.sender)+500);await ctx.reply('🎁 +500 points!');}};
