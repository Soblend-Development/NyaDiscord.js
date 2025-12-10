import { Logger } from '../utils/Logger.js';

export class NYADeveloperMode {
    constructor(client, options = {}) {
        this.client = client;
        this.enabled = options.enabled || false;
        this.developerIds = options.developerIds || [];
        this.testGuildId = options.testGuildId || null;
        this.debugLevel = options.debugLevel || 1;
        this.logPayloads = options.logPayloads || false;
        this.measurePerformance = options.measurePerformance || true;
        this.performanceMetrics = new Map();
    }

    enable() {
        this.enabled = true;
        Logger.nya('Developer mode ENABLED');
        this.#setupDebugListeners();
        return this;
    }

    disable() {
        this.enabled = false;
        Logger.nya('Developer mode DISABLED');
        return this;
    }

    #setupDebugListeners() {
        if (this.logPayloads) {
            this.client.gateway?.on('raw', ({ eventName, data }) => {
                if (this.enabled && this.debugLevel >= 3) {
                    Logger.debug(`[RAW] ${eventName}: ${JSON.stringify(data).substring(0, 200)}...`);
                }
            });
        }
    }

    isDeveloper(userId) {
        return this.developerIds.includes(userId);
    }

    startTimer(label) {
        if (!this.measurePerformance) return;
        this.performanceMetrics.set(label, {
            start: process.hrtime.bigint(),
            end: null
        });
    }

    endTimer(label) {
        if (!this.measurePerformance) return null;
        const metric = this.performanceMetrics.get(label);
        if (!metric) return null;

        metric.end = process.hrtime.bigint();
        const duration = Number(metric.end - metric.start) / 1e6;

        if (this.enabled && this.debugLevel >= 2) {
            Logger.debug(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
        }

        return duration;
    }

    log(message, level = 1) {
        if (this.enabled && this.debugLevel >= level) {
            Logger.debug(`[DEV] ${message}`);
        }
    }

    inspect(obj, label = 'Object') {
        if (this.enabled && this.debugLevel >= 2) {
            Logger.debug(`[INSPECT] ${label}:`);
            console.dir(obj, { depth: 3, colors: true });
        }
    }

    async testCommand(commandName, mockMessage) {
        if (!this.enabled) {
            throw new Error('Developer mode is not enabled');
        }

        const command = this.client.commandHandler?.get(commandName);
        if (!command) {
            throw new Error(`Command ${commandName} not found`);
        }

        this.startTimer(`test:${commandName}`);
        try {
            await command.execute({
                client: this.client,
                message: mockMessage,
                args: [],
                command,
                developerMode: true
            });
            const duration = this.endTimer(`test:${commandName}`);
            Logger.success(`Test passed for ${commandName} (${duration?.toFixed(2)}ms)`);
            return { success: true, duration };
        } catch (error) {
            this.endTimer(`test:${commandName}`);
            Logger.error(`Test failed for ${commandName}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    getMetrics() {
        const metrics = {};
        for (const [label, data] of this.performanceMetrics) {
            if (data.end) {
                metrics[label] = Number(data.end - data.start) / 1e6;
            }
        }
        return metrics;
    }

    clearMetrics() {
        this.performanceMetrics.clear();
        return this;
    }
}
