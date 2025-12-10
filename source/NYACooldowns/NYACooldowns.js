export class NYACooldowns {
    constructor(options = {}) {
        this.userCooldowns = new Map();
        this.guildCooldowns = new Map();
        this.channelCooldowns = new Map();
        this.ipCooldowns = new Map();
        this.globalCooldowns = new Map();
        this.defaultCooldown = options.defaultCooldown || 3000;
        this.sweepInterval = options.sweepInterval || 60000;
        this.#startSweeper();
    }

    #startSweeper() {
        setInterval(() => {
            const now = Date.now();
            this.#sweepMap(this.userCooldowns, now);
            this.#sweepMap(this.guildCooldowns, now);
            this.#sweepMap(this.channelCooldowns, now);
            this.#sweepMap(this.ipCooldowns, now);
            this.#sweepMap(this.globalCooldowns, now);
        }, this.sweepInterval);
    }

    #sweepMap(map, now) {
        for (const [key, expires] of map) {
            if (expires < now) {
                map.delete(key);
            }
        }
    }

    #getKey(type, id, commandName) {
        return `${type}:${id}:${commandName}`;
    }

    checkUser(userId, commandName, cooldownMs) {
        const key = this.#getKey('user', userId, commandName);
        const expires = this.userCooldowns.get(key);
        const now = Date.now();

        if (expires && expires > now) {
            return {
                onCooldown: true,
                remaining: expires - now,
                type: 'user'
            };
        }

        return { onCooldown: false, remaining: 0, type: 'user' };
    }

    setUser(userId, commandName, cooldownMs) {
        const key = this.#getKey('user', userId, commandName);
        this.userCooldowns.set(key, Date.now() + (cooldownMs || this.defaultCooldown));
        return this;
    }

    checkGuild(guildId, commandName, cooldownMs) {
        const key = this.#getKey('guild', guildId, commandName);
        const expires = this.guildCooldowns.get(key);
        const now = Date.now();

        if (expires && expires > now) {
            return {
                onCooldown: true,
                remaining: expires - now,
                type: 'guild'
            };
        }

        return { onCooldown: false, remaining: 0, type: 'guild' };
    }

    setGuild(guildId, commandName, cooldownMs) {
        const key = this.#getKey('guild', guildId, commandName);
        this.guildCooldowns.set(key, Date.now() + (cooldownMs || this.defaultCooldown));
        return this;
    }

    checkChannel(channelId, commandName, cooldownMs) {
        const key = this.#getKey('channel', channelId, commandName);
        const expires = this.channelCooldowns.get(key);
        const now = Date.now();

        if (expires && expires > now) {
            return {
                onCooldown: true,
                remaining: expires - now,
                type: 'channel'
            };
        }

        return { onCooldown: false, remaining: 0, type: 'channel' };
    }

    setChannel(channelId, commandName, cooldownMs) {
        const key = this.#getKey('channel', channelId, commandName);
        this.channelCooldowns.set(key, Date.now() + (cooldownMs || this.defaultCooldown));
        return this;
    }

    checkIP(ip, commandName, cooldownMs) {
        const key = this.#getKey('ip', ip, commandName);
        const expires = this.ipCooldowns.get(key);
        const now = Date.now();

        if (expires && expires > now) {
            return {
                onCooldown: true,
                remaining: expires - now,
                type: 'ip'
            };
        }

        return { onCooldown: false, remaining: 0, type: 'ip' };
    }

    setIP(ip, commandName, cooldownMs) {
        const key = this.#getKey('ip', ip, commandName);
        this.ipCooldowns.set(key, Date.now() + (cooldownMs || this.defaultCooldown));
        return this;
    }

    checkGlobal(commandName) {
        const expires = this.globalCooldowns.get(commandName);
        const now = Date.now();

        if (expires && expires > now) {
            return {
                onCooldown: true,
                remaining: expires - now,
                type: 'global'
            };
        }

        return { onCooldown: false, remaining: 0, type: 'global' };
    }

    setGlobal(commandName, cooldownMs) {
        this.globalCooldowns.set(commandName, Date.now() + (cooldownMs || this.defaultCooldown));
        return this;
    }

    check(options) {
        const { userId, guildId, channelId, ip, commandName, userCooldown, guildCooldown, channelCooldown, ipCooldown, globalCooldown } = options;

        if (globalCooldown) {
            const result = this.checkGlobal(commandName);
            if (result.onCooldown) return result;
        }

        if (guildCooldown && guildId) {
            const result = this.checkGuild(guildId, commandName, guildCooldown);
            if (result.onCooldown) return result;
        }

        if (channelCooldown && channelId) {
            const result = this.checkChannel(channelId, commandName, channelCooldown);
            if (result.onCooldown) return result;
        }

        if (userCooldown && userId) {
            const result = this.checkUser(userId, commandName, userCooldown);
            if (result.onCooldown) return result;
        }

        if (ipCooldown && ip) {
            const result = this.checkIP(ip, commandName, ipCooldown);
            if (result.onCooldown) return result;
        }

        return { onCooldown: false, remaining: 0, type: null };
    }

    set(options) {
        const { userId, guildId, channelId, ip, commandName, userCooldown, guildCooldown, channelCooldown, ipCooldown, globalCooldown } = options;

        if (globalCooldown) this.setGlobal(commandName, globalCooldown);
        if (guildCooldown && guildId) this.setGuild(guildId, commandName, guildCooldown);
        if (channelCooldown && channelId) this.setChannel(channelId, commandName, channelCooldown);
        if (userCooldown && userId) this.setUser(userId, commandName, userCooldown);
        if (ipCooldown && ip) this.setIP(ip, commandName, ipCooldown);

        return this;
    }

    clearUser(userId, commandName) {
        const key = this.#getKey('user', userId, commandName);
        this.userCooldowns.delete(key);
        return this;
    }

    clearGuild(guildId, commandName) {
        const key = this.#getKey('guild', guildId, commandName);
        this.guildCooldowns.delete(key);
        return this;
    }

    clearAll() {
        this.userCooldowns.clear();
        this.guildCooldowns.clear();
        this.channelCooldowns.clear();
        this.ipCooldowns.clear();
        this.globalCooldowns.clear();
        return this;
    }

    getStats() {
        return {
            users: this.userCooldowns.size,
            guilds: this.guildCooldowns.size,
            channels: this.channelCooldowns.size,
            ips: this.ipCooldowns.size,
            global: this.globalCooldowns.size
        };
    }
}
