
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

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
            queue.textChannel.send(`🎶 **${song.name}** (${song.formattedDuration}) 재생 시작!\n요청: ${song.user}`);
        });

        this.distube.on('addSong', (queue, song) => {
            queue.textChannel.send(`🎶 **${song.name}** (${song.formattedDuration})이(가) 재생 목록에 추가되었습니다.\n요청: ${song.user}`);
        });

        this.distube.on('addList', (queue, playlist) => {
            queue.textChannel.send(`🎶 재생 목록 **${playlist.name}** (${playlist.songs.length}곡)이(가) 추가되었습니다.`);
        });

        this.distube.on('error', (channel, error) => {
            console.error('DisTube 오류:', error);
            channel.send('음악 재생 중 오류가 발생했습니다.');
        });

        this.distube.on('empty', queue => {
            queue.textChannel.send('음성 채널에 아무도 없어 연결을 종료합니다.');
        });

        this.distube.on('finish', queue => {
            queue.textChannel.send('재생 목록이 끝났습니다.');
        });
    }

    async play(interaction) {
        const string = interaction.options.getString('url');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '음성 채널에 먼저 참여해주세요!', ephemeral: true });
        }

        await interaction.reply('음악을 재생 목록에 추가하고 있습니다...');

        try {
            await this.distube.play(voiceChannel, string, {
                member: interaction.member,
                textChannel: interaction.channel,
            });
            interaction.editReply('음악 재생 요청을 처리했습니다.');
        } catch (e) {
            console.error(e);
            interaction.editReply(`오류: ${e.message}`);
        }
    }

    async skip(interaction) {
        const queue = this.distube.getQueue(interaction);
        if (!queue) {
            return interaction.reply({ content: '재생 중인 음악이 없습니다.', ephemeral: true });
        }
        try {
            await queue.skip();
            interaction.reply('현재 곡을 건너뛰었습니다.');
        } catch (e) {
            interaction.reply(`오류: ${e.message}`);
        }
    }

    async stop(interaction) {
        const queue = this.distube.getQueue(interaction);
        if (!queue) {
            return interaction.reply({ content: '재생 중인 음악이 없습니다.', ephemeral: true });
        }
        await queue.stop();
        interaction.reply('음악 재생을 중지하고 음성 채널에서 나갑니다.');
    }

    async playSong(message, songName) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('음성 채널에 먼저 참여해주세요!');
        }

        try {
            const searchQuery = `${songName} Topic`;
            const { stdout } = await execAsync(`yt-dlp "ytsearch:${searchQuery}" --dump-json`);
            const videoInfo = JSON.parse(stdout);
            const url = videoInfo.webpage_url;

            await this.distube.play(voiceChannel, url, {
                member: message.member,
                textChannel: message.channel,
            });
        } catch (e) {
            console.error(e);
            message.reply(`오류가 발생했습니다: ${e.message}`);
        }
    }

    async showQueue(interactionOrMessage) {
        const queue = this.distube.getQueue(interactionOrMessage);
        if (!queue) {
            const reply = interactionOrMessage.reply.bind(interactionOrMessage);
            return reply({ content: '재생 목록이 비어있습니다.', ephemeral: true });
        }

        const songs = queue.songs.map((song, index) => {
            if (index === 0) {
                return `**[현재 재생 중]** ${song.name} - \`${song.formattedDuration}\``;
            }
            return `**${index}.** ${song.name} - \`${song.formattedDuration}\``;
        }).slice(0, 10).join('\n');

        const replyMethod = interactionOrMessage.reply.bind(interactionOrMessage) || interactionOrMessage.channel.send.bind(interactionOrMessage.channel);
        replyMethod(`**재생 목록**\n${songs}`);
    }
}

module.exports = DisTubeHandler;
