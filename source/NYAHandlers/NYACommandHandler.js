import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import fs from 'fs';
import path from 'path';

export class NYACommandHandler extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.commands = new Map();
        this.aliases = new Map();
        this.categories = new Map();
        this.directory = options.directory || './commands';
        this.autoReload = options.autoReload || false;
        this.developerMode = options.developerMode || false;
        this.developerIds = options.developerIds || [];
        this.watcher = null;
    }

    async loadAll() {
        const startTime = Date.now();
        await this.#loadDirectory(this.directory);
        const elapsed = Date.now() - startTime;
        Logger.success(`Loaded ${this.commands.size} commands in ${elapsed}ms`);

        if (this.autoReload) {
            this.#startWatcher();
        }

        return this;
    }

    async #loadDirectory(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                await this.#loadDirectory(filePath);
            } else if (file.endsWith('.js')) {
                await this.#loadCommand(filePath);
            }
        }
    }

    async #loadCommand(filePath) {
        try {
            const absolutePath = path.resolve(filePath);
            const fileUrl = `file://${absolutePath.replace(/\\/g, '/')}?update=${Date.now()}`;

            const module = await import(fileUrl);
            const command = module.default || module;

            if (!command.name) {
                Logger.warn(`Command at ${filePath} has no name, skipping`);
                return;
            }

            command.filePath = absolutePath;
            command.category = command.category || path.basename(path.dirname(filePath));

            this.commands.set(command.name.toLowerCase(), command);

            if (command.aliases) {
                for (const alias of command.aliases) {
                    this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
                }
            }

            if (!this.categories.has(command.category)) {
                this.categories.set(command.category, []);
            }
            this.categories.get(command.category).push(command.name);

            this.emit('commandLoad', command);
            Logger.debug(`Loaded command: ${command.name}`);
        } catch (error) {
            Logger.error(`Failed to load command ${filePath}: ${error.message}`);
            this.emit('commandError', { filePath, error });
        }
    }

    async reload(commandName) {
        const command = this.commands.get(commandName.toLowerCase());
        if (!command) {
            throw new Error(`Command ${commandName} not found`);
        }

        this.commands.delete(command.name.toLowerCase());

        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.delete(alias.toLowerCase());
            }
        }

        await this.#loadCommand(command.filePath);
        Logger.success(`Reloaded command: ${commandName}`);
        this.emit('commandReload', commandName);

        return this.commands.get(commandName.toLowerCase());
    }

    async reloadAll() {
        this.commands.clear();
        this.aliases.clear();
        this.categories.clear();
        await this.loadAll();
        this.emit('commandsReloadAll');
    }

    #startWatcher() {
        if (this.watcher) return;

        const absoluteDir = path.resolve(this.directory);

        this.watcher = fs.watch(absoluteDir, { recursive: true }, async (eventType, filename) => {
            if (!filename || !filename.endsWith('.js')) return;

            const filePath = path.join(absoluteDir, filename);

            if (fs.existsSync(filePath)) {
                await this.#loadCommand(filePath);
                Logger.nya(`Hot-reloaded: ${filename}`);
            }
        });

        Logger.success('Auto-reload watcher started');
    }

    stopWatcher() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            Logger.log('Auto-reload watcher stopped');
        }
    }

    get(name) {
        const aliasResolved = this.aliases.get(name.toLowerCase());
        return this.commands.get(aliasResolved || name.toLowerCase());
    }

    has(name) {
        return this.commands.has(name.toLowerCase()) || this.aliases.has(name.toLowerCase());
    }

    async run(message, commandName, args) {
        const command = this.get(commandName);

        if (!command) {
            this.emit('commandNotFound', { message, commandName });
            return false;
        }

        if (command.developerOnly && !this.developerIds.includes(message.author.id)) {
            this.emit('commandDeveloperOnly', { message, command });
            return false;
        }

        if (command.guildOnly && !message.guildId) {
            this.emit('commandGuildOnly', { message, command });
            return false;
        }

        if (command.ownerOnly && message.author.id !== message.guild?.ownerId) {
            this.emit('commandOwnerOnly', { message, command });
            return false;
        }

        try {
            const context = {
                client: this.client,
                message,
                args,
                command,
                developerMode: this.developerMode
            };

            await command.execute(context);
            this.emit('commandRun', { message, command, args });
            return true;
        } catch (error) {
            Logger.error(`Error in command ${command.name}: ${error.message}`);
            this.emit('commandError', { message, command, error });
            return false;
        }
    }

    toJSON() {
        return Array.from(this.commands.values()).map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            category: cmd.category,
            aliases: cmd.aliases || []
        }));
    }
}
