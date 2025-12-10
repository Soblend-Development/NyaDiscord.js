import { EventEmitter } from 'events';
import http from 'http';
import { Logger } from '../utils/Logger.js';

export class NYAPanel extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.port = options.port || 3000;
        this.host = options.host || 'localhost';
        this.auth = options.auth || null;
        this.server = null;
        this.routes = new Map();

        this.#registerDefaultRoutes();
    }

    #registerDefaultRoutes() {
        this.route('GET', '/', (req, res) => {
            return {
                name: 'NyaDiscord.js Panel',
                version: '1.0.0',
                status: 'online',
                uptime: this.client.uptime
            };
        });

        this.route('GET', '/stats', (req, res) => {
            return {
                guilds: this.client.guilds?.size || 0,
                users: this.client.users?.size || 0,
                channels: this.client.channels?.size || 0,
                uptime: this.client.uptime,
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            };
        });

        this.route('GET', '/guilds', (req, res) => {
            return Array.from(this.client.guilds?.values() || []).map(g => ({
                id: g.id,
                name: g.name,
                memberCount: g.memberCount
            }));
        });

        this.route('GET', '/health', (req, res) => {
            return {
                status: 'healthy',
                timestamp: Date.now(),
                gateway: this.client.gateway ? 'connected' : 'disconnected'
            };
        });

        this.route('GET', '/commands', (req, res) => {
            if (this.client.commandHandler) {
                return this.client.commandHandler.toJSON();
            }
            return Array.from(this.client.commands?.keys() || []);
        });

        this.route('GET', '/plugins', (req, res) => {
            if (this.client.plugins) {
                return this.client.plugins.list();
            }
            return [];
        });

        this.route('POST', '/eval', async (req, res, body) => {
            if (!this.auth || req.headers.authorization !== this.auth) {
                res.statusCode = 401;
                return { error: 'Unauthorized' };
            }

            try {
                const result = await eval(body.code);
                return { result: String(result) };
            } catch (error) {
                return { error: error.message };
            }
        });

        this.route('POST', '/reload', async (req, res, body) => {
            if (!this.auth || req.headers.authorization !== this.auth) {
                res.statusCode = 401;
                return { error: 'Unauthorized' };
            }

            if (body.type === 'commands' && this.client.commandHandler) {
                await this.client.commandHandler.reloadAll();
                return { success: true, message: 'Commands reloaded' };
            }

            if (body.type === 'events' && this.client.eventHandler) {
                return { success: true, message: 'Events reloaded' };
            }

            return { error: 'Unknown reload type' };
        });
    }

    route(method, path, handler) {
        const key = `${method}:${path}`;
        this.routes.set(key, handler);
        return this;
    }

    start() {
        this.server = http.createServer(async (req, res) => {
            const url = new URL(req.url, `http://${this.host}:${this.port}`);
            const key = `${req.method}:${url.pathname}`;
            const handler = this.routes.get(key);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            if (req.method === 'OPTIONS') {
                res.statusCode = 204;
                res.end();
                return;
            }

            if (!handler) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Not found' }));
                return;
            }

            try {
                let body = null;
                if (req.method === 'POST') {
                    body = await this.#parseBody(req);
                }

                const result = await handler(req, res, body, url.searchParams);
                res.end(JSON.stringify(result));
            } catch (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message }));
            }
        });

        this.server.listen(this.port, this.host, () => {
            Logger.success(`Panel started at http://${this.host}:${this.port}`);
            this.emit('start', { port: this.port, host: this.host });
        });

        return this;
    }

    #parseBody(req) {
        return new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(data);
                }
            });
            req.on('error', reject);
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            Logger.log('Panel stopped');
            this.emit('stop');
        }
        return this;
    }

    getRoutes() {
        return Array.from(this.routes.keys());
    }
}
