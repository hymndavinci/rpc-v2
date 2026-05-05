const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');

const defaultData = {
    status: 'online',
    custom_status: '',
    emoji: ''
};

function loadData() {
    if (!fs.existsSync(STATUS_FILE)) return defaultData;
    try {
        const loaded = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
        return { ...defaultData, ...loaded };
    } catch (e) { return defaultData; }
}

function saveData(data) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    // Merge with existing to avoid overwriting missing keys if any
    const existing = loadData();
    const newData = { ...existing, ...data };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(newData, null, 2));
}

function parseEmoji(text) {
    if (!text) return null;
    const customEmojiRegex = /<(a)?:(\w+):(\d+)>/;
    const match = text.match(customEmojiRegex);
    if (match) {
        return {
            name: match[2],
            id: match[3],
            animated: !!match[1]
        };
    }
    return {
        name: text,
        id: null,
        animated: false
    };
}

function getStatusActivity(data) {
    if (!data.custom_status && !data.emoji) return null;

    const activity = {
        type: 'CUSTOM',
        name: 'Custom Status',
        state: data.custom_status || ' ', // FIX: Use space if empty to prevent "Custom Status" text
    };

    if (data.emoji) {
        activity.emoji = parseEmoji(data.emoji);
    }

    return activity;
}

module.exports = {
    loadData,
    saveData,
    getStatusActivity
};
