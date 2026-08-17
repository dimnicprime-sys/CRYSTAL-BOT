
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

/*
 * ============================================================================
 * CRYSTAL BOT - DOWNLOADER
 * ============================================================================
 *
 * Requires:
 *
 *   python -m pip install -U yt-dlp
 *
 * FFmpeg must also be installed and available in PATH.
 *
 * Your FFmpeg installation is already working.
 *
 * Commands:
 *
 *   /play song name
 *   /song song name
 *   /ytmp3 YouTube URL
 *   /ytmp4 YouTube URL
 *   /ytsearch song name
 *
 * ============================================================================
 */

const TEMP_ROOT = path.join(os.tmpdir(), 'crystal-bot-downloads');

if (!fs.existsSync(TEMP_ROOT)) {
    fs.mkdirSync(TEMP_ROOT, { recursive: true });
}

/* ==========================================================================
   CONFIG
========================================================================== */

const MAX_RETRIES = 3;
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000;
const SEARCH_TIMEOUT = 60 * 1000;

/*
 * yt-dlp is executed through Python.
 *
 * This avoids depending on Windows having "yt-dlp.exe"
 * directly available in PATH.
 */

function getPythonCommand() {
    return process.platform === 'win32'
        ? 'python'
        : 'python3';
}

/* ==========================================================================
   YOUTUBE / YT-DLP COMPATIBILITY
========================================================================== */

/*
 * YouTube currently uses additional anti-bot / proof-of-origin checks.
 * yt-dlp's current documentation recommends a PO-token provider for
 * affected clients. This downloader will automatically use the provider
 * when it is available, while keeping the existing commands unchanged.
 *
 * Optional environment variables:
 *
 *   CRYSTAL_POT_URL
 *     URL of a running bgutil PO-token HTTP provider.
 *     Default provider URL is http://127.0.0.1:4416
 *
 *   CRYSTAL_BGUTIL_SCRIPT
 *     Full path to bgutil's generate_once.js script.
 *
 * The common Windows location is:
 *
 *   %USERPROFILE%\\bgutil-ytdlp-pot-provider\\server\\build\\generate_once.js
 */

function getBgutilScriptPath() {
    const candidates = [];

    if (process.env.CRYSTAL_BGUTIL_SCRIPT) {
        candidates.push(
            process.env.CRYSTAL_BGUTIL_SCRIPT
        );
    }

    if (process.env.USERPROFILE) {
        candidates.push(
            path.join(
                process.env.USERPROFILE,
                'bgutil-ytdlp-pot-provider',
                'server',
                'build',
                'generate_once.js'
            )
        );
    }

    candidates.push(
        path.join(
            process.cwd(),
            'bgutil-ytdlp-pot-provider',
            'server',
            'build',
            'generate_once.js'
        )
    );

    for (const candidate of candidates) {
        if (
            candidate &&
            fs.existsSync(candidate)
        ) {
            return candidate;
        }
    }

    return null;
}

function getYtDlpCompatibilityArgs() {
    const args = [
        /*
         * Current yt-dlp versions use an external JavaScript runtime
         * for YouTube challenge solving. Node 20+ is already required
         * by the current Crystal Bot environment.
         */
        '--js-runtimes',
        'node',

        /*
         * Let yt-dlp obtain the EJS challenge components when needed.
         */
        '--remote-components',
        'ejs:npm'
    ];

    const potUrl =
        String(
            process.env.CRYSTAL_POT_URL ||
            ''
        ).trim();

    const scriptPath =
        getBgutilScriptPath();

    /*
     * Prefer the HTTP PO-token provider when explicitly configured.
     */
    if (potUrl) {
        args.push(
            '--extractor-args',
            `youtubepot-bgutilhttp:base_url=${potUrl}`
        );

        /*
         * mweb is the client recommended by the current
         * yt-dlp PO-token documentation when using a provider.
         */
        args.push(
            '--extractor-args',
            'youtube:player-client=mweb'
        );

        return args;
    }

    /*
     * Otherwise use the local bgutil generation script if it exists.
     */
    if (scriptPath) {
        args.push(
            '--extractor-args',
            `youtubepot-bgutilscript:script_path=${scriptPath}`
        );

        args.push(
            '--extractor-args',
            'youtube:player-client=mweb'
        );

        return args;
    }

    /*
     * No PO-token provider is installed.
     *
     * Keep the downloader usable for videos that YouTube still exposes
     * without a token, but do not pretend that this bypasses YouTube's
     * current bot checks.
     */
    args.push(
        '--extractor-args',
        'youtube:player-client=web_safari'
    );

    return args;
}

function hasBgutilProvider() {
    return Boolean(
        String(
            process.env.CRYSTAL_POT_URL ||
            ''
        ).trim() ||
        getBgutilScriptPath()
    );
}

/* ==========================================================================
   HELPERS
========================================================================== */

function createTempDirectory() {
    const folder = path.join(
        TEMP_ROOT,
        `job-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`
    );

    fs.mkdirSync(folder, {
        recursive: true
    });

    return folder;
}

function cleanupDirectory(directory) {
    if (!directory) {
        return;
    }

    try {
        if (fs.existsSync(directory)) {
            fs.rmSync(directory, {
                recursive: true,
                force: true
            });
        }
    } catch (error) {
        console.error(
            'Downloader cleanup error:',
            error.message
        );
    }
}

function sanitizeTitle(title) {
    return String(title || 'Crystal Bot')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 150) || 'Crystal Bot';
}

function isYouTubeUrl(value) {
    return /^https?:\/\/(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\//i
        .test(String(value || '').trim());
}

function formatDuration(seconds) {
    const value = Number(seconds);

    if (!Number.isFinite(value) || value < 0) {
        return 'Unknown';
    }

    const total = Math.floor(value);

    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* ==========================================================================
   RUN COMMAND
========================================================================== */

function runProcess(
    args,
    {
        cwd = process.cwd(),
        timeout = DOWNLOAD_TIMEOUT
    } = {}
) {
    return new Promise((resolve, reject) => {
        const python = getPythonCommand();

        let child;

        try {
            child = spawn(
                python,
                args,
                {
                    cwd,
                    windowsHide: true,
                    shell: false
                }
            );
        } catch (error) {
            reject(error);
            return;
        }

        let stdout = '';
        let stderr = '';
        let finished = false;

        const timer = setTimeout(() => {
            if (finished) {
                return;
            }

            finished = true;

            try {
                child.kill();
            } catch (_) {}

            reject(
                new Error(
                    `Process timed out after ${Math.floor(timeout / 1000)} seconds.`
                )
            );
        }, timeout);

        child.stdout.on('data', data => {
            stdout += data.toString();
        });

        child.stderr.on('data', data => {
            stderr += data.toString();
        });

        child.on('error', error => {
            if (finished) {
                return;
            }

            finished = true;
            clearTimeout(timer);

            reject(error);
        });

        child.on('close', code => {
            if (finished) {
                return;
            }

            finished = true;
            clearTimeout(timer);

            resolve({
                code,
                stdout,
                stderr
            });
        });
    });
}

/* ==========================================================================
   CHECK YT-DLP
========================================================================== */

async function checkYtDlp() {
    try {
        const result = await runProcess(
            [
                '-m',
                'yt_dlp',
                '--version'
            ],
            {
                timeout: 30000
            }
        );

        return result.code === 0;
    } catch (_) {
        return false;
    }
}

/* ==========================================================================
   SEARCH YOUTUBE
========================================================================== */

async function searchYouTube(query, limit = 5) {
    const cleanQuery = String(query || '').trim();

    if (!cleanQuery) {
        return [];
    }

    const result = await runProcess(
        [
            '-m',
            'yt_dlp',

            ...getYtDlpCompatibilityArgs(),

            '--flat-playlist',

            '--no-warnings',
            '--ignore-errors',

            '--skip-download',

            '--print',
            '%(id)s\t%(title)s\t%(duration)s\t%(channel)s',

            `ytsearch${limit}:${cleanQuery}`
        ],
        {
            timeout: SEARCH_TIMEOUT
        }
    );

    if (result.code !== 0) {
        throw new Error(
            result.stderr.trim() ||
            'YouTube search failed.'
        );
    }

    const results = [];

    for (const line of result.stdout.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed) {
            continue;
        }

        const parts = trimmed.split('\t');

        const id = parts[0];

        if (!id) {
            continue;
        }

        results.push({
            id,
            title: parts[1] || 'Unknown title',
            duration: parts[2] || 'Unknown',
            channel: parts[3] || 'Unknown'
        });
    }

    return results;
}

/* ==========================================================================
   GET VIDEO INFORMATION
========================================================================== */

async function getVideoInfo(url) {
    const result = await runProcess(
        [
            '-m',
            'yt_dlp',

            ...getYtDlpCompatibilityArgs(),

            '--dump-single-json',
            '--no-warnings',
            '--skip-download',

            url
        ],
        {
            timeout: SEARCH_TIMEOUT
        }
    );

    if (result.code !== 0) {
        throw new Error(
            result.stderr.trim() ||
            'Unable to retrieve video information.'
        );
    }

    try {
        return JSON.parse(result.stdout);
    } catch (_) {
        throw new Error(
            'YouTube returned invalid video information.'
        );
    }
}

/* ==========================================================================
   DOWNLOAD AUDIO
========================================================================== */

async function downloadAudio(url, directory) {
    const outputTemplate = path.join(
        directory,
        '%(title).150s [%(id)s].%(ext)s'
    );

    const args = [
        '-m',
        'yt_dlp',

        ...getYtDlpCompatibilityArgs(),

        '--no-warnings',
        '--no-playlist',

        '--retries',
        '3',

        '--fragment-retries',
        '3',

        '--file-access-retries',
        '3',

        '--retry-sleep',
        '2',

        '--socket-timeout',
        '30',

        '--concurrent-fragments',
        '4',

        '--newline',

        '-f',
        'bestaudio/best',

        '-x',

        '--audio-format',
        'mp3',

        '--audio-quality',
        '192K',

        '--embed-thumbnail',

        '--add-metadata',

        '-o',
        outputTemplate,

        url
    ];

    return await runProcess(
        args,
        {
            cwd: directory,
            timeout: DOWNLOAD_TIMEOUT
        }
    );
}

/* ==========================================================================
   DOWNLOAD VIDEO
========================================================================== */

async function downloadVideo(url, directory) {
    const outputTemplate = path.join(
        directory,
        '%(title).150s [%(id)s].%(ext)s'
    );

    const args = [
        '-m',
        'yt_dlp',

        ...getYtDlpCompatibilityArgs(),

        '--no-warnings',
        '--no-playlist',

        '--retries',
        '3',

        '--fragment-retries',
        '3',

        '--file-access-retries',
        '3',

        '--retry-sleep',
        '2',

        '--socket-timeout',
        '30',

        '--concurrent-fragments',
        '4',

        '--newline',

        /*
         * Prefer MP4-compatible streams.
         *
         * If a separate video/audio stream is needed,
         * yt-dlp + FFmpeg will merge them.
         */

        '-f',
        'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best',

        '--merge-output-format',
        'mp4',

        '-o',
        outputTemplate,

        url
    ];

    return await runProcess(
        args,
        {
            cwd: directory,
            timeout: DOWNLOAD_TIMEOUT
        }
    );
}

/* ==========================================================================
   FIND DOWNLOADED FILE
========================================================================== */

function findDownloadedFile(directory, extensions = []) {
    if (!fs.existsSync(directory)) {
        return null;
    }

    const files = fs.readdirSync(directory)
        .filter(file => {
            const fullPath = path.join(
                directory,
                file
            );

            try {
                return fs.statSync(fullPath).isFile();
            } catch (_) {
                return false;
            }
        });

    if (!extensions.length) {
        return files.length
            ? path.join(directory, files[0])
            : null;
    }

    const matching = files.filter(file => {
        const lower = file.toLowerCase();

        return extensions.some(
            extension =>
                lower.endsWith(extension.toLowerCase())
        );
    });

    if (!matching.length) {
        return null;
    }

    /*
     * Choose the largest file.
     *
     * This helps avoid accidentally selecting
     * a thumbnail or tiny metadata file.
     */

    matching.sort((a, b) => {
        const sizeA = fs.statSync(
            path.join(directory, a)
        ).size;

        const sizeB = fs.statSync(
            path.join(directory, b)
        ).size;

        return sizeB - sizeA;
    });

    return path.join(
        directory,
        matching[0]
    );
}

/* ==========================================================================
   SEND AUDIO
========================================================================== */

async function sendAudio({
    sock,
    jid,
    file,
    title,
    reply
}) {
    if (!sock || !jid) {
        throw new Error(
            'WhatsApp socket or JID is unavailable.'
        );
    }

    if (!fs.existsSync(file)) {
        throw new Error(
            'Downloaded audio file does not exist.'
        );
    }

    const stats = fs.statSync(file);

    if (stats.size < 1000) {
        throw new Error(
            'Downloaded audio file appears to be invalid.'
        );
    }

    await sock.sendMessage(
        jid,
        {
            audio: {
                stream: fs.createReadStream(file)
            },

            mimetype: 'audio/mpeg',

            fileName:
                `${sanitizeTitle(title)}.mp3`,

            ptt: false
        }
    );

    return true;
}

/* ==========================================================================
   SEND VIDEO
========================================================================== */

async function sendVideo({
    sock,
    jid,
    file,
    title
}) {
    if (!sock || !jid) {
        throw new Error(
            'WhatsApp socket or JID is unavailable.'
        );
    }

    if (!fs.existsSync(file)) {
        throw new Error(
            'Downloaded video file does not exist.'
        );
    }

    const stats = fs.statSync(file);

    if (stats.size < 1000) {
        throw new Error(
            'Downloaded video file appears to be invalid.'
        );
    }

    await sock.sendMessage(
        jid,
        {
            video: {
                stream: fs.createReadStream(file)
            },

            mimetype: 'video/mp4',

            fileName:
                `${sanitizeTitle(title)}.mp4`
        }
    );

    return true;
}

/* ==========================================================================
   DOWNLOAD WITH RETRIES
========================================================================== */

async function downloadWithRetries(
    downloader,
    url,
    directory
) {
    let lastError = null;

    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {
        try {
            console.log(
                `🎵 Downloader attempt ${attempt}/${MAX_RETRIES}`
            );

            const result =
                await downloader(
                    url,
                    directory
                );

            if (result.code === 0) {
                return result;
            }

            lastError = new Error(
                result.stderr.trim() ||
                `Download failed with exit code ${result.code}.`
            );

            console.error(
                `Downloader attempt ${attempt} failed:`,
                lastError.message
            );
        } catch (error) {
            lastError = error;

            console.error(
                `Downloader attempt ${attempt} error:`,
                error.message
            );
        }

        if (attempt < MAX_RETRIES) {
            await sleep(
                1500 * attempt
            );
        }
    }

    throw lastError ||
        new Error('Download failed.');
}

/* ==========================================================================
   ERROR MESSAGE
========================================================================== */

function friendlyDownloadError(error) {
    const message = String(
        error?.message || error || ''
    ).toLowerCase();

    if (
        message.includes('timed out') ||
        message.includes('timeout')
    ) {
        return (
            '⏱️ *DOWNLOAD TIMEOUT*\n\n' +
            'The video took too long to download.\n' +
            'Try a shorter video or try again.'
        );
    }

    if (
        message.includes('sign in') ||
        message.includes('confirm you') ||
        message.includes('not a bot') ||
        message.includes('authentication') ||
        message.includes('login_required')
    ) {
        if (!hasBgutilProvider()) {
            return (
                '🔐 *YOUTUBE ANTI-BOT CHECK*\n\n' +
                'YouTube is currently requiring a Proof-of-Origin (PO) token for this download.\n\n' +
                'The downloader code is ready to use a bgutil PO-token provider, but no provider is installed/running yet.\n\n' +
                'Install the provider, then restart Crystal Bot.\n\n' +
                'Windows provider script location:\n' +
                '%USERPROFILE%\\bgutil-ytdlp-pot-provider\\server\\build\\generate_once.js'
            );
        }

        return (
            '🔐 *YOUTUBE ANTI-BOT CHECK*\n\n' +
            'The PO-token provider was detected, but YouTube still rejected this request.\n\n' +
            'Try the command again or update the PO-token provider and yt-dlp.'
        );
    }

    if (
        message.includes('private video') ||
        message.includes('video unavailable')
    ) {
        return (
            '🚫 *VIDEO UNAVAILABLE*\n\n' +
            'The requested YouTube video is unavailable or private.'
        );
    }

    if (
        message.includes('ffmpeg')
    ) {
        return (
            '❌ *FFMPEG ERROR*\n\n' +
            'FFmpeg could not process the downloaded media.\n\n' +
            'Make sure FFmpeg is available in your system PATH.'
        );
    }

    return (
        '❌ *DOWNLOAD FAILED*\n\n' +
        'The media could not be downloaded after several attempts.\n\n' +
        'Try the command again or use another video.'
    );
}

/* ==========================================================================
   PLUGINS
========================================================================== */

module.exports = [

    /* ======================================================================
       PLAY
    ====================================================================== */

    {
        name: 'play',

        alias: [
            'song',
            'music'
        ],

        description:
            'Search YouTube and download music as MP3',

        category:
            'DOWNLOADER',

        async execute(context) {
            const {
                reply,
                text,
                sock,
                jid
            } = context;

            const query =
                String(text || '').trim();

            if (!query) {
                return reply(
                    '🎵 *CRYSTAL PLAY*\n\n' +
                    'Search and download music.\n\n' +
                    'Usage:\n' +
                    '/play song name\n\n' +
                    'Example:\n' +
                    '/play Omah Lay Soso'
                );
            }

            const ready =
                await checkYtDlp();

            if (!ready) {
                return reply(
                    '❌ *YT-DLP NOT FOUND*\n\n' +
                    'Run this in PowerShell:\n\n' +
                    'python -m pip install -U yt-dlp\n\n' +
                    'Then restart Crystal Bot.'
                );
            }

            let directory = null;

            try {
                await reply(
                    '🔎 *SEARCHING YOUTUBE...*\n\n' +
                    `🎵 ${query}`
                );

                const results =
                    await searchYouTube(
                        query,
                        5
                    );

                if (!results.length) {
                    return reply(
                        '❌ No YouTube results were found.'
                    );
                }

                const video =
                    results[0];

                const url =
                    `https://www.youtube.com/watch?v=${video.id}`;

                await reply(
                    '⬇️ *DOWNLOADING MUSIC...*\n\n' +
                    `🎵 ${video.title}\n` +
                    `👤 ${video.channel}\n` +
                    `⏱️ ${formatDuration(video.duration)}\n\n` +
                    'Please wait...'
                );

                directory =
                    createTempDirectory();

                await downloadWithRetries(
                    downloadAudio,
                    url,
                    directory
                );

                const file =
                    findDownloadedFile(
                        directory,
                        ['.mp3']
                    );

                if (!file) {
                    throw new Error(
                        'MP3 file was not created.'
                    );
                }

                await sendAudio({
                    sock,
                    jid,
                    file,
                    title: video.title,
                    reply
                });

                console.log(
                    `✅ MP3 sent: ${video.title}`
                );
            } catch (error) {
                console.error(
                    '❌ /play error:',
                    error
                );

                await reply(
                    friendlyDownloadError(error)
                );
            } finally {
                cleanupDirectory(
                    directory
                );
            }
        }
    },

    /* ======================================================================
       SONG
    ====================================================================== */

    {
        name: 'song',

        alias: [
            'ytmusic'
        ],

        description:
            'Download a song as MP3',

        category:
            'DOWNLOADER',

        async execute(context) {
            /*
             * Keep /song compatible with /play.
             *
             * The command handler normally resolves aliases,
             * but this fallback makes the plugin useful even if
             * aliases are handled differently by the loader.
             */

            const query =
                String(
                    context.text || ''
                ).trim();

            if (!query) {
                return context.reply(
                    '🎵 Usage:\n' +
                    '/song song name'
                );
            }

            /*
             * Call the same implementation directly.
             */

            const {
                reply,
                sock,
                jid
            } = context;

            let directory = null;

            try {
                const ready =
                    await checkYtDlp();

                if (!ready) {
                    return reply(
                        '❌ yt-dlp is not installed.\n\n' +
                        'Run:\n' +
                        'python -m pip install -U yt-dlp'
                    );
                }

                await reply(
                    '🔎 Searching for your song...'
                );

                const results =
                    await searchYouTube(
                        query,
                        5
                    );

                if (!results.length) {
                    return reply(
                        '❌ No results found.'
                    );
                }

                const video =
                    results[0];

                const url =
                    `https://www.youtube.com/watch?v=${video.id}`;

                await reply(
                    '⬇️ Downloading MP3...\n\n' +
                    `🎵 ${video.title}`
                );

                directory =
                    createTempDirectory();

                await downloadWithRetries(
                    downloadAudio,
                    url,
                    directory
                );

                const file =
                    findDownloadedFile(
                        directory,
                        ['.mp3']
                    );

                if (!file) {
                    throw new Error(
                        'MP3 was not created.'
                    );
                }

                await sendAudio({
                    sock,
                    jid,
                    file,
                    title: video.title,
                    reply
                });
            } catch (error) {
                console.error(
                    '❌ /song error:',
                    error
                );

                await reply(
                    friendlyDownloadError(error)
                );
            } finally {
                cleanupDirectory(
                    directory
                );
            }
        }
    },

    /* ======================================================================
       YTMP3
    ====================================================================== */

    {
        name: 'ytmp3',

        alias: [
            'yta',
            'ytaudio'
        ],

        description:
            'Download YouTube URL as MP3',

        category:
            'DOWNLOADER',

        async execute(context) {
            const {
                reply,
                text,
                sock,
                jid
            } = context;

            const url =
                String(text || '').trim();

            if (!url) {
                return reply(
                    '🎵 *YOUTUBE MP3*\n\n' +
                    'Usage:\n' +
                    '/ytmp3 YouTube URL'
                );
            }

            if (!isYouTubeUrl(url)) {
                return reply(
                    '❌ Please provide a valid YouTube URL.'
                );
            }

            let directory = null;

            try {
                const ready =
                    await checkYtDlp();

                if (!ready) {
                    return reply(
                        '❌ yt-dlp is not installed.\n\n' +
                        'Run:\n' +
                        'python -m pip install -U yt-dlp'
                    );
                }

                await reply(
                    '🔎 Reading YouTube video...'
                );

                const info =
                    await getVideoInfo(url);

                await reply(
                    '⬇️ *DOWNLOADING MP3...*\n\n' +
                    `🎵 ${info.title || 'YouTube audio'}\n` +
                    `👤 ${info.uploader || 'Unknown'}\n` +
                    `⏱️ ${formatDuration(info.duration)}`
                );

                directory =
                    createTempDirectory();

                await downloadWithRetries(
                    downloadAudio,
                    url,
                    directory
                );

                const file =
                    findDownloadedFile(
                        directory,
                        ['.mp3']
                    );

                if (!file) {
                    throw new Error(
                        'MP3 file was not created.'
                    );
                }

                await sendAudio({
                    sock,
                    jid,
                    file,
                    title:
                        info.title ||
                        'Crystal Bot Audio',
                    reply
                });

                console.log(
                    `✅ /ytmp3 completed: ${info.title}`
                );
            } catch (error) {
                console.error(
                    '❌ /ytmp3 error:',
                    error
                );

                await reply(
                    friendlyDownloadError(error)
                );
            } finally {
                cleanupDirectory(
                    directory
                );
            }
        }
    },

    /* ======================================================================
       YTMP4
    ====================================================================== */

    {
        name: 'ytmp4',

        alias: [
            'ytvideo'
        ],

        description:
            'Download YouTube URL as MP4',

        category:
            'DOWNLOADER',

        async execute(context) {
            const {
                reply,
                text,
                sock,
                jid
            } = context;

            const url =
                String(text || '').trim();

            if (!url) {
                return reply(
                    '🎥 *YOUTUBE MP4*\n\n' +
                    'Usage:\n' +
                    '/ytmp4 YouTube URL'
                );
            }

            if (!isYouTubeUrl(url)) {
                return reply(
                    '❌ Please provide a valid YouTube URL.'
                );
            }

            let directory = null;

            try {
                const ready =
                    await checkYtDlp();

                if (!ready) {
                    return reply(
                        '❌ yt-dlp is not installed.\n\n' +
                        'Run:\n' +
                        'python -m pip install -U yt-dlp'
                    );
                }

                await reply(
                    '🔎 Reading YouTube video...'
                );

                const info =
                    await getVideoInfo(url);

                await reply(
                    '🎥 *DOWNLOADING VIDEO...*\n\n' +
                    `🎬 ${info.title || 'YouTube video'}\n` +
                    `⏱️ ${formatDuration(info.duration)}\n\n` +
                    'Please wait...'
                );

                directory =
                    createTempDirectory();

                await downloadWithRetries(
                    downloadVideo,
                    url,
                    directory
                );

                const file =
                    findDownloadedFile(
                        directory,
                        ['.mp4']
                    );

                if (!file) {
                    throw new Error(
                        'MP4 file was not created.'
                    );
                }

                await sendVideo({
                    sock,
                    jid,
                    file,
                    title:
                        info.title ||
                        'Crystal Bot Video'
                });

                console.log(
                    `✅ /ytmp4 completed: ${info.title}`
                );
            } catch (error) {
                console.error(
                    '❌ /ytmp4 error:',
                    error
                );

                await reply(
                    friendlyDownloadError(error)
                );
            } finally {
                cleanupDirectory(
                    directory
                );
            }
        }
    },

    /* ======================================================================
       YTSEARCH
    ====================================================================== */

    {
        name: 'ytsearch',

        alias: [
            'yts',
            'youtubesearch'
        ],

        description:
            'Search YouTube without downloading',

        category:
            'DOWNLOADER',

        async execute({
            reply,
            text
        }) {
            const query =
                String(text || '').trim();

            if (!query) {
                return reply(
                    '🔎 *YOUTUBE SEARCH*\n\n' +
                    'Usage:\n' +
                    '/ytsearch song name\n\n' +
                    'Example:\n' +
                    '/ytsearch Omah Lay Soso'
                );
            }

            try {
                const ready =
                    await checkYtDlp();

                if (!ready) {
                    return reply(
                        '❌ yt-dlp is not installed.\n\n' +
                        'Run:\n' +
                        'python -m pip install -U yt-dlp'
                    );
                }

                await reply(
                    '🔎 Searching YouTube...'
                );

                const results =
                    await searchYouTube(
                        query,
                        5
                    );

                if (!results.length) {
                    return reply(
                        '❌ No YouTube results found.'
                    );
                }

                let output =
                    '╭━━━〔 🔎 YOUTUBE SEARCH 〕━━━╮\n' +
                    '┃\n';

                results.forEach(
                    (video, index) => {
                        output +=
                            `┃ ${index + 1}. *${video.title}*\n` +
                            `┃    👤 ${video.channel}\n` +
                            `┃    ⏱️ ${formatDuration(video.duration)}\n` +
                            `┃    🔗 https://youtu.be/${video.id}\n` +
                            '┃\n';
                    }
                );

                output +=
                    '╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n' +
                    '💎 Crystal Bot';

                await reply(output);
            } catch (error) {
                console.error(
                    '❌ /ytsearch error:',
                    error
                );

                await reply(
                    '❌ *SEARCH FAILED*\n\n' +
                    'YouTube search could not be completed.\n' +
                    'Try again in a moment.'
                );
            }
        }
    }

];

