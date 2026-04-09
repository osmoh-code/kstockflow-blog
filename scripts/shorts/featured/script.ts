/**
 * Stage 2 (featured-stocks): Generate ShortsScript via Gemini 2.5 Flash.
 *
 * Featured-stocks flow:
 *   1. Build a detailed user prompt with topStocks + markPhrases + sectorHeadings
 *   2. Call gemini-2.5-flash (JSON mode). Fallback to gemini-2.5-flash-lite
 *      on quota/parse failure.
 *   3. If the model returns a too-short narration (< 130 chars), retry once
 *      with stronger guidance ("narration must include 등락률 + 동작 + 이유").
 *   4. Drop body scenes that lack a valid stockFocus (model occasionally adds
 *      "intro" cuts with no stock data).
 *
 * Hot-issues does NOT go through this file — see ../hot-issues/script.ts for
 * the deterministic rule-based builder.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SHORTS_SYSTEM_PROMPT, buildUserPrompt } from "../lib/prompt-shorts";
import type { ShortsInputData, ShortsScript } from "../types";

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";
const MAX_OUTPUT_TOKENS = 16384;

export async function generateFeaturedScript(input: ShortsInputData): Promise<ShortsScript> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY 누락 (.env.local 확인)");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const userPrompt = buildUserPrompt(input);

  // Try primary model first, fall back to lite on quota or parse failure
  let script: ShortsScript;
  try {
    script = await callGemini(genAI, PRIMARY_MODEL, userPrompt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  ${PRIMARY_MODEL} 실패, ${FALLBACK_MODEL}로 fallback: ${msg.slice(0, 100)}`);
    script = await callGemini(genAI, FALLBACK_MODEL, userPrompt);
  }

  // If narration is too short (< 130 chars), retry once with stronger guidance
  const charCount = countNarrationCharsRaw(script);
  if (charCount < 130) {
    console.log(`   ⚠️  narration ${charCount}자로 너무 짧음 — 더 자세한 prompt로 재시도`);
    const retryPrompt = `${userPrompt}

⚠️ 추가 지시: 이전 시도가 narration이 너무 짧았습니다. 각 body scene narration은 반드시 18~26자(공백 제외)로 작성하고, **종목명 + 등락률 + 동작 + 이유** 4요소를 모두 포함하세요. 이유 부분(예: "에너지 확대 기대감")을 절대 생략하지 마세요. 전체 narration 합계는 150~195자.`;
    try {
      script = await callGemini(genAI, PRIMARY_MODEL, retryPrompt);
      console.log(`   ✅ 재시도 후 ${countNarrationCharsRaw(script)}자`);
    } catch {
      console.log(`   ⚠️  재시도 실패, 첫 결과 유지`);
    }
  }

  // Drop "intro" body scenes that don't have a valid stockFocus
  script = dropEmptyBodyScenes(script);

  // Force-fix the hook to a fixed template (with dynamic date). Reason:
  // Gemini's creative (temperature 0.8) hooks vary day-to-day and broke
  // channel branding consistency. 2026-04-08 user feedback locked the
  // hook narration + on-screen text to this exact pattern.
  const monthDay = formatMonthDay(input.date);
  script = {
    ...script,
    hook: {
      ...script.hook,
      narration: `${monthDay} 시장을 주도한 핵심종목 총정리`,
      onScreenText: `${monthDay}\n오늘의 주도주?`,
    },
  };

  return script;
}

/**
 * "2026-04-08" → "4월 8일". Falls back to "오늘" when the date is malformed.
 */
function formatMonthDay(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return "오늘";
  return `${parseInt(m[2], 10)}월 ${parseInt(m[3], 10)}일`;
}

async function callGemini(
  genAI: GoogleGenerativeAI,
  modelName: string,
  userPrompt: string,
): Promise<ShortsScript> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SHORTS_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.8, // Creative for hook copy, but stable for JSON
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Strip markdown fences if present (defensive)
    const stripped = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(stripped);
  }

  return parsed as ShortsScript;
}

function dropEmptyBodyScenes(script: ShortsScript): ShortsScript {
  const filteredBody = script.body.filter((s) => s.stockFocus && s.stockFocus.trim() !== "");
  if (filteredBody.length !== script.body.length) {
    console.log(`   ⏭️  body scene ${script.body.length - filteredBody.length}개 스킵 (stockFocus 없음)`);
  }
  return { ...script, body: filteredBody };
}

function countNarrationCharsRaw(script: ShortsScript): number {
  const stripSpaces = (s: string) => s.replace(/\s/g, "");
  let total = 0;
  total += stripSpaces(script.hook?.narration ?? "").length;
  for (const scene of script.body ?? []) {
    total += stripSpaces(scene.narration ?? "").length;
  }
  total += stripSpaces(script.cta?.narration ?? "").length;
  total += stripSpaces(script.loop?.narration ?? "").length;
  return total;
}
