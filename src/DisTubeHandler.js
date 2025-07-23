
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

class DisTubeHandler {
    constructor(client) {
        this.distube = new DisTube(client, {
            emitNewSongOnly: true,
            emitAddSongWhenCreatingQueue: false,
            emitAddListWhenCreatingQueue: false,
            plugins: [new YtDlpPlugin()],
        });

        this.client = client;
        this.queue = new Map();

        this.distube.on('playSong', (queue, song) => {
            queue.textChannel.send(`🎶 | 재생 시작: **${song.name}** - \`${song.formattedDuration}\`
요청: ${song.user}`);
        });

        this.distube.on('addSong', (queue, song) => {
            queue.textChannel.send(`🎶 | 큐에 추가됨: **${song.name}** - ${song.formattedDuration}
요청: ${song.user}`);
        });

        this.distube.on('addList', (queue, playlist) => {
            queue.textChannel.send(`🎶 | 재생 목록 추가됨: **${playlist.name}** (${playlist.songs.length} 곡)`);
        });

        this.distube.on('error', (channel, error) => {
            console.error('DisTube 오류:', error);
            channel.send('오류가 발생했습니다.');
        });

        this.distube.on('empty', queue => {
            queue.textChannel.send('음성 채널이 비어있어 채널을 나갑니다.');
        });

        this.distube.on('finish', queue => {
            queue.textChannel.send('재생 목록이 비어있습니다.');
        });
    }

    async play(interaction) {
        const string = interaction.options.getString('url');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '음성 채널에 먼저 참여해주세요!', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            await this.distube.play(voiceChannel, string, {
                member: interaction.member,
                textChannel: interaction.channel,
            });
            interaction.editReply('요청을 처리했습니다.');
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
            interaction.reply('음악을 건너뛰었습니다.');
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
}

module.exports = DisTubeHandler;
