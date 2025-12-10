import { Constants } from '../core/Constants.js';

export class Message {
    constructor(client, data) {
        this.client = client;
        this.id = data.id;
        this.channelId = data.channel_id;
        this.guildId = data.guild_id || null;
        this.content = data.content;
        this.timestamp = new Date(data.timestamp);
        this.editedTimestamp = data.edited_timestamp ? new Date(data.edited_timestamp) : null;
        this.tts = data.tts;
        this.mentionEveryone = data.mention_everyone;
        this.mentions = data.mentions || [];
        this.mentionRoles = data.mention_roles || [];
        this.attachments = data.attachments || [];
        this.embeds = data.embeds || [];
        this.reactions = data.reactions || [];
        this.pinned = data.pinned;
        this.type = data.type;
        this.components = data.components || [];
        this.author = data.author;
        this.member = data.member || null;
        this.referencedMessage = data.referenced_message || null;
    }

    get channel() {
        return this.client.channels.get(this.channelId) || null;
    }

    get guild() {
        return this.guildId ? this.client.guilds.get(this.guildId) : null;
    }

    get nya() {
        return new NyaMessageHelper(this);
    }
}

class NyaMessageHelper {
    constructor(message) {
        this.message = message;
        this.client = message.client;
    }

    async reply(content, options = {}) {
        const payload = this.#buildPayload(content, options);
        payload.message_reference = {
            message_id: this.message.id,
            channel_id: this.message.channelId,
            guild_id: this.message.guildId,
            fail_if_not_exists: false
        };

        const data = await this.client.rest.sendMessage(this.message.channelId, payload);
        return new Message(this.client, data);
    }

    async send(content, options = {}) {
        const payload = this.#buildPayload(content, options);
        const data = await this.client.rest.sendMessage(this.message.channelId, payload);
        return new Message(this.client, data);
    }

    async edit(content, options = {}) {
        const payload = this.#buildPayload(content, options);
        const data = await this.client.rest.editMessage(this.message.channelId, this.message.id, payload);
        return new Message(this.client, data);
    }

    async delete() {
        await this.client.rest.deleteMessage(this.message.channelId, this.message.id);
        return true;
    }

    async react(emoji) {
        await this.client.rest.createReaction(this.message.channelId, this.message.id, emoji);
        return true;
    }

    buttons(buttons) {
        const components = [];
        const rows = [];

        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(buttons.slice(i, i + 5));
        }

        for (const row of rows) {
            components.push({
                type: Constants.ComponentTypes.ActionRow,
                components: row.map(btn => ({
                    type: Constants.ComponentTypes.Button,
                    style: btn.style || Constants.ButtonStyles.Primary,
                    label: btn.label,
                    custom_id: btn.id || btn.customId,
                    emoji: btn.emoji ? (typeof btn.emoji === 'string' ? { name: btn.emoji } : btn.emoji) : undefined,
                    url: btn.url,
                    disabled: btn.disabled || false
                }))
            });
        }

        return components;
    }

    embed(data) {
        return {
            title: data.title,
            description: data.description,
            url: data.url,
            timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : undefined,
            color: data.color || Constants.Colors.NyaPink,
            footer: data.footer ? {
                text: data.footer.text || data.footer,
                icon_url: data.footer.iconUrl || data.footer.icon_url
            } : undefined,
            image: data.image ? { url: typeof data.image === 'string' ? data.image : data.image.url } : undefined,
            thumbnail: data.thumbnail ? { url: typeof data.thumbnail === 'string' ? data.thumbnail : data.thumbnail.url } : undefined,
            author: data.author ? {
                name: data.author.name || data.author,
                url: data.author.url,
                icon_url: data.author.iconUrl || data.author.icon_url
            } : undefined,
            fields: data.fields || []
        };
    }

    #buildPayload(content, options) {
        const payload = {};

        if (typeof content === 'string') {
            payload.content = content;
        } else if (typeof content === 'object') {
            if (content.embed || content.embeds) {
                payload.embeds = content.embeds || [this.embed(content.embed)];
            }
            if (content.content) {
                payload.content = content.content;
            }
            if (content.components) {
                payload.components = content.components;
            }
            if (content.buttons) {
                payload.components = this.buttons(content.buttons);
            }
        }

        if (options.embed) {
            payload.embeds = [this.embed(options.embed)];
        }
        if (options.embeds) {
            payload.embeds = options.embeds.map(e => this.embed(e));
        }
        if (options.buttons) {
            payload.components = this.buttons(options.buttons);
        }
        if (options.components) {
            payload.components = options.components;
        }
        if (options.ephemeral) {
            payload.flags = 64;
        }

        return payload;
    }

    log(message) {
        const { Logger } = require('../utils/Logger.js');
        Logger.log(message);
    }

    error(message) {
        const { Logger } = require('../utils/Logger.js');
        Logger.error(message);
    }

    success(message) {
        const { Logger } = require('../utils/Logger.js');
        Logger.success(message);
    }
}
