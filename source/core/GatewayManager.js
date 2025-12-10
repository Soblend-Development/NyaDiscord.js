import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Constants } from './Constants.js';
import { Logger } from '../utils/Logger.js';

export class GatewayManager extends EventEmitter {
    #token;
    #intents;
    #ws;
    #heartbeatInterval;
    #lastSequence;
    #sessionId;
    #resumeGatewayUrl;
    #isReconnecting;
    #heartbeatAck;

    constructor(token, intents) {
        super();
        this.#token = token;
        this.#intents = intents;
        this.#ws = null;
        this.#heartbeatInterval = null;
        this.#lastSequence = null;
        this.#sessionId = null;
        this.#resumeGatewayUrl = null;
        this.#isReconnecting = false;
        this.#heartbeatAck = true;
    }

    connect() {
        const url = this.#resumeGatewayUrl || Constants.GatewayURL;
        Logger.gateway(`Connecting to ${url}`);

        this.#ws = new WebSocket(url);

        this.#ws.on('open', () => {
            Logger.gateway('WebSocket connection established');
        });

        this.#ws.on('message', (data) => {
            this.#handleMessage(JSON.parse(data.toString()));
        });

        this.#ws.on('close', (code, reason) => {
            Logger.gateway(`Connection closed: ${code} - ${reason}`);
            this.#handleDisconnect(code);
        });

        this.#ws.on('error', (error) => {
            Logger.error(`WebSocket error: ${error.message}`);
        });
    }

    #handleMessage(payload) {
        const { op, d, s, t } = payload;

        if (s) {
            this.#lastSequence = s;
        }

        switch (op) {
            case Constants.Opcodes.Hello:
                this.#startHeartbeat(d.heartbeat_interval);
                if (this.#sessionId && this.#isReconnecting) {
                    this.#resume();
                } else {
                    this.#identify();
                }
                break;

            case Constants.Opcodes.HeartbeatAck:
                this.#heartbeatAck = true;
                break;

            case Constants.Opcodes.Heartbeat:
                this.#sendHeartbeat();
                break;

            case Constants.Opcodes.Reconnect:
                Logger.gateway('Received reconnect request');
                this.#reconnect();
                break;

            case Constants.Opcodes.InvalidSession:
                Logger.gateway('Invalid session received');
                if (d) {
                    setTimeout(() => this.#resume(), 1000 + Math.random() * 4000);
                } else {
                    this.#sessionId = null;
                    setTimeout(() => this.#identify(), 1000 + Math.random() * 4000);
                }
                break;

            case Constants.Opcodes.Dispatch:
                this.#handleDispatch(t, d);
                break;
        }
    }

    #handleDispatch(eventName, data) {
        if (eventName === Constants.Events.Ready) {
            this.#sessionId = data.session_id;
            this.#resumeGatewayUrl = data.resume_gateway_url;
            Logger.success(`Logged in as ${data.user.username}#${data.user.discriminator}`);
        }

        if (eventName === Constants.Events.Resumed) {
            Logger.success('Session resumed successfully');
        }

        this.emit('raw', { eventName, data });
        this.emit(eventName, data);
    }

    #identify() {
        Logger.gateway('Sending IDENTIFY payload');
        this.#send({
            op: Constants.Opcodes.Identify,
            d: {
                token: this.#token,
                intents: this.#intents,
                properties: {
                    os: process.platform,
                    browser: 'NyaDiscord.js',
                    device: 'NyaDiscord.js'
                },
                compress: false
            }
        });
    }

    #resume() {
        Logger.gateway('Sending RESUME payload');
        this.#send({
            op: Constants.Opcodes.Resume,
            d: {
                token: this.#token,
                session_id: this.#sessionId,
                seq: this.#lastSequence
            }
        });
    }

    #startHeartbeat(interval) {
        Logger.gateway(`Starting heartbeat with interval ${interval}ms`);

        if (this.#heartbeatInterval) {
            clearInterval(this.#heartbeatInterval);
        }

        this.#sendHeartbeat();

        this.#heartbeatInterval = setInterval(() => {
            if (!this.#heartbeatAck) {
                Logger.warn('Heartbeat ACK not received, reconnecting...');
                this.#reconnect();
                return;
            }
            this.#heartbeatAck = false;
            this.#sendHeartbeat();
        }, interval);
    }

    #sendHeartbeat() {
        this.#send({
            op: Constants.Opcodes.Heartbeat,
            d: this.#lastSequence
        });
    }

    #send(data) {
        if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
            this.#ws.send(JSON.stringify(data));
        }
    }

    #handleDisconnect(code) {
        if (this.#heartbeatInterval) {
            clearInterval(this.#heartbeatInterval);
            this.#heartbeatInterval = null;
        }

        const resumableCodes = [4000, 4001, 4002, 4003, 4005, 4007, 4008, 4009];

        if (resumableCodes.includes(code)) {
            this.#reconnect();
        } else if (code === 4014) {
            Logger.error('Disallowed intents. Please enable privileged intents in the Discord Developer Portal.');
        } else if (code === 4004) {
            Logger.error('Invalid token provided.');
        } else {
            this.#reconnect();
        }
    }

    #reconnect() {
        this.#isReconnecting = true;
        if (this.#ws) {
            this.#ws.removeAllListeners();
            if (this.#ws.readyState === WebSocket.OPEN) {
                this.#ws.close();
            }
        }
        setTimeout(() => this.connect(), 5000);
    }

    disconnect() {
        if (this.#heartbeatInterval) {
            clearInterval(this.#heartbeatInterval);
        }
        if (this.#ws) {
            this.#ws.close(1000, 'Client disconnect');
        }
    }

    updatePresence(presence) {
        this.#send({
            op: Constants.Opcodes.PresenceUpdate,
            d: presence
        });
    }

    requestGuildMembers(guildId, options = {}) {
        this.#send({
            op: Constants.Opcodes.RequestGuildMembers,
            d: {
                guild_id: guildId,
                query: options.query || '',
                limit: options.limit || 0,
                presences: options.presences || false,
                user_ids: options.userIds || undefined,
                nonce: options.nonce || undefined
            }
        });
    }
}
