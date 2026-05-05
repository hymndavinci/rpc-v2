module.exports = {
    name: 'left',
    category: 'Music',
    description: 'Leave the voice channel and stop music',
    async execute(message, args, client) {
        const guildId = message.guild.id;

        // Stop music and clear queue
        const queue = client.queueManager.get(guildId);
        if (queue) {
            client.queueManager.delete(guildId);
        }

        if (client.lavalink) {
            try {
                await client.lavalink.destroyPlayer(guildId);
            } catch (e) { }
        }

        // Leave Voice Channel
        try {
            if (client.ws && client.ws.shards && client.ws.shards.size > 0) {
                const sid = message.guild.shardId != null ? message.guild.shardId : 0;
                let shard = client.ws.shards.get(sid);
                if (!shard) shard = client.ws.shards.first();
                if (!shard) throw new Error('No shard');
                shard.send({
                    op: 4,
                    d: {
                        guild_id: guildId,
                        channel_id: null,
                        self_mute: false,
                        self_deaf: false
                    }
                });
            } else {
                client.ws.broadcast({
                    op: 4,
                    d: {
                        guild_id: guildId,
                        channel_id: null,
                        self_mute: false,
                        self_deaf: false
                    }
                });
            }
            message.reply('Disconnected and stopped music.');
        } catch (error) {
            console.error(error);
            message.reply('Failed to leave voice channel.');
        }
    }
};
