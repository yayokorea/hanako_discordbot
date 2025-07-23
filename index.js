
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
require('dotenv').config();
const config = require('./config');
const { registerCommands } = require('./src/commands');
const DisTubeHandler = require('./src/DisTubeHandler');
const { getChat, generateResponse } = require('./src/gemini');
const gtts = require('gtts');
const fs = require('fs');

async function sendLongMessage(interactionOrMessage, text) {
    const replyMethod = interactionOrMessage.reply.bind(interactionOrMessage) || interactionOrMessage.followUp.bind(interactionOrMessage);
    if (text.length <= config.MAX_MESSAGE_LENGTH) {
        await replyMethod(text);
    } else {
        let currentMessage = '';
        const words = text.split(' ');
        for (const word of words) {
            if (currentMessage.length + word.length + 1 > config.MAX_MESSAGE_LENGTH) {
                await replyMethod(currentMessage);
                currentMessage = word + ' ';
            } else {
                currentMessage += word + ' ';
            }
        }
        if (currentMessage.length > 0) {
            await replyMethod(currentMessage);
        }
    }
}

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
    if (!interaction.isCommand()) return;

    const { commandName, options, guildId, member, channel } = interaction;

    if (commandName === 'play') {
        await distubeHandler.play(interaction);
    } else if (commandName === 'skip') {
        await distubeHandler.skip(interaction);
    } else if (commandName === 'stop') {
        await distubeHandler.stop(interaction);
    } else if (commandName === 'list') {
        await distubeHandler.showQueue(interaction);
    } else if (commandName === 'tts') {
        const prompt = options.getString('text');
        if (!prompt) {
            return interaction.reply('음성으로 변환할 텍스트를 입력해주세요.');
        }

        if (!member.voice.channel) {
            return interaction.reply('음성 채널에 먼저 참여해주세요!');
        }

        const chat = getChat(interaction.channel.id);

        try {
            await interaction.deferReply();

            const text = await generateResponse(chat, prompt);

            const outputPath = `./temp_tts_${guildId}.mp3`;
            const gttsInstance = new gtts(text, 'ko');

            await new Promise((resolve, reject) => {
                gttsInstance.save(outputPath, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });

            const connection = joinVoiceChannel({
                channelId: member.voice.channel.id,
                guildId: guildId,
                adapterCreator: member.voice.channel.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(outputPath);

            player.play(resource);
            connection.subscribe(player);

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
                // 임시 파일 삭제
                fs.unlink(outputPath, err => {
                    if (err && err.code !== 'ENOENT') {
                        console.error('임시 TTS 파일 삭제 오류:', err);
                    }
                });
            });

            await sendLongMessage(interaction, text);
        } catch (error) {
            console.error('Gemini 콘텐츠 생성 또는 TTS 처리 중 오류가 발생했습니다:', error);
            await interaction.followUp('죄송합니다. 요청을 처리하는 중 오류가 발생했습니다.');
        }
    }
});



client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const botMention = `<@${client.user.id}>`;
    let prompt = message.content;

    const isMentioned = message.mentions.users.has(client.user.id);
    let matchedKeyword = null;
    for (const keyword of config.BOT_KEYWORDS) {
        if (prompt.toLowerCase().startsWith(keyword.toLowerCase())) {
            matchedKeyword = keyword;
            break;
        }
    }

    if (!isMentioned && !matchedKeyword) return;

    let fullPrompt = prompt;
    if (isMentioned) {
        prompt = prompt.replace(botMention, '').trim();
    } else if (matchedKeyword) {
        prompt = prompt.substring(matchedKeyword.length).trim();
    }

    if (prompt.length === 0) {
        return message.reply('무엇을 도와드릴까요?');
    }

    try {
        const chat = getChat(message.channel.id);
        const geminiResponse = await generateResponse(chat, prompt);

        if (geminiResponse.intent === 'play_music' && geminiResponse.song) {
            await distubeHandler.playSong(message, geminiResponse.song);
        } else if (geminiResponse.intent === 'stop_music') {
            await distubeHandler.stop({ 
                guild: message.guild,
                reply: (msg) => message.reply(msg),
                distube: distubeHandler.distube 
            });
        } else if (geminiResponse.intent === 'skip_song') {
            await distubeHandler.skip({ 
                guild: message.guild,
                reply: (msg) => message.reply(msg),
                distube: distubeHandler.distube 
            });
        } else if (geminiResponse.intent === 'show_queue') {
            await distubeHandler.showQueue(message);
        } else {
            await sendLongMessage(message, geminiResponse.response);
        }
    } catch (error) {
        console.error('Gemini 콘텐츠 생성 또는 메시지 처리 중 오류가 발생했습니다:', error);
        await message.reply('죄송합니다. 요청을 처리하는 중 오류가 발생했습니다.');
    }
});

client.login(config.DISCORD_BOT_TOKEN);
