/**
 * featured-stocks upload metadata builder.
 *
 * Produces the YouTube title/description/tags and first-comment text
 * for a featured-stocks daily Shorts video. The format is the date-based
 * "{N월 N일} 시장 주도주 급등주 테마주 정리" template.
 *
 * Kept separate from hot-issues/upload-meta.ts so neither category can
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

export function buildFeaturedStocksMetadata(
  slug: string,
  script: ShortsScript | null,
  postUrl: string,
): UploadMetadata {
  const { monthDay, monthDaySpaced } = parseSlugDate(slug);
  const uniqueStocks = collectStockNames(script);

  // 제목에 #Shorts 넣지 않음 — YouTube는 이미 9:16 + 60초 이하로 Shorts 자동 분류하므로
  // 해시태그는 제목 공간만 먹고 SEO 키워드 밀도를 낮춤. description의 #Shorts로 충분함.
  const title = `${monthDay} 시장 주도주 급등주 테마주 정리`;

  const stocksLine = uniqueStocks.length > 0 ? uniqueStocks.join(", ") : "오늘의 강세 종목";
  const headline = `📈 ${monthDaySpaced} 시장을 주도한 핵심 종목 TOP ${uniqueStocks.length || 5}`;

  const description = `🔥 전체 분석 보러가기 → ${postUrl}

${headline}

${stocksLine}

자세한 분석과 시장 전망은 위 링크에서 확인하세요
👉 ${postUrl}

#Shorts #주식 #특징주 #급등주 #테마주 #한국주식 #${monthDay} ${uniqueStocks.map((s) => `#${s}`).join(" ")}

⚠️ 본 영상은 정보 제공 목적이며, 투자 권유가 아닙니다. 투자의 책임은 본인에게 있습니다.`;

  const tags = [
    "주식",
    "특징주",
    "급등주",
    "테마주",
    "주도주",
    "한국주식",
    "shorts",
    "K주식핫이슈",
    monthDay,
    ...uniqueStocks,
  ];

  return { title, description, tags };
}

export function buildFeaturedStocksFirstComment(slug: string, postUrl: string): string {
  const { monthDaySpaced } = parseSlugDate(slug);
  return `📈 ${monthDaySpaced} 전체 분석 보기

👉 ${postUrl}

K주식핫이슈에서 매일 업데이트됩니다 ✅`;
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
