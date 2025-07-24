
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
            console.log(`[${new Date().toLocaleString('ko-KR')}] ${song.user.tag}님이 '${song.name}'을(를) 재생했습니다.`);
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

        if (!voiceChannel) {
            console.error("음성 채널 정보를 찾을 수 없습니다.");
            return interaction.reply({ content: '오류: 음성 채널 정보를 찾을 수 없습니다. 다시 시도해주세요.', ephemeral: true });
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
            const command = `yt-dlp "ytsearch:${searchQuery}" --get-id`;
            console.log(`[${new Date().toLocaleString('ko-KR')}] Executing command: ${command}`);
            const { stdout } = await execAsync(command);
            const videoId = stdout.trim();
            console.log(`[${new Date().toLocaleString('ko-KR')}] yt-dlp stdout (videoId): '${videoId}'`);

            if (!videoId) {
                console.error(`[${new Date().toLocaleString('ko-KR')}] yt-dlp failed to get video ID for "${songName}"`);
                return message.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('오류 발생').setDescription(`'${songName}'에 대한 영상을 찾지 못했습니다.`)] });
            }

            const url = `https://www.youtube.com/watch?v=${videoId}`;
            console.log(`[${new Date().toLocaleString('ko-KR')}] Constructed URL: ${url}`);

            console.log(`[${new Date().toLocaleString('ko-KR')}] Calling distube.play...`);
            await this.distube.play(voiceChannel, url, {
                member: message.member,
                textChannel: message.channel,
            });
            console.log(`[${new Date().toLocaleString('ko-KR')}] distube.play call succeeded.`);
        } catch (e) {
            console.error(`[${new Date().toLocaleString('ko-KR')}] Error in playSong function:`, e);
            message.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('오류 발생').setDescription(`오류가 발생했습니다: ${e.message}`)] });
        }
    }

    async playUrlFromMessage(message, url) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('음성 채널에 먼저 참여해주세요!');
        }

        try {
            await this.distube.play(voiceChannel, url, {
                member: message.member,
                textChannel: message.channel,
            });
        } catch (e) {
            console.error(e);
            message.reply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('오류 발생').setDescription(`오류가 발생했습니다: ${e.message}`)] });
        }
    }

    async showQueue(interactionOrMessage, page = 0, statusMessage = null) {
        const queue = this.distube.getQueue(interactionOrMessage);
        if (!queue) {
            const reply = interactionOrMessage.reply.bind(interactionOrMessage);
            return reply({ embeds: [new EmbedBuilder().setColor(0x808080).setDescription('재생 목록이 비어있습니다.')], ephemeral: true });
        }

        const songsPerPage = 5;
        const totalPages = Math.ceil(queue.songs.length / songsPerPage);
        const start = page * songsPerPage;
        const end = start + songsPerPage;

        const songs = queue.songs.slice(start, end).map((song, index) => {
            const songIndex = start + index;
            if (songIndex === 0) {
                return `**[현재 재생 중]** ${song.name} - \`${song.formattedDuration}\``;
            }
            return `**${songIndex}.** ${song.name} - \`${song.formattedDuration}\``;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x00FFFF) // 청록색
            .setTitle('🎶 현재 재생 목록')
            .setDescription((statusMessage ? `${statusMessage}\n\n` : '') + (songs || '재생 목록이 비어있습니다.'))
            .setFooter({ text: `페이지 ${page + 1}/${totalPages}` });

        const components = [];
        const songButtons = queue.songs.slice(start, end).map((song, index) => {
            const songIndex = start + index;
            if (songIndex > 0) { // 현재 재생 중인 곡은 삭제 버튼 표시 안 함
                return new ButtonBuilder()
                    .setCustomId(`remove_song_${songIndex}`)
                    .setLabel(`${songIndex}번 곡 삭제`)
                    .setStyle(ButtonStyle.Danger);
            }
            return null;
        }).filter(button => button !== null);

        if (songButtons.length > 0) {
            components.push(new ActionRowBuilder().addComponents(songButtons));
        }

        const pageButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`queue_page_${page - 1}`)
                    .setLabel('이전')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`queue_page_${page + 1}`)
                    .setLabel('다음')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page >= totalPages - 1),
            );
        components.push(pageButtons);

        if (interactionOrMessage.isCommand && interactionOrMessage.isCommand()) {
            // It's a command interaction (first time showing queue)
            await interactionOrMessage.reply({ embeds: [embed], components: components });
        } else if (interactionOrMessage.isButton && interactionOrMessage.isButton()) {
            // It's a button interaction (page navigation or initial queue display from button)
            await interactionOrMessage.update({ embeds: [embed], components: components });
        } else if (interactionOrMessage.editable) { // Check if it's an editable message
            // It's an existing message object that can be edited
            await interactionOrMessage.edit({ embeds: [embed], components: components });
        } else if (interactionOrMessage.channel) {
            // It's a message object (e.g., from a message command) that needs a new reply
            await interactionOrMessage.channel.send({ embeds: [embed], components: components });
        }
    }
}

module.exports = DisTubeHandler;
