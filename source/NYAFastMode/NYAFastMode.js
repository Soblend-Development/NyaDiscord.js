import { Worker } from 'worker_threads';
import { Logger } from '../utils/Logger.js';
import os from 'os';

export class NYAFastMode {
    constructor(client, options = {}) {
        this.client = client;
        this.enabled = false;
        this.workers = [];
        this.workerCount = options.workerCount || Math.max(1, os.cpus().length - 1);
        this.taskQueue = [];
        this.currentWorker = 0;

        this.cacheConfig = {
            maxUsers: options.maxUsers || 10000,
            maxGuilds: options.maxGuilds || 1000,
            maxChannels: options.maxChannels || 10000,
            maxMessages: options.maxMessages || 1000,
            sweepInterval: options.sweepInterval || 300000
        };

        this.stats = {
            tasksProcessed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgTaskTime: 0
        };
    }

    enable() {
        this.enabled = true;
        this.#optimizeCache();
        this.#startSweeper();
        Logger.nya('Fast Mode ENABLED');
        return this;
    }

    disable() {
        this.enabled = false;
        this.#stopWorkers();
        Logger.nya('Fast Mode DISABLED');
        return this;
    }

    #optimizeCache() {
        if (this.client.users?.size > this.cacheConfig.maxUsers) {
            const toDelete = this.client.users.size - this.cacheConfig.maxUsers;
            const iterator = this.client.users.keys();
            for (let i = 0; i < toDelete; i++) {
                const key = iterator.next().value;
                this.client.users.delete(key);
            }
        }

        if (this.client.channels?.size > this.cacheConfig.maxChannels) {
            const toDelete = this.client.channels.size - this.cacheConfig.maxChannels;
            const iterator = this.client.channels.keys();
            for (let i = 0; i < toDelete; i++) {
                const key = iterator.next().value;
                this.client.channels.delete(key);
            }
        }
    }

    #startSweeper() {
        this.sweeperInterval = setInterval(() => {
            if (this.enabled) {
                this.#optimizeCache();
            }
        }, this.cacheConfig.sweepInterval);
    }

    #stopWorkers() {
        for (const worker of this.workers) {
            worker.terminate();
        }
        this.workers = [];

        if (this.sweeperInterval) {
            clearInterval(this.sweeperInterval);
        }
    }

    async runTask(taskFn, data) {
        if (!this.enabled) {
            return taskFn(data);
        }

        const start = Date.now();
        const result = await taskFn(data);
        const duration = Date.now() - start;

        this.stats.tasksProcessed++;
        this.stats.avgTaskTime = (this.stats.avgTaskTime * (this.stats.tasksProcessed - 1) + duration) / this.stats.tasksProcessed;

        return result;
    }

    batchProcess(items, processFn, batchSize = 100) {
        return new Promise(async (resolve) => {
            const results = [];

            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                const batchResults = await Promise.all(batch.map(processFn));
                results.push(...batchResults);

                if (i + batchSize < items.length) {
                    await new Promise(r => setImmediate(r));
                }
            }

            resolve(results);
        });
    }

    cacheGet(collection, key) {
        const item = this.client[collection]?.get(key);
        if (item) {
            this.stats.cacheHits++;
            return item;
        }
        this.stats.cacheMisses++;
        return null;
    }

    prefetch(collection, keys) {
        const missing = [];
        for (const key of keys) {
            if (!this.client[collection]?.has(key)) {
                missing.push(key);
            }
        }
        return missing;
    }

    async warmCache(type, ids) {
        const batches = [];
        const batchSize = 100;

        for (let i = 0; i < ids.length; i += batchSize) {
            batches.push(ids.slice(i, i + batchSize));
        }

        for (const batch of batches) {
            await Promise.all(batch.map(async (id) => {
                try {
                    if (type === 'user') {
                        const user = await this.client.rest.getUser(id);
                        this.client.users.set(id, user);
                    } else if (type === 'channel') {
                        const channel = await this.client.rest.getChannel(id);
                        this.client.channels.set(id, channel);
                    } else if (type === 'guild') {
                        const guild = await this.client.rest.getGuild(id);
                        this.client.guilds.set(id, guild);
                    }
                } catch (error) {
                    Logger.debug(`Failed to warm cache for ${type} ${id}`);
                }
            }));
        }

        return this;
    }

    getStats() {
        const cacheHitRate = this.stats.cacheHits + this.stats.cacheMisses > 0
            ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            cacheHitRate: `${cacheHitRate}%`,
            enabled: this.enabled,
            workerCount: this.workers.length,
            cacheSize: {
                users: this.client.users?.size || 0,
                guilds: this.client.guilds?.size || 0,
                channels: this.client.channels?.size || 0
            }
        };
    }

    clearStats() {
        this.stats = {
            tasksProcessed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgTaskTime: 0
        };
        return this;
    }
}
