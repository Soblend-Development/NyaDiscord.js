import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    fg: {
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m'
    }
};

export class NYALogger extends EventEmitter {
    constructor(options = {}) {
        super();
        this.enabled = true;
        this.logLevel = options.logLevel || 'debug';
        this.categories = new Set(['system', 'commands', 'errors', 'security', 'database', 'latency', 'gateway', 'rest', 'custom']);
        this.enabledCategories = new Set(options.enabledCategories || [...this.categories]);
        this.webhookUrl = options.webhookUrl || null;
        this.filePath = options.filePath || null;
        this.fileStream = null;
        this.dashboardCallback = options.dashboardCallback || null;
        this.buffer = [];
        this.bufferSize = options.bufferSize || 100;
        this.flushInterval = options.flushInterval || 5000;

        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            fatal: 4
        };

        this.stats = {
            totalLogs: 0,
            byCategory: {},
            byLevel: {}
        };

        if (this.filePath) {
            this.#initFileStream();
        }

        this.#startFlushTimer();
    }

    #initFileStream() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.fileStream = fs.createWriteStream(this.filePath, { flags: 'a' });
    }

    #startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    #getTimestamp() {
        return new Date().toISOString();
    }

    #getColor(level) {
        switch (level) {
            case 'debug': return colors.fg.blue;
            case 'info': return colors.fg.cyan;
            case 'warn': return colors.fg.yellow;
            case 'error': return colors.fg.red;
            case 'fatal': return `${colors.bright}${colors.fg.red}`;
            default: return colors.fg.white;
        }
    }

    #getCategoryColor(category) {
        const categoryColors = {
            system: colors.fg.magenta,
            commands: colors.fg.green,
            errors: colors.fg.red,
            security: colors.fg.yellow,
            database: colors.fg.cyan,
            latency: colors.fg.blue,
            gateway: colors.fg.white,
            rest: colors.fg.cyan,
            custom: colors.fg.magenta
        };
        return categoryColors[category] || colors.fg.white;
    }

    #formatConsole(entry) {
        const levelColor = this.#getColor(entry.level);
        const catColor = this.#getCategoryColor(entry.category);
        return `${colors.dim}[${entry.timestamp}]${colors.reset} ${levelColor}[${entry.level.toUpperCase()}]${colors.reset} ${catColor}[${entry.category}]${colors.reset} ${entry.message}`;
    }

    #formatFile(entry) {
        return JSON.stringify(entry);
    }

    log(level, category, message, metadata = {}) {
        if (!this.enabled) return;
        if (this.levels[level] < this.levels[this.logLevel]) return;
        if (!this.enabledCategories.has(category)) return;

        const entry = {
            timestamp: this.#getTimestamp(),
            level,
            category,
            message,
            metadata
        };

        console.log(this.#formatConsole(entry));

        this.buffer.push(entry);
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }

        this.stats.totalLogs++;
        this.stats.byCategory[category] = (this.stats.byCategory[category] || 0) + 1;
        this.stats.byLevel[level] = (this.stats.byLevel[level] || 0) + 1;

        this.emit('log', entry);
        return entry;
    }

    debug(category, message, metadata) {
        return this.log('debug', category, message, metadata);
    }

    info(category, message, metadata) {
        return this.log('info', category, message, metadata);
    }

    warn(category, message, metadata) {
        return this.log('warn', category, message, metadata);
    }

    error(category, message, metadata) {
        return this.log('error', category, message, metadata);
    }

    fatal(category, message, metadata) {
        return this.log('fatal', category, message, metadata);
    }

    system(message, metadata) {
        return this.info('system', message, metadata);
    }

    command(message, metadata) {
        return this.info('commands', message, metadata);
    }

    security(message, metadata) {
        return this.warn('security', message, metadata);
    }

    database(message, metadata) {
        return this.debug('database', message, metadata);
    }

    latency(message, metadata) {
        return this.debug('latency', message, metadata);
    }

    async flush() {
        if (this.buffer.length === 0) return;

        const entries = [...this.buffer];
        this.buffer = [];

        if (this.fileStream) {
            for (const entry of entries) {
                this.fileStream.write(this.#formatFile(entry) + '\n');
            }
        }

        if (this.webhookUrl) {
            await this.#sendWebhook(entries);
        }

        if (this.dashboardCallback) {
            this.dashboardCallback(entries);
        }

        this.emit('flush', { count: entries.length });
    }

    async #sendWebhook(entries) {
        try {
            const content = entries.map(e => `[${e.level.toUpperCase()}][${e.category}] ${e.message}`).join('\n');

            await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: content.substring(0, 2000),
                    username: 'NYALogger'
                })
            });
        } catch (error) {
            console.error('Failed to send webhook:', error.message);
        }
    }

    enableCategory(category) {
        this.enabledCategories.add(category);
        return this;
    }

    disableCategory(category) {
        this.enabledCategories.delete(category);
        return this;
    }

    setLogLevel(level) {
        if (this.levels[level] !== undefined) {
            this.logLevel = level;
        }
        return this;
    }

    setWebhook(url) {
        this.webhookUrl = url;
        return this;
    }

    setFilePath(filePath) {
        if (this.fileStream) {
            this.fileStream.end();
        }
        this.filePath = filePath;
        this.#initFileStream();
        return this;
    }

    setDashboardCallback(callback) {
        this.dashboardCallback = callback;
        return this;
    }

    getStats() {
        return { ...this.stats };
    }

    clearStats() {
        this.stats = {
            totalLogs: 0,
            byCategory: {},
            byLevel: {}
        };
        return this;
    }

    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        if (this.fileStream) {
            this.flush();
            this.fileStream.end();
        }
    }
}
