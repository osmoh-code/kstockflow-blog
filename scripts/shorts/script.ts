/**
 * Stage 2: Generate hook-style YouTube Shorts script via Gemini.
 *
 * Usage:
 *   npx tsx scripts/shorts/script.ts <slug> [--force]
 *
 * Input:  dist/shorts/pending/{slug}/{slug}.input.json (from extract.ts)
 * Output: dist/shorts/pending/{slug}/{slug}.script.json
 *
 * Model: gemini-2.5-flash (free tier: 10 RPM, 250 RPD — production usage 1/day)
 * Output format: Native JSON mode (responseMimeType: application/json)
 */

import fs from "node:fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extract } from "./extract";
import { buildHotIssuesHeaderTitle, buildHotIssuesLoopTitle } from "./lib/mark-extractor";
import { SHORTS_SYSTEM_PROMPT, buildUserPrompt } from "./lib/prompt-shorts";
import { ensureDir, inputJsonPath, pendingDir, scriptJsonPath } from "./lib/shorts-paths";
import type { ShortsInputData, ShortsScript } from "./types";

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";
const MAX_OUTPUT_TOKENS = 16384;  // 응답 잘림 방지 (이전 8192는 부족)

export async function generateScript(
  input: ShortsInputData,
  opts: { force?: boolean } = {},
): Promise<ShortsScript> {
  const cachePath = scriptJsonPath(input.slug);

  if (!opts.force && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as ShortsScript;
    console.log(`   ♻️  스크립트 캐시 사용`);
    return cached;
  }

  // Hot-issues: use rule-based generator (deterministic, bypasses Gemini).
  // Content is directly extracted from the blog post's table + 핵심 요약.
  if (input.category === "hot-issues") {
    console.log(`   🤖 hot-issues 규칙 기반 스크립트 생성 중...`);
    const hotScript = buildHotIssuesScript(input);
    const processed = validateAndWrite(hotScript, input, cachePath);
    return processed;
  }

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

  // Drop body scenes that don't have a valid stockFocus
  // (LLM sometimes generates "시장 intro" cuts with no stock data)
  script = dropEmptyBodyScenes(script);

  return validateAndWrite(script, input, cachePath);
}

function validateAndWrite(
  script: ShortsScript,
  input: ShortsInputData,
  cachePath: string,
): ShortsScript {
  // Post-process narration: replace "핫이슈" → "핫 이슈" for TTS pronunciation
  script = replaceNarrationBrand(script);

  validateScript(script, input.category);

  ensureDir(pendingDir(input.slug));
  fs.writeFileSync(cachePath, JSON.stringify(script, null, 2), "utf-8");

  return script;
}

// ============================================================
// Hot-issues rule-based script builder
// ============================================================

/**
 * Build a ShortsScript deterministically from hot-issues post data.
 *
 * Structure:
 *   Hook  — first 2 sentences of 핵심 요약 (from hookSummary)
 *   Body  — one scene per related stock (name + key point abbreviated)
 *   Loop  — short pre-table narration ("관련주 전체 확인하세요")
 *   CTA   — same template as featured-stocks
 *
 * Narration length target (at 1.25 speakingRate):
 *   Hook ~80 chars (~9s), Body 7×18 chars (~13s),
 *   Loop ~18 chars (~2.5s), CTA ~35 chars (~4s) → total ~28~30s
 */
function buildHotIssuesScript(input: ShortsInputData): ShortsScript {
  const stocks = input.topStocks;
  if (stocks.length === 0) {
    throw new Error("hot-issues 스크립트 생성 실패: topStocks 비어있음");
  }

  // --- Hook: 핵심 요약에서 추출한 2문장 (없으면 title 기반 fallback) ---
  const hookNarration =
    input.hookSummary && input.hookSummary.length >= 30
      ? trimToMaxChars(input.hookSummary, 130)
      : `${extractKeyword(input.title)}가 주목받고 있습니다. 오늘의 관련주 ${stocks.length}개를 알려드릴게요.`;

  const firstName = stocks[0].name;
  // Hook on-screen title: same 2-line format as the letterbox header
  // ("중동전쟁 종전 기대감\n건설주 TOP 7"). HookScene renders this as a
  // prominent intro card with the narration text shown below.
  const hookOnScreen = buildHotIssuesHeaderTitle(input.title);

  // --- Body: 각 종목당 narration = Gemini summary (already 50~65 chars) ---
  // s.reason now holds a Gemini-generated 1-sentence summary that combines
  // theme rationale + stock-specific strength. We hard-cap at 65 chars as a
  // safety net in case Gemini ignores the length instruction.
  const bodyScenes = stocks.map((s, i) => {
    const narrationText = pickNarrationSentence(s.reason, 65);
    return {
      idx: i + 1,
      narration: narrationText,
      onScreenText: s.name,
      visualDirection: `${s.name} 카드`,
      stockFocus: s.name,
      mainBusiness: s.sector, // 대장주/수혜주/관련주 라벨
      durationSec: 3,
      emphasisWords: [s.name],
      sfxCue: null as null,
    };
  });

  // --- Loop: table scene with short narration ---
  const loopNarration = `오늘의 관련주 전체 한눈에 정리해드립니다.`;

  // --- CTA: same template ---
  const ctaNarration = `오늘 다룬 종목의 자세한 내용은 채널 프로필 K주식 핫 이슈에서 확인하세요.`;

  return {
    hook: {
      narration: hookNarration,
      onScreenText: hookOnScreen,
      visualDirection: "테마 키워드 타이틀 애니메이션",
      fomoTrigger: firstName,
    },
    body: bodyScenes,
    cta: {
      narration: ctaNarration,
      onScreenText: "K주식핫이슈 → 프로필",
      visualDirection: "화살표 + 채널 프로필 강조",
      arrowDirection: "to_profile_top_left" as const,
      brandName: "K주식핫이슈",
      siteUrl: "kstockflow.com",
      durationSec: 5,
      sfxCue: "notification" as const,
    },
    loop: {
      narration: loopNarration,
      onScreenText: buildHotIssuesLoopTitle(input.title), // "중동전쟁 종전 건설주 관련주 전체"
      hookConnector: "",
      visualDirection: "stagger in 관련주 테이블",
      durationSec: 3,
    },
    totalDurationSec: 30,
    tableFormat: [],
  };
}

function extractKeyword(title: string): string {
  // "중동전쟁 종전 기대감 건설주 관련주 TOP 7 | ..." → "중동전쟁 종전 건설주"
  const beforePipe = title.split("|")[0].trim();
  // Strip common suffixes
  return beforePipe
    .replace(/관련주\s*TOP\s*\d+\s*$/, "")
    .replace(/관련주\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimToMaxChars(text: string, max: number): string {
  if (text.length <= max) return text;
  // Try to trim at sentence boundary
  const cut = text.slice(0, max);
  const lastPeriod = Math.max(cut.lastIndexOf("다."), cut.lastIndexOf("요."));
  if (lastPeriod > max * 0.6) return cut.slice(0, lastPeriod + 2);
  return cut;
}

function abbreviateKeyPoint(keyPoint: string, maxChars: number): string {
  // Remove leading "+XX.XX% 급등, " prefix (redundant for fast-paced body)
  const stripped = keyPoint
    .replace(/^[+-]?\d+(?:\.\d+)?\s*%\s*(?:급등|상승|폭등|강세|기록)?\s*,?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= maxChars) return stripped;
  // Cut at comma or word boundary near the limit
  const cut = stripped.slice(0, maxChars);
  const lastComma = cut.lastIndexOf(",");
  if (lastComma > maxChars * 0.5) return cut.slice(0, lastComma);
  return cut;
}

/**
 * Pick a narration sentence from a multi-sentence description.
 * Strategy: take the first complete sentence; if it exceeds maxChars, cut at
 * the last comma/space before the limit and append "다." if missing.
 */
function pickNarrationSentence(description: string, maxChars: number): string {
  const text = description.trim();
  if (!text) return "";
  // Match first sentence ending in 다./요./다!/요!
  const firstMatch = /^[^.!]*?[다요][.!]/.exec(text);
  const firstSentence = firstMatch ? firstMatch[0] : text;
  if (firstSentence.length <= maxChars) return firstSentence;
  // Truncate: cut at last comma or space within limit
  const cut = firstSentence.slice(0, maxChars);
  const lastBreak = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(" "));
  const trimmed = lastBreak > maxChars * 0.55 ? cut.slice(0, lastBreak) : cut;
  // Ensure it ends naturally
  return /[다요][.!]$/.test(trimmed) ? trimmed : trimmed.replace(/[,.]$/, "") + ".";
}

// Action verbs that should be followed by a pause for natural pacing
const ACTION_WORDS = "상승|급등|상한가|폭등|하락|급락|반등|약세|강세|돌파|진입|기록|급락세|강세장";

function dropEmptyBodyScenes(script: ShortsScript): ShortsScript {
  const filteredBody = script.body.filter((s) => s.stockFocus && s.stockFocus.trim() !== "");
  if (filteredBody.length !== script.body.length) {
    console.log(`   ⏭️  body scene ${script.body.length - filteredBody.length}개 스킵 (stockFocus 없음)`);
  }
  return { ...script, body: filteredBody };
}

function replaceNarrationBrand(script: ShortsScript): ShortsScript {
  // 1. Pronunciation fix: 핫이슈 → "핫 이슈" (연음 방지)
  // 2. Strip "블로그" per user preference
  // 3. Insert pause after "{등락률}% {동작}" so TTS doesn't say "상승에너지"
  //    e.g. "12.58% 상승, 에너지 확대" instead of "12.58% 상승에너지 확대"
  const actionPauseRegex = new RegExp(`(\\d+(?:\\.\\d+)?\\s*%\\s*(?:${ACTION_WORDS}))(?![.,!?\\s])`, "g");
  const actionPauseRegexWithSpace = new RegExp(`(\\d+(?:\\.\\d+)?\\s*%\\s*(?:${ACTION_WORDS}))\\s+(?![.,!?])`, "g");

  const fix = (s: string): string =>
    s
      // Brand name pronunciation
      .replace(/HotIssue/g, "핫 이슈")
      .replace(/핫이슈/g, "핫 이슈")
      // Strip "블로그"
      .replace(/핫 이슈\s*블로그에서/g, "핫 이슈에서")
      .replace(/핫 이슈\s*블로그/g, "핫 이슈")
      .replace(/블로그에서/g, "에서")
      .replace(/블로그/g, "")
      // Add pause after action verbs (절 구분)
      .replace(actionPauseRegex, "$1, ")
      .replace(actionPauseRegexWithSpace, "$1, ")
      // Cleanup double spaces and trailing whitespace
      .replace(/\s{2,}/g, " ")
      .replace(/,\s*,/g, ",")
      .trim();
  return {
    ...script,
    hook: { ...script.hook, narration: fix(script.hook.narration) },
    body: script.body.map((scene) => ({ ...scene, narration: fix(scene.narration) })),
    cta: { ...script.cta, narration: fix(script.cta.narration) },
    loop: { ...script.loop, narration: fix(script.loop.narration) },
  };
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

// Korean speech rate at speakingRate 1.25: ~8 chars/sec
// Featured-stocks (no loop scene): 200 chars max → ~25s audio
// Hot-issues (up to 10 body scenes + loop): 480 chars max → ~60s audio
//   (YouTube Shorts hard limit is 60s, so we allow up to that with margin)
const MAX_TOTAL_CHARS_FEATURED = 200;
const MAX_TOTAL_CHARS_HOT_ISSUES = 480;
const MIN_TOTAL_CHARS = 130;

function validateScript(script: ShortsScript, category = "featured-stocks"): void {
  const errors: string[] = [];

  if (!script.hook?.narration) errors.push("hook.narration 누락");
  if (!script.cta?.narration) errors.push("cta.narration 누락");
  if (!script.loop?.narration) errors.push("loop.narration 누락");
  if (!Array.isArray(script.body) || script.body.length === 0) {
    errors.push("body 배열 누락");
  }

  const total = script.totalDurationSec;
  const maxDuration = category === "hot-issues" ? 55 : 32;
  if (typeof total !== "number" || total < 15 || total > maxDuration) {
    errors.push(`totalDurationSec 범위 위반 (${total}, 22~${maxDuration} 권장)`);
  }

  // Critical: narration character count check
  const totalChars = countNarrationChars(script);
  const maxChars = category === "hot-issues" ? MAX_TOTAL_CHARS_HOT_ISSUES : MAX_TOTAL_CHARS_FEATURED;
  if (totalChars > maxChars) {
    errors.push(
      `narration 총 글자수 ${totalChars}자 — 최대 ${maxChars}자 초과`,
    );
  }
  if (totalChars < MIN_TOTAL_CHARS) {
    console.log(`   ⚠️  narration 총 글자수 ${totalChars}자 — 최소 ${MIN_TOTAL_CHARS}자 권장 (영상이 너무 짧을 수 있음)`);
  }
  console.log(`   📏 총 narration: ${totalChars}자 (예상 약 ${(totalChars / 8).toFixed(1)}초 @ 1.25x)`);

  if (errors.length > 0) {
    throw new Error(`스크립트 검증 실패:\n  - ${errors.join("\n  - ")}`);
  }
}

function countNarrationCharsRaw(script: ShortsScript): number {
  return countNarrationChars(script);
}

function countNarrationChars(script: ShortsScript): number {
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

// ============================================================
// CLI entry
// ============================================================

const isMain = (() => {
  try {
    const argv = (process.argv[1] ?? "").replace(/\\/g, "/");
    return argv.endsWith("/scripts/shorts/script.ts");
  } catch {
    return false;
  }
})();

if (isMain) {
  // Load .env.local
  if (fs.existsSync(".env.local")) {
    for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }

  const slug = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const force = process.argv.includes("--force");

  if (!slug) {
    console.error("사용법: npx tsx scripts/shorts/script.ts <slug> [--force]");
    process.exit(1);
  }

  const run = async () => {
    let input: ShortsInputData;
    if (fs.existsSync(inputJsonPath(slug))) {
      input = JSON.parse(fs.readFileSync(inputJsonPath(slug), "utf-8"));
      console.log(`   📄 input.json 로드`);
    } else {
      console.log(`   📄 extract 단계 자동 실행...`);
      input = await extract(slug);
    }

    console.log(`\n🤖 Gemini ${PRIMARY_MODEL} 호출 중...`);
    const script = await generateScript(input, { force });

    console.log(`\n✅ 스크립트 생성 완료: ${slug}`);
    console.log(`   총 길이: ${script.totalDurationSec.toFixed(1)}초`);
    console.log(`\n   🎬 Hook (0~3초):`);
    console.log(`     "${script.hook.narration}"`);
    console.log(`     화면: ${script.hook.onScreenText}`);
    console.log(`\n   📊 Body (${script.body.length} cuts):`);
    for (const scene of script.body) {
      console.log(`     [${scene.idx}] ${scene.durationSec}s — "${scene.narration.slice(0, 50)}..."`);
      console.log(`         화면: ${scene.onScreenText} ${scene.sfxCue ? `(SFX: ${scene.sfxCue})` : ""}`);
    }
    console.log(`\n   📢 CTA (${script.cta.durationSec}s):`);
    console.log(`     "${script.cta.narration}"`);
    console.log(`\n   🔁 Loop (${script.loop.durationSec}s):`);
    console.log(`     "${script.loop.narration}"`);
    console.log(`     ↪ Hook 연결: "${script.loop.hookConnector}"`);
    console.log(`\n   💾 ${scriptJsonPath(slug)}`);
  };

  run().catch((err) => {
    console.error(`\n❌ 스크립트 생성 실패:`, err);
    process.exit(1);
  });
}
