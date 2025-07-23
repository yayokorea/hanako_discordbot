
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const config = require('../config');

const commands = [
    {
        name: 'play',
        description: '음악을 재생합니다.',
        options: [
            {
                name: 'url',
                type: 3,
                description: '유튜브 URL',
                required: true,
            },
        ],
    },
    {
        name: 'skip',
        description: '현재 재생 중인 음악을 건너뜁니다.',
    },
    {
        name: 'stop',
        description: '음악 재생을 중지하고 음성 채널에서 나갑니다.',
    },
    {
        name: 'tts',
        description: '텍스트를 음성으로 변환하여 말합니다.',
        options: [
            {
                name: 'text',
                type: 3,
                description: '음성으로 변환할 텍스트',
                required: true,
            },
        ],
    },
    {
        name: 'list',
        description: '현재 재생 목록을 표시합니다.',
    },
];

const registerCommands = async (client) => {
    const CLIENT_ID = client.user.id;
    const GUILD_ID = config.GUILD_ID;
    const rest = new REST({ version: '9' }).setToken(config.DISCORD_BOT_TOKEN);

    try {
        if (GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands },
            );
            console.log('Successfully registered application commands for development guild.');
        } else {
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands },
            );
            console.log('Successfully registered application commands globally.');
        }
    } catch (error) {
        console.error('Error registering commands:', error);
    }
};

module.exports = {
    commands,
    registerCommands,
};
