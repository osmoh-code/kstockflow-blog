/**
 * hot-issues upload metadata builder.
 *
 * Produces the YouTube title/description/tags and first-comment text for
 * a hot-issues theme Shorts video. Title comes from the Gemini-generated
 * 2-line on-screen header (e.g. "중동전쟁 재건 철강주 급등\n관련주 TOP 6"),
 * joined on a single line so YouTube search can match it.
 *
 * Kept separate from featured/upload-meta.ts so neither category can
 * accidentally leak its template into the other (past bug: upload.ts
 * used slug pattern matching and mis-routed hot-issues slugs ending in
 * "-stocks" into the featured-stocks branch).
 */

import type { ShortsScript } from "../types";

export interface UploadMetadata {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
}

export function buildHotIssuesMetadata(
  slug: string,
  script: ShortsScript | null,
  postUrl: string,
): UploadMetadata {
  const { monthDay, monthDaySpaced } = parseSlugDate(slug);
  const uniqueStocks = collectStockNames(script);
  const hookTitle = extractHookTitle(script);

  // Prefer the Gemini hook title. Fall back to a stock-based template
  // only when the hook is missing (e.g. legacy posts without onScreenText).
  // 제목에 #Shorts 넣지 않음 — YouTube는 이미 9:16 + 60초 이하로 Shorts 자동 분류하므로
  // 해시태그는 제목 공간만 먹고 SEO 키워드 밀도를 낮춤. description의 #Shorts로 충분함.
  const title =
    hookTitle ?? `${monthDaySpaced} ${uniqueStocks[0] ?? ""} 관련 주도주 정리`.trim();

  const stocksLine = uniqueStocks.length > 0 ? uniqueStocks.join(", ") : "오늘의 강세 종목";
  const headline = hookTitle
    ? `📈 ${hookTitle} 관련주 정리`
    : `📈 ${monthDaySpaced} 핫이슈 관련주 TOP ${uniqueStocks.length || 5}`;

  const description = `🔥 전체 분석 보러가기 → ${postUrl}

${headline}

${stocksLine}

자세한 분석과 시장 전망은 위 링크에서 확인하세요
👉 ${postUrl}

#Shorts #주식 #핫이슈 #테마주 #관련주 #한국주식 #${monthDay} ${uniqueStocks.map((s) => `#${s}`).join(" ")}

⚠️ 본 영상은 정보 제공 목적이며, 투자 권유가 아닙니다. 투자의 책임은 본인에게 있습니다.`;

  const tags = [
    "주식",
    "핫이슈",
    "테마주",
    "관련주",
    "수혜주",
    "한국주식",
    "shorts",
    "K주식핫이슈",
    monthDay,
    ...uniqueStocks,
  ];

  return { title, description, tags };
}

export function buildHotIssuesFirstComment(
  script: ShortsScript | null,
  postUrl: string,
): string {
  const hookTitle = extractHookTitle(script);
  if (hookTitle && hookTitle.length > 0) {
    return `📈 ${hookTitle} 전체 분석 보기

👉 ${postUrl}

K주식핫이슈에서 자세한 내용 확인 ✅`;
  }
  return `📈 핫이슈 관련주 전체 분석 보기

👉 ${postUrl}

K주식핫이슈에서 자세한 내용 확인 ✅`;
}

function extractHookTitle(script: ShortsScript | null): string | null {
  const onScreen = script?.hook?.onScreenText;
  if (!onScreen) return null;
  // hot-issues hook is ALWAYS 2-line (e.g. "중동전쟁 재건 철강주 급등\n관련주 TOP 6").
  // Single-line hooks belong to featured-stocks and should not reach this builder.
  if (!onScreen.includes("\n")) return null;
  return onScreen.replace(/\n/g, " ").trim();
}

function parseSlugDate(slug: string): { monthDay: string; monthDaySpaced: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(slug);
  if (!m) return { monthDay: "오늘", monthDaySpaced: "오늘" };
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  return {
    monthDay: `${month}월${day}일`,
    monthDaySpaced: `${month}월 ${day}일`,
  };
}

function collectStockNames(script: ShortsScript | null): string[] {
  if (!script?.body) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const scene of script.body) {
    if (scene.stockFocus && !seen.has(scene.stockFocus)) {
      seen.add(scene.stockFocus);
      out.push(scene.stockFocus);
    }
  }
  return out;
}
