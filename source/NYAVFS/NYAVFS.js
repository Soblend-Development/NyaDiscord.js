import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import fs from 'fs';
import path from 'path';

export class NYAVFS extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.baseDir = options.baseDir || './';
        this.modules = new Map();
        this.watchers = new Map();
        this.hotReload = options.hotReload !== false;
        this.watcherEnabled = false;

        this.directories = {
            commands: options.commandsDir || 'commands',
            events: options.eventsDir || 'events',
            modules: options.modulesDir || 'modules',
            plugins: options.pluginsDir || 'plugins'
        };
    }

    async loadAll() {
        const startTime = Date.now();
        let totalLoaded = 0;

        for (const [type, dir] of Object.entries(this.directories)) {
            const fullPath = path.join(this.baseDir, dir);
            if (fs.existsSync(fullPath)) {
                const count = await this.#loadDirectory(fullPath, type);
                totalLoaded += count;
            }
        }

        const elapsed = Date.now() - startTime;
        Logger.success(`VFS loaded ${totalLoaded} modules in ${elapsed}ms`);

        if (this.hotReload) {
            this.startWatching();
        }

        return this;
    }

    async #loadDirectory(dir, type, prefix = '') {
        let count = 0;
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                count += await this.#loadDirectory(filePath, type, `${prefix}${file}/`);
            } else if (file.endsWith('.js')) {
                await this.#loadModule(filePath, type, `${prefix}${file.replace('.js', '')}`);
                count++;
            }
        }

        return count;
    }

    async #loadModule(filePath, type, name) {
        try {
            const absolutePath = path.resolve(filePath);
            const fileUrl = `file://${absolutePath.replace(/\\/g, '/')}?update=${Date.now()}`;

            const module = await import(fileUrl);
            const data = module.default || module;

            const moduleInfo = {
                name,
                type,
                path: absolutePath,
                data,
                loadedAt: Date.now()
            };

            const key = `${type}:${name}`;
            this.modules.set(key, moduleInfo);

            this.#registerModule(moduleInfo);
            this.emit('moduleLoad', moduleInfo);

            Logger.debug(`VFS loaded: ${type}/${name}`);
        } catch (error) {
            Logger.error(`VFS failed to load ${filePath}: ${error.message}`);
            this.emit('moduleError', { filePath, error });
        }
    }

    #registerModule(moduleInfo) {
        const { type, data, name } = moduleInfo;

        switch (type) {
            case 'commands':
                if (this.client.commandHandler) {
                    data.name = data.name || name;
                    data.filePath = moduleInfo.path;
                    this.client.commandHandler.commands.set(data.name.toLowerCase(), data);
                } else if (this.client.commands) {
                    this.client.commands.set(name.toLowerCase(), data);
                }
                break;

            case 'events':
                const eventName = data.name || name;
                const listener = async (...args) => {
                    try {
                        await data.execute(this.client, ...args);
                    } catch (error) {
                        Logger.error(`Event ${eventName} error: ${error.message}`);
                    }
                };

                if (data.once) {
                    this.client.once(eventName, listener);
                } else {
                    this.client.on(eventName, listener);
                }
                break;

            case 'modules':
                if (data.init) {
                    data.init(this.client);
                }
                break;

            case 'plugins':
                if (data.register) {
                    data.register(this.client);
                }
                break;
        }
    }

    startWatching() {
        if (this.watcherEnabled) return;
        this.watcherEnabled = true;

        for (const [type, dir] of Object.entries(this.directories)) {
            const fullPath = path.resolve(this.baseDir, dir);
            if (!fs.existsSync(fullPath)) continue;

            const watcher = fs.watch(fullPath, { recursive: true }, async (eventType, filename) => {
                if (!filename || !filename.endsWith('.js')) return;

                const filePath = path.join(fullPath, filename);
                const name = filename.replace(/\\/g, '/').replace('.js', '');

                if (fs.existsSync(filePath)) {
                    await this.reload(`${type}:${name}`);
                    Logger.nya(`Hot-reloaded: ${type}/${name}`);
                }
            });

            this.watchers.set(type, watcher);
        }

        Logger.success('VFS file watching started');
    }

    stopWatching() {
        for (const [, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();
        this.watcherEnabled = false;
        Logger.log('VFS file watching stopped');
    }

    async reload(key) {
        const moduleInfo = this.modules.get(key);
        if (!moduleInfo) {
            throw new Error(`Module ${key} not found`);
        }

        await this.#loadModule(moduleInfo.path, moduleInfo.type, moduleInfo.name);
        this.emit('moduleReload', { key });
        return this.modules.get(key);
    }

    async reloadAll() {
        this.modules.clear();
        await this.loadAll();
        this.emit('reloadAll');
    }

    get(key) {
        return this.modules.get(key)?.data;
    }

    has(key) {
        return this.modules.has(key);
    }

    list(type) {
        const result = [];
        for (const [key, info] of this.modules) {
            if (!type || info.type === type) {
                result.push({
                    key,
                    name: info.name,
                    type: info.type,
                    loadedAt: info.loadedAt
                });
            }
        }
        return result;
    }

    getStats() {
        const stats = {
            totalModules: this.modules.size,
            byType: {}
        };

        for (const [, info] of this.modules) {
            stats.byType[info.type] = (stats.byType[info.type] || 0) + 1;
        }

        return stats;
    }
}
