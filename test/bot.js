import { NyaClient, Intents, Colors, Logger } from '../source/index.js';

const client = new NyaClient({
    intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
    prefix: '!'
});

client.on('ready', (bot) => {
    Logger.success(`Logged in as ${bot.user.tag}`);

    client.setPresence({
        activities: [{ name: 'with NyaDiscord.js', type: 0 }],
        status: 'online'
    });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
        const start = Date.now();
        const reply = await message.nya.reply('Pinging...');
        const latency = Date.now() - start;
        await reply.nya.edit(`Pong! Latency: ${latency}ms`);
    }

    if (message.content === '!embed') {
        await message.nya.reply({
            embed: {
                title: 'NyaDiscord.js',
                description: 'The most advanced Discord library!',
                color: Colors.NyaPink,
                footer: 'Made with love',
                fields: [
                    { name: 'Speed', value: 'Ultra fast', inline: true },
                    { name: 'Features', value: 'Everything', inline: true }
                ]
            }
        });
    }

    if (message.content === '!buttons') {
        await message.nya.reply({
            content: 'Click a button!',
            buttons: [
                { label: 'Primary', id: 'btn_primary', style: 1 },
                { label: 'Success', id: 'btn_success', style: 3 },
                { label: 'Danger', id: 'btn_danger', style: 4 }
            ]
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.customId === 'btn_primary') {
        await interaction.nya.reply('You clicked Primary!', { ephemeral: true });
    }
    if (interaction.customId === 'btn_success') {
        await interaction.nya.reply('You clicked Success!', { ephemeral: true });
    }
    if (interaction.customId === 'btn_danger') {
        await interaction.nya.reply('You clicked Danger!', { ephemeral: true });
    }
});

client.addCommand('test', async (message, args) => {
    await message.nya.reply(`Test command executed with args: ${args.join(' ') || 'none'}`);
});

client.addCommand('db', async (message) => {
    await client.loadDatabase('./data');
    const users = client.db.collection('users');
    users.insertOne({ id: message.author.id, name: message.author.username });
    await client.db.save();
    await message.nya.reply('User saved to database!');
});

Logger.nya('Starting NyaDiscord.js test bot...');
client.login('YOUR_BOT_TOKEN_HERE');
