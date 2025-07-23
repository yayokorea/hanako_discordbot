
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.CHATGEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-06-17"});
const chats = new Map();

function getChat(channelId) {
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
    return chat;
}

async function generateResponse(chat, prompt) {
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();
}

module.exports = { getChat, generateResponse };
