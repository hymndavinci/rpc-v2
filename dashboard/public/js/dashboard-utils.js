/**
 * Dipakai di seluruh view dashboard yang memuat partial super_button terlebih dulu.
 */
(function (global) {

    /** Global toast notification — menggantikan alert() di semua halaman. */
    var _toastTimer = null;
    global.showToast = function showToast(msg, type) {
        var el = document.getElementById('globalToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'globalToast';
            el.style.cssText = [
                'position:fixed', 'bottom:24px', 'right:24px', 'z-index:99999',
                'padding:10px 18px', 'border-radius:10px', 'font-size:13px',
                'font-weight:600', 'color:#fff', 'opacity:0', 'pointer-events:none',
                'transition:opacity 0.25s ease', 'max-width:320px',
                'box-shadow:0 4px 20px rgba(0,0,0,0.4)', 'font-family:inherit'
            ].join(';');
            document.body.appendChild(el);
        }
        var colors = { error: '#ef4444', success: '#22c55e', warn: '#f59e0b' };
        el.style.background = colors[type] || '#06b6d4';
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { el.style.opacity = '0'; }, 3000);
    };

    /** Sanitasi teks untuk interpolasi HTML (isi elemen atau teks). */
    global.escapeHtml = function escapeHtml(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    /** Hanya boleh https untuk asset gambar (Discord CDN dll). */
    global.safeHttpsUrl = function safeHttpsUrl(url, fallback) {
        fallback =
            fallback || 'https://cdn.discordapp.com/embed/avatars/0.png';
        try {
            var s = String(url == null ? '' : url).trim();
            if (!s) return fallback;
            var u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
            return u.protocol === 'https:' ? u.href : fallback;
        } catch (e) {
            return fallback;
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
