function createIdentifier(query) {
    return /^(https?:\/\/|www\.)/i.test(query) ? query : `ytsearch:${query}`;
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

async function playLogic(client, guildId, query) {
    const identifier = createIdentifier(query);
    let result;
    try {
        result = await client.lavalink.loadTracks(identifier);
    } catch (e) {
        return { success: false, reason: e.message };
    }

    if (result.loadType === 'empty') return { success: false, reason: 'No results found' };
    if (result.loadType === 'error') return { success: false, reason: result.data.message || 'Lavalink Error' };

    let track;
    if (result.loadType === 'track') track = result.data;
    else if (result.loadType === 'playlist') track = result.data.tracks[0];
    else if (result.loadType === 'search') track = result.data[0];

    if (!track) return { success: false, reason: 'No track found' };
    

    let queue = client.queueManager.get(guildId);
    if (!queue) {
        queue = client.queueManager.create(guildId);
    }

    if (queue.nowPlaying) {
        client.queueManager.addSong(guildId, track);

        if (queue.autoplay && queue.songs.length < 5) {
            client.queueManager.fillAutoplayQueue(client, guildId);
        }

        return { success: true, type: 'queue', track };
    } else {
        const voiceState = client.lavalinkVoiceStates[guildId];
        if (!voiceState || !voiceState.token) {
            return { success: false, reason: 'Bot not connected to voice. Use !join first.' };
        }

        queue.nowPlaying = track;
        queue.position = 0;
        queue.lastUpdate = Date.now();

        await client.lavalink.updatePlayer(guildId, track, voiceState, {
            volume: queue.volume,
            filters: queue.filters
        });

        if (queue.autoplay && queue.songs.length < 5) {
            client.queueManager.fillAutoplayQueue(client, guildId);
        }

        return { success: true, type: 'play', track };
    }
}

module.exports = {
    name: 'play',
    description: 'Play a song from YouTube or search query',
    playLogic,
    async execute(message, args, client) {
        if (!message.guild) return message.channel.send('```This command only works in servers```');

        if (client.ttsMap) client.ttsMap.delete(message.guild.id);

        if (!args.length) return message.channel.send('```Please provide a song name or URL```');

        // Cek apakah bot sudah di VC (via !join), kalau belum coba join dari VC user
        const guildId = message.guild.id;
        const voiceState = client.lavalinkVoiceStates[guildId];

        if (!voiceState || !voiceState.token) {
            // Bot belum join — coba join dari VC user
            const vc = message.member?.voice?.channel;
            if (!vc) return message.channel.send('```Bot not in voice channel. Use !join first or join a VC```');

            const shard = client.ws.shards ? client.ws.shards.get(message.guild.shardId || 0) : client.ws;
            shard.send({
                op: 4,
                d: {
                    guild_id: vc.guild.id,
                    channel_id: vc.id,
                    self_mute: false,
                    self_deaf: false
                }
            });

            // Wait for voiceState to be populated (poll every 200ms, max 5s)
            let waited = 0;
            while (waited < 5000) {
                await new Promise(resolve => setTimeout(resolve, 200));
                waited += 200;
                const vs = client.lavalinkVoiceStates[guildId];
                if (vs && vs.token && vs.sessionId && vs.endpoint) break;
            }

            const vsCheck = client.lavalinkVoiceStates[guildId];
            if (!vsCheck || !vsCheck.token) {
                return message.channel.send('```Voice connection timed out. Try !join first then !play```');
            }
        }

        try {
            const result = await playLogic(client, guildId, args.join(' '));

            if (!result.success) {
                return message.channel.send(`\`\`\`Error: ${result.reason}\`\`\``);
            }

            if (result.type === 'queue') {
                let response = '```\n';
                response += '╭─[ ADDED TO QUEUE ]─╮\n\n';
                response += `  Title: ${result.track.info.title}\n`;
                response += `  Artist: ${result.track.info.author}\n`;
                response += `  Position: ${client.queueManager.get(guildId).songs.length}\n`;
                response += '\n╰──────────────────────────────────╯\n```';
                message.channel.send(response);
            } else {
                let response = '```\n';
                response += '╭─[ NOW PLAYING ]─╮\n\n';
                response += `  🎵 ${result.track.info.title}\n`;
                response += `  👤 ${result.track.info.author}\n`;
                response += `  ⏱️ ${formatDuration(result.track.info.length)}\n`;
                response += '\n╰──────────────────────────────────╯\n```';
                message.channel.send(response);

                const queue = client.queueManager.get(guildId);
                if (queue) queue.textChannel = message.channel;
            }

            if (message.deletable) message.delete().catch(() => { });

        } catch (err) {
            console.error('[Play Error]:', err);
            message.channel.send(`\`\`\`js\n❌ Error: ${err.message}\n\`\`\``);
        }
    },
};