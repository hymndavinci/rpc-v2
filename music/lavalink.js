const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');

class Lavalink extends EventEmitter {
    constructor({ restHost, wsHost, password, clientName }) {
        super();
        this.restHost = restHost.replace(/\/$/, '');
        this.wsHost = wsHost.replace(/\/$/, '');
        this.password = password;
        this.clientName = clientName;
        this.sessionId = null;
        this.ws = null;
        this.userId = null;
    }

    async connect(userId) {
        this.userId = userId;
        this._reconnectAttempts = 0;
        this._doConnect();
    }

    _doConnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.ws = new WebSocket(this.wsHost, {
            headers: {
                Authorization: this.password,
                'User-Id': this.userId,
                'Client-Name': this.clientName,
            },
        });

        this.ws.on('open', () => {
            console.log('[Lavalink] Connected');
            this._reconnectAttempts = 0;
        });
        this.ws.on('close', (code, reason) => {
            console.log(`[Lavalink] Closed: ${code}`);
            if (code !== 1000) {
                const delay = Math.min(5000 * Math.pow(2, this._reconnectAttempts), 60000);
                this._reconnectAttempts++;
                console.log(`[Lavalink] Reconnecting in ${delay / 1000}s (attempt ${this._reconnectAttempts})...`);
                setTimeout(() => this._doConnect(), delay);
            }
        });
        this.ws.on('error', (error) => console.error('[Lavalink] Error:', error.message));
        this.ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg);
                this.handlePayload(data);
            } catch (err) {
                console.error('[Lavalink] Parse error:', err);
            }
        });
    }

    handlePayload(payload) {
        switch (payload.op) {
            case 'ready':
                this.sessionId = payload.sessionId;
                console.log('[Lavalink] Session:', this.sessionId);
                this.emit('ready', payload);
                break;
            case 'playerUpdate':
                this.emit('playerUpdate', payload);
                break;
            case 'event':
                this.emit('event', payload);
                break;
            case 'stats':
                this.emit('stats', payload);
                break;
        }
    }

    async loadTracks(identifier) {
        const url = `${this.restHost}/loadtracks?identifier=${encodeURIComponent(identifier)}`;

        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            const req = protocol.get(url, {
                headers: { Authorization: this.password }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                    } else {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error(`Invalid JSON from Lavalink: ${data.substring(0, 100)}`));
                        }
                    }
                });
            });
            req.on('error', reject);
        });
    }

    async updatePlayer(guildId, track, voiceState, options = {}) {
        if (!this.sessionId) throw new Error('Session ID not set');
        const url = `${this.restHost}/sessions/${this.sessionId}/players/${guildId}`;

        const payload = {
            voice: voiceState
        };

        if (track) {
            // FIX: noReplace: false supaya lagu yang sama bisa diplay ulang (loop track)
            // Tanpa ini Lavalink bisa ignore request kalau encoded sama persis
            payload.track = { encoded: track.encoded, userData: {} };
            payload.noReplace = false;
        }

        if (options.volume !== undefined) {
            payload.volume = options.volume;
        }

        if (options.paused !== undefined) {
            payload.paused = options.paused;
        }

        if (options.filters !== undefined) {
            payload.filters = options.filters;
        }

        return this.makeRequest(url, 'PATCH', payload);
    }

    async updatePlayerProperties(guildId, properties = {}) {
        if (!this.sessionId) throw new Error('Session ID not set');
        const url = `${this.restHost}/sessions/${this.sessionId}/players/${guildId}`;

        const payload = {};

        if (properties.volume !== undefined) {
            payload.volume = properties.volume;
        }

        if (properties.paused !== undefined) {
            payload.paused = properties.paused;
        }

        if (properties.filters !== undefined) {
            payload.filters = properties.filters;
        }

        if (properties.position !== undefined) {
            payload.position = properties.position;
        }

        return this.makeRequest(url, 'PATCH', payload);
    }

    async destroyPlayer(guildId) {
        if (!this.sessionId) throw new Error('Session ID not set');
        const url = `${this.restHost}/sessions/${this.sessionId}/players/${guildId}`;

        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            const urlObj = new URL(url);

            const req = protocol.request({
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname,
                method: 'DELETE',
                headers: { Authorization: this.password }
            }, (res) => {
                resolve(res.statusCode === 204);
            });

            req.on('error', reject);
            req.end();
        });
    }

    makeRequest(url, method, body) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            const urlObj = new URL(url);

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname,
                method: method,
                headers: {
                    Authorization: this.password,
                    'Content-Type': 'application/json'
                }
            };

            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    } else {
                        resolve(data ? JSON.parse(data) : {});
                    }
                });
            });

            req.on('error', reject);
            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }
}

module.exports = Lavalink;