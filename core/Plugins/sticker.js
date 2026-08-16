const {
    downloadMediaMessage
} = require('@whiskeysockets/baileys');

const {
    Sticker,
    StickerTypes
} = require('wa-sticker-formatter');

module.exports = {
    name: 'sticker',
    alias: ['s', 'stiker'],
    description: 'Convert replied image/video to sticker',
    category: 'MEDIA',

    async execute({
        sock,
        message,
        jid,
        reply,
        args
    }) {
        try {
            if (!message) {
                return reply('❌ Message not found.');
            }

            /*
             * Find quoted message.
             */
            const contextInfo =
                message.message?.extendedTextMessage?.contextInfo ||
                message.message?.imageMessage?.contextInfo ||
                message.message?.videoMessage?.contextInfo ||
                message.message?.documentMessage?.contextInfo;

            const quotedMessage = contextInfo?.quotedMessage;

            /*
             * /sticker me
             *
             * Create sticker from the bot/user profile picture.
             */
            if (!quotedMessage && args?.[0]?.toLowerCase() === 'me') {

                const targetJid =
                    message.key.participant ||
                    message.key.remoteJid;

                try {
                    const profileUrl =
                        await sock.profilePictureUrl(
                            targetJid,
                            'image'
                        );

                    if (!profileUrl) {
                        return reply(
                            '❌ No profile picture found.'
                        );
                    }

                    const response = await fetch(profileUrl);

                    if (!response.ok) {
                        throw new Error(
                            `Profile image request failed: ${response.status}`
                        );
                    }

                    const arrayBuffer =
                        await response.arrayBuffer();

                    const imageBuffer =
                        Buffer.from(arrayBuffer);

                    if (!imageBuffer.length) {
                        throw new Error(
                            'Profile image is empty.'
                        );
                    }

                    const sticker =
                        new Sticker(
                            imageBuffer,
                            {
                                pack: 'CRYSTAL BOT',
                                author: 'GitHub',
                                type: StickerTypes.FULL,
                                quality: 90
                            }
                        );

                    const stickerBuffer =
                        await sticker.toBuffer();

                    if (
                        !stickerBuffer ||
                        !stickerBuffer.length
                    ) {
                        throw new Error(
                            'Sticker conversion returned an empty buffer.'
                        );
                    }

                    await sock.sendMessage(
                        jid,
                        {
                            sticker: stickerBuffer
                        },
                        {
                            quoted: message
                        }
                    );

                    return;

                } catch (profileError) {

                    console.error(
                        '❌ /sticker me profile error:',
                        profileError
                    );

                    return reply(
                        '❌ *PROFILE STICKER FAILED*\n\n' +
                        'I could not download the profile picture.\n\n' +
                        'Try replying to an image with `/sticker` instead.'
                    );
                }
            }

            /*
             * No quoted media.
             */
            if (!quotedMessage) {
                return reply(
                    '🖼️ *STICKER*\n\n' +
                    'Reply to an image or video with:\n\n' +
                    '/sticker\n\n' +
                    'You can also use:\n' +
                    '/sticker me'
                );
            }

            /*
             * Don't bypass View Once.
             */
            if (
                quotedMessage.viewOnceMessage ||
                quotedMessage.viewOnceMessageV2 ||
                quotedMessage.viewOnceMessageV2Extension
            ) {
                return reply(
                    '🔒 View Once media cannot be converted.'
                );
            }

            let mediaMessage = null;
            let mediaType = null;

            if (quotedMessage.imageMessage) {
                mediaMessage =
                    quotedMessage.imageMessage;

                mediaType = 'image';
            }

            else if (quotedMessage.videoMessage) {
                mediaMessage =
                    quotedMessage.videoMessage;

                mediaType = 'video';
            }

            else {
                return reply(
                    '❌ Reply to an image or video.'
                );
            }

            await reply('⏳ Creating sticker...');

            /*
             * Reconstruct the quoted WAMessage.
             */
            const quotedWAMessage = {
                key: {
                    remoteJid: jid,
                    fromMe: false,
                    id: contextInfo.stanzaId
                },
                message: quotedMessage
            };

            /*
             * Download media using Baileys'
             * standalone downloadMediaMessage().
             */
            const mediaBuffer =
                await downloadMediaMessage(
                    quotedWAMessage,
                    'buffer',
                    {},
                    {
                        logger: sock.logger,
                        reuploadRequest: async msg => {
                            if (
                                typeof sock.updateMediaMessage ===
                                'function'
                            ) {
                                return sock.updateMediaMessage(msg);
                            }

                            return undefined;
                        }
                    }
                );

            if (
                !mediaBuffer ||
                !Buffer.isBuffer(mediaBuffer) ||
                mediaBuffer.length === 0
            ) {
                throw new Error(
                    'Downloaded media is empty.'
                );
            }

            /*
             * Convert to proper WebP sticker.
             */
            const sticker =
                new Sticker(
                    mediaBuffer,
                    {
                        pack: 'CRYSTAL BOT',
                        author: 'GitHub',
                        type:
                            mediaType === 'image'
                                ? StickerTypes.FULL
                                : StickerTypes.DEFAULT,
                        quality: 90
                    }
                );

            const stickerBuffer =
                await sticker.toBuffer();

            if (
                !stickerBuffer ||
                !stickerBuffer.length
            ) {
                throw new Error(
                    'Sticker conversion produced an empty file.'
                );
            }

            /*
             * Send actual WebP sticker.
             */
            await sock.sendMessage(
                jid,
                {
                    sticker: stickerBuffer
                },
                {
                    quoted: message
                }
            );

        } catch (error) {

            console.error(
                '❌ /sticker error:',
                error
            );

            await reply(
                '❌ *STICKER ERROR*\n\n' +
                `${error.message || error}\n\n` +
                'Try replying to a normal image with `/sticker`.'
            );
        }
    }
};