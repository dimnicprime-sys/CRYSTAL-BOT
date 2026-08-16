const {ensureJson,saveJson,randomInt}=require('../_utils');
function wallet(){return ensureJson('wallet.json',{});}
function balance(id){const db=wallet(); return db[id]||1000;}
function setBalance(id,n){const db=wallet(); db[id]=Math.max(0,Math.floor(n)); saveJson('wallet.json',db);}

module.exports={name:'leaderboard',category:'casino',description:'Show points leaderboard.',async execute(ctx){const db=wallet();const top=Object.entries(db).sort((a,b)=>b[1]-a[1]).slice(0,10).map((x,i)=>`${i+1}. @${x[0].split('@')[0]} — ${x[1]}`).join('\n');await ctx.sock.sendMessage(ctx.jid,{text:'🏆 Leaderboard\n'+(top||'No players yet.'),mentions:Object.keys(db).slice(0,10)},{quoted:ctx.message});}};
