export class Guild {
    constructor(client, data) {
        this.client = client;
        this.id = data.id;
        this.name = data.name;
        this.icon = data.icon;
        this.splash = data.splash;
        this.discoverySplash = data.discovery_splash;
        this.ownerId = data.owner_id;
        this.afkChannelId = data.afk_channel_id;
        this.afkTimeout = data.afk_timeout;
        this.widgetEnabled = data.widget_enabled;
        this.widgetChannelId = data.widget_channel_id;
        this.verificationLevel = data.verification_level;
        this.defaultMessageNotifications = data.default_message_notifications;
        this.explicitContentFilter = data.explicit_content_filter;
        this.roles = new Map();
        this.emojis = new Map();
        this.features = data.features || [];
        this.mfaLevel = data.mfa_level;
        this.applicationId = data.application_id;
        this.systemChannelId = data.system_channel_id;
        this.systemChannelFlags = data.system_channel_flags;
        this.rulesChannelId = data.rules_channel_id;
        this.maxPresences = data.max_presences;
        this.maxMembers = data.max_members;
        this.vanityUrlCode = data.vanity_url_code;
        this.description = data.description;
        this.banner = data.banner;
        this.premiumTier = data.premium_tier;
        this.premiumSubscriptionCount = data.premium_subscription_count;
        this.preferredLocale = data.preferred_locale;
        this.publicUpdatesChannelId = data.public_updates_channel_id;
        this.maxVideoChannelUsers = data.max_video_channel_users;
        this.approximateMemberCount = data.approximate_member_count;
        this.approximatePresenceCount = data.approximate_presence_count;
        this.nsfwLevel = data.nsfw_level;
        this.premiumProgressBarEnabled = data.premium_progress_bar_enabled;
        this.memberCount = data.member_count;
        this.unavailable = data.unavailable || false;

        if (data.roles) {
            for (const role of data.roles) {
                this.roles.set(role.id, role);
            }
        }

        if (data.emojis) {
            for (const emoji of data.emojis) {
                this.emojis.set(emoji.id, emoji);
            }
        }
    }

    get iconURL() {
        if (!this.icon) return null;
        const ext = this.icon.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/icons/${this.id}/${this.icon}.${ext}`;
    }

    get bannerURL() {
        if (!this.banner) return null;
        const ext = this.banner.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/banners/${this.id}/${this.banner}.${ext}`;
    }

    get splashURL() {
        if (!this.splash) return null;
        return `https://cdn.discordapp.com/splashes/${this.id}/${this.splash}.png`;
    }

    async fetch() {
        const data = await this.client.rest.getGuild(this.id);
        Object.assign(this, new Guild(this.client, data));
        return this;
    }
}
