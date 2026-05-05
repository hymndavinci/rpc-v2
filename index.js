require('dotenv').config();


// Suppress annoying DeprecationWarnings from dependencies (like url.parse())
process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning') return;
    console.warn(warning.name, warning.message);
});

require('./logger').initLogger();
const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');
const path = require('path');

// Ambil semua token dari env (TOKEN_1, TOKEN_2, ...)
const tokens = [];
let i = 1;
while (process.env[`TOKEN_${i}`]) {
    tokens.push(process.env[`TOKEN_${i}`]);
    i++;
}

// Fallback kalau masih pakai TOKEN lama
if (tokens.length === 0 && process.env.TOKEN) {
    tokens.push(process.env.TOKEN);
}

if (tokens.length === 0) {
    console.error('Error: TOKEN atau TOKEN_1 tidak ditemukan di .env file');
    process.exit(1);
}

console.log(`🚀 Menjalankan ${tokens.length} akun...`);

// Shared instances (semua akun pakai yang sama)
const Lavalink = require('./music/lavalink');
const Queue = require('./music/queue');

// Lavalink is now instantiated per-client inside startClient

// Shared data
const afkCooldowns = new Map();
const clients = [];
let dashboardStarted = false;

// Cleanup old cooldowns every hour
setInterval(() => {
    const now = Date.now();
    for (const [id, time] of afkCooldowns) {
        if (now - time > 3600000) afkCooldowns.delete(id);
    }
}, 3600000);

// Allowed Users Logic
const allowedManager = require('./commands/allowedManager');
function isAllowedUser(userId) {
    return allowedManager.isAllowed(userId);
}

// Load commands (shared logic, tapi tiap client punya Map sendiri)
const commandsPath = path.join(__dirname, 'commands');
let loadedCommands = [];
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const command = require(path.join(commandsPath, file));
            if (command.name) {
                loadedCommands.push(command);
            }
        } catch (error) {
            console.error('Error loading command ' + file + ':', error);
        }
    }
}

const dashboard = require('./dashboard/index');

// Pre-load all managers at top-level (avoid require() inside event handlers)
const rpcManager = require('./commands/rpcManager');
const reactionManager = require('./commands/reactionManager');
const aiManager = require('./commands/aiManager');
const mirrorManager = require('./commands/mirrorManager');
const autoMsg = require('./commands/autoMsg');
const timedMsg = require('./commands/timedMsg');
const waifuManager = require('./commands/waifuManager');
const welcomerManager = require('./commands/welcomerManager');
const mimicManager = require('./commands/mimicManager');
const igManager = require('./commands/igManager');
const ytManager = require('./commands/ytManager');
const calculator = require('./commands/calculator');
const currency = require('./commands/currency');
const qrManager = require('./commands/qrManager');
const ipCommand = require('./commands/ip');
const clipboardManager = require('./commands/clipboardManager');

// Command Cooldown System (prevent spam)
const commandCooldowns = new Map();
function checkCooldown(userId, commandName, seconds = 3) {
    const key = `${userId}-${commandName}`;
    const now = Date.now();
    if (commandCooldowns.has(key) && now - commandCooldowns.get(key) < seconds * 1000) return false;
    commandCooldowns.set(key, now);
    return true;
}
// Cleanup cooldowns every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, time] of commandCooldowns) {
        if (now - time > 60000) commandCooldowns.delete(key);
    }
}, 300000);

// Helper: tulis activity log
function writeActivityLog(logData) {
    try {
        const actLogPath = path.join(__dirname, 'data', 'activity_log.json');
        let actLogs = [];
        if (fs.existsSync(actLogPath)) {
            actLogs = JSON.parse(fs.readFileSync(actLogPath, 'utf8'));
        }
        actLogs.unshift(logData);
        if (actLogs.length > 200) actLogs = actLogs.slice(0, 200);
        fs.writeFileSync(actLogPath, JSON.stringify(actLogs, null, 2));
    } catch (e) {
        console.error('[Activity Log] Write error:', e.message);
    }
}

function startClient(token, index) {
    const client = new Client({
        checkUpdate: false
    });

    // FIX: voiceStates per-client, bukan shared — cegah saling overwrite antar akun
    const voiceStates = {};
    const clientQueue = new Queue();

    // AFK cache to avoid disk reads on every message
    let afkCache = null;
    let afkCacheTime = 0;

    function getAfkData() {
        const now = Date.now();
        if (!afkCache || now - afkCacheTime > 5000) {
            const afkPath = path.join(__dirname, 'data', 'afk.json');
            if (fs.existsSync(afkPath)) {
                afkCache = JSON.parse(fs.readFileSync(afkPath, 'utf8'));
            } else {
                afkCache = { isOn: false, reason: '', logsEnabled: false };
            }
            afkCacheTime = now;
        }
        return afkCache;
    }

    // PREFIX PER AKUN — ambil dari PREFIX_1, PREFIX_2, PREFIX_3, fallback ke PREFIX atau '!'
    client.prefix = process.env[`PREFIX_${index}`] || process.env.PREFIX || '!';

    client.ttsMap = new Map();
    client.commands = new Map();
    
    // Instantiate Lavalink for THIS specific client so it binds to the correct user.id
    if (process.env.LAVALINK_WS && process.env.LAVALINK_REST && process.env.LAVALINK_PASSWORD) {
        client.lavalink = new Lavalink({
            restHost: process.env.LAVALINK_REST,
            wsHost: process.env.LAVALINK_WS,
            password: process.env.LAVALINK_PASSWORD,
            clientName: (process.env.CLIENT_NAME || 'HymnPlus') + '-' + index,
        });
    } else {
        client.lavalink = null;
    }
    
    client.queueManager = clientQueue;
    client.lavalinkVoiceStates = voiceStates;

    // Assign commands ke client ini
    for (const cmd of loadedCommands) {
        client.commands.set(cmd.name, cmd);
    }

    client.on('ready', () => {
        console.log(`[Akun ${index}] Logged in as ${client.user.tag}`);
        console.log(`[Akun ${index}] User ID: ${client.user.id}`);
        console.log(`[Akun ${index}] Hymn+ is ready!`);
        console.log(`[Akun ${index}] Loaded ${client.commands.size} commands`);
        console.log(`[Akun ${index}] Prefix: ${client.prefix}`);

        // Connect to Lavalink independently for each account
        if (client.lavalink) {
            client.lavalink.connect(client.user.id);
            console.log(`[Akun ${index}] Connecting to Lavalink...`);
        }

        // Initialize RPC
        rpcManager.initialize(client);

        // Initialize Auto Reaction
        reactionManager.initialize(client);

        // Initialize AI System
        aiManager.initialize(client);

        // Heartbeat to prevent status from disappearing (every 10 minutes)
        setInterval(async () => {
            const data = rpcManager.loadData();
            await rpcManager.setPresence(client, data);
        }, 10 * 60 * 1000);

        // Initialize Mirror System
        mirrorManager.initialize(client);

        // Initialize Auto Msg System
        autoMsg.initialize(client);

        // Initialize Timed Msg System
        timedMsg.initialize(client);

        // Initialize Waifu/Fun System
        waifuManager.initialize(client);

        // Store client in the global clients array
        clients[index - 1] = client;

        // Start Dashboard only once
        if (!dashboardStarted) {
            dashboard(clients);
            dashboardStarted = true;
            console.log(`[Akun ${index}] Dashboard started (Multi-Account Ready)`);
        }
    });

    // Voice state handling for Lavalink (per client, pakai voiceStates lokal)
    if (client.lavalink) {
        client.ws.on('VOICE_STATE_UPDATE', (packet) => {
            if (packet.user_id !== client.user.id) return;

            const guildId = packet.guild_id;
            if (!voiceStates[guildId]) voiceStates[guildId] = {};
            voiceStates[guildId].sessionId = packet.session_id;
            if (packet.channel_id) {
                voiceStates[guildId].channelId = packet.channel_id;
            }
            console.log(`[Akun ${index}] [Voice] State update for guild ${guildId}`);
        });

        client.ws.on('VOICE_SERVER_UPDATE', (packet) => {
            const guildId = packet.guild_id;
            if (!voiceStates[guildId]) voiceStates[guildId] = {};
            voiceStates[guildId].token = packet.token;
            voiceStates[guildId].endpoint = packet.endpoint;
            console.log(`[Akun ${index}] [Voice] Server update for guild ${guildId}`);
        });

        // Lavalink event handlers (per client)
        client.lavalink.on('ready', async () => {
            console.log(`[Akun ${index}] [Lavalink] Session established`);

            // FIX: resume semua queue yang masih aktif setelah reconnect
            // Lavalink session baru = player lama hilang, perlu di-restore manual
            const allQueues = clientQueue.getAll();
            for (const [guildId, queue] of allQueues) {
                if (!queue.nowPlaying) continue;

                const voiceState = voiceStates[guildId];
                if (!voiceState || !voiceState.token || !voiceState.sessionId || !voiceState.endpoint) {
                    console.warn(`[Akun ${index}] [Resume] voiceState not ready for guild ${guildId}, skip`);
                    continue;
                }

                try {
                    console.log(`[Akun ${index}] [Resume] Restoring player for guild ${guildId}: ${queue.nowPlaying.info.title}`);
                    await client.lavalink.updatePlayer(guildId, queue.nowPlaying, voiceState, {
                        volume: queue.volume,
                        filters: queue.filters
                    });
                    if (queue.textChannel) {
                        queue.textChannel.send('```⚡ Lavalink reconnected — resuming playback```');
                    }
                } catch (err) {
                    console.error(`[Akun ${index}] [Resume] Failed to restore player for guild ${guildId}:`, err);
                    if (queue.textChannel) {
                        queue.textChannel.send('```❌ Lavalink reconnected but failed to resume playback. Please play again.```');
                    }
                }
            }
        });

        client.lavalink.on('event', async (evt) => {
            console.log(`[Akun ${index}] [Lavalink Event] Type: ${evt.type}, Guild: ${evt.guildId}`);

            if (evt.type === 'TrackEndEvent') {
                if (evt.reason === 'finished' || evt.reason === 'loadFailed') {
                    const queue = clientQueue.get(evt.guildId);
                    if (!queue) return;

                    if (queue.nowPlaying) {
                        if (queue.loop === 'track') {
                            // FIX: track loop — langsung unshift, JANGAN push ke history
                            // supaya lagu yang sama terus dimainkan tanpa masuk history
                            queue.songs.unshift(queue.nowPlaying);
                        } else if (queue.loop === 'queue') {
                            // FIX: queue loop — push ke history DAN ke akhir songs
                            // ini sudah benar, tapi tambahkan fallback:
                            // kalau queue cuma 1 lagu dan songs kosong setelah push,
                            // pastikan tetap ada lagu (double-check)
                            queue.history.push(queue.nowPlaying);
                            queue.songs.push(queue.nowPlaying);
                        } else {
                            // no loop — masuk history, tidak balik ke queue
                            queue.history.push(queue.nowPlaying);
                        }
                    }

                    let nextSong = clientQueue.getNext(evt.guildId);

                    if (queue.autoplay && queue.songs.length < 5) {
                        await clientQueue.fillAutoplayQueue(client, evt.guildId);
                        if (!nextSong) {
                            nextSong = clientQueue.getNext(evt.guildId);
                        }
                    }

                    if (!nextSong) {
                        await client.lavalink.destroyPlayer(evt.guildId);
                        clientQueue.delete(evt.guildId);
                        if (queue.textChannel) {
                            queue.textChannel.send('```Queue finished' + (queue.autoplay ? ' (Autoplay failed to find songs)' : '') + '```');
                        }
                        return;
                    }

                    queue.nowPlaying = nextSong;
                    const voiceState = voiceStates[evt.guildId];

                    if (voiceState && voiceState.token && voiceState.sessionId && voiceState.endpoint) {
                        try {
                            await client.lavalink.updatePlayer(evt.guildId, nextSong, voiceState, {
                                volume: queue.volume,
                                filters: queue.filters
                            });

                            if (queue.textChannel) {
                                let nowPlayingMsg = '```\n';
                                nowPlayingMsg += '╭─[ NOW PLAYING ]─╮\n\n';
                                nowPlayingMsg += `  🎵 ${nextSong.info.title}\n`;
                                nowPlayingMsg += `  👤 ${nextSong.info.author}\n`;
                                nowPlayingMsg += '\n╰──────────────────────────────────╯\n```';
                                queue.textChannel.send(nowPlayingMsg);
                            }
                        } catch (err) {
                            console.error(`[Akun ${index}] [Auto-play Error]:`, err);
                            // FIX: kalau gagal play, kembalikan lagu ke depan queue
                            // supaya ga ilang dan bisa dicoba lagi
                            queue.songs.unshift(nextSong);
                            queue.nowPlaying = null;
                            if (queue.textChannel) {
                                queue.textChannel.send('```⚠️ Error playing next song, will retry on reconnect```');
                            }
                        }
                    } else {
                        // FIX: voiceState expired/belum siap — kembalikan lagu ke depan queue
                        // supaya tidak hilang, dan tunggu VOICE_SERVER_UPDATE berikutnya
                        console.warn(`[Akun ${index}] [TrackEnd] voiceState not ready for guild ${evt.guildId}, re-queuing song`);
                        queue.songs.unshift(nextSong);
                        queue.nowPlaying = null;
                    }
                }
            }
        });

        client.lavalink.on('playerUpdate', (packet) => {
            const queue = clientQueue.get(packet.guildId);
            if (queue && packet.state) {
                queue.position = packet.state.position;
                queue.lastUpdate = Date.now();
            }
        });
    }

    // --- WELCOMER SYSTEM ---
    client.on('guildMemberAdd', async member => {
        try {
            const setup = welcomerManager.getSetup(member.guild.id);

            if (setup && setup.channelId) {
                const channel = member.guild.channels.cache.get(setup.channelId);
                if (channel) {
                    if (setup.welcomeType === 'text') {
                        let txt = setup.textMessage || 'hey {user} welcome to the {server} you are {count} member';
                        txt = txt.replace(/{user}/g, `<@${member.user.id}>`);
                        txt = txt.replace(/{server}/g, member.guild.name || 'Server');
                        txt = txt.replace(/{count}/g, member.guild.memberCount || 1);
                        await channel.send(txt);
                    } else {
                        const { createCanvas, loadImage } = require('canvas');
                        const fs = require('fs');
                        const path = require('path');

                        const dataDir = path.join(__dirname, 'data');
                        const extList = ['.png', '.jpg', '.jpeg', '.webp'];
                        let bgPath = path.join(__dirname, 'dashboard', 'public', 'welcome.jpg');

                        for (const ext of extList) {
                            const checkPath = path.join(dataDir, `welcome${ext}`);
                            if (fs.existsSync(checkPath)) {
                                bgPath = checkPath;
                                break;
                            }
                        }

                        const canvas = createCanvas(1024, 450);
                        const ctx = canvas.getContext('2d');

                        const background = await loadImage(bgPath);
                        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

                        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        const cleanGuild = member.guild.name.replace(/[^\x00-\x7F]/g, "").trim() || "Server";
                        let cleanUser = member.user.username.replace(/[^\x00-\x7F]/g, "").trim() || "User";
                        if (member.user.discriminator && member.user.discriminator !== '0') {
                            cleanUser += `#${member.user.discriminator}`;
                        }

                        let userColor = setup.textcolor || '#ffffff';
                        if (/^[0-9A-Fa-f]{6}$/.test(userColor)) userColor = '#' + userColor;

                        ctx.textAlign = 'center';

                        const lines = (setup.cardMessage || "WELCOME TO {server}\n{user}\nMember #{count}").split('\n');
                        let startY = 290;

                        lines.forEach((line) => {
                            let parsedLine = line.replace(/{server}/gi, cleanGuild)
                                .replace(/{user}/gi, cleanUser)
                                .replace(/{count}/gi, member.guild.memberCount.toString());

                            if (line.toLowerCase().includes('{user}')) {
                                ctx.font = 'bold 50px Arial';
                                ctx.fillStyle = userColor;
                                startY += 10;
                            } else {
                                ctx.font = 'bold 36px Arial';
                                ctx.fillStyle = '#ffffff';
                            }
                            ctx.fillText(parsedLine, canvas.width / 2, startY);
                            startY += 45;
                        });

                        const userAvatar = member.user.displayAvatarURL({ format: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
                        const avatar = await loadImage(userAvatar);

                        const arcX = canvas.width / 2;
                        const arcY = 140;
                        const arcRadius = 90;

                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(arcX, arcY, arcRadius, 0, Math.PI * 2, true);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(avatar, arcX - arcRadius, arcY - arcRadius, arcRadius * 2, arcRadius * 2);
                        ctx.restore();

                        ctx.beginPath();
                        ctx.arc(arcX, arcY, arcRadius, 0, Math.PI * 2, true);
                        ctx.closePath();
                        ctx.lineWidth = 8;
                        ctx.strokeStyle = userColor;
                        ctx.stroke();

                        const buffer = canvas.toBuffer('image/png');

                        await channel.send({
                            files: [{
                                attachment: buffer,
                                name: 'welcome.png'
                            }]
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`[Akun ${index}] Welcomer Canvas Event Error:`, e);
        }
    });

    // --- MESSAGE HANDLER ---
    client.on('messageCreate', async (message) => {
        try {
            if (!message.author) return;

            // --- MIMIC SYSTEM ---
            mimicManager.handle(message, client);

            // --- AFK & LOGGING SYSTEM ---
            const mentionsMe = message.mentions.users.has(client.user.id);
            const isDm = message.channel.type === 'DM';

            if ((mentionsMe || isDm) && message.author.id !== client.user.id) {
                const logPath = path.join(__dirname, 'data', 'afklog.json');

                let afkData = getAfkData();

                // 1. LOGGING (If enabled)
                if (afkData.logsEnabled) {
                    let logs = [];
                    if (fs.existsSync(logPath)) {
                        logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
                    }

                    let cleanContent = message.content;
                    cleanContent = cleanContent.replace(/<@!?(\d+)>/g, (match, id) => {
                        const user = client.users.cache.get(id);
                        return user ? `@${user.username}` : match;
                    });
                    cleanContent = cleanContent.replace(/<@&(\d+)>/g, (match, id) => {
                        const role = message.guild ? message.guild.roles.cache.get(id) : null;
                        return role ? `@${role.name}` : match;
                    });
                    cleanContent = cleanContent.replace(/<#(\d+)>/g, (match, id) => {
                        const channel = client.channels.cache.get(id);
                        return channel ? `#${channel.name}` : match;
                    });
                    cleanContent = cleanContent.replace(/<a?:(\w+):(\d+)>/g, ':$1:');

                    const logEntry = {
                        id: Date.now().toString(),
                        user: message.author.tag,
                        userId: message.author.id,
                        channel: isDm ? 'DM' : message.channel.name || 'Unknown',
                        guild: message.guild ? message.guild.name : 'Direct Message',
                        content: cleanContent,
                        time: new Date().toLocaleString(),
                        link: message.url
                    };

                    logs.unshift(logEntry);
                    if (logs.length > 50) logs = logs.slice(0, 50);
                    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
                }

                // 2. AFK REPLY
                if (afkData.isOn) {
                    const now = Date.now();
                    const lastReply = afkCooldowns.get(message.author.id) || 0;
                    const startTime = afkData.startTime || 0;
                    const cooldown = 5 * 60 * 1000;

                    if (now - lastReply >= cooldown || lastReply < startTime) {
                        const reason = afkData.reason || "I'm currently AFK.";
                        try {
                            await message.reply(`${reason}`);
                            afkCooldowns.set(message.author.id, now);
                        } catch (err) {
                            console.error(`[Akun ${index}] Failed to reply to AFK ping:`, err);
                        }
                    }
                }
            }

            // Helper buat buat log entry
            const makeLog = (type) => ({
                time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
                account: `Akun ${index}`,
                type,
                channel: message.guild ? `#${message.channel.name}` : 'DM',
                server: message.guild ? message.guild.name : `DM with ${message.author.tag}`,
                command: message.content
            });

            // --- NO-PREFIX HANDLERS (hanya akun ke-1, DISENGAJA) ---
            // Handler ini sengaja dibatasi ke akun pertama saja supaya tidak
            // double-trigger ketika beberapa akun aktif di channel yang sama.
            if (isAllowedUser(message.author.id) && index === 1) {
                const igHandled = await igManager.handle(message);
                if (igHandled) { writeActivityLog(makeLog('ig-fixer')); return; }

                const ytHandled = await ytManager.handle(message);
                if (ytHandled) { writeActivityLog(makeLog('yt-fixer')); return; }

                const handled = await calculator.handle(message);
                if (handled) { writeActivityLog(makeLog('calculator')); return; }

                const currencyHandled = await currency.handle(message);
                if (currencyHandled) { writeActivityLog(makeLog('currency')); return; }

                const qrHandled = await qrManager.handle(message, client, true, index);
                if (qrHandled) { writeActivityLog(makeLog('qr')); return; }

                const ipHandled = await ipCommand.handle(message);
                if (ipHandled) { writeActivityLog(makeLog('ip')); return; }
            }

            // --- TTS AUTO-SPEAK SYSTEM (semua akun, tapi per ttsMap masing-masing) ---
            if (isAllowedUser(message.author.id)) {
                if (message.guild && client.ttsMap && client.ttsMap.has(message.guild.id)) {
                    if (message.channel.id === client.ttsMap.get(message.guild.id) && !message.content.startsWith(client.prefix)) {
                        const ttsCommand = client.commands.get('tts');
                        if (ttsCommand && ttsCommand.speak) {
                            try {
                                await ttsCommand.speak(message, client);
                            } catch (err) {
                                console.error(`[Akun ${index}] TTS Speak Error:`, err);
                            }
                        }
                    }
                }
            }

            // --- COMMAND HANDLER ---
            if (!message.content.startsWith(client.prefix)) return;

            const args = message.content.slice(client.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (!isAllowedUser(message.author.id)) {
                return;
            }

            const command = client.commands.get(commandName);

            // --- CLIPBOARD MANAGER START ---
            if (!command) {
                const responseText = clipboardManager.getResponse(commandName);

                if (responseText) {
                    const referenceId = message.reference ? message.reference.messageId : null;

                    if (message.author.id === client.user.id) {
                        try { await message.delete(); } catch (e) { }
                    } else if (message.guild && message.guild.me.permissionsIn(message.channel).has('MANAGE_MESSAGES')) {
                        try { await message.delete(); } catch (e) { }
                    }

                    if (referenceId) {
                        try {
                            const repliedMsg = await message.channel.messages.fetch(referenceId);
                            if (repliedMsg) {
                                await repliedMsg.reply({ content: responseText, allowedMentions: { repliedUser: true } });
                            } else {
                                await message.channel.send(responseText);
                            }
                        } catch (e) {
                            await message.channel.send(responseText);
                        }
                    } else {
                        await message.channel.send(responseText);
                    }
                    writeActivityLog(makeLog('clipboard'));
                    return;
                }
            }
            // --- CLIPBOARD MANAGER END ---

            if (!command) return;

            // --- COOLDOWN CHECK ---
            if (!checkCooldown(message.author.id, commandName)) return;

            // --- ACTIVITY LOG (prefix commands) ---
            writeActivityLog(makeLog('command'));

            await command.execute(message, args, client);
        } catch (error) {
            console.error(`[Akun ${index}] Error in messageCreate:`, error);
        }
    });

    // Login
    client.login(token).catch(error => {
        console.error(`[Akun ${index}] Failed to login:`, error.message);
    });

    return client;
}

// Jalanin semua akun
tokens.forEach((token, idx) => {
    const client = startClient(token, idx + 1);
    clients.push(client);
});

// Anti-crash (global, cukup 1x)
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Anti-Crash] Unhandled Promise Rejection:\n', reason);
});

process.on('uncaughtException', (error, origin) => {
    console.error('[Anti-Crash] Uncaught Exception/Catch:\n', error, '\nOrigin:', origin);
});

process.on('uncaughtExceptionMonitor', (error, origin) => {
    console.error('[Anti-Crash] Uncaught Exception Monitor:\n', error, '\nOrigin:', origin);
});

// Graceful shutdown
async function shutdown(signal) {
    console.log(`\n[Shutdown] Received ${signal}. Cleaning up...`);

    for (const client of clients) {
        if (client && client.lavalink && client.lavalink.sessionId) {
            const queues = client.queueManager ? client.queueManager.getAll() : new Map();
            for (const [guildId] of queues) {
                try {
                    await client.lavalink.destroyPlayer(guildId);
                    console.log(`[Shutdown] Destroyed player for guild ${guildId}`);
                } catch (e) { }
            }
        }
        try { client.destroy(); } catch (e) { }
    }

    console.log('[Shutdown] Cleanup complete. Exiting.');
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));