import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

export class NYAEvents extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.afkUsers = new Map();
        this.joinTracker = new Map();
        this.messageTracker = new Map();
        this.slowmodeTracker = new Map();

        this.thresholds = {
            afkTimeout: options.afkTimeout || 300000,
            raidJoins: options.raidJoins || 10,
            raidWindow: options.raidWindow || 5000,
            spamMessages: options.spamMessages || 5,
            spamWindow: options.spamWindow || 3000
        };

        this.#setupListeners();
    }

    #setupListeners() {
        this.client.on('messageCreate', (message) => {
            this.#handleAFKTrigger(message);
            this.#handleSlowmodeCheck(message);
            this.#handleJoinSpamMessage(message);
        });

        this.client.on('GUILD_MEMBER_ADD', (member) => {
            this.#handleRaidDetection(member);
            this.#handleJoinSpamDetection(member);
        });

        this.client.commandHandler?.on('commandError', (data) => {
            this.emit('commandError', data);
        });

        Logger.success('Extended events system initialized');
    }

    #handleAFKTrigger(message) {
        if (!message.mentions?.length) return;

        for (const mention of message.mentions) {
            const afkData = this.afkUsers.get(mention.id);
            if (afkData) {
                this.emit('messageAFKTrigger', {
                    message,
                    afkUser: mention,
                    afkData,
                    triggeredBy: message.author
                });
            }
        }

        if (this.afkUsers.has(message.author?.id)) {
            const afkData = this.afkUsers.get(message.author.id);
            this.afkUsers.delete(message.author.id);
            this.emit('afkRemoved', {
                user: message.author,
                afkData,
                duration: Date.now() - afkData.since
            });
        }
    }

    #handleRaidDetection(member) {
        const guildId = member.guild_id;
        const now = Date.now();

        let joins = this.joinTracker.get(guildId) || [];
        joins = joins.filter(t => now - t.time < this.thresholds.raidWindow);
        joins.push({ time: now, userId: member.user?.id });
        this.joinTracker.set(guildId, joins);

        if (joins.length >= this.thresholds.raidJoins) {
            this.emit('guildRaidDetected', {
                guildId,
                joinCount: joins.length,
                window: this.thresholds.raidWindow,
                members: joins.map(j => j.userId)
            });
        }
    }

    #handleJoinSpamDetection(member) {
        const userId = member.user?.id;
        if (!userId) return;

        const now = Date.now();
        let userJoins = [];

        for (const [guildId, joins] of this.joinTracker) {
            const recentJoins = joins.filter(j => j.userId === userId && now - j.time < 60000);
            userJoins.push(...recentJoins);
        }

        if (userJoins.length >= 5) {
            this.emit('joinSpamDetected', {
                userId,
                joinCount: userJoins.length,
                guildId: member.guild_id
            });
        }
    }

    #handleSlowmodeCheck(message) {
        const channelId = message.channelId;
        const userId = message.author?.id;
        if (!userId) return;

        const channel = this.client.channels.get(channelId);
        if (!channel?.rateLimitPerUser) return;

        const slowmode = channel.rateLimitPerUser * 1000;
        const key = `${channelId}:${userId}`;
        const lastMessage = this.slowmodeTracker.get(key);
        const now = Date.now();

        if (lastMessage && now - lastMessage < slowmode) {
            this.emit('slowmodeExceeded', {
                message,
                channelId,
                userId,
                slowmode,
                timeSinceLastMessage: now - lastMessage
            });
        }

        this.slowmodeTracker.set(key, now);
    }

    #handleJoinSpamMessage(message) {
        const userId = message.author?.id;
        const channelId = message.channelId;
        if (!userId) return;

        const key = `${channelId}:${userId}`;
        const now = Date.now();

        let messages = this.messageTracker.get(key) || [];
        messages = messages.filter(t => now - t < this.thresholds.spamWindow);
        messages.push(now);
        this.messageTracker.set(key, messages);

        if (messages.length >= this.thresholds.spamMessages) {
            this.emit('messageSpamDetected', {
                message,
                userId,
                channelId,
                messageCount: messages.length,
                window: this.thresholds.spamWindow
            });
        }
    }

    setAFK(userId, reason = 'AFK') {
        this.afkUsers.set(userId, {
            reason,
            since: Date.now()
        });
        this.emit('afkSet', { userId, reason });
        return this;
    }

    removeAFK(userId) {
        const afkData = this.afkUsers.get(userId);
        if (afkData) {
            this.afkUsers.delete(userId);
            this.emit('afkRemoved', { userId, afkData });
        }
        return this;
    }

    isAFK(userId) {
        return this.afkUsers.has(userId);
    }

    getAFKData(userId) {
        return this.afkUsers.get(userId) || null;
    }

    clearTrackers() {
        this.joinTracker.clear();
        this.messageTracker.clear();
        this.slowmodeTracker.clear();
        return this;
    }

    getStats() {
        return {
            afkUsers: this.afkUsers.size,
            trackedGuilds: this.joinTracker.size,
            trackedChannels: this.messageTracker.size,
            slowmodeEntries: this.slowmodeTracker.size
        };
    }
}
