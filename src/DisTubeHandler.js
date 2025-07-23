
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { EmbedBuilder } = require('discord.js');

class DisTubeHandler {
    constructor(client) {
        this.distube = new DisTube(client, {
            emitNewSongOnly: true,
            emitAddSongWhenCreatingQueue: false,
            emitAddListWhenCreatingQueue: false,
            plugins: [new YtDlpPlugin({ cookies: 'cookies.txt' })],
        });

        this.client = client;
        this.queue = new Map();

        this.distube.on('playSong', (queue, song) => {
            const embed = new EmbedBuilder()
                .setColor(0x0099FF) // 파란색
                .setDescription(`🎶 ${song.name} 재생을 시작했어요.`)
                .addFields(
                    { name: '곡 길이', value: song.formattedDuration, inline: true },
                    { name: '음원', value: `[링크](${song.url})`, inline: true }
                )
                .setThumbnail(song.thumbnail)
                .setFooter({
                    text: song.user.tag,
                    iconURL: song.user.displayAvatarURL({ dynamic: true })
                });
            queue.textChannel.send({ embeds: [embed] });
        });

        this.distube.on('addSong', (queue, song) => {
            const queuePosition = queue.songs.indexOf(song);
            const queueStatus = queuePosition === 0 ? '바로 재생' : `#${queuePosition + 1}`;

            const embed = new EmbedBuilder()
                .setColor(0x0099FF) // 파란색
                .setDescription(`🎶 ${song.name}을(를) 재생 목록에 추가했어요.`)
                .addFields(
                    { name: '곡 길이', value: song.formattedDuration, inline: true },
                    { name: '대기열', value: queueStatus, inline: true },
                    { name: '음원', value: `[링크](${song.url})`, inline: true }
                )
                .setThumbnail(song.thumbnail)
                .setFooter({
                    text: song.user.tag,
                    iconURL: song.user.displayAvatarURL({ dynamic: true })
                });
            queue.textChannel.send({ embeds: [embed] });
        });


        this.distube.on('addList', (queue, playlist) => {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500) // 주황색
                .setTitle(`🎶 재생 목록 추가됨: ${playlist.name}`)
                .setDescription(`${playlist.songs.length}곡이 재생 목록에 추가되었습니다.`);
            queue.textChannel.send({ embeds: [embed] });
        });

        this.distube.on('error', (channel, error) => {
            console.error('DisTube 오류:', error);
            const embed = new EmbedBuilder()
                .setColor(0xFF0000) // 빨간색
                .setTitle('❌ 음악 재생 중 오류 발생')
                .setDescription(`오류 내용: ${error.message}`);
            channel.send({ embeds: [embed] });
        });

        this.distube.on('empty', queue => {
            const embed = new EmbedBuilder()
                .setColor(0x808080) // 회색
                .setTitle('음성 채널 비어있음')
                .setDescription('음성 채널에 아무도 없어 연결을 종료합니다.');
            queue.textChannel.send({ embeds: [embed] });
        });

        this.distube.on('finish', queue => {
            const embed = new EmbedBuilder()
                .setColor(0x0000FF) // 파란색
                .setTitle('재생 목록 종료')
                .setDescription('재생 목록이 끝났습니다.');
            queue.textChannel.send({ embeds: [embed] });
        });
    }

    async play(interaction) {
        const string = interaction.options.getString('url');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '음성 채널에 먼저 참여해주세요!', ephemeral: true });
        }

        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x0099FF).setDescription('음악을 재생 목록에 추가하고 있습니다...')] });

        try {
            await this.distube.play(voiceChannel, string, {
                member: interaction.member,
                textChannel: interaction.channel,
            });
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription('음악 재생 요청을 처리했습니다.')] });
        } catch (e) {
            console.error(e);
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('오류 발생').setDescription(`오류: ${e.message}`)] });
        }
    }

    async skip(interaction) {
        const queue = this.distube.getQueue(interaction);
        if (!queue) {
            return interaction.reply({ content: '재생 중인 음악이 없습니다.', ephemeral: true });
        }
        try {
            if (!queue.songs[1]) { // 다음 곡이 없으면
                await queue.stop();
                interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription('다음 곡이 없어 재생을 중지합니다.')] });
            } else {
                await queue.skip();
                interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription('현재 곡을 건너뛰었습니다.')] });
            }
        } catch (e) {
            interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('오류 발생').setDescription(`오류: ${e.message}`)] });
        }
    }

    async stop(interaction) {
        const queue = this.distube.getQueue(interaction);
        if (!queue) {
            return interaction.reply({ content: '재생 중인 음악이 없습니다.', ephemeral: true });
        }
        await queue.stop();
        interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription('음악 재생을 중지하고 음성 채널에서 나갑니다.')] });
    }

    async setVolume(interaction) {
        const newVolume = interaction.options.getInteger('level');
        const queue = this.distube.getQueue(interaction);

        if (!queue) {
            return interaction.reply({ content: '재생 중인 음악이 없습니다.', ephemeral: true });
        }

        if (newVolume < 0 || newVolume > 100) {
            return interaction.reply({ content: '볼륨은 0에서 100 사이로 설정해주세요.', ephemeral: true });
        }

        try {
            queue.setVolume(newVolume);
            interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(`볼륨을 ${newVolume}%로 설정했습니다.`)] });
        } catch (e) {
            console.error(e);
            interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('오류 발생').setDescription(`볼륨 설정 중 오류가 발생했습니다: ${e.message}`)] });
        }
    }

    async toggleBassBoost(interaction) {
        const queue = this.distube.getQueue(interaction);
        if (!queue) {
            return interaction.reply({ content: "현재 재생 중인 음악이 없습니다.", ephemeral: true });
        }

        try {
            const bassboostOn = queue.filters.has("bassboost");

            if (bassboostOn) {
                await queue.filters.remove("bassboost");
                interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(`베이스 부스트를 껐습니다.`)] });
            } else {
                await queue.filters.add("bassboost");
                interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`베이스 부스트를 켰습니다.`)] });
            }
        } catch (e) {
            console.error(e);
            interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('오류 발생').setDescription(`베이스 부스트 설정 중 오류가 발생했습니다: ${e.message}`)] });
        }
    }

    async toggleKaraoke(interaction) {
        const queue = this.distube.getQueue(interaction);
        if (!queue) {
            return interaction.reply({ content: "현재 재생 중인 음악이 없습니다.", ephemeral: true });
        }

        try {
            const karaokeOn = queue.filters.has("karaoke");

            if (karaokeOn) {
                await queue.filters.remove("karaoke");
                interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(`노래방 효과를 껐습니다.`)] });
            } else {
                await queue.filters.add("karaoke");
                interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`노래방 효과를 켰습니다.`)] });
            }
        } catch (e) {
            console.error(e);
            interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('오류 발생').setDescription(`노래방 효과 설정 중 오류가 발생했습니다: ${e.message}`)] });
        }
    }

    async playSong(message, songName) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('음성 채널에 먼저 참여해주세요!');
        }

        try {
            const searchQuery = `${songName} Topic`;
            const { stdout } = await execAsync(`yt-dlp "ytsearch:${searchQuery}" --get-id`);
            const videoId = stdout.trim();
            const url = `https://www.youtube.com/watch?v=${videoId}`;

            await this.distube.play(voiceChannel, url, {
                member: message.member,
                textChannel: message.channel,
            });
        } catch (e) {
            console.error(e);
            message.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('오류 발생').setDescription(`오류가 발생했습니다: ${e.message}`)] });
        }
    }

    async showQueue(interactionOrMessage) {
        const queue = this.distube.getQueue(interactionOrMessage);
        if (!queue) {
            const reply = interactionOrMessage.reply.bind(interactionOrMessage);
            return reply({ embeds: [new EmbedBuilder().setColor(0x808080).setDescription('재생 목록이 비어있습니다.')], ephemeral: true });
        }

        const songs = queue.songs.map((song, index) => {
            if (index === 0) {
                return `**[현재 재생 중]** ${song.name} - \`${song.formattedDuration}\``;
            }
            return `**${index}.** ${song.name} - \`${song.formattedDuration}\``;
        }).slice(0, 10).join('\n');

        const replyMethod = interactionOrMessage.reply.bind(interactionOrMessage) || interactionOrMessage.channel.send.bind(interactionOrMessage.channel);
        const queueEmbed = new EmbedBuilder()
            .setColor(0x00FFFF) // 청록색
            .setTitle('🎶 현재 재생 목록')
            .setDescription(songs || '재생 목록이 비어있습니다.');
        replyMethod({ embeds: [queueEmbed] });
    }
}

module.exports = DisTubeHandler;
