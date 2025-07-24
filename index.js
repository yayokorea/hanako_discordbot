const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const config = require('./config');
const { registerCommands } = require('./src/commands');
const DisTubeHandler = require('./src/DisTubeHandler');
const { handleInteractionCreate } = require('./src/events/interactionHandler');
const { handleMessageCreate } = require('./src/events/messageHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const distubeHandler = new DisTubeHandler(client);

client.once('ready', async () => {
    console.log(`${client.user.tag}으로 로그인했습니다!`);
    await registerCommands(client);
});

client.on('interactionCreate', async interaction => {
    await handleInteractionCreate(interaction, distubeHandler);
});

client.on('messageCreate', async message => {
    await handleMessageCreate(message, client, distubeHandler);
});

process.on('uncaughtException', error => {
    console.error('처리되지 않은 예외가 발생했습니다:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('처리되지 않은 프로미스 거부가 발생했습니다:', reason);
});

client.login(config.DISCORD_BOT_TOKEN);