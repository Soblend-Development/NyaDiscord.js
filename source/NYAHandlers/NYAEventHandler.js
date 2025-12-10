import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import fs from 'fs';
import path from 'path';

export class NYAEventHandler extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.events = new Map();
        this.directory = options.directory || './events';
        this.autoReload = options.autoReload || false;
        this.watcher = null;
    }

    async loadAll() {
        const startTime = Date.now();
        await this.#loadDirectory(this.directory);
        const elapsed = Date.now() - startTime;
        Logger.success(`Loaded ${this.events.size} events in ${elapsed}ms`);

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
                await this.#loadEvent(filePath);
            }
        }
    }

    async #loadEvent(filePath) {
        try {
            const absolutePath = path.resolve(filePath);
            const fileUrl = `file://${absolutePath.replace(/\\/g, '/')}?update=${Date.now()}`;

            const module = await import(fileUrl);
            const event = module.default || module;

            if (!event.name) {
                Logger.warn(`Event at ${filePath} has no name, skipping`);
                return;
            }

            if (this.events.has(event.name)) {
                const oldEvent = this.events.get(event.name);
                this.client.removeListener(event.name, oldEvent.listener);
            }

            event.filePath = absolutePath;

            const listener = async (...args) => {
                try {
                    await event.execute(this.client, ...args);
                } catch (error) {
                    Logger.error(`Error in event ${event.name}: ${error.message}`);
                    this.emit('eventError', { event, error });
                }
            };

            event.listener = listener;

            if (event.once) {
                this.client.once(event.name, listener);
            } else {
                this.client.on(event.name, listener);
            }

            this.events.set(event.name, event);
            Logger.debug(`Loaded event: ${event.name}`);
        } catch (error) {
            Logger.error(`Failed to load event ${filePath}: ${error.message}`);
        }
    }

    async reload(eventName) {
        const event = this.events.get(eventName);
        if (!event) {
            throw new Error(`Event ${eventName} not found`);
        }

        this.client.removeListener(event.name, event.listener);
        await this.#loadEvent(event.filePath);
        Logger.success(`Reloaded event: ${eventName}`);

        return this.events.get(eventName);
    }

    #startWatcher() {
        if (this.watcher) return;

        const absoluteDir = path.resolve(this.directory);

        this.watcher = fs.watch(absoluteDir, { recursive: true }, async (eventType, filename) => {
            if (!filename || !filename.endsWith('.js')) return;

            const filePath = path.join(absoluteDir, filename);

            if (fs.existsSync(filePath)) {
                await this.#loadEvent(filePath);
                Logger.nya(`Hot-reloaded event: ${filename}`);
            }
        });

        Logger.success('Event auto-reload watcher started');
    }

    stopWatcher() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}
