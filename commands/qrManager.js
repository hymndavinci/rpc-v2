const fs = require('fs');
const path = require('path');
const { fetch } = require('undici');

const qrPath = path.join(__dirname, '..', 'data', 'qr.json');

const activeSetup = new Map();

function loadData() {
    if (!fs.existsSync(qrPath)) return {};
    try { return JSON.parse(fs.readFileSync(qrPath, 'utf8')); }
    catch (e) { return {}; }
}

function saveData(data) {
    fs.writeFileSync(qrPath, JSON.stringify(data, null, 2));
}

async function deleteSoon(msg) {
    try { await msg.delete(); } catch (e) {}
}

module.exports = {
    async handle(message, client, isAllowed, accountIndex) {
        if (!isAllowed || accountIndex !== 1) return false;

        const content = message.content.trim();
        const lower = content.toLowerCase();
        const userId = message.author.id;
        const now = Date.now();

        const sessionKey = userId;

        if (activeSetup.has(sessionKey)) {
            const sess = activeSetup.get(sessionKey);
            if (now - sess.startTime > 300000) {
                activeSetup.delete(sessionKey);
                message.reply('Setup timed out.');
                return true;
            }
        }

        if (lower === 'qr' || lower === 'change qr') {
            const db = loadData();
            if (lower === 'qr' && db[userId] && db[userId].img) {
                deleteSoon(message);
                await message.channel.send(db[userId].img);
                if (db[userId].id) await message.channel.send(db[userId].id);
                return true;
            }

            // Start Setup
            activeSetup.set(sessionKey, { step: 1, startTime: now, msgs: [message] });
            const promptMsg = await message.channel.send('send your qr link or image');
            activeSetup.get(sessionKey).msgs.push(promptMsg);
            return true;
        }

        const session = activeSetup.get(sessionKey);
        if (session) {
            if (session.step === 1) {
                let imgUrl = null;
                if (message.attachments.size > 0) {
                    imgUrl = message.attachments.first().url;
                } else if (content.startsWith('http')) {
                    imgUrl = content;
                }

                if (imgUrl) {
                    session.pendingImg = imgUrl;
                    session.step = 2;
                    session.msgs.push(message);
                    activeSetup.set(sessionKey, session);

                    const idMsg = await message.channel.send("send your id, if u don't want to set then say no");
                    session.msgs.push(idMsg);
                    return true;
                }
                return false;
            }

            if (session.step === 2) {
                const db = loadData();
                db[userId] = {
                    img: session.pendingImg,
                    id: (content.toLowerCase() === 'no') ? null : content
                };
                saveData(db);

                const allMsgs = [...session.msgs, message];
                activeSetup.delete(sessionKey);

                const doneMsg = await message.channel.send(db[userId].id ? 'done' : 'saved');

                setTimeout(async () => {
                    for (const m of allMsgs) deleteSoon(m);
                    deleteSoon(doneMsg);
                }, 2000);

                return true;
            }
        }

        return false;
    }
};
