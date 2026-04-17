/**
 * Gemini batch summarization of sector reasons into a single crisp sentence.
 *
 * One-shot call that takes the full paragraph text of every sector and
 * returns parallel 1-sentence summaries (~30~50 chars each) for use as
 * narration in the sector_table scenes.
 *
 * Failure mode: on any error (quota / JSON parse / missing API key) the caller
 * falls back to the truncated first paragraph already computed in parse-sectors.ts.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

const SYSTEM_PROMPT = `당신은 한국 주식 YouTube Shorts 내레이션 작성가입니다.
각 "섹터 설명"을 **딱 한 문장**으로 핵심 원인만 요약하세요.

━━ 분량 ━━
- 정확히 한 문장 (마침표 1개), 공백 제외 25~45자.

━━ 내용 ━━
- 왜 올랐는지 "구체적 트리거"(사건·인물·수치·정책)가 명확히 드러나야 함.
- 개별 종목명 사용 금지 (섹터 전체 스토리만).
- 본문에 없는 사실 지어내지 말 것.

━━ ⚠️ 어미·구조 다양성 (가장 중요) ━━
섹터마다 서술 어미를 반드시 **다르게** 쓰세요. 같은 어미가 반복되면 영상이 지루해집니다.

✅ 사용 권장 어미 (배열 내 최대한 골고루 섞기):
  · 급등했습니다 / 상한가 행진을 펼쳤습니다 / 일제히 올랐습니다
  · 강세를 보였습니다 / 폭등세를 나타냈습니다 / 동반 상승했습니다
  · 부각되었습니다 / 주목받았습니다 / 집중 조명받았습니다
  · 수혜주로 떠올랐습니다 / 호재가 됐습니다 / 랠리를 펼쳤습니다
  · 모멘텀이 붙었습니다 / 기대감이 확산됐습니다 / 관심이 쏠렸습니다

❌ 금지: "~이끌었습니다" 어미는 전체 배열에서 **최대 1회만** 사용 가능.
❌ 금지: 모든 문장이 "{원인}이 {결과}를 이끌었습니다" 같은 동일 구조면 안 됩니다.

━━ 문장 구조 다양화 예시 ━━
  · 원인→결과: "엔비디아 아이징 발표로 양자컴퓨팅 관련주가 급등했습니다."
  · 결과→원인: "건설주는 미·이란 종전 협상 재개 기대감에 상한가 행진을 펼쳤습니다."
  · 섹터 중심: "초전도 케이블이 데이터센터 전력난의 대안으로 부각되었습니다."
  · 수혜 강조: "5G·6G 투자 가속화로 광통신주가 AI 인프라 수혜주로 떠올랐습니다."
  · 정책 발언: "신현송 총재 후보자 스테이블코인 발언에 결제주가 일제히 올랐습니다."

위 5개처럼 **매 섹터마다 어미와 구조를 바꿔가며** 작성하세요.

━━ 출력 형식 (엄격) ━━
{"summaries": ["문장1", "문장2", ...]}

배열 길이는 입력 배열 길이와 정확히 일치해야 합니다.`;

export interface SectorReasonInput {
  readonly sectorHeading: string;
  readonly fullText: string;
}

/**
 * Summarize multiple sector reasons in a single Gemini call.
 * Returns undefined on failure — caller must provide a fallback.
 */
export async function summarizeSectorReasons(
  inputs: readonly SectorReasonInput[],
): Promise<readonly string[] | undefined> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || inputs.length === 0) return undefined;

  const genAI = new GoogleGenerativeAI(apiKey);
  const userPrompt = buildUserPrompt(inputs);

  try {
    return await callOnce(genAI, MODEL, userPrompt, inputs.length);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  ${MODEL} 요약 실패, ${FALLBACK_MODEL}로 재시도: ${msg.slice(0, 100)}`);
    try {
      return await callOnce(genAI, FALLBACK_MODEL, userPrompt, inputs.length);
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      console.log(`   ⚠️  ${FALLBACK_MODEL} 요약도 실패: ${msg2.slice(0, 100)}`);
      return undefined;
    }
  }
}

async function callOnce(
  genAI: GoogleGenerativeAI,
  modelName: string,
  userPrompt: string,
  expectedLength: number,
): Promise<readonly string[]> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      // 0.7 — deterministic enough to stay on-topic, creative enough to vary
      // sentence endings across sectors (pure 0.3 kept collapsing to "~이끌었습니다").
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  });

  const res = await model.generateContent(userPrompt);
  const text = res.response.text();
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(stripped) as { summaries?: unknown };
  if (!Array.isArray(parsed.summaries)) {
    throw new Error("응답에 summaries 배열 없음");
  }
  const summaries = parsed.summaries.map((s) =>
    typeof s === "string" ? s.trim() : "",
  );
  if (summaries.length !== expectedLength) {
    throw new Error(
      `요약 개수 불일치 (${summaries.length} / ${expectedLength} 예상)`,
    );
  }
  return summaries;
}

function buildUserPrompt(inputs: readonly SectorReasonInput[]): string {
  const items = inputs.map((inp, i) => ({
    idx: i,
    sector: inp.sectorHeading,
    // Cap input at ~800 chars per sector so total prompt stays small.
    content: inp.fullText.length > 800 ? inp.fullText.slice(0, 800) + "…" : inp.fullText,
  }));
  return `다음 ${inputs.length}개 섹터 설명을 각각 1문장으로 요약해주세요:

${JSON.stringify({ sectors: items }, null, 2)}

출력: {"summaries": ["섹터0_요약", "섹터1_요약", ...]}`;
}
