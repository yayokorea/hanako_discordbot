# Discord Gemini Bot

This is a Discord bot that uses the Gemini API and DisTube to provide music playback and text-to-speech (TTS) functionality.

## Features

- Play music from YouTube
- Skip the currently playing song
- Stop music playback
- Convert text to speech and play it in a voice channel

## Commands

- `/play <url>`: Plays music from the provided YouTube URL.
- `/skip`: Skips the currently playing song.
- `/stop`: Stops music playback and disconnects the bot from the voice channel.
- `/tts <text>`: Converts the provided text to speech and plays it in the voice channel.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yayokorea/discordbot.git
    cd discordbot
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Create a `config.js` file in the root directory and add your configuration:
    ```javascript
    module.exports = {
        DISCORD_BOT_TOKEN: 'YOUR_DISCORD_BOT_TOKEN',
        GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY',
        GUILD_ID: 'YOUR_GUILD_ID', // Optional: for development testing
    };
    ```

## Usage

1.  Start the bot:
    ```bash
    node index.js
    ```

2.  Invite the bot to your Discord server.

3.  Use the slash commands in your server.

## Dependencies

- [@discordjs/opus](https://www.npmjs.com/package/@discordjs/opus)
- [@discordjs/voice](https://www.npmjs.com/package/@discordjs/voice)
- [@distube/yt-dlp](https://www.npmjs.com/package/@distube/yt-dlp)
- [@distube/ytdl-core](https://www.npmjs.com/package/@distube/ytdl-core)
- [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)
- [axios](https://www.npmjs.com/package/axios)
- [discord.js](https://www.npmjs.com/package/discord.js)
- [distube](https://www.npmjs.com/package/distube)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [ffmpeg-static](https://www.npmjs.com/package/ffmpeg-static)
- [gtts](https://www.npmjs.com/package/gtts)
