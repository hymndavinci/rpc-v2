module.exports = {
    name: 'stop',
    description: 'Stop music and clear the queue',
    async execute(message, args, client) {
        if (!message.guild) {
            await message.channel.send('```This command only works in servers```');
            return;
        }

        const queue = client.queueManager.get(message.guild.id);

        if (!queue) {
            await message.channel.send('```No music is playing```');
            return;
        }

        try {
            // Destroy Lavalink player
            await client.lavalink.destroyPlayer(message.guild.id);

            // Clear queue
            client.queueManager.delete(message.guild.id);

            // Disconnect from voice channel via gateway OP 4
            const shard = client.ws.shards ? client.ws.shards.get(message.guild.shardId || 0) : client.ws;
            shard.send({
                op: 4,
                d: {
                    guild_id: message.guild.id,
                    channel_id: null,
                    self_mute: false,
                    self_deaf: false
                }
            });

            let response = '```\n';
            response += '╭─[ MUSIC STOPPED ]─╮\n\n';
            response += '  ⏹️ Player stopped\n';
            response += '  🗑️ Queue cleared\n';
            response += '  👋 Disconnected\n';
            response += '\n╰──────────────────────────────────╯\n```';

            await message.channel.send(response);

            if (message.deletable) {
                await message.delete().catch(() => { });
            }
        } catch (err) {
            console.error('[Stop Error]:', err);
            await message.channel.send(`\`\`\`js\n❌ Error: ${err.message}\n\`\`\``);
        }
    },
};
