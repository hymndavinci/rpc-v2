function extractVideoId(link) {
    try {
        const patterns = [
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
            /youtube\.com\/shorts\/([^"&?\/\s]{11})/i
        ];

        for (const pattern of patterns) {
            const match = link.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    } catch (error) {
        console.error('[YT Manager] Extract Error:', error);
        return null;
    }
}

async function handle(message, client) {
    const prefix = (client && client.prefix) || process.env.PREFIX || '!';
    const content = message.content.trim();

    // FIX: Sekarang pakai command !yt <link>
    if (!content.startsWith(`${prefix}yt `)) return false;

    const link = content.slice(`${prefix}yt `.length).trim();

    if (!link.includes('youtube.com') && !link.includes('youtu.be')) {
        await message.channel.send('```Please provide a valid YouTube link```');
        return true;
    }

    const videoId = extractVideoId(link);

    if (videoId) {
        const newLink = `[+](https://koutube.com/${videoId})`;
        try {
            await message.channel.send(newLink);
            if (message.deletable) message.delete().catch(() => {});
        } catch (e) {
            console.error('[YT Manager] Send Error:', e);
        }
    } else {
        await message.channel.send('```Could not extract YouTube video ID from link```');
    }

    return true;
}

module.exports = { handle };