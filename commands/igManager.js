function extractReelId(link) {
    try {
        const patterns = [
            /instagram\.com\/reels?\/([A-Za-z0-9_-]+)/,
            /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
            /instagram\.com\/p\/([A-Za-z0-9_-]+)/
        ];

        for (const pattern of patterns) {
            const match = link.match(pattern);
            if (match && match[1]) {
                return match[1].split('?')[0].split('/')[0];
            }
        }
        return null;
    } catch (error) {
        console.error('[IG Manager] Extract Error:', error);
        return null;
    }
}

async function handle(message, client) {
    const prefix = (client && client.prefix) || process.env.PREFIX || '!';
    const content = message.content.trim();

    // FIX: Sekarang pakai command !ig <link>
    if (!content.startsWith(`${prefix}ig `)) return false;

    const link = content.slice(`${prefix}ig `.length).trim();

    if (!link.includes('instagram.com')) {
        await message.channel.send('```Please provide a valid Instagram link```');
        return true;
    }

    const reelId = extractReelId(link);

    if (reelId) {
        const newLink = `[+](https://kkinstagram.com/reels/${reelId})`;
        try {
            await message.channel.send(newLink);
            if (message.deletable) message.delete().catch(() => {});
        } catch (e) {
            console.error('[IG Manager] Send Error:', e);
        }
    } else {
        await message.channel.send('```Could not extract Instagram ID from link```');
    }

    return true;
}

module.exports = { handle };