#!/usr/bin/env node

import { NYAMotor } from './source/NYAMotor/NYAMotor.js';
import { Logger } from './source/utils/Logger.js';
import path from 'path';

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];
const target = args[2] || './';

const motor = new NYAMotor();

async function main() {
    switch (command) {
        case 'new':
            if (!subcommand) {
                Logger.error('Usage: nyadiscord.js new <template>');
                Logger.log('Available templates:');
                motor.listTemplates().forEach(t => {
                    Logger.log(`  - ${t.id}: ${t.description}`);
                });
                process.exit(1);
            }
            try {
                await motor.generate(subcommand, path.resolve(target));
                Logger.success('Project created successfully!');
                Logger.log('Next steps:');
                Logger.log('  1. cd ' + target);
                Logger.log('  2. npm install');
                Logger.log('  3. Create .env file with your DISCORD_TOKEN');
                Logger.log('  4. npm start');
            } catch (error) {
                Logger.error(error.message);
                process.exit(1);
            }
            break;

        case 'templates':
            Logger.nya('Available templates:');
            motor.listTemplates().forEach(t => {
                Logger.log(`  ${t.id} - ${t.name}`);
                Logger.log(`    ${t.description}`);
            });
            break;

        case 'plugins':
            if (subcommand === 'install') {
                const packageName = args[2];
                if (!packageName) {
                    Logger.error('Usage: nyadiscord.js plugins install <package>');
                    process.exit(1);
                }
                Logger.log(`Installing plugin: ${packageName}...`);
                const { execSync } = await import('child_process');
                try {
                    execSync(`npm install ${packageName}`, { stdio: 'inherit' });
                    Logger.success(`Plugin ${packageName} installed!`);
                } catch {
                    Logger.error(`Failed to install ${packageName}`);
                }
            } else if (subcommand === 'list') {
                Logger.nya('Installed plugins:');
                Logger.log('  (Check your plugins directory)');
            } else {
                Logger.error('Usage: nyadiscord.js plugins <install|list> [package]');
            }
            break;

        case 'help':
        case '--help':
        case '-h':
            Logger.nya('NyaDiscord.js CLI');
            Logger.log('');
            Logger.log('Commands:');
            Logger.log('  new <template> [dir]    Create a new project from template');
            Logger.log('  templates               List available templates');
            Logger.log('  plugins install <name>  Install a plugin');
            Logger.log('  plugins list            List installed plugins');
            Logger.log('  help                    Show this help message');
            Logger.log('');
            Logger.log('Examples:');
            Logger.log('  nyadiscord.js new bot ./my-bot');
            Logger.log('  nyadiscord.js new music');
            Logger.log('  nyadiscord.js new automod');
            Logger.log('  nyadiscord.js new dashboard');
            break;

        case 'version':
        case '--version':
        case '-v':
            Logger.nya('NyaDiscord.js v1.0.0');
            break;

        default:
            Logger.error('Unknown command. Use --help for usage.');
            process.exit(1);
    }
}

main().catch(error => {
    Logger.error(error.message);
    process.exit(1);
});
