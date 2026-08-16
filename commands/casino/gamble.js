const {ensureJson,saveJson,randomInt}=require('../_utils');
function wallet(){return ensureJson('wallet.json',{});}
function balance(id){const db=wallet(); return db[id]||1000;}
function setBalance(id,n){const db=wallet(); db[id]=Math.max(0,Math.floor(n)); saveJson('wallet.json',db);}

module.exports={name:'gamble',aliases:['bet'],category:'casino',description:'Gamble points.',async execute(ctx){const bet=Math.floor(Number(ctx.args?.[0]));if(!bet||bet<1)return ctx.reply('Usage: /gamble 100');const bal=balance(ctx.sender);if(bet>bal)return ctx.reply('❌ Insufficient points.');const win=Math.random()<0.48;const next=win?bal+bet:bal-bet;setBalance(ctx.sender,next);await ctx.reply(win?`🎰 You won ${bet} points!\nBalance: ${next}`:`💸 You lost ${bet} points.\nBalance: ${next}`);}};
