import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

export class NYAFlows extends EventEmitter {
    constructor(client) {
        super();
        this.client = client;
        this.flows = new Map();
        this.actions = new Map();
        this.#registerDefaultActions();
    }

    #registerDefaultActions() {
        this.registerAction('sendMessage', async (ctx, options) => {
            const channel = this.client.channels.get(options.channelId || options.channel);
            if (channel) {
                await channel.send(options.content || options.message);
            }
        });

        this.registerAction('reply', async (ctx, options) => {
            if (ctx.message) {
                await ctx.message.nya.reply(options.content || options.message);
            }
        });

        this.registerAction('giveRole', async (ctx, options) => {
            if (ctx.member && ctx.guildId) {
                const roleId = options.roleId || options.role;
                await this.client.rest.put(
                    `/guilds/${ctx.guildId}/members/${ctx.member.user.id}/roles/${roleId}`,
                    null
                );
            }
        });

        this.registerAction('removeRole', async (ctx, options) => {
            if (ctx.member && ctx.guildId) {
                const roleId = options.roleId || options.role;
                await this.client.rest.delete(
                    `/guilds/${ctx.guildId}/members/${ctx.member.user.id}/roles/${roleId}`
                );
            }
        });

        this.registerAction('log', async (ctx, options) => {
            Logger.log(options.message || options);
        });

        this.registerAction('wait', async (ctx, options) => {
            await new Promise(resolve => setTimeout(resolve, options.duration || options.ms || 1000));
        });

        this.registerAction('setVariable', async (ctx, options) => {
            ctx.variables = ctx.variables || {};
            ctx.variables[options.name] = options.value;
        });

        this.registerAction('sendDM', async (ctx, options) => {
            if (ctx.user) {
                await ctx.user.send(options.content || options.message);
            }
        });

        this.registerAction('react', async (ctx, options) => {
            if (ctx.message) {
                await ctx.message.nya.react(options.emoji);
            }
        });

        this.registerAction('deleteMessage', async (ctx) => {
            if (ctx.message) {
                await ctx.message.nya.delete();
            }
        });

        this.registerAction('ban', async (ctx, options) => {
            if (ctx.member && ctx.guildId) {
                await this.client.rest.put(
                    `/guilds/${ctx.guildId}/bans/${ctx.member.user.id}`,
                    { delete_message_days: options.days || 0 }
                );
            }
        });

        this.registerAction('kick', async (ctx) => {
            if (ctx.member && ctx.guildId) {
                await this.client.rest.delete(
                    `/guilds/${ctx.guildId}/members/${ctx.member.user.id}`
                );
            }
        });

        this.registerAction('timeout', async (ctx, options) => {
            if (ctx.member && ctx.guildId) {
                const until = new Date(Date.now() + (options.duration || 60000)).toISOString();
                await this.client.rest.patch(
                    `/guilds/${ctx.guildId}/members/${ctx.member.user.id}`,
                    { communication_disabled_until: until }
                );
            }
        });
    }

    registerAction(name, handler) {
        this.actions.set(name, handler);
        return this;
    }

    flow(name) {
        const flowBuilder = new FlowBuilder(this, name);
        this.flows.set(name, flowBuilder);
        return flowBuilder;
    }

    async execute(flowName, context) {
        const flow = this.flows.get(flowName);
        if (!flow) {
            throw new Error(`Flow ${flowName} not found`);
        }

        await flow.run(context);
        this.emit('flowExecuted', { flowName, context });
    }

    getFlow(name) {
        return this.flows.get(name);
    }

    deleteFlow(name) {
        this.flows.delete(name);
        return this;
    }

    listFlows() {
        return Array.from(this.flows.keys());
    }
}

class FlowBuilder {
    constructor(flowsManager, name) {
        this.flowsManager = flowsManager;
        this.name = name;
        this.trigger = null;
        this.conditions = [];
        this.steps = [];
    }

    when(eventName) {
        this.trigger = eventName;

        this.flowsManager.client.on(eventName, async (...args) => {
            const context = this.#buildContext(eventName, args);
            await this.run(context);
        });

        return this;
    }

    #buildContext(eventName, args) {
        const context = {
            eventName,
            args,
            variables: {},
            client: this.flowsManager.client
        };

        if (eventName === 'messageCreate' && args[0]) {
            context.message = args[0];
            context.author = args[0].author;
            context.channelId = args[0].channelId;
            context.guildId = args[0].guildId;
        }

        if (eventName === 'GUILD_MEMBER_ADD' && args[0]) {
            context.member = args[0];
            context.user = args[0].user;
            context.guildId = args[0].guild_id;
        }

        if (eventName === 'interactionCreate' && args[0]) {
            context.interaction = args[0];
            context.user = args[0].user;
            context.channelId = args[0].channelId;
            context.guildId = args[0].guildId;
        }

        return context;
    }

    if(condition) {
        this.conditions.push(condition);
        return this;
    }

    do(actionName, options = {}) {
        this.steps.push({ action: actionName, options });
        return this;
    }

    async run(context) {
        for (const condition of this.conditions) {
            if (typeof condition === 'function') {
                if (!condition(context)) return;
            }
        }

        for (const step of this.steps) {
            const handler = this.flowsManager.actions.get(step.action);
            if (handler) {
                try {
                    await handler(context, step.options);
                } catch (error) {
                    Logger.error(`Flow ${this.name} action ${step.action} failed: ${error.message}`);
                    this.flowsManager.emit('flowError', {
                        flowName: this.name,
                        action: step.action,
                        error
                    });
                }
            } else {
                Logger.warn(`Flow ${this.name}: Action ${step.action} not found`);
            }
        }
    }
}
