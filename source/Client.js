import { EventEmitter } from 'events';
import { LocalDB } from '@imjxsx/localdb';
import Envy from '@imjxsx/envy';
import { GatewayManager } from './core/GatewayManager.js';
import { RestManager } from './core/RestManager.js';
import { Constants } from './core/Constants.js';
import { Logger } from './utils/Logger.js';
import { Message } from './structures/Message.js';
import { Interaction } from './structures/Interaction.js';
import { Guild } from './structures/Guild.js';
import { User } from './structures/User.js';
import { Channel } from './structures/Channel.js';

export class NyaClient extends EventEmitter {
    constructor(options = {}) {
        super();

        this.token = options.token || null;
        this.intents = options.intents || 0;
        this.prefix = options.prefix || '!';
        this.owners = options.owners || [];

        this.rest = null;
        this.gateway = null;
        this.db = null;
        this.env = null;

        this.user = null;
        this.application = null;
        this.readyAt = null;

        this.guilds = new Map();
        this.channels = new Map();
        this.users = new Map();

        this.commands = new Map();
        this.slashCommands = new Map();
        this.events = new Map();

        this.#setupEventHandlers();
    }

    async loadEnv(path = './.env') {
        this.env = new Envy(path);
        await this.env.load();
        Logger.success('Environment variables loaded');
        return this;
    }

    async loadDatabase(path = './data') {
        const localDB = new LocalDB(path);
        this.db = localDB.db('nya');
        await this.db.load();
        Logger.success('Database loaded');
        return this;
    }

    #setupEventHandlers() {
        this.on('READY', (data) => {
            this.user = new User(this, data.user);
            this.application = data.application;
            this.readyAt = new Date();

            for (const guild of data.guilds) {
                this.guilds.set(guild.id, { id: guild.id, unavailable: guild.unavailable });
            }

            this.emit('ready', this);
        });

        this.on('MESSAGE_CREATE', (data) => {
            const message = new Message(this, data);
            this.emit('messageCreate', message);

            if (message.author.bot) return;

            if (message.content.startsWith(this.prefix)) {
                const args = message.content.slice(this.prefix.length).trim().split(/\s+/);
                const commandName = args.shift().toLowerCase();
                const command = this.commands.get(commandName);

                if (command) {
                    try {
                        command.execute(message, args);
                    } catch (error) {
                        Logger.error(`Command error: ${error.message}`);
                    }
                }
            }
        });

        this.on('INTERACTION_CREATE', (data) => {
            const interaction = new Interaction(this, data);
            this.emit('interactionCreate', interaction);

            if (data.type === Constants.InteractionTypes.ApplicationCommand) {
                const command = this.slashCommands.get(data.data.name);
                if (command) {
                    try {
                        command.execute(interaction);
                    } catch (error) {
                        Logger.error(`Slash command error: ${error.message}`);
                    }
                }
            }
        });

        this.on('GUILD_CREATE', (data) => {
            const guild = new Guild(this, data);
            this.guilds.set(guild.id, guild);

            for (const channel of data.channels || []) {
                channel.guild_id = guild.id;
                this.channels.set(channel.id, new Channel(this, channel));
            }

            this.emit('guildCreate', guild);
        });

        this.on('GUILD_DELETE', (data) => {
            const guild = this.guilds.get(data.id);
            this.guilds.delete(data.id);
            this.emit('guildDelete', guild || data);
        });

        this.on('CHANNEL_CREATE', (data) => {
            const channel = new Channel(this, data);
            this.channels.set(channel.id, channel);
            this.emit('channelCreate', channel);
        });

        this.on('CHANNEL_DELETE', (data) => {
            const channel = this.channels.get(data.id);
            this.channels.delete(data.id);
            this.emit('channelDelete', channel || data);
        });
    }

    addCommand(name, handler) {
        this.commands.set(name.toLowerCase(), { name, execute: handler });
        return this;
    }

    addSlashCommand(command) {
        this.slashCommands.set(command.name, command);
        return this;
    }

    async registerSlashCommands(guildId = null) {
        const commands = Array.from(this.slashCommands.values()).map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || []
        }));

        await this.rest.bulkOverwriteCommands(this.application.id, commands, guildId);
        Logger.success(`Registered ${commands.length} slash commands`);
        return this;
    }

    async login(token) {
        this.token = token || this.token;

        if (!this.token) {
            throw new Error('No token provided');
        }

        this.rest = new RestManager(this.token);
        this.gateway = new GatewayManager(this.token, this.intents);

        this.gateway.on('raw', ({ eventName, data }) => {
            this.emit(eventName, data);
        });

        this.gateway.connect();

        Logger.nya('NyaDiscord.js is connecting...');
        return this;
    }

    setPresence(options) {
        this.gateway.updatePresence({
            since: options.since || null,
            activities: options.activities || [],
            status: options.status || 'online',
            afk: options.afk || false
        });
        return this;
    }

    get uptime() {
        return this.readyAt ? Date.now() - this.readyAt.getTime() : null;
    }

    async destroy() {
        if (this.db) {
            await this.db.save();
        }
        this.gateway.disconnect();
        Logger.nya('Client destroyed');
    }
}
