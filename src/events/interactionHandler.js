const { AudioPlayerStatus } = require('@discordjs/voice');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const gtts = require('gtts');
const config = require('../../config');
const { getChat, generateResponse } = require('../gemini');
const { sendLongMessage } = require('../utils/messageSender');

async function handleInteractionCreate(interaction, distubeHandler) {
    if (interaction.isButton()) {
        console.log(`[${new Date().toLocaleString('ko-KR')}] Button interaction detected. Custom ID: ${interaction.customId}`);
        const [action, ...args] = interaction.customId.split('_');
        console.log(`[${new Date().toLocaleString('ko-KR')}] Parsed action: ${action}, args: ${JSON.stringify(args)}`);

        if (action === 'queue') {
            const page = parseInt(args[1], 10);
            await distubeHandler.showQueue(interaction, page);
        } else if (action === 'select' && args[0] === 'song') {
            console.log(`[${new Date().toLocaleString('ko-KR')}] Attempting to defer update for select_song.`);
            await interaction.deferUpdate();
            console.log(`[${new Date().toLocaleString('ko-KR')}] Defer update successful for select_song.`);
            const videoId = args[1];
            console.log(`[${new Date().toLocaleString('ko-KR')}] select_song 버튼 클릭: videoId=${videoId}`);
            const url = `https://www.youtube.com/watch?v=${videoId}`;

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                console.log(`[${new Date().toLocaleString('ko-KR')}] 음성 채널에 없음.`);
                return interaction.followUp({ content: '음성 채널에 먼저 참여해주세요!', ephemeral: true });
            }

            try {
                console.log(`[${new Date().toLocaleString('ko-KR')}] distube.play 호출 시도: url=${url}`);
                await distubeHandler.distube.play(voiceChannel, url, {
                    member: interaction.member,
                    textChannel: interaction.channel,
                });
                console.log(`[${new Date().toLocaleString('ko-KR')}] distube.play 성공.`);
                await interaction.followUp({ content: `선택하신 곡이 재생 목록에 추가되었습니다.`, ephemeral: true });
                console.log(`[${new Date().toLocaleString('ko-KR')}] followUp 메시지 전송 성공.`);
                // await interaction.message.delete(); // 검색 결과 메시지 삭제 (디버깅을 위해 임시 주석 처리)
            } catch (e) {
                console.error(`[${new Date().toLocaleString('ko-KR')}] Error playing selected song:`, e);
                await interaction.followUp({ content: `선택한 곡을 재생하는 중 오류가 발생했습니다: ${e.message}`, ephemeral: true });
            }
        } else if (action === 'remove') {
            await interaction.deferUpdate(); // 상호작용을 지연시킵니다.
            const songIndex = parseInt(args[1], 10);
            const queue = distubeHandler.distube.getQueue(interaction);
            if (queue && queue.songs[songIndex]) {
                const removedSong = queue.songs.splice(songIndex, 1)[0];
                await interaction.followUp({ content: `**${removedSong.name}**을(를) 재생 목록에서 삭제했습니다.`, ephemeral: true });
                // 기존 재생 목록 메시지를 업데이트합니다.
                await distubeHandler.showQueue(interaction.message, 0, `**${removedSong.name}**을(를) 재생 목록에서 삭제했습니다.`); // 0페이지로 이동하여 업데이트
            } else {
                await interaction.followUp({ content: '해당 곡을 찾을 수 없거나 이미 삭제되었습니다.', ephemeral: true });
            }
        }
        return;
    }

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

        const user = { id: interaction.user.id, username: interaction.member.displayName };

        const chat = getChat(interaction.channel.id);

        try {
            await interaction.deferReply();

            const geminiResult = await generateResponse(chat, prompt, user);

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
