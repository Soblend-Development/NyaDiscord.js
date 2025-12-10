import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { Logger } from '../utils/Logger.js';
import cluster from 'cluster';
import os from 'os';

export class NYASharding extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.shards = new Map();
        this.totalShards = options.totalShards || 'auto';
        this.shardsPerCluster = options.shardsPerCluster || 1;
        this.mode = options.mode || 'process';
        this.respawn = options.respawn !== false;
        this.respawnDelay = options.respawnDelay || 5000;
        this.token = options.token || null;
        this.ready = false;
        this.shardQueue = [];
        this.shardStats = new Map();
    }

    async spawn() {
        if (this.totalShards === 'auto') {
            this.totalShards = await this.#fetchRecommendedShards();
        }

        Logger.nya(`Spawning ${this.totalShards} shards...`);

        for (let i = 0; i < this.totalShards; i++) {
            this.shardQueue.push(i);
        }

        await this.#spawnNextShard();
        return this;
    }

    async #fetchRecommendedShards() {
        try {
            const response = await fetch('https://discord.com/api/v10/gateway/bot', {
                headers: { 'Authorization': `Bot ${this.token}` }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.shards || 1;
        } catch (error) {
            Logger.warn(`Could not fetch recommended shards: ${error.message}, defaulting to 1`);
            return 1;
        }
    }

    async #spawnNextShard() {
        if (this.shardQueue.length === 0) {
            this.ready = true;
            this.emit('ready', { totalShards: this.totalShards });
            Logger.success(`All ${this.totalShards} shards spawned`);
            return;
        }

        const shardId = this.shardQueue.shift();
        await this.#createShard(shardId);

        await new Promise(resolve => setTimeout(resolve, 5500));
        await this.#spawnNextShard();
    }

    async #createShard(shardId) {
        const shard = {
            id: shardId,
            status: 'spawning',
            ready: false,
            guilds: 0,
            ping: 0,
            lastHeartbeat: null,
            worker: null
        };

        if (this.mode === 'worker') {
            shard.worker = new Worker(new URL('./NYAShardWorker.js', import.meta.url), {
                workerData: {
                    shardId,
                    totalShards: this.totalShards,
                    token: this.token
                }
            });

            shard.worker.on('message', (message) => this.#handleWorkerMessage(shardId, message));
            shard.worker.on('error', (error) => this.#handleWorkerError(shardId, error));
            shard.worker.on('exit', (code) => this.#handleWorkerExit(shardId, code));
        }

        this.shards.set(shardId, shard);
        this.emit('shardSpawn', shard);
        Logger.log(`Shard ${shardId} spawned`);

        return shard;
    }

    #handleWorkerMessage(shardId, message) {
        const shard = this.shards.get(shardId);
        if (!shard) return;

        switch (message.type) {
            case 'ready':
                shard.ready = true;
                shard.status = 'ready';
                shard.guilds = message.guilds || 0;
                this.emit('shardReady', shard);
                break;

            case 'stats':
                shard.ping = message.ping || 0;
                shard.guilds = message.guilds || 0;
                shard.lastHeartbeat = Date.now();
                this.shardStats.set(shardId, message);
                break;

            case 'disconnect':
                shard.status = 'disconnected';
                shard.ready = false;
                this.emit('shardDisconnect', shard);
                break;

            case 'error':
                this.emit('shardError', { shard, error: message.error });
                break;
        }
    }

    #handleWorkerError(shardId, error) {
        Logger.error(`Shard ${shardId} worker error: ${error.message}`);
        this.emit('shardError', { shardId, error });
    }

    #handleWorkerExit(shardId, code) {
        const shard = this.shards.get(shardId);
        if (!shard) return;

        Logger.warn(`Shard ${shardId} exited with code ${code}`);
        shard.status = 'dead';
        shard.ready = false;
        this.emit('shardDeath', { shard, code });

        if (this.respawn && code !== 0) {
            setTimeout(() => {
                Logger.log(`Respawning shard ${shardId}...`);
                this.#createShard(shardId);
            }, this.respawnDelay);
        }
    }

    broadcast(message) {
        for (const [, shard] of this.shards) {
            if (shard.worker) {
                shard.worker.postMessage(message);
            }
        }
        return this;
    }

    send(shardId, message) {
        const shard = this.shards.get(shardId);
        if (shard?.worker) {
            shard.worker.postMessage(message);
        }
        return this;
    }

    async respawnShard(shardId) {
        const shard = this.shards.get(shardId);
        if (shard?.worker) {
            shard.worker.terminate();
        }
        await this.#createShard(shardId);
        return this;
    }

    async respawnAll() {
        for (const [shardId] of this.shards) {
            await this.respawnShard(shardId);
            await new Promise(resolve => setTimeout(resolve, 5500));
        }
        return this;
    }

    getStats() {
        const stats = {
            totalShards: this.totalShards,
            readyShards: 0,
            totalGuilds: 0,
            averagePing: 0,
            shards: []
        };

        let totalPing = 0;

        for (const [id, shard] of this.shards) {
            if (shard.ready) stats.readyShards++;
            stats.totalGuilds += shard.guilds;
            totalPing += shard.ping;

            stats.shards.push({
                id,
                status: shard.status,
                ready: shard.ready,
                guilds: shard.guilds,
                ping: shard.ping
            });
        }

        stats.averagePing = stats.readyShards > 0 ? Math.round(totalPing / stats.readyShards) : 0;

        return stats;
    }

    getShardForGuild(guildId) {
        return Number((BigInt(guildId) >> 22n) % BigInt(this.totalShards));
    }

    async destroy() {
        for (const [, shard] of this.shards) {
            if (shard.worker) {
                shard.worker.terminate();
            }
        }
        this.shards.clear();
        Logger.log('All shards destroyed');
        return this;
    }
}
