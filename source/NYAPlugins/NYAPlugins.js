import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import fs from 'fs';
import path from 'path';

export class NYAPlugins extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.plugins = new Map();
        this.directory = options.directory || './plugins';
        this.registry = options.registry || 'https://registry.nyadiscord.js/plugins';
        this.autoLoad = options.autoLoad !== false;
    }

    async loadAll() {
        if (!fs.existsSync(this.directory)) {
            fs.mkdirSync(this.directory, { recursive: true });
        }

        const dirs = fs.readdirSync(this.directory);
        let loaded = 0;

        for (const dir of dirs) {
            const pluginPath = path.join(this.directory, dir);
            if (fs.statSync(pluginPath).isDirectory()) {
                try {
                    await this.load(dir);
                    loaded++;
                } catch (error) {
                    Logger.error(`Failed to load plugin ${dir}: ${error.message}`);
                }
            }
        }

        Logger.success(`Loaded ${loaded} plugins`);
        return this;
    }

    async load(name) {
        const pluginDir = path.join(this.directory, name);
        const manifestPath = path.join(pluginDir, 'manifest.json');
        const indexPath = path.join(pluginDir, 'index.js');

        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Plugin ${name} has no manifest.json`);
        }

        if (!fs.existsSync(indexPath)) {
            throw new Error(`Plugin ${name} has no index.js`);
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const fileUrl = `file://${path.resolve(indexPath).replace(/\\/g, '/')}?update=${Date.now()}`;
        const module = await import(fileUrl);
        const plugin = module.default || module;

        const pluginData = {
            name: manifest.name || name,
            version: manifest.version || '1.0.0',
            author: manifest.author || 'Unknown',
            description: manifest.description || '',
            dependencies: manifest.dependencies || [],
            path: pluginDir,
            instance: null,
            enabled: true
        };

        for (const dep of pluginData.dependencies) {
            if (!this.plugins.has(dep)) {
                throw new Error(`Plugin ${name} requires ${dep} which is not loaded`);
            }
        }

        if (plugin.register) {
            pluginData.instance = await plugin.register(this.client, manifest.config || {});
        }

        this.plugins.set(name, pluginData);
        this.emit('pluginLoad', pluginData);
        Logger.log(`Loaded plugin: ${pluginData.name} v${pluginData.version}`);

        return pluginData;
    }

    async unload(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin ${name} not found`);
        }

        if (plugin.instance?.unregister) {
            await plugin.instance.unregister();
        }

        this.plugins.delete(name);
        this.emit('pluginUnload', { name });
        Logger.log(`Unloaded plugin: ${name}`);

        return this;
    }

    async reload(name) {
        await this.unload(name);
        return this.load(name);
    }

    async install(packageName) {
        Logger.log(`Installing plugin: ${packageName}`);

        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            await execAsync(`npm install ${packageName} --prefix ${this.directory}`);

            Logger.success(`Installed plugin: ${packageName}`);
            this.emit('pluginInstall', { packageName });

            return this;
        } catch (error) {
            Logger.error(`Failed to install plugin ${packageName}: ${error.message}`);
            throw error;
        }
    }

    async uninstall(packageName) {
        Logger.log(`Uninstalling plugin: ${packageName}`);

        if (this.plugins.has(packageName)) {
            await this.unload(packageName);
        }

        const pluginDir = path.join(this.directory, packageName);
        if (fs.existsSync(pluginDir)) {
            fs.rmSync(pluginDir, { recursive: true });
        }

        Logger.success(`Uninstalled plugin: ${packageName}`);
        this.emit('pluginUninstall', { packageName });

        return this;
    }

    async search(query) {
        try {
            const response = await fetch(`${this.registry}/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error(`Registry returned ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            Logger.warn(`Plugin search failed: ${error.message}`);
            return [];
        }
    }

    get(name) {
        return this.plugins.get(name);
    }

    has(name) {
        return this.plugins.has(name);
    }

    enable(name) {
        const plugin = this.plugins.get(name);
        if (plugin) {
            plugin.enabled = true;
            this.emit('pluginEnable', { name });
        }
        return this;
    }

    disable(name) {
        const plugin = this.plugins.get(name);
        if (plugin) {
            plugin.enabled = false;
            this.emit('pluginDisable', { name });
        }
        return this;
    }

    list() {
        return Array.from(this.plugins.values()).map(p => ({
            name: p.name,
            version: p.version,
            author: p.author,
            enabled: p.enabled
        }));
    }

    getStats() {
        return {
            total: this.plugins.size,
            enabled: Array.from(this.plugins.values()).filter(p => p.enabled).length,
            disabled: Array.from(this.plugins.values()).filter(p => !p.enabled).length
        };
    }
}
