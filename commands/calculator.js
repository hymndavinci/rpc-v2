module.exports = {
    async handle(message) {
        const content = message.content.trim();
        const mathRegex = /^[0-9+\-*/().\s^%×÷]+$/;
        const operatorRegex = /[+\-*/^%×÷]/;

        if (!mathRegex.test(content) || !operatorRegex.test(content)) {
            return false;
        }
        try {
            const evalStr = content
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/\^/g, '**');

            const result = new Function('return ' + evalStr)();

            if (result !== undefined && !isNaN(result) && isFinite(result)) {
                if (result.toString() === content) return false;

                await message.channel.send(result.toString());
                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }
};
module.exports = {
    async handle(message) {
        const content = message.content.trim();

        // Harus ada angka di kiri DAN kanan operator — cegah false positive seperti "-1" atau "2"
        const mathRegex = /^[0-9+\-*/().\s^%×÷]+$/;
        const operatorRegex = /\d\s*[+\-*/^%×÷]\s*\d/;

        if (!mathRegex.test(content) || !operatorRegex.test(content)) {
            return false;
        }

        // Minimal harus ada 2 karakter angka dan 1 operator
        const digitCount = (content.match(/\d/g) || []).length;
        if (digitCount < 2) return false;

        try {
            const evalStr = content
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/\^/g, '**');

            const result = new Function('return ' + evalStr)();

            if (result !== undefined && !isNaN(result) && isFinite(result)) {
                if (result.toString() === content) return false;

                await message.channel.send(result.toString());
                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }
};