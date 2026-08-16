'use strict';

/*
 * CRYSTAL BOT
 * GROUP ADMIN COMMANDS
 */

function getTargetJid(message, args = []) {
    const mentioned =
        message?.message?.extendedTextMessage?.contextInfo?.mentionedJid;

    if (Array.isArray(mentioned) && mentioned.length) {
        return mentioned[0];
    }

    const quoted =
        message?.message?.extendedTextMessage?.contextInfo?.participant;

    if (quoted) {
        return quoted;
    }

    const number = String(args[0] || '')
        .replace(/\D/g, '');

    if (number.length >= 7) {
        return `${number}@s.whatsapp.net`;
    }

    return null;
}

function getTargets(message, args = []) {
    const mentioned =
        message?.message?.extendedTextMessage?.contextInfo?.mentionedJid;

    if (Array.isArray(mentioned) && mentioned.length) {
        return mentioned;
    }

    const target = getTargetJid(message, args);

    return target ? [target] : [];
}

function requireGroup(isGroup) {
    return isGroup;
}

function requireAdmin(isGroupAdmin) {
    return isGroupAdmin;
}

function requireBotAdmin(isBotAdmin) {
    return isBotAdmin;
}

module.exports = [

    /* ============================================================
       KICK
    ============================================================ */

    {
        name: 'kick',
        alias: ['remove'],
        description: 'Remove a member from the group',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /kick.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin first.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention, reply to, or provide the number of the member to remove.');

            await sock.groupParticipantsUpdate(
                jid,
                targets,
                'remove'
            );

            await reply(
                `✅ Removed ${targets.length} member${targets.length > 1 ? 's' : ''}.`
            );
        }
    },


    /* ============================================================
       ADD
    ============================================================ */

    {
        name: 'add',
        alias: ['invite'],
        description: 'Add a member to the group',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            args,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /add.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin first.');

            const number = String(args[0] || '')
                .replace(/\D/g, '');

            if (!number || number.length < 7) {
                return reply(
                    '❌ Usage:\n/add 2348012345678'
                );
            }

            const target =
                `${number}@s.whatsapp.net`;

            await sock.groupParticipantsUpdate(
                jid,
                [target],
                'add'
            );

            await reply(
                `✅ Add request sent for @${number}.`,
                {
                    mentions: [target]
                }
            );
        }
    },


    /* ============================================================
       PROMOTE
    ============================================================ */

    {
        name: 'promote',
        alias: ['admin'],
        description: 'Promote a member to admin',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /promote.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin first.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention or reply to the member.');

            await sock.groupParticipantsUpdate(
                jid,
                targets,
                'promote'
            );

            await reply('👑 Member promoted successfully.');
        }
    },


    /* ============================================================
       DEMOTE
    ============================================================ */

    {
        name: 'demote',
        alias: ['unadmin'],
        description: 'Remove admin status',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /demote.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin first.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention or reply to the admin.');

            await sock.groupParticipantsUpdate(
                jid,
                targets,
                'demote'
            );

            await reply('✅ Admin privileges removed.');
        }
    },


    /* ============================================================
       MUTE
    ============================================================ */

    {
        name: 'mute',
        alias: ['silence'],
        description: 'Mute a group member',
        category: 'GROUP ADMIN',

        async execute({
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /mute.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention or reply to the member.');

            for (const target of targets) {
                global.mutedUsers.add(
                    `${global.BOT_NUMBER || 'bot'}:${target}`
                );
            }

            await reply(
                `🔇 Muted ${targets.length} member${targets.length > 1 ? 's' : ''}.\n\nTheir commands/messages will be ignored by Crystal Bot.`
            );
        }
    },


    /* ============================================================
       UNMUTE
    ============================================================ */

    {
        name: 'unmute',
        alias: ['unsilence'],
        description: 'Unmute a member',
        category: 'GROUP ADMIN',

        async execute({
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /unmute.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention or reply to the member.');

            for (const target of targets) {
                global.mutedUsers.delete(
                    `${global.BOT_NUMBER || 'bot'}:${target}`
                );
            }

            await reply('🔊 Member unmuted.');
        }
    },


    /* ============================================================
       BAN
    ============================================================ */

    {
        name: 'ban',
        alias: ['blockgroup'],
        description: 'Ban a member from the group',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /ban.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin first.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention or reply to the member.');

            for (const target of targets) {
                global.bannedUsers.add(
                    `${jid}:${target}`
                );
            }

            await sock.groupParticipantsUpdate(
                jid,
                targets,
                'remove'
            );

            await reply('🚫 Member banned and removed.');
        }
    },


    /* ============================================================
       UNBAN
    ============================================================ */

    {
        name: 'unban',
        alias: ['pardon'],
        description: 'Remove a group ban',
        category: 'GROUP ADMIN',

        async execute({
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /unban.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention or reply to the member.');

            for (const target of targets) {
                global.bannedUsers.delete(
                    `${global.BOT_NUMBER || 'bot'}:${target}`
                );
            }

            await reply('✅ Ban removed.');
        }
    },


    /* ============================================================
       WARN
    ============================================================ */

    {
        name: 'warn',
        alias: ['warning'],
        description: 'Warn a member',
        category: 'GROUP ADMIN',

        async execute({
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /warn.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention or reply to the member.');

            global.groupWarnings =
                global.groupWarnings || {};

            global.groupWarnings[jidKey(message)] =
                global.groupWarnings[jidKey(message)] || {};

            for (const target of targets) {
                const key = target;

                global.groupWarnings[jidKey(message)][key] =
                    (global.groupWarnings[jidKey(message)][key] || 0) + 1;
            }

            const count =
                global.groupWarnings[jidKey(message)][targets[0]];

            await reply(
                `⚠️ Warning issued.\n\nWarnings: ${count}/${global.maxWarns || 3}`
            );
        }
    },


    /* ============================================================
       UNWARN
    ============================================================ */

    {
        name: 'unwarn',
        alias: ['clearwarn'],
        description: 'Remove one warning',
        category: 'GROUP ADMIN',

        async execute({
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /unwarn.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention or reply to the member.');

            global.groupWarnings =
                global.groupWarnings || {};

            const group =
                global.groupWarnings[jidKey(message)] || {};

            for (const target of targets) {
                if (group[target]) {
                    group[target]--;
                    if (group[target] <= 0) {
                        delete group[target];
                    }
                }
            }

            global.groupWarnings[jidKey(message)] = group;

            await reply('✅ Warning removed.');
        }
    },


    /* ============================================================
       WARNINGS
    ============================================================ */

    {
        name: 'warnings',
        alias: ['warns'],
        description: 'Check member warnings',
        category: 'GROUP ADMIN',

        async execute({
            message,
            args,
            reply,
            isGroup,
            isGroupAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /warnings.');

            const targets = getTargets(message, args);

            if (!targets.length)
                return reply('❌ Mention or reply to the member.');

            global.groupWarnings =
                global.groupWarnings || {};

            const group =
                global.groupWarnings[jidKey(message)] || {};

            const count =
                group[targets[0]] || 0;

            await reply(
                `⚠️ Warnings: ${count}/${global.maxWarns || 3}`
            );
        }
    },


    /* ============================================================
       TAG ALL
    ============================================================ */

    {
        name: 'tagall',
        alias: ['everyone'],
        description: 'Mention all group members',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            args,
            reply,
            isGroup,
            isGroupAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /tagall.');

            const metadata =
                await sock.groupMetadata(jid);

            const participants =
                metadata.participants || [];

            const mentions =
                participants.map(p => p.id);

            const text =
                args.join(' ') ||
                '📢 Attention everyone!';

            await sock.sendMessage(
                jid,
                {
                    text,
                    mentions
                }
            );
        }
    },


    /* ============================================================
       HIDETAG
    ============================================================ */

    {
        name: 'hidetag',
        alias: ['notifyall'],
        description: 'Mention everyone without displaying tags',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            args,
            reply,
            isGroup,
            isGroupAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only group admins can use /hidetag.');

            const metadata =
                await sock.groupMetadata(jid);

            const participants =
                metadata.participants || [];

            const mentions =
                participants.map(p => p.id);

            await sock.sendMessage(
                jid,
                {
                    text:
                        args.join(' ') ||
                        '📢 Attention everyone.',
                    mentions
                }
            );
        }
    },


    /* ============================================================
       ADMINS
    ============================================================ */

    {
        name: 'admins',
        alias: ['adminlist'],
        description: 'Show group admins',
        category: 'GROUP',

        async execute({
            sock,
            jid,
            reply,
            isGroup
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            const metadata =
                await sock.groupMetadata(jid);

            const admins =
                metadata.participants
                    .filter(p =>
                        p.admin === 'admin' ||
                        p.admin === 'superadmin'
                    );

            const mentions =
                admins.map(p => p.id);

            const text =
                `👑 *GROUP ADMINS*\n\n` +
                admins
                    .map(
                        (p, i) =>
                            `${i + 1}. @${p.id.split('@')[0]}`
                    )
                    .join('\n');

            await sock.sendMessage(
                jid,
                {
                    text,
                    mentions
                }
            );
        }
    },


    /* ============================================================
       GROUP INFO
    ============================================================ */

    {
        name: 'groupinfo',
        alias: ['ginfo'],
        description: 'Show group information',
        category: 'GROUP',

        async execute({
            sock,
            jid,
            reply,
            isGroup
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            const metadata =
                await sock.groupMetadata(jid);

            const admins =
                metadata.participants.filter(
                    p =>
                        p.admin === 'admin' ||
                        p.admin === 'superadmin'
                );

            await reply(
                `👥 *GROUP INFORMATION*\n\n` +
                `📛 Name: ${metadata.subject || 'Unknown'}\n` +
                `👤 Members: ${metadata.participants.length}\n` +
                `👑 Admins: ${admins.length}\n` +
                `🆔 ID: ${metadata.id}\n` +
                `📝 Description:\n${metadata.desc || 'None'}`
            );
        }
    },


    /* ============================================================
       SET NAME
    ============================================================ */

    {
        name: 'setname',
        alias: ['groupname'],
        description: 'Change group name',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            args,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only admins can use /setname.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin.');

            const name = args.join(' ').trim();

            if (!name)
                return reply('❌ Usage: /setname New Group Name');

            await sock.groupUpdateSubject(
                jid,
                name
            );

            await reply('✅ Group name updated.');
        }
    },


    /* ============================================================
       SET DESCRIPTION
    ============================================================ */

    {
        name: 'setdesc',
        alias: ['groupdesc'],
        description: 'Change group description',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            args,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only admins can use /setdesc.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin.');

            const description =
                args.join(' ').trim();

            if (!description)
                return reply('❌ Usage: /setdesc Your description');

            await sock.groupUpdateDescription(
                jid,
                description
            );

            await reply('✅ Group description updated.');
        }
    },


    /* ============================================================
       LINK
    ============================================================ */

    {
        name: 'link',
        alias: ['grouplink'],
        description: 'Get group invite link',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            reply,
            isGroup,
            isGroupAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only admins can use /link.');

            const code =
                await sock.groupInviteCode(jid);

            if (!code)
                return reply('❌ Could not generate group link.');

            await reply(
                `🔗 *GROUP LINK*\n\nhttps://chat.whatsapp.com/${code}`
            );
        }
    },


    /* ============================================================
       REVOKE LINK
    ============================================================ */

    {
        name: 'revoke',
        alias: ['resetlink'],
        description: 'Revoke group invite link',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only admins can use /revoke.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin.');

            await sock.groupRevokeInvite(jid);

            await reply(
                '🔄 Group invite link revoked successfully.'
            );
        }
    },


    /* ============================================================
       MUTE CHAT
    ============================================================ */

    {
        name: 'mutechat',
        alias: ['lockchat'],
        description: 'Allow only admins to send messages',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only admins can use /mutechat.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin.');

            await sock.groupSettingUpdate(
                jid,
                'announcement'
            );

            await reply(
                '🔒 Group chat locked.\n\nOnly admins can send messages.'
            );
        }
    },


    /* ============================================================
       UNMUTE CHAT
    ============================================================ */

    {
        name: 'unmutechat',
        alias: ['unlockchat'],
        description: 'Allow everyone to send messages',
        category: 'GROUP ADMIN',

        async execute({
            sock,
            jid,
            reply,
            isGroup,
            isGroupAdmin,
            isBotAdmin
        }) {
            if (!requireGroup(isGroup))
                return reply('❌ This command only works in groups.');

            if (!requireAdmin(isGroupAdmin))
                return reply('❌ Only admins can use /unmutechat.');

            if (!requireBotAdmin(isBotAdmin))
                return reply('❌ I need to be a group admin.');

            await sock.groupSettingUpdate(
                jid,
                'not_announcement'
            );

            await reply(
                '🔓 Group chat unlocked.\n\nEveryone can send messages.'
            );
        }
    }
];


/* ================================================================
   HELPERS
================================================================ */

function jidKey(message) {
    return message?.key?.remoteJid || 'unknown';
}