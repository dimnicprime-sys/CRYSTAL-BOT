const {ensureJson,saveJson,randomInt}=require('../_utils');
function wallet(){return ensureJson('wallet.json',{});}
function balance(id){const db=wallet(); return db[id]||1000;}
function setBalance(id,n){const db=wallet(); db[id]=Math.max(0,Math.floor(n)); saveJson('wallet.json',db);}

module.exports={name:'balance',aliases:['bal'],category:'casino',description:'Show points balance.',async execute(ctx){await ctx.reply(`💰 Balance: ${balance(ctx.sender)} points`);}};
