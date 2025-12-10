import { Constants } from '../core/Constants.js';
import { Message } from './Message.js';

export class Interaction {
    constructor(client, data) {
        this.client = client;
        this.id = data.id;
        this.applicationId = data.application_id;
        this.type = data.type;
        this.data = data.data || null;
        this.guildId = data.guild_id || null;
        this.channelId = data.channel_id || null;
        this.member = data.member || null;
        this.user = data.user || (data.member ? data.member.user : null);
        this.token = data.token;
        this.version = data.version;
        this.message = data.message ? new Message(client, data.message) : null;
        this.locale = data.locale || null;
        this.guildLocale = data.guild_locale || null;

        this.deferred = false;
        this.replied = false;
    }

    get commandName() {
        return this.data ? this.data.name : null;
    }

    get customId() {
        return this.data ? this.data.custom_id : null;
    }

    get values() {
        return this.data ? this.data.values : [];
    }

    getOption(name) {
        if (!this.data || !this.data.options) return null;
        const option = this.data.options.find(o => o.name === name);
        return option ? option.value : null;
    }

    getSubcommand() {
        if (!this.data || !this.data.options) return null;
        const sub = this.data.options.find(o => o.type === 1);
        return sub ? sub.name : null;
    }

    getSubcommandGroup() {
        if (!this.data || !this.data.options) return null;
        const group = this.data.options.find(o => o.type === 2);
        return group ? group.name : null;
    }

    get guild() {
        return this.guildId ? this.client.guilds.get(this.guildId) : null;
    }

    get channel() {
        return this.channelId ? this.client.channels.get(this.channelId) : null;
    }

    get nya() {
        return new NyaInteractionHelper(this);
    }
}

class NyaInteractionHelper {
    constructor(interaction) {
        this.interaction = interaction;
        this.client = interaction.client;
    }

    async reply(content, options = {}) {
        if (this.interaction.replied || this.interaction.deferred) {
            return this.editReply(content, options);
        }

        const payload = this.#buildPayload(content, options);
        await this.client.rest.createInteractionResponse(this.interaction.id, this.interaction.token, {
            type: Constants.InteractionResponseTypes.ChannelMessageWithSource,
            data: payload
        });
        this.interaction.replied = true;
        return this;
    }

    async defer(ephemeral = false) {
        await this.client.rest.createInteractionResponse(this.interaction.id, this.interaction.token, {
            type: Constants.InteractionResponseTypes.DeferredChannelMessageWithSource,
            data: ephemeral ? { flags: 64 } : {}
        });
        this.interaction.deferred = true;
        return this;
    }

    async editReply(content, options = {}) {
        const payload = this.#buildPayload(content, options);
        await this.client.rest.editOriginalInteractionResponse(
            this.interaction.applicationId,
            this.interaction.token,
            payload
        );
        return this;
    }

    async update(content, options = {}) {
        const payload = this.#buildPayload(content, options);
        await this.client.rest.createInteractionResponse(this.interaction.id, this.interaction.token, {
            type: Constants.InteractionResponseTypes.UpdateMessage,
            data: payload
        });
        return this;
    }

    async deferUpdate() {
        await this.client.rest.createInteractionResponse(this.interaction.id, this.interaction.token, {
            type: Constants.InteractionResponseTypes.DeferredUpdateMessage
        });
        return this;
    }

    async modal(data) {
        await this.client.rest.createInteractionResponse(this.interaction.id, this.interaction.token, {
            type: Constants.InteractionResponseTypes.Modal,
            data: {
                custom_id: data.id || data.customId,
                title: data.title,
                components: data.components || data.fields.map(field => ({
                    type: Constants.ComponentTypes.ActionRow,
                    components: [{
                        type: Constants.ComponentTypes.TextInput,
                        custom_id: field.id || field.customId,
                        style: field.style || 1,
                        label: field.label,
                        min_length: field.minLength,
                        max_length: field.maxLength,
                        required: field.required !== false,
                        value: field.value,
                        placeholder: field.placeholder
                    }]
                }))
            }
        });
        return this;
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

    select(data) {
        return {
            type: Constants.ComponentTypes.ActionRow,
            components: [{
                type: data.type || Constants.ComponentTypes.StringSelect,
                custom_id: data.id || data.customId,
                placeholder: data.placeholder,
                min_values: data.minValues || 1,
                max_values: data.maxValues || 1,
                options: data.options ? data.options.map(opt => ({
                    label: opt.label,
                    value: opt.value,
                    description: opt.description,
                    emoji: opt.emoji ? (typeof opt.emoji === 'string' ? { name: opt.emoji } : opt.emoji) : undefined,
                    default: opt.default || false
                })) : undefined
            }]
        };
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
}
