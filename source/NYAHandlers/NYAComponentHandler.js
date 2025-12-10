import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import { Constants } from '../core/Constants.js';

export class NYAComponentHandler extends EventEmitter {
    constructor(client) {
        super();
        this.client = client;
        this.buttons = new Map();
        this.selectMenus = new Map();
        this.modals = new Map();
        this.wildcards = [];
        this.#setupListener();
    }

    #setupListener() {
        this.client.on('interactionCreate', async (interaction) => {
            try {
                if (interaction.type === Constants.InteractionTypes.MessageComponent) {
                    await this.#handleComponent(interaction);
                } else if (interaction.type === Constants.InteractionTypes.ModalSubmit) {
                    await this.#handleModal(interaction);
                }
            } catch (error) {
                Logger.error(`Component handler error: ${error.message}`);
                this.emit('componentError', { interaction, error });
            }
        });
    }

    async #handleComponent(interaction) {
        const customId = interaction.customId;
        const componentType = interaction.data.component_type;

        if (componentType === Constants.ComponentTypes.Button) {
            const handler = this.buttons.get(customId) || this.#findWildcard(customId, 'button');
            if (handler) {
                await handler.execute(interaction, this.#parseCustomId(customId));
                this.emit('buttonClick', { interaction, handler });
            }
        } else if ([3, 5, 6, 7, 8].includes(componentType)) {
            const handler = this.selectMenus.get(customId) || this.#findWildcard(customId, 'select');
            if (handler) {
                await handler.execute(interaction, interaction.values, this.#parseCustomId(customId));
                this.emit('selectMenu', { interaction, handler });
            }
        }
    }

    async #handleModal(interaction) {
        const customId = interaction.customId;
        const handler = this.modals.get(customId) || this.#findWildcard(customId, 'modal');

        if (handler) {
            const fields = {};
            if (interaction.data.components) {
                for (const row of interaction.data.components) {
                    for (const component of row.components) {
                        fields[component.custom_id] = component.value;
                    }
                }
            }
            await handler.execute(interaction, fields, this.#parseCustomId(customId));
            this.emit('modalSubmit', { interaction, handler, fields });
        }
    }

    #parseCustomId(customId) {
        const parts = customId.split(':');
        return {
            base: parts[0],
            params: parts.slice(1),
            raw: customId
        };
    }

    #findWildcard(customId, type) {
        for (const wildcard of this.wildcards) {
            if (wildcard.type === type && customId.startsWith(wildcard.prefix)) {
                return wildcard;
            }
        }
        return null;
    }

    registerButton(customId, handler) {
        if (customId.endsWith('*')) {
            this.wildcards.push({
                type: 'button',
                prefix: customId.slice(0, -1),
                execute: handler
            });
        } else {
            this.buttons.set(customId, { execute: handler });
        }
        return this;
    }

    registerSelect(customId, handler) {
        if (customId.endsWith('*')) {
            this.wildcards.push({
                type: 'select',
                prefix: customId.slice(0, -1),
                execute: handler
            });
        } else {
            this.selectMenus.set(customId, { execute: handler });
        }
        return this;
    }

    registerModal(customId, handler) {
        if (customId.endsWith('*')) {
            this.wildcards.push({
                type: 'modal',
                prefix: customId.slice(0, -1),
                execute: handler
            });
        } else {
            this.modals.set(customId, { execute: handler });
        }
        return this;
    }

    unregisterButton(customId) {
        this.buttons.delete(customId);
        return this;
    }

    unregisterSelect(customId) {
        this.selectMenus.delete(customId);
        return this;
    }

    unregisterModal(customId) {
        this.modals.delete(customId);
        return this;
    }

    clearAll() {
        this.buttons.clear();
        this.selectMenus.clear();
        this.modals.clear();
        this.wildcards = [];
        return this;
    }
}
