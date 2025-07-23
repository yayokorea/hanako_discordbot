const { AudioPlayerStatus } = require('@discordjs/voice');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const gtts = require('gtts');
const config = require('../../config');
const { getChat, generateResponse } = require('../gemini');
const { sendLongMessage } = require('../utils/messageSender');

async function handleInteractionCreate(interaction, distubeHandler) {
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
    } else if (commandName === 'volume') {
        await distubeHandler.setVolume(interaction);
    } else if (commandName === 'bassboost') {
        await distubeHandler.toggleBassBoost(interaction);
    } else if (commandName === 'karaoke') {
        await distubeHandler.toggleKaraoke(interaction);
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

            const geminiResult = await generateResponse(chat, prompt);

            const outputPath = `./temp_tts_${guildId}.mp3`;
            const gttsInstance = new gtts(geminiResult.response, 'ko');

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

            await sendLongMessage(interaction, geminiResult.response);
        } catch (error) {
            console.error('Gemini 콘텐츠 생성 또는 TTS 처리 중 오류가 발생했습니다:', error);
            await interaction.followUp('죄송합니다. 요청을 처리하는 중 오류가 발생했습니다.');
        }
    }
}

module.exports = { handleInteractionCreate };
