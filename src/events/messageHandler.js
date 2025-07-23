const config = require('../../config');
const { getChat, generateResponse } = require('../gemini');
const { sendLongMessage } = require('../utils/messageSender');

async function handleMessageCreate(message, client, distubeHandler) {
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

    message.channel.sendTyping(); // 입력 중 표시

    try {
        const chat = getChat(message.channel.id);
        const geminiResponse = await generateResponse(chat, prompt);

        if (geminiResponse.intent === 'play_music') {
            if (geminiResponse.url) {
                await distubeHandler.playUrlFromMessage(message, geminiResponse.url);
            } else if (geminiResponse.song) {
                await distubeHandler.playSong(message, geminiResponse.song);
            }
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
}

module.exports = { handleMessageCreate };
