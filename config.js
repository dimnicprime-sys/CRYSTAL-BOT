
'use strict';

const fs = require('fs');
const path = require('path');
const pino = require('pino');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const cfg = require('./config');

const BOT_NAME = cfg.BOT_NAME || 'CRYSTAL BOT';
const VERSION = cfg.VERSION || '2.1.0';
const PREFIX = cfg.PREFIX || '/';

/* ==========================================================================
   GLOBAL STATE
========================================================================== */

global.plugins = global.plugins || new Map();

global.OWNER_NUMBERS = [];
global.SUDO = [];

global.isPublic =
    typeof global.isPublic === 'boolean'
        ? global.isPublic
        : true;

global.BOT_NUMBER = '';
global.BOT_LID = '';

global.mutedUsers = global.mutedUsers || new Set();
global.bannedUsers = global.bannedUsers || new Set();

global.antilink = global.antilink || new Set();
global.antispam = global.antispam || new Set();
global.antitag = global.antitag || new Set();
global.antibot = global.antibot || new Set();

global.welcome = global.welcome || {};
global.goodbye = global.goodbye || {};

global.welcomeMsg = global.welcomeMsg || {};
global.goodbyeMsg = global.goodbyeMsg || {};

global.aiMemory = global.aiMemory || {};
global.maxWarns = global.maxWarns || 3;
global.warns = global.warns || {};

/* ==========================================================================
   DIRECTORIES
========================================================================== */

const AUTH_DIR = path.join(__dirname, 'auth_info');
const PLUGIN_DIR = path.join(__dirname, 'Plugins');

if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

if (!fs.existsSync(PLUGIN_DIR)) {
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
}

/* ==========================================================================
   NUMBER / JID HELPERS
========================================================================== */

function normalizeNumber(number) {
    if (!number) return '';

    let value = String(number)
        .replace(/\D/g, '');

    if (value.startsWith('0') && value.length > 1) {
        value = '234' + value.slice(1);
    }

    return value;
}

function normalizeJid(jid) {
    if (!jid) return '';

    return String(jid)
        .replace(/:\d+@/, '@')
        .trim();
}

function numberToJid(number) {
    const clean = normalizeNumber(number);

    if (!clean) return '';

    return `${clean}@s.whatsapp.net`;
}

/*
 * Get the phone-number portion of a JID.
 */
function jidToNumber(jid) {
    if (!jid) return '';

    const normalized = normalizeJid(jid);

    return normalized
        .split('@')[0]
        .replace(/\D/g, '');
}

/* ==========================================================================
   CONFIG
========================================================================== */

function getConfiguredBotNumber() {
    try {
        if (typeof cfg.getPhoneNumber === 'function') {
            return normalizeNumber(
                cfg.getPhoneNumber()
            );
        }
    } catch (_) {}

    return normalizeNumber(
        cfg.BOT_NUMBER ||
        process.env.BOT_NUMBER ||
        process.env.PHONE_NUMBER ||
        ''
    );
}

function getConfiguredOwners() {
    let owners = [];

    try {
        if (typeof cfg.getOwners === 'function') {
            owners = cfg.getOwners();
        } else if (Array.isArray(cfg.OWNER_NUMBERS)) {
            owners = cfg.OWNER_NUMBERS;
        }
    } catch (_) {}

    if (!Array.isArray(owners)) {
        owners = owners ? [owners] : [];
    }

    return owners
        .map(value => {
            const str = String(value || '').trim();

            if (!str) return '';

            if (
                str.endsWith('@s.whatsapp.net') ||
                str.endsWith('@lid')
            ) {
                return normalizeJid(str);
            }

            return numberToJid(str);
        })
        .filter(Boolean);
}

function getConfiguredSudo() {
    let sudo = [];

    try {
        if (typeof cfg.getSudo === 'function') {
            sudo = cfg.getSudo();
        } else if (Array.isArray(cfg.SUDO_NUMBERS)) {
            sudo = cfg.SUDO_NUMBERS;
        }
    } catch (_) {}

    if (!Array.isArray(sudo)) {
        sudo = sudo ? [sudo] : [];
    }

    return sudo
        .map(value => {
            const str = String(value || '').trim();

            if (!str) return '';

            if (
                str.endsWith('@s.whatsapp.net') ||
                str.endsWith('@lid')
            ) {
                return normalizeJid(str);
            }

            return numberToJid(str);
        })
        .filter(Boolean);
}

/* ==========================================================================
   ACCESS LIST INITIALIZATION
========================================================================== */

function initializeAccessLists() {
    global.OWNER_NUMBERS =
        getConfiguredOwners();

    global.SUDO =
        getConfiguredSudo();

    /*
     * Remove owner from sudo list if accidentally duplicated.
     */
    const ownerNumbers = new Set(
        global.OWNER_NUMBERS.map(jidToNumber)
    );

    global.SUDO =
        global.SUDO.filter(
            jid => !ownerNumbers.has(jidToNumber(jid))
        );
}

initializeAccessLists();

/* ==========================================================================
   IDENTITY MATCHING
========================================================================== */

function identityMatches(identity, configured) {
    if (!identity || !configured) {
        return false;
    }

    const a = normalizeJid(identity);
    const b = normalizeJid(configured);

    if (!a || !b) {
        return false;
    }

    /*
     * Exact JID match.
     */
    if (a === b) {
        return true;
    }

    /*
     * Phone-number match.
     */
    const aNumber = jidToNumber(a);
    const bNumber = jidToNumber(b);

    if (
        aNumber &&
        bNumber &&
        aNumber === bNumber
    ) {
        return true;
    }

    return false;
}

/* ==========================================================================
   OWNER / SUDO CHECKS
========================================================================== */

function isOwnerIdentity(identities) {
    const ids = Array.isArray(identities)
        ? identities
        : [identities];

    return ids.some(identity =>
        global.OWNER_NUMBERS.some(owner =>
            identityMatches(identity, owner)
        )
    );
}

function isSudoIdentity(identities) {
    const ids = Array.isArray(identities)
        ? identities
        : [identities];

    return ids.some(identity =>
        global.SUDO.some(sudo =>
            identityMatches(identity, sudo)
        )
    );
}

/* ==========================================================================
   MESSAGE TEXT
========================================================================== */

function getTextFromMessage(msg) {
    const message = msg?.message;

    if (!message) {
        return '';
    }

    return (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.buttonsResponseMessage?.selectedButtonId ||
        message.listResponseMessage
            ?.singleSelectReply
            ?.selectedRowId ||
        message.templateButtonReplyMessage
            ?.selectedId ||
        ''
    );
}

function getMentions(msg) {
    return (
        msg?.message
            ?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid ||
        []
    );
}

function getQuotedMessage(msg) {
    return (
        msg?.message
            ?.extendedTextMessage
            ?.contextInfo
            ?.quotedMessage ||
        null
    );
}

/* ==========================================================================
   SENDER IDENTITY EXTRACTION

   WhatsApp can provide:
   - phone JID
   - LID
   - participantPn
   - participantAlt
   - remoteJidAlt

   We collect ALL of them instead of trusting only one.
========================================================================== */

function getAllUserIds(msg) {
    const ids = new Set();

    const key = msg?.key || {};

    const candidates = [
        key.participantPn,
        key.senderPn,
        key.participantAlt,
        key.remoteJidAlt,
        key.participant,
        key.senderLid,
        key.remoteJid
    ];

    for (const id of candidates) {
        if (!id) continue;

        const normalized = normalizeJid(id);

        if (!normalized) continue;

        if (
            normalized.endsWith('@s.whatsapp.net') ||
            normalized.endsWith('@lid')
        ) {
            ids.add(normalized);
        }
    }

    /*
     * If the message is from the bot itself, add the bot's
     * known identities.
     */
    if (key.fromMe) {
        if (global.BOT_NUMBER) {
            ids.add(
                normalizeJid(
                    global.BOT_NUMBER
                )
            );
        }

        if (global.BOT_LID) {
            ids.add(
                normalizeJid(
                    global.BOT_LID
                )
            );
        }
    }

    return [...ids];
}

function getSender(msg) {
    const ids = getAllUserIds(msg);

    /*
     * Prefer phone JID.
     */
    const phone = ids.find(
        id =>
            id.endsWith('@s.whatsapp.net')
    );

    if (phone) {
        return phone;
    }

    return (
        ids[0] ||
        msg?.key?.remoteJid ||
        ''
    );
}

/* ==========================================================================
   GROUP HELPERS
========================================================================== */

async function getGroupMetadata(sock, jid) {
    if (
        !jid ||
        !jid.endsWith('@g.us')
    ) {
        return null;
    }

    try {
        return await sock.groupMetadata(jid);
    } catch (error) {
        console.error(
            '❌ Failed to get group metadata:',
            error.message
        );

        return null;
    }
}

async function isGroupAdmin(
    sock,
    jid,
    identities
) {
    if (
        !jid ||
        !jid.endsWith('@g.us')
    ) {
        return false;
    }

    const metadata =
        await getGroupMetadata(
            sock,
            jid
        );

    if (!metadata) {
        return false;
    }

    const ids =
        Array.isArray(identities)
            ? identities
            : [identities];

    return metadata.participants.some(
        participant => {
            const participantId =
                normalizeJid(
                    participant.id
                );

            return ids.some(id =>
                identityMatches(
                    participantId,
                    id
                )
            ) && (
                participant.admin === 'admin' ||
                participant.admin === 'superadmin'
            );
        }
    );
}

async function isBotAdmin(sock, jid) {
    return isGroupAdmin(
        sock,
        jid,
        [
            global.BOT_NUMBER,
            global.BOT_LID
        ].filter(Boolean)
    );
}

/* ==========================================================================
   SEND HELPERS
========================================================================== */

async function sendText(
    sock,
    jid,
    text,
    options = {}
) {
    if (!jid) return null;

    return sock.sendMessage(
        jid,
        {
            text: String(text)
        },
        options
    );
}

async function replyTo(
    sock,
    message,
    text,
    options = {}
) {
    const jid =
        message?.key?.remoteJid;

    if (!jid) return null;

    return sendText(
        sock,
        jid,
        text,
        {
            quoted: message,
            ...options
        }
    );
}

/* ==========================================================================
   COMMAND PARSER
========================================================================== */

function parseCommand(text) {
    if (!text) return null;

    const trimmed =
        String(text).trim();

    if (!trimmed.startsWith(PREFIX)) {
        return null;
    }

    const withoutPrefix =
        trimmed
            .slice(PREFIX.length)
            .trim();

    if (!withoutPrefix) {
        return null;
    }

    const parts =
        withoutPrefix.split(/\s+/);

    const command =
        String(parts.shift() || '')
            .toLowerCase()
            .trim();

    if (!command) {
        return null;
    }

    return {
        command,
        args: parts,
        text: parts.join(' '),
        raw: trimmed
    };
}

/* ==========================================================================
   PLUGIN LOADER
========================================================================== */

async function loadPlugins() {
    global.plugins.clear();

    console.log('');
    console.log('========================================');
    console.log('          📂 LOADING PLUGINS');
    console.log('========================================');
    console.log('');

    const files =
        fs.readdirSync(PLUGIN_DIR)
            .filter(
                file =>
                    file.endsWith('.js')
            )
            .sort();

    if (files.length === 0) {
        console.log(
            '⚠️ No plugin files found.'
        );
        return;
    }

    let loadedFiles = 0;
    let loadedCommands = 0;

    for (const file of files) {
        const fullPath =
            path.join(
                PLUGIN_DIR,
                file
            );

        try {
            delete require.cache[
                require.resolve(fullPath)
            ];

            const imported =
                require(fullPath);

            const commands =
                Array.isArray(imported)
                    ? imported
                    : [imported];

            let fileLoaded = false;

            for (const command of commands) {
                if (!command) continue;

                const commandName =
                    command.name ||
                    command.command;

                if (!commandName) {
                    console.log(
                        `⚠️ ${file}: missing command name`
                    );
                    continue;
                }

                const execute =
                    command.execute ||
                    command.handler;

                if (
                    typeof execute !==
                    'function'
                ) {
                    console.log(
                        `⚠️ ${file}: ${commandName} has no execute function`
                    );
                    continue;
                }

                command.name =
                    String(commandName)
                        .toLowerCase()
                        .trim();

                command.execute =
                    execute;

                global.plugins.set(
                    command.name,
                    command
                );

                loadedCommands++;
                fileLoaded = true;

                const aliases =
                    Array.isArray(
                        command.alias
                    )
                        ? command.alias
                        : Array.isArray(
                            command.aliases
                        )
                            ? command.aliases
                            : [];

                for (const alias of aliases) {
                    if (!alias) continue;

                    global.plugins.set(
                        String(alias)
                            .toLowerCase()
                            .trim(),
                        command
                    );
                }

                console.log(
                    `✅ /${command.name}`
                );
            }

            if (fileLoaded) {
                loadedFiles++;
            }

        } catch (error) {
            console.error(
                `❌ ${file}: ${error.message}`
            );
        }
    }

    console.log('');
    console.log(
        `📦 Plugin files loaded: ${loadedFiles}/${files.length}`
    );
    console.log(
        `🧩 Commands available: ${global.plugins.size}`
    );
    console.log('');
}

/* ==========================================================================
   PLUGIN EXECUTION
========================================================================== */

async function executePlugin(
    sock,
    plugin,
    message,
    parsed,
    sender,
    jid,
    isGroup,
    owner,
    sudo,
    privileged
) {
    const groupMetadata =
        isGroup
            ? await getGroupMetadata(
                sock,
                jid
            )
            : null;

    const groupAdmin =
        isGroup
            ? await isGroupAdmin(
                sock,
                jid,
                getAllUserIds(message)
            )
            : false;

    const botAdmin =
        isGroup
            ? await isBotAdmin(
                sock,
                jid
            )
            : false;

    const context = {
        sock,

        message,
        msg: message,

        jid,
        remoteJid: jid,

        sender,

        command:
            parsed.command,

        args:
            parsed.args,

        text:
            parsed.text,

        raw:
            parsed.raw,

        isGroup,

        /*
         * IMPORTANT:
         * These are the authoritative access values.
         */
        isOwner: owner,
        isSudo: sudo,
        isPrivileged: privileged,

        /*
         * Also expose them globally to plugins
         * that expect these names.
         */
        owner,
        sudo,
        privileged,

        isGroupAdmin:
            groupAdmin,

        isBotAdmin:
            botAdmin,

        groupMetadata,

        prefix:
            PREFIX,

        botName:
            BOT_NAME,

        version:
            VERSION,

        mode:
            global.isPublic
                ? 'public'
                : 'private',

        config:
            cfg,

        mentions:
            getMentions(message),

        quoted:
            getQuotedMessage(message),

        fromMe:
            Boolean(
                message?.key?.fromMe
            ),

        isBot:
            Boolean(
                message?.key?.fromMe
            ),

        mutedUsers:
            global.mutedUsers,

        bannedUsers:
            global.bannedUsers,

        antilink:
            global.antilink,

        antispam:
            global.antispam,

        antitag:
            global.antitag,

        antibot:
            global.antibot,

        welcome:
            global.welcome,

        goodbye:
            global.goodbye,

        welcomeMsg:
            global.welcomeMsg,

        goodbyeMsg:
            global.goodbyeMsg,

        warns:
            global.warns,

        reply:
            async (
                messageText,
                options = {}
            ) =>
                replyTo(
                    sock,
                    message,
                    messageText,
                    options
                ),

        sendText:
            async (
                destination,
                messageText,
                options = {}
            ) =>
                sendText(
                    sock,
                    destination,
                    messageText,
                    options
                ),

        getGroupInfo:
            async () =>
                getGroupMetadata(
                    sock,
                    jid
                ),

        isAdmin:
            async user =>
                isGroupAdmin(
                    sock,
                    jid,
                    user
                ),

        botIsAdmin:
            async () =>
                isBotAdmin(
                    sock,
                    jid
                )
    };

    try {
        await plugin.execute(context);
        return true;

    } catch (error) {
        console.error(
            `❌ Command /${parsed.command} failed:`,
            error
        );

        try {
            await replyTo(
                sock,
                message,
                `❌ Command /${parsed.command} failed.\n\n${error.message || error}`
            );
        } catch (_) {}

        return false;
    }
}

/* ==========================================================================
   START BOT
========================================================================== */

let reconnecting = false;
let currentSocket = null;

async function startBot() {
    if (
        currentSocket &&
        currentSocket.user
    ) {
        console.log(
            '⚠️ Crystal Bot is already connected.'
        );

        return currentSocket;
    }

    try {
        initializeAccessLists();

        const configuredMode =
            String(
                cfg.MODE ||
                'public'
            ).toLowerCase();

        global.isPublic =
            configuredMode !== 'private';

        console.log('');
        console.log('========================================');
        console.log(`        ${BOT_NAME} v${VERSION}`);
        console.log('========================================');
        console.log('');

        console.log(
            `🌐 Mode: ${global.isPublic ? 'PUBLIC' : 'PRIVATE'}`
        );

        console.log(
            `👑 Owner entries: ${global.OWNER_NUMBERS.length}`
        );

        console.log(
            `🛡️ SUDO entries: ${global.SUDO.length}`
        );

        console.log('');

        /*
         * Print the actual configured numbers.
         * Useful for diagnosing owner issues.
         */
        console.log('🔐 ACCESS CONFIGURATION');

        for (
            const owner of global.OWNER_NUMBERS
        ) {
            console.log(
                `👑 OWNER: ${owner}`
            );
        }

        for (
            const sudo of global.SUDO
        ) {
            console.log(
                `🛡️ SUDO: ${sudo}`
            );
        }

        console.log('');

        const {
            state,
            saveCreds
        } =
            await useMultiFileAuthState(
                AUTH_DIR
            );

        let version;

        try {
            const latest =
                await fetchLatestBaileysVersion();

            version =
                latest?.version;

            if (version) {
                console.log(
                    `WhatsApp Web version: ${version.join('.')}`
                );
            }

        } catch (_) {
            console.log(
                '⚠️ Using default WhatsApp Web version.'
            );
        }

        const socketOptions = {
            auth: state,

            logger:
                pino({
                    level: 'silent'
                }),

            browser: [
                BOT_NAME,
                'Chrome',
                '120.0.0.0'
            ],

            printQRInTerminal: true,

            markOnlineOnConnect: false,

            syncFullHistory: false,

            generateHighQualityLinkPreview:
                false,

            getMessage:
                async () =>
                    undefined
        };

        if (version) {
            socketOptions.version =
                version;
        }

        console.log(
            '🔌 Creating WhatsApp connection...'
        );

        const sock =
            makeWASocket(
                socketOptions
            );

        currentSocket = sock;

        sock.ev.on(
            'creds.update',
            saveCreds
        );

        /* ================================================================
           CONNECTION UPDATE
        ================================================================ */

        sock.ev.on(
            'connection.update',
            async update => {
                const {
                    connection,
                    lastDisconnect,
                    qr
                } = update;

                if (
                    connection ===
                    'connecting'
                ) {
                    console.log(
                        '🔄 Connecting to WhatsApp...'
                    );
                }

                if (
                    qr &&
                    !state.creds.registered
                ) {
                    console.log('');
                    console.log(
                        '========================================'
                    );
                    console.log(
                        '       📱 CRYSTAL BOT QR LOGIN'
                    );
                    console.log(
                        '========================================'
                    );
                    console.log('');
                    console.log(
                        'Scan this QR with the client phone.'
                    );
                    console.log('');
                }

                if (
                    connection ===
                    'open'
                ) {
                    reconnecting = false;

                    global.BOT_NUMBER =
                        normalizeJid(
                            sock.user?.id ||
                            ''
                        );

                    global.BOT_LID =
                        normalizeJid(
                            sock.user?.lid ||
                            ''
                        );

                    const configuredBot =
                        getConfiguredBotNumber();

                    if (
                        !global.BOT_NUMBER &&
                        configuredBot
                    ) {
                        global.BOT_NUMBER =
                            numberToJid(
                                configuredBot
                            );
                    }

                    console.log('');
                    console.log(
                        '========================================'
                    );
                    console.log(
                        '       ✅ WHATSAPP CONNECTED'
                    );
                    console.log(
                        '========================================'
                    );
                    console.log('');

                    console.log(
                        `🤖 Bot: ${BOT_NAME}`
                    );

                    console.log(
                        `📱 Number: ${global.BOT_NUMBER || 'unknown'}`
                    );

                    console.log(
                        `🆔 LID: ${global.BOT_LID || 'unknown'}`
                    );

                    console.log(
                        `🌐 Mode: ${global.isPublic ? 'PUBLIC' : 'PRIVATE'}`
                    );

                    /*
                     * Re-display access configuration after connection.
                     */
                    console.log('');
                    console.log(
                        '🔐 OWNER/SUDO ACCESS READY'
                    );

                    console.log(
                        `👑 Owners: ${global.OWNER_NUMBERS.length}`
                    );

                    console.log(
                        `🛡️ Sudo: ${global.SUDO.length}`
                    );

                    await loadPlugins();

                    console.log(
                        '✅ CRYSTAL BOT is ONLINE.'
                    );

                    console.log(
                        'Try: /ping'
                    );

                    console.log('');
                }

                if (
                    connection ===
                    'close'
                ) {
                    if (
                        currentSocket ===
                        sock
                    ) {
                        currentSocket = null;
                    }

                    const statusCode =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode;

                    console.error('');
                    console.error(
                        '========================================'
                    );
                    console.error(
                        '       ❌ WHATSAPP CONNECTION CLOSED'
                    );
                    console.error(
                        '========================================'
                    );

                    console.error(
                        `Status code: ${statusCode || 'unknown'}`
                    );

                    if (
                        statusCode ===
                        DisconnectReason.loggedOut
                    ) {
                        console.error(
                            '❌ WhatsApp session was logged out.'
                        );

                        console.error(
                            'Delete core/auth_info and pair again.'
                        );

                        return;
                    }

                    if (!reconnecting) {
                        reconnecting = true;

                        console.log(
                            '🔄 Reconnecting in 5 seconds...'
                        );

                        setTimeout(
                            () => {
                                reconnecting = false;

                                startBot()
                                    .catch(
                                        error =>
                                            console.error(
                                                'Reconnect failed:',
                                                error
                                            )
                                    );
                            },
                            5000
                        );
                    }
                }
            }
        );

        /* ================================================================
           MESSAGE HANDLER
        ================================================================ */

        sock.ev.on(
            'messages.upsert',
            async ({
                messages
            }) => {
                if (
                    !Array.isArray(messages)
                ) {
                    return;
                }

                for (
                    const message
                    of messages
                ) {
                    try {
                        if (!message) continue;

                        if (!message.message) {
                            continue;
                        }

                        const jid =
                            message.key
                                ?.remoteJid;

                        if (!jid) continue;

                        if (
                            jid ===
                            'status@broadcast'
                        ) {
                            continue;
                        }

                        const text =
                            getTextFromMessage(
                                message
                            );

                        if (!text) continue;

                        const parsed =
                            parseCommand(text);

                        if (!parsed) {
                            continue;
                        }

                        const fromMe =
                            Boolean(
                                message.key
                                    ?.fromMe
                            );

                        /*
                         * Collect every identity WhatsApp supplied.
                         */
                        const allIds =
                            getAllUserIds(
                                message
                            );

                        /*
                         * For bot/self messages, explicitly include
                         * the bot identities.
                         */
                        if (fromMe) {
                            if (
                                global.BOT_NUMBER
                            ) {
                                allIds.push(
                                    global.BOT_NUMBER
                                );
                            }

                            if (
                                global.BOT_LID
                            ) {
                                allIds.push(
                                    global.BOT_LID
                                );
                            }
                        }

                        /*
                         * Remove duplicates.
                         */
                        const identityList =
                            [
                                ...new Set(
                                    allIds.filter(
                                        Boolean
                                    )
                                )
                            ];

                        const sender =
                            getSender(
                                message
                            );

                        /*
                         * =================================================
                         * OWNER CHECK
                         * =================================================
                         */

                        const owner =
                            fromMe ||
                            isOwnerIdentity(
                                identityList
                            );

                        /*
                         * =================================================
                         * SUDO CHECK
                         * =================================================
                         */

                        const sudo =
                            fromMe ||
                            isSudoIdentity(
                                identityList
                            );

                        /*
                         * Owner OR sudo.
                         */
                        const privileged =
                            owner ||
                            sudo;

                        const isGroup =
                            jid.endsWith(
                                '@g.us'
                            );

                        /*
                         * =================================================
                         * DEBUG ACCESS LOG
                         * =================================================
                         */

                        console.log('');
                        console.log(
                            '📩 COMMAND'
                        );

                        console.log(
                            `👤 Sender: ${sender || 'unknown'}`
                        );

                        console.log(
                            `🆔 Identities: ${identityList.join(', ') || 'none'}`
                        );

                        console.log(
                            `💬 Command: ${parsed.raw}`
                        );

                        console.log(
                            `👑 Owner: ${owner}`
                        );

                        console.log(
                            `🛡️ SUDO: ${sudo}`
                        );

                        console.log(
                            `🔐 Privileged: ${privileged}`
                        );

                        console.log(
                            `🤖 From me: ${fromMe}`
                        );

                        /*
                         * =================================================
                         * MUTED / BANNED
                         * =================================================
                         */

                        const normalizedSender =
                            normalizeJid(
                                sender
                            );

                        const isMuted =
                            global.mutedUsers.has(
                                normalizedSender
                            );

                        const isBanned =
                            global.bannedUsers.has(
                                normalizedSender
                            );

                        if (
                            !privileged &&
                            !fromMe &&
                            isBanned
                        ) {
                            console.log(
                                '🚫 Banned user blocked.'
                            );

                            continue;
                        }

                        if (
                            !privileged &&
                            !fromMe &&
                            isMuted
                        ) {
                            console.log(
                                '🔇 Muted user blocked.'
                            );

                            continue;
                        }

                        /*
                         * =================================================
                         * PRIVATE MODE
                         * =================================================
                         */

                        if (
                            !global.isPublic &&
                            !privileged &&
                            !fromMe
                        ) {
                            console.log(
                                '⛔ Private mode blocked command.'
                            );

                            continue;
                        }

                        /*
                         * =================================================
                         * FIND PLUGIN
                         * =================================================
                         */

                        const plugin =
                            global.plugins.get(
                                parsed.command
                            );

                        if (!plugin) {
                            console.log(
                                `⚠️ No plugin loaded for /${parsed.command}`
                            );

                            if (
                                global.isPublic ||
                                privileged ||
                                fromMe
                            ) {
                                await replyTo(
                                    sock,
                                    message,
                                    `❌ Unknown command: /${parsed.command}\n\nUse /help to see available commands.`
                                );
                            }

                            continue;
                        }

                        /*
                         * =================================================
                         * EXECUTE
                         * =================================================
                         */

                        await executePlugin(
                            sock,
                            plugin,
                            message,
                            parsed,
                            sender,
                            jid,
                            isGroup,
                            owner,
                            sudo,
                            privileged
                        );

                    } catch (error) {
                        console.error(
                            '❌ Message handler error:',
                            error
                        );
                    }
                }
            }
        );

        /* ================================================================
           GROUP PARTICIPANTS
        ================================================================ */

        sock.ev.on(
            'group-participants.update',
            async ({
                id,
                participants,
                action
            }) => {
                try {
                    if (
                        action === 'add' &&
                        global.welcome[id]
                    ) {
                        for (
                            const participant
                            of participants
                        ) {
                            const template =
                                global.welcomeMsg[id] ||
                                '👋 Welcome @{user}!';

                            const text =
                                template.replace(
                                    '{user}',
                                    `@${participant.split('@')[0]}`
                                );

                            await sock.sendMessage(
                                id,
                                {
                                    text,
                                    mentions: [
                                        participant
                                    ]
                                }
                            );
                        }
                    }

                    if (
                        action === 'remove' &&
                        global.goodbye[id]
                    ) {
                        for (
                            const participant
                            of participants
                        ) {
                            const template =
                                global.goodbyeMsg[id] ||
                                '👋 Goodbye @{user}!';

                            const text =
                                template.replace(
                                    '{user}',
                                    `@${participant.split('@')[0]}`
                                );

                            await sock.sendMessage(
                                id,
                                {
                                    text,
                                    mentions: [
                                        participant
                                    ]
                                }
                            );
                        }
                    }

                } catch (error) {
                    console.error(
                        '❌ Group participant handler error:',
                        error.message
                    );
                }
            }
        );

        return sock;

    } catch (error) {
        console.error(
            '❌ Failed to start WhatsApp:',
            error
        );

        currentSocket = null;

        if (!reconnecting) {
            reconnecting = true;

            setTimeout(
                () => {
                    reconnecting = false;

                    startBot()
                        .catch(
                            err =>
                                console.error(
                                    'Reconnect failed:',
                                    err
                                )
                        );
                },
                5000
            );
        }

        return null;
    }
}

/* ==========================================================================
   START
========================================================================== */

startBot()
    .catch(
        error =>
            console.error(
                '❌ Fatal startup error:',
                error
            )
    );

/* ==========================================================================
   EXPORTS
========================================================================== */

module.exports = {
    startBot,
    loadPlugins,
    parseCommand,

    normalizeNumber,
    normalizeJid,
    numberToJid,

    isOwnerIdentity,
    isSudoIdentity,

    isGroupAdmin,
    isBotAdmin,

    getGroupMetadata,
    getTextFromMessage,
    getAllUserIds,
    getSender,

    sendText,
    replyTo
};

