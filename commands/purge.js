module.exports = {
    name: 'purge',
    category: 'Utility',
    description: 'Delete your own messages',
    async execute(message, args, client) {
        // Usage: !purge <count>
        const count = parseInt(args[0]);
        if (!count || isNaN(count)) return;

        try {
            // Delete command message first
            await message.delete().catch(() => { });

            // Fetch recent messages
            const fetched = await message.channel.messages.fetch({ limit: 100 });
            // Filter: Own messages only
            const ownMessages = fetched.filter(m => m.author.id === client.user.id && m.id !== message.id).first(count);

            for (const msg of ownMessages) {
                if (!msg) continue;
                await msg.delete().catch(() => { });
                await new Promise(r => setTimeout(r, 800)); // 800ms delay for safety against rate limits
            }

            const ok = await message.channel.send("ok");
            setTimeout(() => {
                ok.delete().catch(() => { });
            }, 3000);

        } catch (e) {
            console.error('[Purge] Error:', e.message);
        }
    }
};
