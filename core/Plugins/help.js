module.exports = {
    command: 'help',
    description: 'Show available commands',
    handler: async ({ sock, message }) => {
        const text = `💎 *CRYSTAL BOT v2.1.0*

📌 *GENERAL*
/help
/ping
/alive
/owner
/about
/runtime
/speed
/repo
/botinfo
/menu

🤖 *AI*
/ai
/ask
/chat
/imagine
/summarize

🎨 *MEDIA*
/sticker
/toimg
/tovideo
/tourl
/ss
/removebg
/enhance
/caption

🎵 *DOWNLOADER*
/play
/song
/ytmp3
/ytmp4
/ytsearch
/tiktok
/instagram
/facebook
/twitter
/mediafire

🌦️ *UTILITIES*
/weather
/translate
/define
/wiki
/calc
/time
/country
/shortlink
/qr

👥 *GROUP*
/kick
/add
/promote
/demote
/mute
/unmute
/ban
/unban
/warn
/unwarn
/warnings
/tagall
/hidetag
/admins
/groupinfo
/setname
/setdesc
/link
/revoke

🛡️ *PROTECTION*
/antilink
/antispam
/antitag
/antibot
/welcome
/goodbye
/setwelcome
/setgoodbye
/mutechat

🎮 *GAMES & CASINO*
/coinflip
/dice
/slot
/8ball
/guess
/rps
/blackjack
/roulette
/balance
/daily
/work
/bet

🔥 *FREE FIRE*
/ffsensitivity

More commands can be added as plugins.`;

        await sock.sendMessage(message.key.remoteJid, { text });
    }
};
