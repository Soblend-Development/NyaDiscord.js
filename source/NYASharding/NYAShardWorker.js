import { parentPort, workerData } from 'worker_threads';
import { NyaClient } from '../Client.js';

const { shardId, totalShards, token } = workerData;

const client = new NyaClient({
    token,
    shardId,
    totalShards
});

client.on('ready', () => {
    parentPort.postMessage({
        type: 'ready',
        shardId,
        guilds: client.guilds.size
    });
});

client.gateway?.on('raw', () => {
    parentPort.postMessage({
        type: 'stats',
        shardId,
        ping: client.gateway?.ping || 0,
        guilds: client.guilds.size,
        uptime: client.uptime
    });
});

parentPort.on('message', async (message) => {
    if (message.type === 'eval') {
        try {
            const result = await eval(message.code);
            parentPort.postMessage({ type: 'evalResult', result, id: message.id });
        } catch (error) {
            parentPort.postMessage({ type: 'evalError', error: error.message, id: message.id });
        }
    }

    if (message.type === 'shutdown') {
        await client.destroy();
        process.exit(0);
    }
});

client.login(token);
