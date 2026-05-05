const { WebhookClient } = require('discord.js-selfbot-v13');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/mirror_config.json');

// Per-client mirror maps: clientId -> Map<sourceId, config>
const clientMirrors = new Map();

function getMirrors(client) {
    if (!clientMirrors.has(client.user.id)) {
        clientMirrors.set(client.user.id, new Map());
    }
    return clientMirrors.get(client.user.id);
}

function loadData() {
    if (!fs.existsSync(CONFIG_PATH)) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({}, null, 4));
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveData(client) {
    const activeMirrors = getMirrors(client);
    const existing = loadData();

    // Remove old entries for this client, keep others
    for (const [sourceId, config] of Object.entries(existing)) {
        if (config.clientId === client.user.id) {
            delete existing[sourceId];
        }
    }

    // Write this client's mirrors back
    for (const [sourceId, config] of activeMirrors.entries()) {
        existing[sourceId] = {
            clientId: client.user.id,
            sourceId: config.sourceId,
            targetId: config.targetId,
            mode: config.mode,
            webhook: config.webhook,
            startTime: config.startTime
        };
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(existing, null, 4));
}

async function initialize(client) {
    console.log(`[Mirror System] Initializing for account ${client.user.id}...`);
    const saved = loadData();
    const activeMirrors = getMirrors(client);
    let restored = 0;

    for (const [sourceId, config] of Object.entries(saved)) {
        // Only restore mirrors that belong to this client
        // If no clientId saved (legacy), try to restore with this client
        if (config.clientId && config.clientId !== client.user.id) continue;

        try {
            await startMirror(client, config.sourceId, config.targetId, config.mode, config.webhook, true);
            restored++;
        } catch (e) {
            console.error(`[Mirror] Failed to restore mirror for ${sourceId}:`, e.message);
        }
    }

    client.on('messageCreate', async (message) => {
        if (!activeMirrors.has(message.channel.id)) return;
        const config = activeMirrors.get(message.channel.id);

        if (message.author.id === client.user.id) return;
        if (message.author.bot) return;
        if (message.system) return;

        try {
            await processMirror(client, message, config);
        } catch (e) {
            console.error(`[Mirror] Error processing message from ${message.channel.id}:`, e.message);
        }
    });

    console.log(`[Mirror System] Restored ${restored} mirrors for account ${client.user.id}.`);
}

async function startMirror(client, sourceId, targetId, mode, webhookData = null, isRestoring = false) {
    const activeMirrors = getMirrors(client);

    if (activeMirrors.has(sourceId)) {
        throw new Error("Mirror already active for this source channel.");
    }

    const sourceChannel = await client.channels.fetch(sourceId).catch(() => null);
    const targetChannel = await client.channels.fetch(targetId).catch(() => null);

    if (!sourceChannel) throw new Error("Invalid Source Channel.");
    if (!targetChannel) throw new Error("Invalid Target Channel.");

    let webhookInfo = webhookData;
    let webhookClient = null;

    if (mode === 'webhook') {
        if (!webhookInfo) {
            const hooks = await targetChannel.fetchWebhooks().catch(() => null);
            let hook = hooks ? hooks.find(h => h.token) : null;

            if (!hook) {
                try {
                    hook = await targetChannel.createWebhook('Mirror Bot', {
                        avatar: client.user.displayAvatarURL(),
                        reason: 'Mirror System'
                    });
                } catch (e) {
                    throw new Error("Failed to create Webhook. Check Permissions in Target Channel.");
                }
            }
            webhookInfo = { id: hook.id, token: hook.token };
        }

        webhookClient = new WebhookClient({ id: webhookInfo.id, token: webhookInfo.token });
    }

    const config = {
        clientId: client.user.id,
        sourceId,
        targetId,
        mode,
        webhook: webhookInfo,
        webhookClient,
        startTime: new Date().toISOString()
    };

    activeMirrors.set(sourceId, config);

    if (!isRestoring) {
        saveData(client);
    }
}

async function stopMirror(client, sourceId) {
    const activeMirrors = getMirrors(client);
    if (!activeMirrors.has(sourceId)) return false;
    activeMirrors.delete(sourceId);
    saveData(client);
    return true;
}

// WORKAROUND: Send attachment URLs as text content so they embed
async function processMirror(client, message, config) {
    const { mode, targetId, webhookClient } = config;

    if (!message.content && message.attachments.size === 0 && message.embeds.length === 0) return;

    const attachmentUrls = [];
    if (message.attachments.size > 0) {
        message.attachments.forEach(attachment => {
            attachmentUrls.push(attachment.url);
        });
    }

    const cdnLinks = (message.content || '').match(/https:\/\/cdn\.discordapp\.com\/[^\s]+/g) || [];
    cdnLinks.forEach(link => {
        if (!attachmentUrls.includes(link)) {
            attachmentUrls.push(link);
        }
    });

    const embeds = message.embeds.length > 0 ? message.embeds : [];

    let finalContent = message.content || '';
    if (attachmentUrls.length > 0) {
        const urlText = attachmentUrls.join('\n');
        finalContent = finalContent ? `${finalContent}\n${urlText}` : urlText;
    }

    const webhookPayload = {
        username: message.author.username,
        avatarURL: message.author.displayAvatarURL(),
        embeds: embeds
    };

    if (finalContent.trim()) {
        webhookPayload.content = finalContent;
    }

    if (mode === 'webhook' && webhookClient) {
        try {
            await webhookClient.send(webhookPayload);
        } catch (e) {
            console.error(`[Mirror] Webhook Error:`, e.message);
        }
    } else {
        const targetChannel = await client.channels.fetch(targetId).catch(() => null);
        if (targetChannel) {
            try {
                await targetChannel.send(webhookPayload);
            } catch (e) {
                console.error(`[Mirror] Send Error:`, e.message);
            }
        }
    }
}

function getActiveMirrors(client) {
    const activeMirrors = getMirrors(client);
    const list = [];
    for (const [sourceId, config] of activeMirrors.entries()) {
        list.push({
            sourceId,
            targetId: config.targetId,
            mode: config.mode,
            startTime: config.startTime
        });
    }
    return list;
}

module.exports = { initialize, startMirror, stopMirror, getActiveMirrors, loadData };