export class User {
    constructor(client, data) {
        this.client = client;
        this.id = data.id;
        this.username = data.username;
        this.discriminator = data.discriminator;
        this.globalName = data.global_name || null;
        this.avatar = data.avatar;
        this.bot = data.bot || false;
        this.system = data.system || false;
        this.mfaEnabled = data.mfa_enabled || false;
        this.banner = data.banner || null;
        this.accentColor = data.accent_color || null;
        this.locale = data.locale || null;
        this.verified = data.verified || false;
        this.email = data.email || null;
        this.flags = data.flags || 0;
        this.premiumType = data.premium_type || 0;
        this.publicFlags = data.public_flags || 0;
    }

    get tag() {
        if (this.discriminator === '0') {
            return this.username;
        }
        return `${this.username}#${this.discriminator}`;
    }

    get displayName() {
        return this.globalName || this.username;
    }

    get avatarURL() {
        if (!this.avatar) {
            const defaultIndex = this.discriminator === '0'
                ? (BigInt(this.id) >> 22n) % 6n
                : parseInt(this.discriminator) % 5;
            return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
        }
        const ext = this.avatar.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}.${ext}`;
    }

    get bannerURL() {
        if (!this.banner) return null;
        const ext = this.banner.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/banners/${this.id}/${this.banner}.${ext}`;
    }

    get mention() {
        return `<@${this.id}>`;
    }

    toString() {
        return this.mention;
    }

    async fetch() {
        const data = await this.client.rest.getUser(this.id);
        Object.assign(this, new User(this.client, data));
        return this;
    }

    async send(content, options = {}) {
        const dmChannel = await this.client.rest.post('/users/@me/channels', {
            recipient_id: this.id
        });
        return this.client.rest.sendMessage(dmChannel.id, typeof content === 'string' ? { content } : content);
    }
}
