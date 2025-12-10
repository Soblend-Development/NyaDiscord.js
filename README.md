# NyaDiscord.js 🐱

A high-performance, superior Discord library built from scratch with advanced features.

## Installation

```bash
npm install nyadiscord.js
```

## Quick Start

```javascript
import { NyaClient, Intents, Colors, Logger } from 'nyadiscord.js';

const client = new NyaClient({
    intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
    prefix: '!'
});

client.on('ready', (bot) => {
    Logger.success(`Logged in as ${bot.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.content === '!ping') {
        await message.nya.reply('Pong!');
    }
});

client.login('YOUR_BOT_TOKEN');
```

## Features

- **Custom WebSocket Engine**: Built-in heartbeating, reconnection, and resume logic
- **Advanced REST Manager**: Automatic ratelimit handling with per-route queuing
- **Database Integration**: Built-in `@imjxsx/localdb` support
- **Environment Loading**: Built-in `@imjxsx/envy` support
- **Nya Helpers**: Easy-to-use `nya.reply()`, `nya.buttons()`, `nya.embed()`, `nya.modal()`

## API Reference

### NyaClient

```javascript
const client = new NyaClient({
    token: 'BOT_TOKEN',
    intents: Intents.All,
    prefix: '!',
    owners: ['USER_ID']
});

await client.loadEnv('./.env');
await client.loadDatabase('./data');
client.login();
```

### Message Helpers

```javascript
message.nya.reply('Hello!');
message.nya.reply({
    embed: {
        title: 'Title',
        description: 'Description',
        color: Colors.NyaPink
    }
});
message.nya.reply({
    content: 'Click!',
    buttons: [
        { label: 'Click Me', id: 'btn_click', style: 1 }
    ]
});
```

### Interaction Helpers

```javascript
interaction.nya.reply('Response!');
interaction.nya.defer();
interaction.nya.editReply('Updated!');
interaction.nya.modal({
    id: 'my_modal',
    title: 'My Modal',
    fields: [
        { id: 'input', label: 'Input', placeholder: 'Type here...' }
    ]
});
```

### Intents

```javascript
Intents.Guilds
Intents.GuildMessages
Intents.MessageContent
Intents.GuildMembers
Intents.All
Intents.Default
```

### Colors

```javascript
Colors.Red
Colors.Green
Colors.Blue
Colors.NyaPink
Colors.Discord
Colors.Blurple
```

### Button Styles

```javascript
ButtonStyles.Primary
ButtonStyles.Secondary
ButtonStyles.Success
ButtonStyles.Danger
ButtonStyles.Link
```

## Database

```javascript
await client.loadDatabase('./data');
const users = client.db.collection('users');

users.insertOne({ name: 'User', level: 1 });
users.findOne({ name: 'User' });
users.updateOne({ name: 'User' }, { level: 2 });
users.deleteOne({ name: 'User' });

await client.db.save();
```

## Environment Variables

```javascript
await client.loadEnv('./.env');
const token = client.env.get('TOKEN', 'string', 'default');
const port = client.env.get('PORT', 'number', 3000);
const debug = client.env.get('DEBUG', 'boolean', false);
```

## License

ISC
