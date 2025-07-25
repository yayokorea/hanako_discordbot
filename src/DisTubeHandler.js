
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

    async handleMusicSearchAndSelection(interactionOrMessage, query, voiceChannel, member, textChannel) {
        const command = `yt-dlp "ytsearch3:${query}" --get-id`;
        console.log(`[${new Date().toLocaleString('ko-KR')}] Executing command: ${command}`);
        const { stdout, stderr } = await execAsync(command);

        if (stderr) {
            console.error(`[${new Date().toLocaleString('ko-KR')}] yt-dlp stderr: ${stderr}`);
        }

        const videoIds = stdout.trim().split('\n').filter(id => id.length > 0);
        console.log(`[${new Date().toLocaleString('ko-KR')}] Found video IDs: ${videoIds.join(', ')}`);

        const videoPromises = videoIds.map(async (id) => {
            try {
                const { stdout: videoInfoStdout } = await execAsync(`yt-dlp --get-title --get-thumbnail https://www.youtube.com/watch?v=${id}`);
                const [title, thumbnail] = videoInfoStdout.trim().split('\n');
                console.log(`[${new Date().toLocaleString('ko-KR')}] Fetched info for ID ${id}: Title="${title}", Thumbnail="${thumbnail}"`);
                return { id, title, thumbnail };
            } catch (e) {
                console.error(`[${new Date().toLocaleString('ko-KR')}] Failed to get info for video ID ${id}, Error: ${e.message}`);
                return null;
            }
        });

        const videos = (await Promise.all(videoPromises)).filter(Boolean);

        if (videos.length === 0) {
            if (interactionOrMessage.editReply) {
                await interactionOrMessage.editReply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`'${query}'에 대한 검색 결과를 찾지 못했습니다.`)] });
            } else {
                await interactionOrMessage.channel.send({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`'${query}'에 대한 검색 결과를 찾지 못했습니다.`)] });
            }
            return;
        }

        const embeds = videos.map((video, index) => {
            return new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${index + 1}. ${video.title}`)
                .setURL(`https://www.youtube.com/watch?v=${video.id}`)
                .setThumbnail(video.thumbnail)
                .addFields(
                    { name: 'ID', value: video.id, inline: true }
                );
        });

        const buttons = new ActionRowBuilder()
            .addComponents(
                videos.map((video, index) =>
                    new ButtonBuilder()
                        .setCustomId(`select_song_${video.id}`)
                        .setLabel(`${index + 1}번 선택`)
                        .setStyle(ButtonStyle.Primary)
                )
            );

        if (interactionOrMessage.editReply) {
            await interactionOrMessage.editReply({
                content: `'${query}'에 대한 검색 결과입니다. 재생할 곡을 선택해주세요.`,
                embeds: embeds,
                components: [buttons],
            });
        } else {
            await interactionOrMessage.channel.send({
                content: `'${query}'에 대한 검색 결과입니다. 재생할 곡을 선택해주세요.`,
                embeds: embeds,
                components: [buttons],
            });
        }
    }

    async play(interaction) {
        const url = interaction.options.getString('url');
        const query = interaction.options.getString('query');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '음성 채널에 먼저 참여해주세요!', ephemeral: true });
        }

        if (!url && !query) {
            return interaction.reply({ content: '재생할 음악의 URL 또는 검색어를 입력해주세요.', ephemeral: true });
        }

        await interaction.deferReply(); // 응답을 지연시켜 봇이 생각할 시간을 줍니다.

        try {
            if (url) {
                await this.distube.play(voiceChannel, url, {
                    member: interaction.member,
                    textChannel: interaction.channel,
                });
                await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription('음악 재생 요청을 처리했습니다.')] });
            } else if (query) {
                await this.handleMusicSearchAndSelection(interaction, query, voiceChannel, interaction.member, interaction.channel);
            }
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

        await message.channel.sendTyping(); // 입력 중 표시
        await this.handleMusicSearchAndSelection(message, songName, voiceChannel, message.member, message.channel);
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
