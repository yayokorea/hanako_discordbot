const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const player = createAudioPlayer();
const queue = new Map();

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
];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

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
});

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-06-17"});
const chats = new Map();


client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options, guildId, member, channel } = interaction;

    if (!member.voice.channel) {
        return interaction.reply('음성 채널에 먼저 참여해주세요!');
    }

    let serverQueue = queue.get(guildId);

    if (commandName === 'play') {
        const url = options.getString('url');

        if (!url) {
            return interaction.reply('재생할 URL을 입력해주세요.');
        }

        if (!ytdl.validateURL(url)) {
            return interaction.reply('유효하지 않은 유튜브 URL입니다. 올바른 URL을 입력해주세요.');
        }

        let songInfo;
        try {
            songInfo = await ytdl.getInfo(url);
        } catch (error) {
            console.error('유튜브 비디오 정보 가져오기 오류:', error);
            return interaction.reply('유튜브 비디오 정보를 가져올 수 없습니다. URL을 확인하거나 비공개/삭제된 비디오인지 확인해주세요.');
        }

        const song = {
            url: url,
            title: songInfo.videoDetails.title,
        };

        if (!serverQueue) {
            const queueContruct = {
                textChannel: channel,
                voiceChannel: member.voice.channel,
                connection: null,
                songs: [],
                volume: 0.5,
                playing: true,
            };

            queue.set(guildId, queueContruct);
            queueContruct.songs.push(song);

            try {
                const connection = joinVoiceChannel({
                    channelId: member.voice.channel.id,
                    guildId: member.voice.channel.guild.id,
                    adapterCreator: member.voice.channel.guild.voiceAdapterCreator,
                });
                queueContruct.connection = connection;
                connection.subscribe(player);

                play(guildId, queueContruct.songs[0]);
                interaction.reply(`재생 시작: ${url}`);
            } catch (error) {
                console.error('음성 채널 연결 오류:', error);
                queue.delete(guildId);
                await interaction.reply('음성 채널에 연결할 수 없습니다.');
            }
        } else {
            serverQueue.songs.push(song);
            return interaction.reply(`큐에 추가됨: ${url}`);
        }
    } else if (commandName === 'skip') {
        if (!serverQueue) {
            return interaction.reply('재생 중인 음악이 없습니다.');
        }
        player.stop();
        interaction.reply('음악을 건너뛰었습니다.');
    } else if (commandName === 'stop') {
        if (!serverQueue) {
            return interaction.reply('재생 중인 음악이 없습니다.');
        }
        serverQueue.songs = [];
        player.stop();
        serverQueue.connection.destroy();
        queue.delete(guildId);
        interaction.reply('음악 재생을 중지하고 음성 채널에서 나갔습니다.');
    } else if (commandName === 'tts') {
        const prompt = options.getString('text');
        if (!prompt) {
            return interaction.reply('음성으로 변환할 질문을 입력해주세요.');
        }

        if (!member.voice.channel) {
            return interaction.reply('음성 채널에 먼저 참여해주세요!');
        }

        const channelId = interaction.channel.id;
        let chat = chats.get(channelId);

        if (!chat) {
            chat = model.startChat({
                history: [],
                generationConfig: {
                    maxOutputTokens: config.MAX_MESSAGE_LENGTH,
                },
                systemInstruction: {
                    parts: [{ text: "너는 일본어 선생님이야. 이름은 하나코. 친절하게 학생들을 가르쳐봐. 말투는 한국어랑 일본어를 섞어서 쓰는거야. '예시) -씨 혹은 -님: -상, -쨩 / -다: -다요, 데스 / -는: -와 / -해서: -노데, -카라 / -의: -노 / -나, -또는: -야 / 일본: 니혼, 닛폰 / 인간: 닝겐, 히토 / 선배: 센빠이 / 기분: 키모치 / 오빠, 형: 오니-, 니-상 / 행복: 시아와세 / 약속: 야쿠소쿠 / 놀이공원: 유우엔치 / 득템했음, 얻었다구: 겟또다제 / 전혀: 젠젠 / 전부: 젠부 / 안 돼: 다메 / 그만둬: 야메로, 야메떼 / 잠시만: 좃토 / 예, 네: 하이 / 좋다: 이이, 요이 / 맛있다: 우마이, 오이시이 / 귀엽다: 카와이이 / 있다: 아루, 이루 / 재미있다: 오모시로이, 타노시이 / -잖아: -쟝 / -입니다, 합니다: 데스, 마스 / -되었습니다: 시마시타, 사레마시타 / -이네요: 데스네 / -주세요, 해 주세요: 쿠다사이, 오네가이시마스 / ~부터: 카라 / ~까지: 마데'  답변 길이는 길지 않게 해줘. 한국어로 답해." }],
                },
            });
            chats.set(channelId, chat);
        }

        try {
            await interaction.deferReply(); // 응답이 길어질 수 있으므로 deferReply 사용

            const result = await chat.sendMessage(prompt);
            const response = await result.response;
            const text = response.text();
            console.log('[사용자 질문]', prompt);
            console.log('[Gemini 응답]', text);

            if (!serverQueue || !serverQueue.connection || serverQueue.connection.state.status === 'destroyed') {
                try {
                    const connection = joinVoiceChannel({
                        channelId: member.voice.channel.id,
                        guildId: member.voice.channel.guild.id,
                        adapterCreator: member.voice.channel.guild.voiceAdapterCreator,
                    });
                    serverQueue = {
                        textChannel: channel,
                        voiceChannel: member.voice.channel,
                        connection: connection,
                        songs: [],
                        volume: 0.5,
                        playing: true,
                    };
                    queue.set(guildId, serverQueue);
                    connection.subscribe(player);
                    console.log(`음성 채널에 연결됨: ${member.voice.channel.name}`);
                } catch (error) {
                    console.error('음성 채널 연결 오류:', error);
                    await interaction.followUp('음성 채널에 연결할 수 없습니다.'); // deferReply 후 followUp 사용
                    if (text.length <= config.MAX_MESSAGE_LENGTH) {
                        await interaction.followUp(text);
                    } else {
                        let currentMessage = '';
                        const words = text.split(' ');
                        for (const word of words) {
                            if (currentMessage.length + word.length + 1 > config.MAX_MESSAGE_LENGTH) {
                                await interaction.followUp(currentMessage);
                                currentMessage = word + ' ';
                            } else {
                                currentMessage += word + ' ';
                            }
                        }
                        if (currentMessage.length > 0) {
                            await interaction.followUp(currentMessage);
                        }
                    }
                    return;
                }
            }

            if (text.length <= config.MAX_MESSAGE_LENGTH) {
                await interaction.followUp(text); // deferReply 후 followUp 사용
                say(guildId, text);
            } else {
                let currentMessage = '';
                const words = text.split(' ');
                for (const word of words) {
                    if (currentMessage.length + word.length + 1 > config.MAX_MESSAGE_LENGTH) {
                        await interaction.followUp(currentMessage);
                        say(guildId, currentMessage);
                        currentMessage = word + ' ';
                    } else {
                        currentMessage += word + ' ';
                    }
                }
                if (currentMessage.length > 0) {
                    await interaction.followUp(currentMessage);
                    say(guildId, currentMessage);
                }
            }
        } catch (error) {
            console.error('Gemini 콘텐츠 생성 오류:', error);
            await interaction.followUp('죄송합니다. 메시지를 처리하는 중 오류가 발생했습니다.'); // deferReply 후 followUp 사용
        }
    }
});

player.on(AudioPlayerStatus.Idle, () => {
    for (const [guildId, serverQueue] of queue.entries()) {
        if (serverQueue.connection && serverQueue.connection.state.status !== 'destroyed') {
            serverQueue.songs.shift();
            if (serverQueue.songs.length > 0) {
                play(guildId, serverQueue.songs[0]);
            } else {
                serverQueue.connection.destroy();
                queue.delete(guildId);
                serverQueue.textChannel.send('재생 목록이 비었습니다. 음성 채널에서 나갑니다.');
            }
            return;
        }
    }
});

async function play(guildId, song) {
    const serverQueue = queue.get(guildId);
    if (!song) {
        if (serverQueue.connection) {
            serverQueue.connection.destroy();
        }
        queue.delete(guildId);
        return;
    }

    try {
        const stream = ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio' });
        const resource = createAudioResource(stream);
        player.play(resource);
        serverQueue.textChannel.send(`🎶 현재 재생 중: **${song.title}**`);
    } catch (error) {
        console.error('유튜브 트랙 재생 오류:', error);
        let errorMessage = '유튜브 트랙을 재생할 수 없습니다. URL을 확인해주세요.';
        // @distube/ytdl-core는 오류 객체에 statusCode 대신 cause를 포함할 수 있습니다.
        if (error.cause && error.cause.statusCode === 410) {
            errorMessage = '유튜브 비디오를 찾을 수 없습니다. 비공개 또는 삭제된 비디오이거나, 지역 제한이 있을 수 있습니다.';
        } else if (error.message.includes('video is unavailable')) {
            errorMessage = '유튜브 비디오를 사용할 수 없습니다. 비공개 또는 삭제된 비디오일 수 있습니다.';
        } else if (error.message.includes('private video')) { // @distube/ytdl-core에서 private video 관련 오류 처리 추가
            errorMessage = '유튜브 비디오가 비공개입니다.';
        }
        await serverQueue.textChannel.send(errorMessage);
        serverQueue.songs.shift();
        if (serverQueue.songs.length > 0) {
            play(guildId, serverQueue.songs[0]);
        } else {
            if (serverQueue.connection) {
                serverQueue.connection.destroy();
            }
            queue.delete(guildId);
            await serverQueue.textChannel.send('재생 목록이 비었습니다. 음성 채널에서 나갑니다.');
        }
    }
}

async function say(guildId, text) {
    const serverQueue = queue.get(guildId);
    if (!serverQueue || !serverQueue.connection) {
        console.error('음성 채널에 연결되어 있지 않습니다.');
        return;
    }

    try {
        const gtts = require('gtts');
        const gttsInstance = new gtts(text, 'ko');
        const outputPath = `./temp_tts_${guildId}.mp3`;
        await new Promise((resolve, reject) => {
            gttsInstance.save(outputPath, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
        const resource = createAudioResource(outputPath);
        player.play(resource);
        player.once(AudioPlayerStatus.Idle, () => {
            require('fs').unlink(outputPath, err => {
                if (err && err.code !== 'ENOENT') {
                    console.error('임시 TTS 파일 삭제 오류:', err);
                }
            }); // 재생 후 파일 삭제 (비동기)
        });
    } catch (error) {
        console.error('TTS 생성 또는 재생 오류:', error);
    }
}

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

    let fullPrompt = prompt; // 부르는 말을 포함한 전체 프롬프트 저장
    if (isMentioned) {
        prompt = prompt.replace(botMention, '').trim();
    } else if (matchedKeyword) {
        prompt = prompt.substring(matchedKeyword.length).trim();
    }

    if (prompt.length === 0) {
        return message.reply('무엇을 도와드릴까요?');
    }

    try {
        const channelId = message.channel.id;
        let chat = chats.get(channelId);

        if (!chat) {
            chat = model.startChat({
                history: [],
                generationConfig: {
                    maxOutputTokens: config.MAX_MESSAGE_LENGTH,
                },
                systemInstruction: {
                    parts: [{ text: "너는 일본어 선생님이야. 이름은 하나코. 친절하게 학생들을 가르쳐봐. 말투는 한국어랑 일본어를 섞어서 쓰는거야. '예시) -씨 혹은 -님: -상, -쨩 / -다: -다요, 데스 / -는: -와 / -해서: -노데, -카라 / -의: -노 / -나, -또는: -야 / 일본: 니혼, 닛폰 / 인간: 닝겐, 히토 / 선배: 센빠이 / 기분: 키모치 / 오빠, 형: 오니-, 니-상 / 행복: 시아와세 / 약속: 야쿠소쿠 / 놀이공원: 유우엔치 / 득템했음, 얻었다구: 겟또다제 / 전혀: 젠젠 / 전부: 젠부 / 안 돼: 다메 / 그만둬: 야메로, 야메떼 / 잠시만: 좃토 / 예, 네: 하이 / 좋다: 이이, 요이 / 맛있다: 우마이, 오이시이 / 귀엽다: 카와이이 / 있다: 아루, 이루 / 재미있다: 오모시로이, 타노시이 / -잖아: -쟝 / -입니다, 합니다: 데스, 마스 / -되었습니다: 시마시타, 사레마시타 / -이네요: 데스네 / -주세요, 해 주세요: 쿠다사이, 오네가이시마스 / ~부터: 카라 / ~까지: 마데'  답변 길이는 길지 않게 해줘. 한국어로 답해." }],
                },
            });
            chats.set(channelId, chat);
        }

        // 부르는 말을 포함한 전체 프롬프트를 Gemini에 전달
        const result = await chat.sendMessage(fullPrompt);
        const response = await result.response;
        const text = response.text();
        console.log('[사용자 질문]', fullPrompt); // 사용자 질문 출력 (부르는 말 포함)
        console.log('[Gemini 응답]', text); // Gemini 응답 출력

        if (text.length <= config.MAX_MESSAGE_LENGTH) {
            await message.reply(text);
        } else {
            let currentMessage = '';
            const words = text.split(' ');
            for (const word of words) {
                if (currentMessage.length + word.length + 1 > config.MAX_MESSAGE_LENGTH) {
                    await message.reply(currentMessage);
                    currentMessage = word + ' ';
                } else {
                    currentMessage += word + ' ';
                }
            }
            if (currentMessage.length > 0) {
                await message.reply(currentMessage);
            }
        }
    } catch (error) {
        console.error('Gemini 콘텐츠 생성 오류:', error);
        await message.reply('죄송합니다. 메시지를 처리하는 중 오류가 발생했습니다.');
    }
});

client.login(config.DISCORD_BOT_TOKEN);