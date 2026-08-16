
'use strict';

const fs = require('fs');
const path = require('path');

/*
|--------------------------------------------------------------------------
| CRYSTAL BOT PREMIUM MENU
|--------------------------------------------------------------------------
*/

const BOT_NAME = 'CRYSTAL BOT';
const VERSION = '2.1.0';

function formatUptime(seconds) {
    seconds = Math.floor(seconds);

    const days = Math.floor(seconds / 86400);
    seconds %= 86400;

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);

    parts.push(`${seconds}s`);

    return parts.join(' ');
}

function getOwner() {
    const owners = global.OWNER_NUMBERS || [];

    if (!owners.length) {
        return 'Not configured';
    }

    return owners
        .map(owner => {
            const number =
                String(owner)
                    .split('@')[0]
                    .replace(/\D/g, '');

            return number
                ? `+${number}`
                : owner;
        })
        .join(', ');
}

function getBotNumber() {
    if (!global.BOT_NUMBER) {
        return 'Unknown';
    }

    return String(global.BOT_NUMBER)
        .split('@')[0]
        .replace(/\D/g, '');
}

function getProtectionStatus() {
    return {
        antilink:
            global.antilink?.size || 0,

        antispam:
            global.antispam?.size || 0,

        antitag:
            global.antitag?.size || 0,

        antibot:
            global.antibot?.size || 0
    };
}

module.exports = {
    name: 'menu',

    alias: [
        'commands',
        'cmds'
    ],

    description:
        'Show Crystal Bot premium command menu',

    category:
        'GENERAL',

    async execute({
        sock,
        jid,
        reply
    }) {

        const uptime =
            formatUptime(
                process.uptime()
            );

        const owner =
            getOwner();

        const botNumber =
            getBotNumber();

        const mode =
            global.isPublic
                ? 'PUBLIC'
                : 'PRIVATE';

        const commandCount =
            global.plugins
                ? global.plugins.size
                : 0;

        const protection =
            getProtectionStatus();

        /*
         * Put your Toji image here:
         *
         * core/assets/toji.jpg
         */
        const imagePath =
            path.join(
                __dirname,
                '..',
                'assets',
                'toji 2.jpg'
            );

        const menu = `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃
┃       𝑪𝑹𝒀𝑺𝑻𝑨𝑳 𝑩𝑶𝑻
┃          𝑽${VERSION}
┃
┃   ⚡ 𝑷𝒐𝒘𝒆𝒓𝒆𝒅 𝒃𝒚 𝑪𝒓𝒚𝒔𝒕𝒂𝒍
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👤 BOT INFORMATION 〕━━━╮
┃
┃ 👑 Owner   : ${owner}
┃ 📱 Number  : +${botNumber}
┃ 🌐 Mode    : ${mode}
┃ ⏱️ Uptime  : ${uptime}
┃ 🧩 Plugins : ${commandCount}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🤖 GENERAL 〕━━━╮
┃
┃ /help
┃ /ping
┃ /alive
┃ /owner
┃ /about
┃ /runtime
┃ /speed
┃ /repo
┃ /botinfo
┃ /menu
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🧠 ARTIFICIAL INTELLIGENCE 〕━━━╮
┃
┃ /ai
┃ /ask
┃ /chat
┃ /imagine
┃ /summarize
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🎨 MEDIA 〕━━━╮
┃
┃ /sticker
┃ /toimg
┃ /tovideo
┃ /tourl
┃ /ss
┃ /caption
┃ /enhance
┃ /removebg
┃ /vv
┃
╰━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🎵 DOWNLOADERS 〕━━━╮
┃
┃ /play
┃ /song
┃ /ytmp3
┃ /ytmp4
┃ /ytsearch
┃ /tiktok
┃ /instagram
┃ /facebook
┃ /twitter
┃ /mediafire
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🛠️ UTILITIES 〕━━━╮
┃
┃ /calc
┃ /translate
┃ /define
┃ /wiki
┃ /weather
┃ /time
┃ /country
┃ /shortlink
┃ /qr
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👥 GROUP MANAGEMENT 〕━━━╮
┃
┃ /kick
┃ /add
┃ /promote
┃ /demote
┃ /mute
┃ /unmute
┃ /ban
┃ /unban
┃ /warn
┃ /unwarn
┃ /warnings
┃ /tagall
┃ /hidetag
┃ /admins
┃ /groupinfo
┃ /setname
┃ /setdesc
┃ /link
┃ /revoke
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🛡️ PROTECTION 〕━━━╮
┃
┃ /protection
┃ /antilink
┃ /antispam
┃ /antitag
┃ /antibot
┃ /welcome
┃ /goodbye
┃ /setwelcome
┃ /setgoodbye
┃
┃ Active protection groups:
┃ 🔗 AntiLink : ${protection.antilink}
┃ 🚫 AntiSpam : ${protection.antispam}
┃ 👥 AntiTag  : ${protection.antitag}
┃ 🤖 AntiBot  : ${protection.antibot}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🎮 GAMES 〕━━━╮
┃
┃ /games
┃ /quiz
┃ /rps
┃ /coin
┃ /dice
┃ /slots
┃ /8ball
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🎰 CASINO 〕━━━╮
┃
┃ /balance
┃ /daily
┃ /roulette
┃ /blackjack
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🔥 FREE FIRE 〕━━━╮
┃
┃ /ff
┃ /ffsens
┃ /sensitivity
┃
┃ Device-based sensitivity
┃ profiles are supported.
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 💎 CRYSTAL BOT 〕━━━╮
┃
┃ Prefix : /
┃ Status : ONLINE 🟢
┃ Uptime : ${uptime}
┃
┃ Type /help for detailed usage.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯
`;

        /*
         * Send Toji image + menu.
         */
        if (
            fs.existsSync(imagePath)
        ) {

            await sock.sendMessage(
                jid,
                {
                    image:
                        fs.readFileSync(
                            imagePath
                        ),

                    caption:
                        menu
                }
            );

            return;
        }

        /*
         * If image is missing,
         * menu still works normally.
         */
        await reply(menu);
    }
};

