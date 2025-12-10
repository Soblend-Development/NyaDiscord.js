import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

export class NYAMemory extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.cache = new Map();
        this.accessLog = new Map();
        this.ttl = options.ttl || 300000;
        this.maxSize = options.maxSize || 10000;
        this.sweepInterval = options.sweepInterval || 60000;
        this.persistPath = options.persistPath || null;
        this.redis = options.redis || null;
        this.shardSync = options.shardSync || false;

        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };

        this.#startSweeper();
    }

    #startSweeper() {
        this.sweeperTimer = setInterval(() => {
            this.sweep();
        }, this.sweepInterval);
    }

    sweep() {
        const now = Date.now();
        let evicted = 0;

        for (const [key, entry] of this.cache) {
            if (entry.expiresAt && entry.expiresAt < now) {
                this.cache.delete(key);
                this.accessLog.delete(key);
                evicted++;
            }
        }

        if (this.cache.size > this.maxSize) {
            const sortedByAccess = [...this.accessLog.entries()]
                .sort((a, b) => a[1] - b[1]);

            const toDelete = this.cache.size - this.maxSize;
            for (let i = 0; i < toDelete; i++) {
                const [key] = sortedByAccess[i];
                this.cache.delete(key);
                this.accessLog.delete(key);
                evicted++;
            }
        }

        if (evicted > 0) {
            this.stats.evictions += evicted;
            this.emit('sweep', { evicted });
        }

        return evicted;
    }

    set(key, value, ttl = this.ttl) {
        const entry = {
            value,
            createdAt: Date.now(),
            expiresAt: ttl ? Date.now() + ttl : null
        };

        this.cache.set(key, entry);
        this.accessLog.set(key, Date.now());
        this.stats.sets++;

        if (this.shardSync) {
            this.#syncToShards('set', key, entry);
        }

        this.emit('set', { key, value, ttl });
        return this;
    }

    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            this.accessLog.delete(key);
            this.stats.misses++;
            return null;
        }

        this.accessLog.set(key, Date.now());
        this.stats.hits++;
        return entry.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        const existed = this.cache.delete(key);
        this.accessLog.delete(key);

        if (existed) {
            this.stats.deletes++;

            if (this.shardSync) {
                this.#syncToShards('delete', key);
            }

            this.emit('delete', { key });
        }

        return existed;
    }

    clear() {
        this.cache.clear();
        this.accessLog.clear();
        this.emit('clear');
        return this;
    }

    async mget(keys) {
        const results = {};
        const missing = [];

        for (const key of keys) {
            const value = this.get(key);
            if (value !== null) {
                results[key] = value;
            } else {
                missing.push(key);
            }
        }

        return { found: results, missing };
    }

    mset(entries, ttl = this.ttl) {
        for (const [key, value] of Object.entries(entries)) {
            this.set(key, value, ttl);
        }
        return this;
    }

    getOrSet(key, fetchFn, ttl = this.ttl) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const value = fetchFn();
        this.set(key, value, ttl);
        return value;
    }

    async getOrSetAsync(key, fetchFn, ttl = this.ttl) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const value = await fetchFn();
        this.set(key, value, ttl);
        return value;
    }

    #syncToShards(action, key, data) {
        if (this.client.sharding) {
            this.client.sharding.broadcast({
                type: 'cache_sync',
                action,
                key,
                data
            });
        }
    }

    async persist() {
        if (!this.persistPath) {
            throw new Error('No persist path configured');
        }

        const fs = await import('fs');
        const data = {};

        for (const [key, entry] of this.cache) {
            if (!entry.expiresAt || entry.expiresAt > Date.now()) {
                data[key] = entry;
            }
        }

        fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
        Logger.success(`Persisted ${Object.keys(data).length} cache entries`);
        return this;
    }

    async restore() {
        if (!this.persistPath) {
            throw new Error('No persist path configured');
        }

        const fs = await import('fs');

        if (!fs.existsSync(this.persistPath)) {
            return this;
        }

        const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf8'));
        const now = Date.now();
        let restored = 0;

        for (const [key, entry] of Object.entries(data)) {
            if (!entry.expiresAt || entry.expiresAt > now) {
                this.cache.set(key, entry);
                this.accessLog.set(key, now);
                restored++;
            }
        }

        Logger.success(`Restored ${restored} cache entries`);
        return this;
    }

    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
            maxSize: this.maxSize
        };
    }

    clearStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
        return this;
    }

    destroy() {
        if (this.sweeperTimer) {
            clearInterval(this.sweeperTimer);
        }
        this.cache.clear();
        this.accessLog.clear();
        return this;
    }
}
