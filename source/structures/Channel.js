export class Channel {
    constructor(client, data) {
        this.client = client;
        this.id = data.id;
        this.type = data.type;
        this.guildId = data.guild_id || null;
        this.position = data.position || null;
        this.permissionOverwrites = data.permission_overwrites || [];
        this.name = data.name || null;
        this.topic = data.topic || null;
        this.nsfw = data.nsfw || false;
        this.lastMessageId = data.last_message_id || null;
        this.bitrate = data.bitrate || null;
        this.userLimit = data.user_limit || null;
        this.rateLimitPerUser = data.rate_limit_per_user || 0;
        this.recipients = data.recipients || [];
        this.icon = data.icon || null;
        this.ownerId = data.owner_id || null;
        this.applicationId = data.application_id || null;
        this.parentId = data.parent_id || null;
        this.lastPinTimestamp = data.last_pin_timestamp ? new Date(data.last_pin_timestamp) : null;
        this.rtcRegion = data.rtc_region || null;
        this.videoQualityMode = data.video_quality_mode || null;
        this.messageCount = data.message_count || null;
        this.memberCount = data.member_count || null;
        this.threadMetadata = data.thread_metadata || null;
        this.member = data.member || null;
        this.defaultAutoArchiveDuration = data.default_auto_archive_duration || null;
        this.permissions = data.permissions || null;
        this.flags = data.flags || 0;
        this.totalMessageSent = data.total_message_sent || null;
    }

    get guild() {
        return this.guildId ? this.client.guilds.get(this.guildId) : null;
    }

    get parent() {
        return this.parentId ? this.client.channels.get(this.parentId) : null;
    }

    get mention() {
        return `<#${this.id}>`;
    }

    toString() {
        return this.mention;
    }

    isText() {
        return [0, 5, 10, 11, 12].includes(this.type);
    }

    isVoice() {
        return [2, 13].includes(this.type);
    }

    isThread() {
        return [10, 11, 12].includes(this.type);
    }

    isDM() {
        return [1, 3].includes(this.type);
    }

    async send(content, options = {}) {
        const payload = typeof content === 'string' ? { content } : content;
        return this.client.rest.sendMessage(this.id, payload);
    }

    async fetch() {
        const data = await this.client.rest.getChannel(this.id);
        Object.assign(this, new Channel(this.client, data));
        return this;
    }

    async bulkDelete(amount) {
        if (amount < 2 || amount > 100) {
            throw new Error('Amount must be between 2 and 100');
        }

        const messages = await this.client.rest.get(`/channels/${this.id}/messages?limit=${amount}`);
        const ids = messages.map(m => m.id);

        await this.client.rest.post(`/channels/${this.id}/messages/bulk-delete`, {
            messages: ids
        });

        return ids.length;
    }
}
