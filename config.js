require('dotenv').config();

module.exports = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    GUILD_ID: process.env.GUILD_ID,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    MAX_MESSAGE_LENGTH: 2000, // Discord 메시지 최대 길이
    BOT_KEYWORDS: ['하나코', 'はなこ', '花子'],
};