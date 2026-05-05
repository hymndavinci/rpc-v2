const { fetch } = require('undici');

// ─── Mapping kategori ke endpoint nekos.best ───────────────────────────────
// Dokumentasi: https://nekos.best/docs
const NEKOS_BEST_SFW = {
    waifu:  'waifu',
    neko:   'neko',
    hug:    'hug',
    kiss:   'kiss',
    pat:    'pat',
    slap:   'slap',
    // 'kill' tidak ada di nekos.best, fallback ke 'punch'
    kill:   'punch',
};

const NEKOS_BEST_NSFW = {
    waifu:   null,          // nekos.best tidak punya NSFW waifu → pakai nekobot
    neko:    null,          // nekos.best tidak punya NSFW neko  → pakai nekobot
    blowjob: null,          // NSFW → nekobot
    hentai:  null,          // NSFW → nekobot
    anal:    null,          // NSFW → nekobot
    boobs:   null,          // NSFW → nekobot
};

// Mapping kategori NSFW ke endpoint nekobot.xyz
const NEKOBOT_NSFW_MAP = {
    waifu:   'hentai',
    neko:    'nekolewd',
    blowjob: 'blowjob',
    hentai:  'hentai',
    anal:    'hanal',
    boobs:   'hboobs',
};

const waifuManager = {
    initialize(client) {
        const commands = [
            // SFW/NSFW Toggleable berdasarkan channel
            { name: 'waifu',    type: 'mixed' },
            { name: 'neko',     type: 'mixed' },

            // Interactions (SFW only)
            { name: 'hug',      type: 'sfw' },
            { name: 'kiss',     type: 'sfw' },
            { name: 'pat',      type: 'sfw' },
            { name: 'slap',     type: 'sfw' },
            { name: 'kill',     type: 'sfw' },

            // NSFW Only
            { name: 'blowjob',  type: 'nsfw' },
            { name: 'hentai',   type: 'nsfw' },
            { name: 'anal',     type: 'nsfw' },
            { name: 'boobs',    type: 'nsfw' },
        ];

        commands.forEach(cmd => {
            client.commands.set(cmd.name, {
                name: cmd.name,
                category: 'Fun',
                description: `Fun command: ${cmd.name}`,
                execute: async (message, args, client) => {
                    await waifuManager.handleCommand(message, cmd.name, cmd);
                }
            });
        });
    },

    async handleCommand(message, name, config) {
        const isNsfw = message.channel.type === 'GUILD_TEXT'
            ? message.channel.nsfw
            : true;

        let url = null;

        try {
            if (config.type === 'nsfw') {
                if (!isNsfw) return;
                url = await waifuManager.getNekobotNsfw(name);

            } else if (config.type === 'mixed') {
                if (isNsfw) {
                    url = await waifuManager.getNekobotNsfw(name);
                } else {
                    url = await waifuManager.getNekosBest(name);
                }
            } else {
                // SFW
                url = await waifuManager.getNekosBest(name);
            }

            if (!url) {
                console.log(`[WaifuManager] No URL returned for ${name}`);
                return;
            }

            const referenceId = message.reference ? message.reference.messageId : null;

            if (referenceId) {
                try {
                    const repliedMsg = await message.channel.messages.fetch(referenceId);
                    if (repliedMsg) {
                        await repliedMsg.reply({ content: url, allowedMentions: { repliedUser: false } });
                        return;
                    }
                } catch (e) { /* fallthrough */ }
            }

            await message.channel.send(url);

        } catch (e) {
            console.error(`[WaifuManager] Error on ${name}:`, e);
        }
    },

    // ── nekos.best (SFW) ──────────────────────────────────────────────────
    async getNekosBest(category) {
        const endpoint = NEKOS_BEST_SFW[category] || category;
        try {
            const res = await fetch(`https://nekos.best/api/v2/${endpoint}`);
            if (!res.ok) {
                console.error(`[WaifuManager] nekos.best error: ${res.status} for ${endpoint}`);
                return null;
            }
            const data = await res.json();
            // nekos.best returns { results: [{ url, ... }] }
            if (data.results && data.results.length > 0) {
                return data.results[0].url;
            }
            return null;
        } catch (e) {
            console.error('[WaifuManager] nekos.best fetch error:', e);
            return null;
        }
    },

    // ── nekobot.xyz (NSFW fallback) ───────────────────────────────────────
    async getNekobotNsfw(category) {
        const type = NEKOBOT_NSFW_MAP[category] || category;
        try {
            const res = await fetch(`https://nekobot.xyz/api/image?type=${type}`);
            if (!res.ok) {
                console.error(`[WaifuManager] nekobot error: ${res.status} for ${type}`);
                return null;
            }
            const data = await res.json();
            return data.message || null;
        } catch (e) {
            console.error('[WaifuManager] nekobot fetch error:', e);
            return null;
        }
    },
};

module.exports = waifuManager;
