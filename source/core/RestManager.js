import { Constants } from './Constants.js';
import { Logger } from '../utils/Logger.js';

export class RestManager {
    #token;
    #baseUrl;
    #userAgent;
    #ratelimits;
    #globalRatelimit;

    constructor(token) {
        this.#token = token;
        this.#baseUrl = Constants.BaseURL;
        this.#userAgent = Constants.UserAgent;
        this.#ratelimits = new Map();
        this.#globalRatelimit = null;
    }

    async #handleRatelimit(route, response) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        const resetAfter = response.headers.get('x-ratelimit-reset-after');
        const isGlobal = response.headers.get('x-ratelimit-global');

        if (remaining === '0') {
            const delay = parseFloat(resetAfter) * 1000;
            if (isGlobal) {
                this.#globalRatelimit = Date.now() + delay;
            } else {
                this.#ratelimits.set(route, Date.now() + delay);
            }
        }
    }

    async #waitForRatelimit(route) {
        if (this.#globalRatelimit && Date.now() < this.#globalRatelimit) {
            const wait = this.#globalRatelimit - Date.now();
            Logger.warn(`Global ratelimit hit, waiting ${wait}ms`);
            await new Promise(resolve => setTimeout(resolve, wait));
        }

        const routeLimit = this.#ratelimits.get(route);
        if (routeLimit && Date.now() < routeLimit) {
            const wait = routeLimit - Date.now();
            Logger.warn(`Route ratelimit hit for ${route}, waiting ${wait}ms`);
            await new Promise(resolve => setTimeout(resolve, wait));
        }
    }

    async request(method, endpoint, body = null) {
        const route = `${method}:${endpoint.split('/').slice(0, 3).join('/')}`;
        await this.#waitForRatelimit(route);

        const url = `${this.#baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Authorization': `Bot ${this.#token}`,
                'User-Agent': this.#userAgent,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            await this.#handleRatelimit(route, response);

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                Logger.error(`REST Error: ${response.status} - ${error.message || 'Unknown error'}`);
                throw new Error(`HTTP ${response.status}: ${error.message || 'Unknown error'}`);
            }

            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            Logger.error(`Request failed: ${error.message}`);
            throw error;
        }
    }

    async get(endpoint) {
        return this.request('GET', endpoint);
    }

    async post(endpoint, body) {
        return this.request('POST', endpoint, body);
    }

    async patch(endpoint, body) {
        return this.request('PATCH', endpoint, body);
    }

    async put(endpoint, body) {
        return this.request('PUT', endpoint, body);
    }

    async delete(endpoint) {
        return this.request('DELETE', endpoint);
    }

    async sendMessage(channelId, content) {
        const body = typeof content === 'string' ? { content } : content;
        return this.post(`/channels/${channelId}/messages`, body);
    }

    async editMessage(channelId, messageId, content) {
        const body = typeof content === 'string' ? { content } : content;
        return this.patch(`/channels/${channelId}/messages/${messageId}`, body);
    }

    async deleteMessage(channelId, messageId) {
        return this.delete(`/channels/${channelId}/messages/${messageId}`);
    }

    async createReaction(channelId, messageId, emoji) {
        return this.put(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, null);
    }

    async getGuild(guildId) {
        return this.get(`/guilds/${guildId}`);
    }

    async getChannel(channelId) {
        return this.get(`/channels/${channelId}`);
    }

    async getUser(userId) {
        return this.get(`/users/${userId}`);
    }

    async getCurrentUser() {
        return this.get('/users/@me');
    }

    async createInteractionResponse(interactionId, interactionToken, data) {
        return this.post(`/interactions/${interactionId}/${interactionToken}/callback`, data);
    }

    async editOriginalInteractionResponse(applicationId, interactionToken, data) {
        return this.patch(`/webhooks/${applicationId}/${interactionToken}/messages/@original`, data);
    }

    async registerCommand(applicationId, command, guildId = null) {
        const endpoint = guildId
            ? `/applications/${applicationId}/guilds/${guildId}/commands`
            : `/applications/${applicationId}/commands`;
        return this.post(endpoint, command);
    }

    async getCommands(applicationId, guildId = null) {
        const endpoint = guildId
            ? `/applications/${applicationId}/guilds/${guildId}/commands`
            : `/applications/${applicationId}/commands`;
        return this.get(endpoint);
    }

    async bulkOverwriteCommands(applicationId, commands, guildId = null) {
        const endpoint = guildId
            ? `/applications/${applicationId}/guilds/${guildId}/commands`
            : `/applications/${applicationId}/commands`;
        return this.put(endpoint, commands);
    }
}
