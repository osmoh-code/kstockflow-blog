/**
 * Stage 2 (hot-issues): Build ShortsScript deterministically from input data.
 *
 * No Gemini call here — content is already extracted and summarized in
 * hot-issues/extract.ts. This module just assembles the final script shape:
 *
 *   Hook   — 1-sentence news trigger (from input.hookSummary or fallback)
 *   Body   — one scene per stock, narration = "{종목명}{은/는} {Gemini reason}"
 *   Loop   — table of all related stocks, short intro narration
 *   CTA    — channel profile CTA
 *
 * Duration target: total narration ~55 chars/scene × 7 + hook + cta ≈ 55~58s.
 */
import { buildHotIssuesHeaderTitle, buildHotIssuesLoopTitle } from "../lib/mark-extractor";
import type { ShortsInputData, ShortsScript } from "../types";

export function buildHotIssuesScript(input: ShortsInputData): ShortsScript {
  const stocks = input.topStocks;
  if (stocks.length === 0) {
    throw new Error("hot-issues 스크립트 생성 실패: topStocks 비어있음");
  }

  // --- Hook narration: Gemini-summarized 핵심요약 (set in extract.ts) ---
  // 1문장 ~70자 이내, 시청자 첫 5초 안에 "왜 이게 지금 핫한지" 전달
  const hookNarration =
    input.hookSummary && input.hookSummary.length >= 30
      ? pickNarrationSentence(input.hookSummary, 90)
      : `${extractKeyword(input.title)}가 주목받고 있습니다. 오늘의 관련주 ${stocks.length}개를 알려드릴게요.`;

  const firstName = stocks[0].name;

  // --- Hook on-screen title (letterbox + hook scene) ---
  //   1. frontmatter shorts_header_title (exact user text — preferred)
  //   2. heuristic builder with actual stocks.length
  const hookOnScreen =
    input.headerTitleOverride ?? buildHotIssuesHeaderTitle(input.title, stocks.length);

  // --- Body scenes: force "{종목명}{은/는} " prefix for every narration ---
  // Gemini summaries occasionally drop the stock name; this post-process
  // guarantees the listener always hears which stock is being discussed.
  const bodyScenes = stocks.map((s, i) => {
    const josa = getSubjectJosa(s.name);
    const namePrefix = `${s.name}${josa} `;
    // Reserve ~55 chars total per body narration (~6.5s @ 1.25x) so the whole
    // shorts (hook + 7 bodies + loop + cta) fits within 60s.
    const reasonMax = Math.max(35, 55 - namePrefix.length);
    const rawReason = pickNarrationSentence(s.reason, reasonMax);
    const narrationText = rawReason.startsWith(s.name)
      ? rawReason
      : `${namePrefix}${rawReason}`;
    return {
      idx: i + 1,
      narration: narrationText,
      onScreenText: s.name,
      visualDirection: `${s.name} 카드`,
      stockFocus: s.name,
      mainBusiness: s.sector, // 대장주/수혜주/관련주
      durationSec: 3,
      emphasisWords: [s.name],
      sfxCue: null as null,
    };
  });

  // --- Loop: short pre-table narration, full stocks table rendered in LoopScene ---
  const loopNarration = `오늘의 관련주 전체 한눈에 정리해드립니다.`;

  // --- CTA: channel profile pointer (split from loop so scenes don't repeat) ---
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
      onScreenText: buildHotIssuesLoopTitle(input.title),
      hookConnector: "",
      visualDirection: "stagger in 관련주 테이블",
      durationSec: 3,
    },
    totalDurationSec: 30,
    tableFormat: [],
  };
}

// ============================================================
// Helpers (hot-issues-local — not exported)
// ============================================================

function extractKeyword(title: string): string {
  // "중동전쟁 종전 기대감 건설주 관련주 TOP 7 | ..." → "중동전쟁 종전 건설주"
  const beforePipe = title.split("|")[0].trim();
  return beforePipe
    .replace(/관련주\s*TOP\s*\d+\s*$/, "")
    .replace(/관련주\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pick the appropriate Korean subject particle (은/는) for a noun.
 *   은 = noun ends in a consonant (받침 있음)
 *   는 = noun ends in a vowel (받침 없음)
 * Non-Hangul endings default to "은" (most Korean stock tickers end in Hangul).
 */
function getSubjectJosa(name: string): string {
  if (!name) return "은";
  const last = name[name.length - 1];
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "은"; // not Hangul
  return ((code - 0xac00) % 28) !== 0 ? "은" : "는";
}

/**
 * Pick a narration sentence from a multi-sentence description.
 * Strategy: take first complete sentence; if too long, cut at last comma/space.
 */
function pickNarrationSentence(description: string, maxChars: number): string {
  const text = description.trim();
  if (!text) return "";
  const firstMatch = /^[^.!]*?[다요][.!]/.exec(text);
  const firstSentence = firstMatch ? firstMatch[0] : text;
  if (firstSentence.length <= maxChars) return firstSentence;
  const cut = firstSentence.slice(0, maxChars);
  const lastBreak = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(" "));
  const trimmed = lastBreak > maxChars * 0.55 ? cut.slice(0, lastBreak) : cut;
  return /[다요][.!]$/.test(trimmed) ? trimmed : trimmed.replace(/[,.]$/, "") + ".";
}
