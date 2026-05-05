const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/ai_config.json');
const HISTORY_PATH = path.join(__dirname, '../data/chat_history.json');

// Initialize API
const openai = new OpenAI({
    apiKey: process.env.AI_API,
    baseURL: 'https://api.groq.com/openai/v1',
});

// Default Config
const DEFAULT_CONFIG = {
    global: false,
    enabledServers: [],
    enabledChannels: [],
    dmUsers: [],
    enabledGroups: [],
    enabledGroupsMention: [],
    freeWillChannels: [],
    aiName: "Hymn",
    backstory: "You are Hymn, a helpful and witty AI assistant.",
    personality: "Friendly, helpful, and sometimes sarcastic.",
    rules: "Keep responses concise. Do not ping @everyone.",
    modelType: "slow",
    bannedWords: ["age", "year old", "y/o", "birth"],
    disablePing: false,
    blockedUsers: []
};

function loadData() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            const dir = path.dirname(CONFIG_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 4));
            return DEFAULT_CONFIG;
        }
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        if (!raw.trim()) throw new Error('Empty file');

        let data = JSON.parse(raw);
        data = { ...DEFAULT_CONFIG, ...data };

        return data;
    } catch (e) {
        console.error('[AI Manager] Failed to load config, using defaults:', e.message);
        return DEFAULT_CONFIG;
    }
}

function saveData(data) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const existing = loadData();
        const finalData = { ...existing, ...data };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(finalData, null, 4));
    } catch (e) {
        console.error('[AI Manager] Failed to save config:', e);
    }
}

function loadHistory() {
    if (!fs.existsSync(HISTORY_PATH)) {
        fs.writeFileSync(HISTORY_PATH, JSON.stringify({}, null, 4));
        return {};
    }
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
}

function saveHistory(history) {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 4));
}

function getContext(userId, config) {
    const history = loadHistory();
    const userHistory = history[userId] || [];

    const systemMsg = {
        role: "system",
        content: `Name: ${config.aiName}\nBackstory: ${config.backstory}\nPersonality: ${config.personality}\nRules: ${config.rules}`
    };

    const messages = [systemMsg, ...userHistory];
    return messages;
}

async function addHistory(userId, userContent, aiContent) {
    let history = loadHistory();
    if (!history[userId]) history[userId] = [];

    // Simpan versi text-only ke history (bukan array content)
    const textContent = typeof userContent === 'string' ? userContent : 
        (userContent.find(c => c.type === 'text')?.text || '');

    history[userId].push({ role: "user", content: textContent });
    history[userId].push({ role: "assistant", content: aiContent });

    if (history[userId].length > 10) {
        history[userId] = history[userId].slice(history[userId].length - 10);
    }

    saveHistory(history);
}

// Core Chat Function
async function generateReply(userId, userContent, imageUrl = null) {
    const config = loadData();
    const messages = getContext(userId, config);

    // Determine Model Parameters
    // "slow" = Llama 4 Scout 17B — lebih pintar, support vision, konteks panjang
    // "fast" = Llama 3.3 70B — lebih cepat, cocok untuk chat ringan tanpa image
    let modelName = "meta-llama/llama-4-scout-17b-16e-instruct";
    let temp = 0.7;
    let maxTokens = 4096;

    if (config.modelType === "fast") {
        modelName = "llama-3.3-70b-versatile";
        temp = 0.6;
        maxTokens = 2048;
    }

    // Build user message — support image
    let userMessage;
    if (imageUrl) {
        userMessage = {
            role: "user",
            content: [
                { type: "image_url", image_url: { url: imageUrl } },
                { type: "text", text: userContent }
            ]
        };
    } else {
        userMessage = {
            role: "user",
            content: userContent
        };
    }

    messages.push(userMessage);

    try {
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: messages,
            temperature: temp,
            top_p: 0.9,
            max_tokens: maxTokens,
            stream: true
        });

        let fullContent = "";

        for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
                fullContent += delta.content;
            }
        }

        console.log(`\n[AI] Reply complete (Model: ${config.modelType}${imageUrl ? ', with image' : ''}).`);

        fullContent = fullContent.replace(/<think>[\s\S]*?(?:<\/think>|$)\s*/gi, '');

        console.log(`[AI] Content preview: "${fullContent.substring(0, 200)}"`);

        if (fullContent.trim()) {
            await addHistory(userId, userContent, fullContent);
        }

        return fullContent;

    } catch (error) {
        console.error("[AI] Error generating reply:", error);
        return "what you mean?";
    }
}

// Initialization and Event Listening
function initialize(client) {
    console.log("[AI System] Initializing...");

    client.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (!client.user || message.author.id === client.user.id) return;
            if (message.system || !message.content && !message.attachments.size) return;

            const ignoredTypes = ['RECIPIENT_ADD', 'RECIPIENT_REMOVE', 'CALL', 'CHANNEL_NAME_CHANGE', 'CHANNEL_ICON_CHANGE', 'PINS_ADD'];
            if (ignoredTypes.includes(message.type)) return;

            const config = loadData();
            const content = message.content || '';
            const guildId = message.guild?.id;
            const channelId = message.channel.id;
            const authorId = message.author.id;

            // Banned Words Check
            if (config.bannedWords && config.bannedWords.some(w => content.toLowerCase().includes(w.toLowerCase()))) {
                return;
            }

            // Blocklist Users Check
            if (config.blockedUsers && config.blockedUsers.includes(authorId)) {
                return;
            }

            // Detect image attachment
            let imageUrl = null;
            const attachment = message.attachments.first();
            if (attachment && attachment.contentType?.startsWith('image/')) {
                imageUrl = attachment.url;
            }

            // Skip if no content and no image
            if (!content.trim() && !imageUrl) return;

            let shouldReply = false;
            let freeWillDelay = 0;
            let isFreeWill = false;

            // DM Logic
            if (!guildId) {
                if (config.dmUsers && config.dmUsers.includes(authorId)) {
                    shouldReply = true;
                }
                if (config.enabledGroups && config.enabledGroups.includes(channelId)) {
                    shouldReply = true;
                }
                if (config.enabledGroupsMention && config.enabledGroupsMention.includes(channelId)) {
                    if (message.mentions.users.has(client.user.id)) {
                        shouldReply = true;
                    }
                }
            } else {
                // Server Logic
                if (config.freeWillChannels) {
                    const fwItem = config.freeWillChannels.find(x => typeof x === 'object' ? x.id === channelId : x === channelId);
                    if (fwItem) {
                        shouldReply = true;
                        isFreeWill = true;
                        freeWillDelay = typeof fwItem === 'object' ? (fwItem.delay || 0) : 0;
                    }
                }

                if (!isFreeWill) {
                    const isMentioned = message.mentions.users.has(client.user.id);
                    if (isMentioned) {
                        if (config.global) {
                            shouldReply = true;
                        } else {
                            const serverAllowed = config.enabledServers && config.enabledServers.includes(guildId);
                            const channelAllowed = config.enabledChannels && config.enabledChannels.includes(channelId);
                            if (serverAllowed || channelAllowed) {
                                shouldReply = true;
                            }
                        }
                    }
                }
            }

            if (shouldReply) {
                const processReply = async () => {
                    const startTime = Date.now();
                    message.channel.sendTyping().catch(() => { });

                    const effectiveContent = `(User: ${message.author.username}) ${content}`.trim();
                    const reply = await generateReply(authorId, effectiveContent, imageUrl);

                    if (freeWillDelay > 0) {
                        const timeTaken = Date.now() - startTime;
                        const targetDelayMs = freeWillDelay * 1000;
                        if (targetDelayMs > timeTaken) {
                            await new Promise(resolve => setTimeout(resolve, targetDelayMs - timeTaken));
                        }
                    }

                    if (reply && reply.trim().length > 0) {
                        console.log(`[AI] Reply length: ${reply.length}`);
                        const chunks = reply.match(/[\s\S]{1,1900}/g) || [reply];
                        try {
                            await message.reply({
                                content: chunks[0],
                                allowedMentions: { repliedUser: !config.disablePing }
                            });
                            for (let i = 1; i < chunks.length; i++) {
                                await message.channel.send(chunks[i]);
                            }
                        } catch (e) {
                            console.error("[AI] Failed to send reply:", e.message, e.code, e.status);
                            for (const chunk of chunks) {
                                await message.channel.send(chunk).catch(err => console.error("[AI] Failed to send fallback:", err.message, err.code));
                            }
                        }
                    }
                };

                if (isFreeWill && freeWillDelay > 0) {
                    if (!client.freeWillQueues) client.freeWillQueues = new Map();
                    const currentQueue = client.freeWillQueues.get(channelId) || Promise.resolve();

                    const nextQueue = currentQueue
                        .then(() => processReply())
                        .catch(err => console.error("[AI Queue Error]:", err));

                    client.freeWillQueues.set(channelId, nextQueue);
                } else {
                    processReply().catch(err => console.error("[AI Process Error]:", err));
                }
            }
        } catch (error) {
            console.error("Error in AI messageCreate:", error);
        }
    });
}

module.exports = {
    loadData,
    saveData,
    initialize
};