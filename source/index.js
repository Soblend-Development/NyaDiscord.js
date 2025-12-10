export { NyaClient } from './Client.js';
export { Constants } from './core/Constants.js';
export { RestManager } from './core/RestManager.js';
export { GatewayManager } from './core/GatewayManager.js';
export { Logger } from './utils/Logger.js';
export { Collection } from './utils/Collection.js';
export { Permissions } from './utils/Permissions.js';
export { Snowflake } from './utils/Snowflake.js';
export { Message } from './structures/Message.js';
export { Interaction } from './structures/Interaction.js';
export { Guild } from './structures/Guild.js';
export { User } from './structures/User.js';
export { Channel } from './structures/Channel.js';

export { NYACommandHandler, NYAEventHandler, NYAComponentHandler, NYADeveloperMode } from './NYAHandlers/index.js';
export { NYACooldowns } from './NYACooldowns/index.js';
export { NYASecurity } from './NYASecurity/index.js';
export { NYASharding } from './NYASharding/index.js';
export { NYAEvents } from './NYAEvents/index.js';
export { NYAFlows } from './NYAFlows/index.js';
export { NYAFastMode } from './NYAFastMode/index.js';
export { NYAVFS } from './NYAVFS/index.js';
export { NYAMemory } from './NYAMemory/index.js';
export { NYALogger } from './NYALogger/index.js';
export { NYAPlugins } from './NYAPlugins/index.js';
export { NYAPanel } from './NYAPanel/index.js';
export { NYAMotor } from './NYAMotor/index.js';

export const Intents = {
    Guilds: 1 << 0,
    GuildMembers: 1 << 1,
    GuildBans: 1 << 2,
    GuildEmojisAndStickers: 1 << 3,
    GuildIntegrations: 1 << 4,
    GuildWebhooks: 1 << 5,
    GuildInvites: 1 << 6,
    GuildVoiceStates: 1 << 7,
    GuildPresences: 1 << 8,
    GuildMessages: 1 << 9,
    GuildMessageReactions: 1 << 10,
    GuildMessageTyping: 1 << 11,
    DirectMessages: 1 << 12,
    DirectMessageReactions: 1 << 13,
    DirectMessageTyping: 1 << 14,
    MessageContent: 1 << 15,
    GuildScheduledEvents: 1 << 16,
    AutoModerationConfiguration: 1 << 20,
    AutoModerationExecution: 1 << 21,

    All: (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) |
        (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9) | (1 << 10) | (1 << 11) |
        (1 << 12) | (1 << 13) | (1 << 14) | (1 << 15) | (1 << 16) | (1 << 20) | (1 << 21),

    Default: (1 << 0) | (1 << 9) | (1 << 15)
};

export const ButtonStyles = {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5
};

export const Colors = {
    Red: 0xFF0000,
    Green: 0x00FF00,
    Blue: 0x0000FF,
    White: 0xFFFFFF,
    Black: 0x000000,
    Yellow: 0xFFFF00,
    Cyan: 0x00FFFF,
    Magenta: 0xFF00FF,
    Orange: 0xFFA500,
    Purple: 0x800080,
    Pink: 0xFFC0CB,
    NyaPink: 0xFF69B4,
    Discord: 0x5865F2,
    Blurple: 0x5865F2,
    Grey: 0x808080,
    DarkGrey: 0x404040,
    LightGrey: 0xC0C0C0
};
