# Discord Gemini Bot

Gemini API와 DisTube를 사용하여 음악 재생 및 TTS(텍스트 음성 변환) 기능을 제공하는 Discord 봇입니다.

## 주요 기능

- 유튜브 음악 재생
- 현재 재생 중인 노래 건너뛰기
- 음악 재생 중지
- 현재 재생 목록 표시
- 텍스트를 음성으로 변환하여 음성 채널에서 재생
- 베이스 부스트 및 노래방 효과 토글

## 명령어

- `/play <url>`: 제공된 유튜브 URL의 음악을 재생합니다.
- `/skip`: 현재 재생 중인 노래를 건너뜁니다.
- `/stop`: 음악 재생을 중지하고 음성 채널에서 나갑니다.
- `/list`: 현재 재생 목록을 표시합니다.
- `/tts <text>`: 입력된 텍스트를 음성으로 변환하여 음성 채널에서 재생합니다.
- `/volume <level>`: 음악 볼륨을 조절합니다. (0-100)
- `/bassboost`: 베이스 부스트 효과를 켜거나 끕니다.
- `/karaoke`: 노래방 효과를 켜거나 끕니다.

## 자연어 명령

- 봇 멘션 또는 `config.js`에 설정된 키워드(예: '하나코', 'はなこ', '花子')로 시작하는 메시지를 통해 자연어 명령을 처리합니다.
- 음악 재생, 정지, 건너뛰기, 재생 목록 표시 등의 명령을 자연어로 수행할 수 있습니다.

## 설치 방법

1.  저장소 복제:
    ```bash
    git clone https://github.com/yayokorea/discordbot.git
    cd discordbot
    ```

2.  의존성 설치:
    ```bash
    npm install
    ```

3.  루트 디렉토리에 `.env` 파일을 생성하고 다음 환경 변수를 추가합니다:
    ```
    DISCORD_BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN
    CHATGEMINI_API_KEY=YOUR_GEMINI_API_KEY
    GUILD_ID=YOUR_GUILD_ID # 개발 테스트용 (선택 사항)
    ```

## 사용법

1.  봇 실행:
    ```bash
    npm start
    ```

2.  봇을 당신의 디스코드 서버에 초대하세요.

3.  서버에서 슬래시 명령어를 사용하거나 자연어 명령으로 봇과 상호작용하세요.

## 의존성

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
