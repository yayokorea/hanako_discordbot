require('dotenv').config();
const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 1단계: Google Custom Search 결과 가져오기
async function getGoogleSearchResults(query) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}`;

  try {
    const response = await axios.get(url);
    // 검색 결과 중 텍스트 정보만 추출
    const items = response.data.items || [];
    const summaries = items.map((item, index) => `${index + 1}. ${item.title}\n${item.snippet}`).join('\n\n');
    return summaries || '검색 결과가 없습니다.';
  } catch (error) {
    console.error('Google Search API Error:', error.response?.data || error.message);
    return '검색 결과를 가져오는데 실패했습니다.';
  }
}

// 2단계: Gemini API에 요약 요청
async function generateSummaryWithGemini(prompt) {
  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
      }
    );

    // Gemini 응답에서 텍스트 추출
    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '요약을 생성하지 못했습니다.';
  } catch (error) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    return '요약 생성에 실패했습니다.';
  }
}

// 메인 실행 함수
async function main() {
  const query = '미국의 대통령은?';

  const searchResults = await getGoogleSearchResults(query);
  console.log('=== 검색 결과 ===\n', searchResults);

  const prompt = `다음은 실시간 검색 결과입니다:\n${searchResults}\n\n이 내용을 요약해줘.`;

  const summary = await generateSummaryWithGemini(prompt);
  console.log('=== 요약 결과 ===\n', summary);
}

main();
