const fs = require('fs');
const path = require('path');
const { RichPresence } = require('discord.js-selfbot-v13');
const statusManager = require('./statusManager');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RPC_FILE = path.join(DATA_DIR, 'rpc.json');

const defaultData = {
    enabled: false,
    type: 'PLAYING',
    name: 'Hymn+',
    applicationId: '',
    details: '',
    state: '',
    largeImage: '',
    largeText: '',
    smallImage: '',
    smallText: '',
    button1Text: '',
    button2Text: '',
    button2Url: '',
    enableProgressBar: false,
    startTimestamp: 0,
    endTimestamp: 0,
    spoofEnabled: false,
    spoofType: 'none',
    gameSpoofing: false,
    selectedGame: 'none'
};

function loadData() {
    if (!fs.existsSync(RPC_FILE)) return defaultData;
    try {
        const loaded = JSON.parse(fs.readFileSync(RPC_FILE, 'utf8'));
        return { ...defaultData, ...loaded };
    } catch (e) { return defaultData; }
}

function saveData(data) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const startOffset = parseInt(data.startTimestamp);
    const endOffset = parseInt(data.endTimestamp);

    if (data.gameSpoofing) {
        const oldData = fs.existsSync(RPC_FILE) ? JSON.parse(fs.readFileSync(RPC_FILE, 'utf8')) : {};
        if (!oldData.gameSpoofing || oldData.selectedGame !== data.selectedGame || !oldData.epochGameTimestamp) {
            data.epochGameTimestamp = Date.now();
        } else {
            data.epochGameTimestamp = oldData.epochGameTimestamp;
        }
    }

    if (data.enableProgressBar && !isNaN(endOffset) && endOffset > 0) {
        const realStart = Date.now() - (isNaN(startOffset) ? 0 : startOffset);
        data.epochTimestamp = realStart;
        data.epochEndTimestamp = realStart + endOffset;
    } else {
        delete data.epochEndTimestamp;
        if (!isNaN(startOffset) && startOffset > 0) {
            data.epochTimestamp = Date.now() - startOffset;
        } else {
            delete data.epochTimestamp;
        }
    }

    fs.writeFileSync(RPC_FILE, JSON.stringify(data, null, 2));

    // Clear cache supaya image baru di-resolve ulang
    clearImageCache();
}

function isExternalURL(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://'));
}

// Cache hasil resolve external image supaya nggak spam API tiap heartbeat
const imageCache = new Map();

// Clear cache kalau RPC data berubah (ganti image URL)
function clearImageCache() {
    imageCache.clear();
}

async function resolveImages(largeImage, smallImage, appId, client) {
    const result = { large: largeImage || null, small: smallImage || null };
    if (!appId || !client || !client.user) return result;

    const toResolve = [];
    const keys = [];

    if (largeImage && isExternalURL(largeImage)) {
        if (imageCache.has(largeImage)) {
            result.large = imageCache.get(largeImage);
        } else {
            toResolve.push(largeImage);
            keys.push('large');
        }
    }
    if (smallImage && isExternalURL(smallImage) && toResolve.length < 2) {
        if (imageCache.has(smallImage)) {
            result.small = imageCache.get(smallImage);
        } else {
            toResolve.push(smallImage);
            keys.push('small');
        }
    }

    if (toResolve.length === 0) return result;

    try {
        const assets = await RichPresence.getExternal(client, appId, ...toResolve);
        assets.forEach((asset, i) => {
            const resolved = `mp:${asset.external_asset_path}`;
            result[keys[i]] = resolved;
            imageCache.set(toResolve[i], resolved);
        });
        console.log(`[RPC] External image(s) resolved: ${toResolve.join(', ')}`);
    } catch (err) {
        console.error('[RPC] Failed to resolve external images:', err.message);
    }

    return result;
}

async function setPresence(client, data) {
    if (!client.user) return;

    try {
        const activities = [];

        if (data.enabled) {
            const appId = data.applicationId || client.user.id;

            const rpcActivity = {
                type: data.type.toUpperCase(),
                application_id: appId,
                name: data.name || 'Hymn+',
                details: data.details || undefined,
                state: data.state || undefined,
                assets: {},
                buttons: [],
                metadata: { button_urls: [] }
            };

            if (data.type.toUpperCase() === 'STREAMING') {
                rpcActivity.url = 'https://twitch.tv/discord';
            }

            // Timestamps
            if (data.enableProgressBar && data.epochEndTimestamp > 0) {
                rpcActivity.timestamps = {
                    start: data.epochTimestamp || Date.now(),
                    end: data.epochEndTimestamp
                };
            } else if (data.epochTimestamp && data.epochTimestamp > 0) {
                rpcActivity.timestamps = { start: data.epochTimestamp };
            } else if (data.startTimestamp > 0) {
                rpcActivity.timestamps = { start: Date.now() - parseInt(data.startTimestamp) };
            }

            // --- SPOOFING LOGIC ---
            if (data.gameSpoofing) {
                delete rpcActivity.details;
                delete rpcActivity.state;
                rpcActivity.assets = {};
                delete rpcActivity.buttons;
                delete rpcActivity.metadata;

                rpcActivity.type = 'PLAYING';
                rpcActivity.timestamps = { start: data.epochGameTimestamp || Date.now() };

                if (data.selectedGame === 'minecraft') {
                    rpcActivity.application_id = '1402418491272986635';
                    rpcActivity.name = 'Minecraft';
                    rpcActivity.assets.large_image = 'https://cdn.discordapp.com/app-icons/1402418491272986635/166fbad351ecdd02d11a3b464748f66b.png?size=240&keep_aspect_ratio=false';
                } else if (data.selectedGame === 'genshin') {
                    rpcActivity.application_id = '762434991303950386';
                    rpcActivity.name = 'Genshin Impact';
                    rpcActivity.assets.large_image = 'https://cdn.discordapp.com/app-icons/762434991303950386/eb0e25b739e4fa38c1671a3d1edcd1e0.png?size=240&keep_aspect_ratio=false';
                }

            } else if (data.spoofEnabled) {
                if (data.spoofType === 'crunchyroll') {
                    rpcActivity.application_id = '981509069309354054';
                } else if (data.spoofType === 'playstation') {
                    rpcActivity.application_id = '1008890872156405890';
                    rpcActivity.platform = 'ps5';
                }

                // Resolve images with (possibly spoofed) appId
                const spoofAppId = rpcActivity.application_id;
                const images = await resolveImages(data.largeImage, data.smallImage, spoofAppId, client);
                if (images.large) {
                    rpcActivity.assets.large_image = images.large;
                    if (data.largeText) rpcActivity.assets.large_text = data.largeText;
                }
                if (images.small) {
                    rpcActivity.assets.small_image = images.small;
                    if (data.smallText) rpcActivity.assets.small_text = data.smallText;
                }

            } else {
                // Normal mode — resolve external images
                const images = await resolveImages(data.largeImage, data.smallImage, appId, client);
                if (images.large) {
                    rpcActivity.assets.large_image = images.large;
                    if (data.largeText) rpcActivity.assets.large_text = data.largeText;
                }
                if (images.small) {
                    rpcActivity.assets.small_image = images.small;
                    if (data.smallText) rpcActivity.assets.small_text = data.smallText;
                }
            }

            if (Object.keys(rpcActivity.assets).length === 0) delete rpcActivity.assets;

            // Buttons
            const isValidUrl = (url) => url && (url.startsWith('http://') || url.startsWith('https://'));
            if (data.button1Text && isValidUrl(data.button1Url)) {
                rpcActivity.buttons.push(data.button1Text);
                rpcActivity.metadata.button_urls.push(data.button1Url);
            }
            if (data.button2Text && isValidUrl(data.button2Url)) {
                rpcActivity.buttons.push(data.button2Text);
                rpcActivity.metadata.button_urls.push(data.button2Url);
            }
            if (rpcActivity.buttons.length === 0) {
                delete rpcActivity.buttons;
                delete rpcActivity.metadata;
            }

            activities.push(rpcActivity);
        }

        // Custom Status Activity
        const statusData = statusManager.loadData();
        const statusActivity = statusManager.getStatusActivity(statusData);
        if (statusActivity) {
            activities.push(statusActivity);
        }

        // Set Presence
        await client.user.setPresence({
            status: statusData.status || 'online',
            activities: activities
        });

    } catch (e) {
        console.error("[RPC] Error setting presence:", e);
    }
}

module.exports = {
    loadData,
    saveData,
    setPresence,
    initialize: async (client) => {
        const data = loadData();
        await setPresence(client, data);
    }
};