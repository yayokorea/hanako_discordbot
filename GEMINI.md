  프로젝트 개요

  이 프로젝트는 Discord에서 음악 재생, TTS(Text-to-Speech), 자연어 처리 기능을 제공하는 봇입니다. 사용자는 슬래시 명령어나 자연어 명령을 통해 봇과 상호작용할 수 있습니다.

  주요 기능

   - 음악 재생: 사용자는 YouTube URL 또는 검색어를 통해 음악을 재생할 수 있습니다.
   - TTS: 텍스트를 음성으로 변환하여 음성 채널에서 재생합니다.
   - 자연어 명령 처리: 사용자가 일상적인 언어로 명령을 내리면, Gemini API를 통해 의도를 파악하고 해당 기능을 수행합니다.
   - 다양한 음악 제어: 재생, 정지, 건너뛰기, 볼륨 조절 등 다양한 음악 제어 기능을 제공합니다.

  사용된 기술

   - Node.js: 서버 환경
   - discord.js: Discord API와 상호작용하기 위한 라이브러리
   - distube: 음악 재생 및 관리를 위한 라이브- gtts: Google Text-to-Speech 기능을 사용하기 위한 라이브러리
   - @google/generative-ai: 자연어 처리를 위한 Gemini API

  프로젝트 구조

   - index.js: 봇의 메인 파일. 클라이언트 초기화, 이벤트 핸들러 등록 등 전체적인 로직을 관리합니다.
   - src/commands.js: 슬래시 명령어 정의 및 등록을 담당합니다.
   - src/DisTubeHandler.js: DisTube 이벤트 핸들러를 정의하고 음악 재생 관련 로직을 처리합니다.
   - src/events/interactionHandler.js: 슬래시 명령어 상호작용을 처리합니다.
   - src/events/messageHandler.js: 자연어 명령을 처리하고 Gemini API와 통신합니다.
   - src/utils/messageSender.js: 메시지 전송 유틸리티 함수입니다.
   - config.js: 프로젝트 설정 파일.