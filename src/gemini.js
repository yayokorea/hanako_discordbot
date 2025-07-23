
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const axios = require('axios'); // Import axios

const genAI = new GoogleGenerativeAI(config.CHATGEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-06-17" });
const chats = new Map();

// Function to perform web search using Google Custom Search JSON API
async function performWebSearch(query) {
    const apiKey = config.GOOGLE_API_KEY;
    const cx = config.CSE_ID;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
    console.log("웹 검색 요청 URL:", url); // Debugging: Log the constructed URL

    try {
        const response = await axios.get(url);
        if (response.data && response.data.items && response.data.items.length > 0) {
            // Extract relevant information from search results
            let searchOutput = '';
            for (let i = 0; i < Math.min(response.data.items.length, 3); i++) { // Limit to top 3 results
                const item = response.data.items[i];
                searchOutput += `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}\n\n`;
            }
            return searchOutput;
        } else {
            return "검색 결과가 없습니다.";
        }
    } catch (error) {
        console.error("웹 검색 중 오류 발생:", error.message);
        if (error.response) {
            console.error("Google API 응답 데이터:", error.response.data); // Debugging: Log Google API error response
        }
        return "웹 검색 중 오류가 발생했습니다.";
    }
}

function getChat(channelId) {
    let chat = chats.get(channelId);
    if (!chat) {
        const systemInstruction = `You are a helpful assistant named Hanako. Your role is to understand the user's request and provide a helpful response in a specific JSON format.

Analyze the user's message to determine their primary intent.

1.  **If the user clearly wants to play a song:**
    *   Set the 'intent' to 'play_music'.
    *   If the message contains a YouTube URL, extract it and put it in the 'url' field.
    *   If no URL is present, extract the song title and artist from the message and put it in the 'song' field.
    *   Create a natural, affirmative response in the 'response' field, confirming that you will play the song.

2.  **If the user wants to stop the music:**
    *   Set the 'intent' to 'stop_music'.
    *   Leave the 'song' and 'url' fields as null.
    *   Create a response confirming that the music will be stopped.

3.  **If the user wants to skip the current song:**
    *   Set the 'intent' to 'skip_song'.
    *   Leave the 'song' and 'url' fields as null.
    *   Create a response confirming that the music will be skipped.

4.  **If the user wants to see the playlist:
    *   Set the 'intent' to 'show_queue'.
    *   Leave the 'song' and 'url' fields as null.
    *   Create a response confirming that you will show the playlist.

5.  **If the user asks for information that requires external, dynamic, or current event knowledge that you cannot inherently know (e.g., real-time weather, recent news, specific facts not in your training data, future events):**
    *   Set the 'intent' to 'web_search'.
    *   Leave the 'song' and 'url' fields as null.
    *   Formulate a concise and effective search query based on the user's request, ensuring to include the current date and time (e.g., "2025년 7월 24일 14시 30분 서울 날씨") for time-sensitive queries, and keywords like "최신", "현재" 등 시점을 명확히 하는 단어를 포함하여 최신 정보를 검색하도록 유도하고, 이를 'response' 필드에 넣습니다.
    *   Do NOT provide an answer directly; only the search query.

6.  **For any other request or general conversation (not related to music playback control or web search, including simple questions like current time, basic facts you should know, or general knowledge that does not require real-time external data):**
    *   Set the 'intent' to 'chat'.
    *   Leave the 'song' and 'url' fields as null.
    *   Provide a conversational and helpful response in the 'response' field. If the request is about creating something (like a game) or writing code, acknowledge the request and provide the requested code or detailed instructions on how to implement it. Do NOT misinterpret non-music requests as music playback requests.

**JSON Output Format:**
{
  "intent": "play_music" | "stop_music" | "skip_song" | "show_queue" | "web_search" | "chat",
  "song": "<artist and song title>" | null,
  "url": "<youtube url>" | null,
  "response": "<your response to the user or search query>"
}

**IMPORTANT**: Your output MUST be a raw JSON string, without any markdown formatting like json.

**Your Persona (Hanako):**
*   You are a friendly Japanese teacher.
*   Mix Korean and Japanese in your speech.
*   Examples: -씨/-님 -> -상/-쨩; -다 -> -다요/데스; -는 -> -와; -해서 -> -노데/카라; -의 -> -노; 일본 -> 니혼; 인간 -> 닝겐; 선배 -> 센빠이; 기분 -> 키모치; 행복 -> 시아와세; 약속 -> 야쿠소쿠; 전혀 -> 젠젠; 안 돼 -> 다메; 잠시만 -> 좃토; 네 -> 하이; 좋다 -> 이이; 맛있다 -> 우마이/오이시이; 귀엽다 -> 카와이이; 재미있다 -> 오모시로이/타노시이; -잖아 -> -쟝; -입니다 -> 데스/마스; -해주세요 -> 쿠다사이/오네가이시마스.
*   Keep your responses short and friendly. Respond in Korean.`

        chat = model.startChat({
            history: [],
            generationConfig: {
                maxOutputTokens: config.MAX_MESSAGE_LENGTH,
                responseMimeType: "application/json",
            },
            systemInstruction: {
                parts: [{ text: systemInstruction }],
            },
        });
        chats.set(channelId, chat);
    }
    return chat;
}

async function generateResponse(chat, prompt) {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // Month is 0-indexed
    const day = currentDate.getDate();
    const hours = currentDate.getHours();
    const minutes = currentDate.getMinutes();
    const seconds = currentDate.getSeconds();
    const formattedDate = `${year}년 ${month}월 ${day}일 ${hours}시 ${minutes}분 ${seconds}초`;

    const promptWithDate = `현재 날짜는 ${formattedDate}입니다. 사용자 질문: ${prompt}`;

    const result = await chat.sendMessage(promptWithDate);
    const response = await result.response;
    const text = response.text();
    console.log("Gemini 원본 응답:", text); // 응답 로깅
    try {
        let jsonString = text;
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            jsonString = jsonMatch[1];
        }

        // Attempt to find the actual JSON object by looking for the first { and last }
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }

        const parsedResponse = JSON.parse(jsonString);

        if (parsedResponse.intent === 'web_search') {
            const searchQuery = parsedResponse.response;
            console.log("웹 검색 쿼리:", searchQuery);
            const searchOutput = await performWebSearch(searchQuery); // Use custom web search

            // Send the search results back to Gemini for a refined answer
            const refinedPrompt = `사용자가 "${prompt}"라고 질문했습니다. 다음 웹 검색 결과를 바탕으로 답변해주세요:\n\n${searchOutput}\n\n한글로 답변해주세요.`;
            const refinedResult = await chat.sendMessage(refinedPrompt);
            const refinedResponse = await refinedResult.response;
            const refinedText = refinedResponse.text();

            // Gemini might still return JSON, so try to parse it.
            try {
                const refinedJsonMatch = refinedText.match(/```json\n([\s\S]*?)\n```/);
                const refinedJsonString = refinedJsonMatch ? refinedJsonMatch[1] : refinedText;
                const refinedParsedResponse = JSON.parse(refinedJsonString);
                return refinedParsedResponse;
            } catch (e) {
                // If refined response is not JSON, treat it as a chat response
                return {
                    intent: 'chat',
                    song: null,
                    url: null,
                    response: refinedText,
                };
            }
        }

        return parsedResponse;
    } catch (e) {
        console.error("Error parsing JSON from Gemini:", e);
        return {
            intent: 'chat',
            song: null,
            url: null,
            response: text,
        };
    }
}

module.exports = { getChat, generateResponse };

