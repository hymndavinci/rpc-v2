const { MessageAttachment } = require('discord.js-selfbot-v13');
const { fetch } = require('undici');

const HF_TOKEN = process.env.HF_TOKEN;

async function generateImage(prompt) {
    // Pakai HuggingFace Inference API langsung (bukan router)
    const url = `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
            'x-use-cache': 'false'
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                num_inference_steps: 25,
                guidance_scale: 7.5
            }
        }),
        timeout: 60000
    });

    if (!res.ok) {
        const err = await res.text();
        // Kalau model lagi loading, kasih pesan yang jelas
        if (res.status === 503) throw new Error('Model is loading, try again in 20 seconds');
        throw new Error(`API Error ${res.status}: ${err.slice(0, 100)}`);
    }

    // Response langsung berupa binary image (bukan JSON)
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

module.exports = {
    name: 'img',
    description: 'Generate AI image using Stable Diffusion 2.1 (HuggingFace)',
    async execute(message, args) {
        if (!args.length) return message.reply('```Usage: !img <prompt>\nExample: !img makima chainsaw man anime```');

        if (!HF_TOKEN) return message.reply('```HF_TOKEN not set in .env```');

        const prompt = args.join(' ');
        let waitMsg;

        try {
            waitMsg = await message.channel.send(`🎨 Generating **${prompt}**...`);
        } catch (e) {}

        try {
            console.log(`[IMG] Generating: ${prompt}`);

            const buffer = await generateImage(prompt);

            if (buffer.length < 1000) throw new Error('Generated image too small or empty');

            const attachment = new MessageAttachment(buffer, `${args.join('_').slice(0, 50)}.png`);

            await message.channel.send({
                content: `🖼️ **${prompt}**`,
                files: [attachment]
            });

            if (waitMsg) await waitMsg.delete().catch(() => {});
            if (message.deletable) message.delete().catch(() => {});

        } catch (err) {
            console.error('[IMG] Error:', err.message);
            const errMsg = `❌ ${err.message}`;
            if (waitMsg) {
                await waitMsg.edit(errMsg).catch(() => message.channel.send(errMsg));
            } else {
                message.channel.send(errMsg);
            }
        }
    }
};