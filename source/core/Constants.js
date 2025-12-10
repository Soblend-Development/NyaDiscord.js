export const Constants = {
  BaseURL: 'https://discord.com/api/v10',
  GatewayURL: 'wss://gateway.discord.gg/?v=10&encoding=json',
  UserAgent: 'DiscordBot (NyaDiscord.js, 1.0.0)',

  Opcodes: {
    Dispatch: 0,
    Heartbeat: 1,
    Identify: 2,
    PresenceUpdate: 3,
    VoiceStateUpdate: 4,
    Resume: 6,
    Reconnect: 7,
    RequestGuildMembers: 8,
    InvalidSession: 9,
    Hello: 10,
    HeartbeatAck: 11
  },

  Intents: {
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
    AutoModerationExecution: 1 << 21
  },

  Colors: {
    Red: 0xFF0000,
    Green: 0x00FF00,
    Blue: 0x0000FF,
    White: 0xFFFFFF,
    Black: 0x000000,
    Yellow: 0xFFFF00,
    NyaPink: 0xFF69B4
  },

  Events: {
    Ready: 'READY',
    Resumed: 'RESUMED',
    MessageCreate: 'MESSAGE_CREATE',
    MessageUpdate: 'MESSAGE_UPDATE',
    MessageDelete: 'MESSAGE_DELETE',
    GuildCreate: 'GUILD_CREATE',
    GuildUpdate: 'GUILD_UPDATE',
    GuildDelete: 'GUILD_DELETE',
    GuildMemberAdd: 'GUILD_MEMBER_ADD',
    GuildMemberRemove: 'GUILD_MEMBER_REMOVE',
    GuildMemberUpdate: 'GUILD_MEMBER_UPDATE',
    InteractionCreate: 'INTERACTION_CREATE',
    ChannelCreate: 'CHANNEL_CREATE',
    ChannelUpdate: 'CHANNEL_UPDATE',
    ChannelDelete: 'CHANNEL_DELETE',
    TypingStart: 'TYPING_START',
    PresenceUpdate: 'PRESENCE_UPDATE',
    VoiceStateUpdate: 'VOICE_STATE_UPDATE'
  },

  ButtonStyles: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5
  },

  ComponentTypes: {
    ActionRow: 1,
    Button: 2,
    StringSelect: 3,
    TextInput: 4,
    UserSelect: 5,
    RoleSelect: 6,
    MentionableSelect: 7,
    ChannelSelect: 8
  },

  InteractionTypes: {
    Ping: 1,
    ApplicationCommand: 2,
    MessageComponent: 3,
    ApplicationCommandAutocomplete: 4,
    ModalSubmit: 5
  },

  InteractionResponseTypes: {
    Pong: 1,
    ChannelMessageWithSource: 4,
    DeferredChannelMessageWithSource: 5,
    DeferredUpdateMessage: 6,
    UpdateMessage: 7,
    ApplicationCommandAutocompleteResult: 8,
    Modal: 9
  }
};
