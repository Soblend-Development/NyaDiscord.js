import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/Logger.js';

export class NYAMotor {
    constructor(options = {}) {
        this.templatesDir = options.templatesDir || path.join(import.meta.url.replace('file:///', ''), '..', 'templates');
    }

    static templates = {
        bot: {
            name: 'Basic Bot',
            description: 'A simple Discord bot with commands',
            files: {
                'index.js': `import { NyaClient, Intents, Logger } from 'nyadiscord.js';

const client = new NyaClient({
    intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
    prefix: '!'
});

client.on('ready', () => {
    Logger.success(\`Logged in as \${client.user.tag}\`);
});

client.on('messageCreate', async (message) => {
    if (message.content === '!ping') {
        await message.nya.reply('Pong!');
    }
});

client.login(process.env.DISCORD_TOKEN);
`,
                'package.json': `{
  "name": "my-nya-bot",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "nyadiscord.js": "latest"
  }
}
`,
                '.env.example': `DISCORD_TOKEN=your_token_here
`
            }
        },

        music: {
            name: 'Music Bot',
            description: 'A Discord music bot with play, skip, stop commands',
            files: {
                'index.js': `import { NyaClient, Intents, Logger } from 'nyadiscord.js';

const client = new NyaClient({
    intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent | Intents.GuildVoiceStates,
    prefix: '!'
});

const queues = new Map();

client.on('ready', () => {
    Logger.success(\`Music Bot logged in as \${client.user.tag}\`);
});

client.addCommand('play', async (ctx) => {
    await ctx.message.nya.reply('Music functionality coming soon!');
});

client.addCommand('skip', async (ctx) => {
    await ctx.message.nya.reply('Skipping current track...');
});

client.addCommand('stop', async (ctx) => {
    await ctx.message.nya.reply('Stopping music...');
});

client.login(process.env.DISCORD_TOKEN);
`,
                'package.json': `{
  "name": "nya-music-bot",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "nyadiscord.js": "latest"
  }
}
`
            }
        },

        automod: {
            name: 'AutoMod Bot',
            description: 'A Discord moderation bot with automod features',
            files: {
                'index.js': `import { NyaClient, Intents, Logger } from 'nyadiscord.js';

const client = new NyaClient({
    intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent | Intents.GuildMembers,
    prefix: '!'
});

const badWords = ['spam', 'badword'];

client.on('ready', () => {
    Logger.success(\`AutoMod Bot logged in as \${client.user.tag}\`);
    client.security.enable();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();
    for (const word of badWords) {
        if (content.includes(word)) {
            await message.nya.delete();
            await message.nya.send(\`\${message.author}, watch your language!\`);
            return;
        }
    }
});

client.security.on('raidDetected', async (data) => {
    Logger.warn(\`Raid detected in guild \${data.guildId}\`);
});

client.security.on('spamDetected', async (data) => {
    Logger.warn(\`Spam detected from user \${data.userId}\`);
});

client.login(process.env.DISCORD_TOKEN);
`,
                'package.json': `{
  "name": "nya-automod-bot",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "nyadiscord.js": "latest"
  }
}
`
            }
        },

        dashboard: {
            name: 'Dashboard Bot',
            description: 'A Discord bot with web dashboard',
            files: {
                'index.js': `import { NyaClient, Intents, Logger } from 'nyadiscord.js';

const client = new NyaClient({
    intents: Intents.Guilds | Intents.GuildMessages,
    prefix: '!'
});

client.on('ready', () => {
    Logger.success(\`Dashboard Bot logged in as \${client.user.tag}\`);

    client.panel.start();
});

client.addCommand('stats', async (ctx) => {
    await ctx.message.nya.reply({
        embed: {
            title: 'Bot Statistics',
            fields: [
                { name: 'Guilds', value: String(client.guilds.size), inline: true },
                { name: 'Users', value: String(client.users.size), inline: true },
                { name: 'Uptime', value: \`\${Math.floor(client.uptime / 1000)}s\`, inline: true }
            ]
        }
    });
});

client.login(process.env.DISCORD_TOKEN);
`,
                'package.json': `{
  "name": "nya-dashboard-bot",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "nyadiscord.js": "latest"
  }
}
`
            }
        }
    };

    async generate(templateName, targetDir) {
        const template = NYAMotor.templates[templateName];
        if (!template) {
            throw new Error(`Template '${templateName}' not found. Available: ${Object.keys(NYAMotor.templates).join(', ')}`);
        }

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        for (const [filename, content] of Object.entries(template.files)) {
            const filePath = path.join(targetDir, filename);
            const dir = path.dirname(filePath);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, content);
            Logger.log(`Created: ${filename}`);
        }

        Logger.success(`Generated ${template.name} template in ${targetDir}`);
        return template;
    }

    listTemplates() {
        return Object.entries(NYAMotor.templates).map(([id, template]) => ({
            id,
            name: template.name,
            description: template.description
        }));
    }

    getTemplate(name) {
        return NYAMotor.templates[name];
    }

    addTemplate(name, template) {
        NYAMotor.templates[name] = template;
        return this;
    }
}
