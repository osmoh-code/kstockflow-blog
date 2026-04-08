/**
 * Batch-summarize per-stock descriptions via Gemini for hot-issues shorts.
 *
 * Why summarize at all:
 *   The blog's "### N. 종목명" sections contain 1~3 paragraph descriptions
 *   that are too long for both TTS (would exceed 60s) and on-screen reading
 *   (viewers can't read 250-char paragraphs in 5 seconds). We need a tight
 *   1-sentence "why this stock matters for this theme" summary.
 *
 * Why Gemini (not rule-based):
 *   Rule-based truncation gives "first sentence cut at 50 chars" which loses
 *   the actual conclusion. The interesting insight is usually in the 2nd or
 *   3rd sentence. Real summarization is needed.
 *
 * Why batch:
 *   One Gemini call for all 7 stocks is way more efficient than 7 calls.
 *   Free tier has 10 RPM so single batch is safe.
 *
 * Output is cached in extract.ts → input.json so re-renders don't re-call.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 4096;

export interface StockToSummarize {
  readonly name: string;
  readonly description: string;
}

export interface StockSummary {
  readonly name: string;
  readonly summary: string;
}

const SYSTEM_PROMPT = `당신은 한국 주식 분석 요약 전문가입니다.

각 종목별 블로그 설명(보통 2~3문장)을 받아서, 해당 종목이 왜 이 테마와 관련 있는지를 한 문장으로 압축 요약합니다.

⚠️ 가장 중요한 규칙: **공백 포함 50~65자 이내 한 문장** (절대 65자 초과 금지)
- 짧고 핵심만! YouTube Shorts 영상이라 시간이 부족합니다.
- 가능하면 두 가지를 모두 담되 한 가지만 명확하게 담아도 OK: 종목의 강점/경험/연결고리
- 종목명으로 시작 가능 ("대우건설의...", "삼성E&A는...")
- 자연스러운 종결: "~할 전망", "~로 주목", "~수혜 예상", "~기대", "~보유", "~경험 부각", "~경쟁력" 등
- **숫자/날짜/% 언급 절대 금지** (시점에 따라 변동)
- 광고성·과장 표현 금지
- 명사형/형용사형 종결 선호 (간결함). "~입니다" 회피.

좋은 예시 (모두 50~65자):
원본: "대우건설의 핵심 강점은 중동·북아프리카(MENA) 지역에서의 오랜 사업 경험입니다. 과거 중동 건설 붐 시기부터 플랜트, 발전소, 도로, 주거단지 등 다양한 인프라 프로젝트를 수행해왔으며, 이 과정에서 축적한 현지 네트워크와 프로젝트 관리 노하우는 향후 이란 재건 사업 수주에 유리하게 작용할 전망입니다."
요약: "중동 사업 경험과 현지 네트워크로 이란 재건 사업 수주 유리할 전망" (33자)

원본: "이란은 전쟁 이전부터 정유·석유화학 시설의 노후화 문제가 있었으며, 전쟁으로 인한 피해까지 더해지면서 에너지 인프라 복구 수요가 상당할 것으로 예상됩니다. 삼성E&A는 사우디아라비아, UAE, 이라크 등 중동 전역에서 대형 플랜트 프로젝트를 성공적으로 수행한 경험이 있어, 이란 재건 시장에서도 강력한 경쟁력을 발휘할 수 있을 것으로 분석됩니다."
요약: "중동 전역 대형 플랜트 수행 경험으로 이란 재건 시장 경쟁력 부각" (32자)

원본: "두산밥캣의 핵심 경쟁력은 스킵스티어로더, 소형 굴삭기, 텔레핸들러 등 소형·컴팩트 장비 라인업입니다..."
요약: "소형·컴팩트 장비 라인업으로 전후 재건 도심 복구 수요 수혜" (30자)

응답은 반드시 다음 JSON 배열 형식만:
[
  {"name": "대우건설", "summary": "..."},
  {"name": "삼성E&A", "summary": "..."}
]`;

export async function summarizeStockDescriptions(
  stocks: readonly StockToSummarize[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (stocks.length === 0) return result;

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY 누락 (.env.local 확인)");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.5, // Lower temp for more deterministic, factual summaries
    },
  });

  // Build user prompt with numbered stock list
  const userPrompt = `다음 ${stocks.length}개 종목을 각각 1문장(공백 포함 60자 이내)으로 요약하세요.

${stocks
  .map((s, i) => `${i + 1}. ${s.name}\n원본: ${s.description}`)
  .join("\n\n")}

위 모든 종목에 대해 JSON 배열로 응답하세요.`;

  const response = await model.generateContent(userPrompt);
  const text = response.response.text();

  const parsed = parseJsonResilient(text);
  if (!Array.isArray(parsed)) {
    throw new Error(`Gemini 요약 응답이 배열이 아님: ${typeof parsed}`);
  }

  for (const item of parsed as Array<{ name?: string; summary?: string }>) {
    if (item?.name && item?.summary) {
      result.set(item.name.trim(), item.summary.trim());
    }
  }

  return result;
}

/**
 * Try multiple JSON parsing strategies because Gemini occasionally returns
 * malformed JSON (markdown fences, trailing commas, unterminated strings
 * from token cutoff, etc.).
 */
function parseJsonResilient(text: string): unknown {
  // Strategy 1: direct parse
  try {
    return JSON.parse(text);
  } catch {}

  // Strategy 2: strip markdown fences
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {}

  // Strategy 3: extract first JSON array via brace matching
  const arrayStart = stripped.indexOf("[");
  const arrayEnd = stripped.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const slice = stripped.slice(arrayStart, arrayEnd + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }

  // Strategy 4: extract individual {name, summary} objects via regex (last resort)
  // This salvages partial responses where some objects are well-formed but others are truncated.
  const objects: Array<{ name: string; summary: string }> = [];
  const objectRegex = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"summary"\s*:\s*"([^"]+)"\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectRegex.exec(stripped)) !== null) {
    objects.push({ name: match[1], summary: match[2] });
  }
  if (objects.length > 0) {
    return objects;
  }

  // All strategies failed — log first 500 chars of raw response for debugging
  console.log(`   📄 Gemini raw response (first 500 chars):\n${text.slice(0, 500)}`);
  throw new Error(`JSON 파싱 실패 (모든 전략 실패)`);
}
