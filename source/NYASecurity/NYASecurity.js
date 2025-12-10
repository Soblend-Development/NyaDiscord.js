import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

export class NYASecurity extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.enabled = true;
        this.antiCrash = options.antiCrash !== false;
        this.loopDetection = options.loopDetection !== false;
        this.rateLimit = options.rateLimit !== false;
        this.intentSanitization = options.intentSanitization !== false;

        this.eventCounts = new Map();
        this.rateLimits = new Map();
        this.blockedUsers = new Set();
        this.blockedGuilds = new Set();

        this.thresholds = {
            eventLoopLimit: options.eventLoopLimit || 100,
            rateLimitWindow: options.rateLimitWindow || 10000,
            rateLimitMax: options.rateLimitMax || 50,
            raidThreshold: options.raidThreshold || 10,
            raidWindow: options.raidWindow || 5000,
            spamThreshold: options.spamThreshold || 5,
            spamWindow: options.spamWindow || 3000
        };

        this.joinCache = new Map();
        this.messageCache = new Map();

        if (this.antiCrash) this.#setupAntiCrash();
        if (this.loopDetection) this.#setupLoopDetection();
        if (this.rateLimit) this.#setupRateLimit();
    }

    #setupAntiCrash() {
        process.on('uncaughtException', (error) => {
            Logger.error(`[ANTI-CRASH] Uncaught Exception: ${error.message}`);
            Logger.error(error.stack);
            this.emit('crash', { type: 'uncaughtException', error });
        });

        process.on('unhandledRejection', (reason, promise) => {
            Logger.error(`[ANTI-CRASH] Unhandled Rejection: ${reason}`);
            this.emit('crash', { type: 'unhandledRejection', reason, promise });
        });

        process.on('warning', (warning) => {
            Logger.warn(`[ANTI-CRASH] Warning: ${warning.message}`);
            this.emit('warning', warning);
        });

        Logger.success('Anti-crash protection enabled');
    }

    #setupLoopDetection() {
        const originalEmit = this.client.emit.bind(this.client);

        this.client.emit = (event, ...args) => {
            const now = Date.now();
            const key = `${event}:${now - (now % 1000)}`;

            const count = (this.eventCounts.get(key) || 0) + 1;
            this.eventCounts.set(key, count);

            if (count > this.thresholds.eventLoopLimit) {
                Logger.error(`[LOOP-DETECT] Event loop detected: ${event} (${count} calls/sec)`);
                this.emit('loopDetected', { event, count });
                return false;
            }

            return originalEmit(event, ...args);
        };

        setInterval(() => {
            const now = Date.now();
            for (const [key] of this.eventCounts) {
                const timestamp = parseInt(key.split(':')[1]);
                if (now - timestamp > 5000) {
                    this.eventCounts.delete(key);
                }
            }
        }, 5000);

        Logger.success('Loop detection enabled');
    }

    #setupRateLimit() {
        this.client.on('messageCreate', (message) => {
            if (!this.enabled || message.author?.bot) return;

            const userId = message.author?.id;
            if (!userId) return;

            if (this.blockedUsers.has(userId)) {
                this.emit('blockedUserMessage', { message, userId });
                return;
            }

            const key = `msg:${userId}`;
            const now = Date.now();
            const userData = this.rateLimits.get(key) || { count: 0, firstMessage: now };

            if (now - userData.firstMessage > this.thresholds.rateLimitWindow) {
                userData.count = 1;
                userData.firstMessage = now;
            } else {
                userData.count++;
            }

            this.rateLimits.set(key, userData);

            if (userData.count > this.thresholds.rateLimitMax) {
                Logger.warn(`[RATE-LIMIT] User ${userId} exceeded rate limit (${userData.count} messages)`);
                this.emit('userRateLimited', { userId, count: userData.count, message });
            }
        });

        Logger.success('Rate limiting enabled');
    }

    detectRaid(guildId, userId) {
        const now = Date.now();
        const key = `raid:${guildId}`;

        let joins = this.joinCache.get(key) || [];
        joins = joins.filter(t => now - t < this.thresholds.raidWindow);
        joins.push(now);
        this.joinCache.set(key, joins);

        if (joins.length >= this.thresholds.raidThreshold) {
            Logger.error(`[RAID-DETECT] Possible raid detected in guild ${guildId}`);
            this.emit('raidDetected', { guildId, joinCount: joins.length, window: this.thresholds.raidWindow });
            return true;
        }

        return false;
    }

    detectSpam(userId, channelId) {
        const now = Date.now();
        const key = `spam:${userId}:${channelId}`;

        let messages = this.messageCache.get(key) || [];
        messages = messages.filter(t => now - t < this.thresholds.spamWindow);
        messages.push(now);
        this.messageCache.set(key, messages);

        if (messages.length >= this.thresholds.spamThreshold) {
            Logger.warn(`[SPAM-DETECT] Spam detected from user ${userId} in channel ${channelId}`);
            this.emit('spamDetected', { userId, channelId, messageCount: messages.length });
            return true;
        }

        return false;
    }

    blockUser(userId) {
        this.blockedUsers.add(userId);
        this.emit('userBlocked', userId);
        return this;
    }

    unblockUser(userId) {
        this.blockedUsers.delete(userId);
        this.emit('userUnblocked', userId);
        return this;
    }

    blockGuild(guildId) {
        this.blockedGuilds.add(guildId);
        this.emit('guildBlocked', guildId);
        return this;
    }

    unblockGuild(guildId) {
        this.blockedGuilds.delete(guildId);
        this.emit('guildUnblocked', guildId);
        return this;
    }

    isUserBlocked(userId) {
        return this.blockedUsers.has(userId);
    }

    isGuildBlocked(guildId) {
        return this.blockedGuilds.has(guildId);
    }

    sanitizeIntents(intents) {
        const dangerousIntents = [1 << 1, 1 << 8];
        let sanitized = intents;

        for (const dangerous of dangerousIntents) {
            if ((intents & dangerous) === dangerous) {
                Logger.warn(`[INTENT-SANITIZE] Privileged intent detected: ${dangerous}`);
            }
        }

        return sanitized;
    }

    getStats() {
        return {
            blockedUsers: this.blockedUsers.size,
            blockedGuilds: this.blockedGuilds.size,
            rateLimitEntries: this.rateLimits.size,
            eventCountEntries: this.eventCounts.size,
            joinCacheEntries: this.joinCache.size,
            messageCacheEntries: this.messageCache.size
        };
    }

    clearCaches() {
        this.eventCounts.clear();
        this.rateLimits.clear();
        this.joinCache.clear();
        this.messageCache.clear();
        return this;
    }
}
