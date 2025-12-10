export class Permissions {
    static Flags = {
        CreateInstantInvite: 1n << 0n,
        KickMembers: 1n << 1n,
        BanMembers: 1n << 2n,
        Administrator: 1n << 3n,
        ManageChannels: 1n << 4n,
        ManageGuild: 1n << 5n,
        AddReactions: 1n << 6n,
        ViewAuditLog: 1n << 7n,
        PrioritySpeaker: 1n << 8n,
        Stream: 1n << 9n,
        ViewChannel: 1n << 10n,
        SendMessages: 1n << 11n,
        SendTTSMessages: 1n << 12n,
        ManageMessages: 1n << 13n,
        EmbedLinks: 1n << 14n,
        AttachFiles: 1n << 15n,
        ReadMessageHistory: 1n << 16n,
        MentionEveryone: 1n << 17n,
        UseExternalEmojis: 1n << 18n,
        ViewGuildInsights: 1n << 19n,
        Connect: 1n << 20n,
        Speak: 1n << 21n,
        MuteMembers: 1n << 22n,
        DeafenMembers: 1n << 23n,
        MoveMembers: 1n << 24n,
        UseVAD: 1n << 25n,
        ChangeNickname: 1n << 26n,
        ManageNicknames: 1n << 27n,
        ManageRoles: 1n << 28n,
        ManageWebhooks: 1n << 29n,
        ManageEmojisAndStickers: 1n << 30n,
        UseApplicationCommands: 1n << 31n,
        RequestToSpeak: 1n << 32n,
        ManageEvents: 1n << 33n,
        ManageThreads: 1n << 34n,
        CreatePublicThreads: 1n << 35n,
        CreatePrivateThreads: 1n << 36n,
        UseExternalStickers: 1n << 37n,
        SendMessagesInThreads: 1n << 38n,
        UseEmbeddedActivities: 1n << 39n,
        ModerateMembers: 1n << 40n,
        ViewCreatorMonetizationAnalytics: 1n << 41n,
        UseSoundboard: 1n << 42n,
        UseExternalSounds: 1n << 45n,
        SendVoiceMessages: 1n << 46n
    };

    static All = Object.values(Permissions.Flags).reduce((acc, val) => acc | val, 0n);

    constructor(bits = 0n) {
        this.bitfield = BigInt(bits);
    }

    has(permission) {
        const bit = typeof permission === 'bigint' ? permission : Permissions.Flags[permission];
        if (!bit) return false;
        if ((this.bitfield & Permissions.Flags.Administrator) === Permissions.Flags.Administrator) {
            return true;
        }
        return (this.bitfield & bit) === bit;
    }

    add(...permissions) {
        let total = 0n;
        for (const perm of permissions) {
            const bit = typeof perm === 'bigint' ? perm : Permissions.Flags[perm];
            if (bit) total |= bit;
        }
        this.bitfield |= total;
        return this;
    }

    remove(...permissions) {
        let total = 0n;
        for (const perm of permissions) {
            const bit = typeof perm === 'bigint' ? perm : Permissions.Flags[perm];
            if (bit) total |= bit;
        }
        this.bitfield &= ~total;
        return this;
    }

    toArray() {
        return Object.entries(Permissions.Flags)
            .filter(([, bit]) => this.has(bit))
            .map(([name]) => name);
    }

    serialize() {
        const serialized = {};
        for (const [name, bit] of Object.entries(Permissions.Flags)) {
            serialized[name] = this.has(bit);
        }
        return serialized;
    }

    toString() {
        return this.bitfield.toString();
    }

    toJSON() {
        return this.bitfield.toString();
    }
}
