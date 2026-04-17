/**
 * sector-leaders upload metadata builder.
 *
 * YouTube title/description/tags + first-comment for the sector-leaders
 * daily Shorts. Format: "{N월N일} 시장 주도섹터 총정리 | {top 3 섹터 키워드} 강세"
 * (user-approved 2026-04-15).
 *
 * Kept separate from featured/ and hot-issues/ — neither category's
 * upload-meta may be imported or shared here.
 */

import type { SectorLeadersScript } from "./types";

export interface UploadMetadata {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
}

/**
 * Build YouTube metadata from a SectorLeadersScript + original featured-stocks MDX slug.
 *
 * `mdxSlug` is the base slug WITHOUT the "-sector-leaders" suffix — used only
 * to derive the date and the blog post URL.
 */
export function buildSectorLeadersMetadata(
  mdxSlug: string,
  script: SectorLeadersScript | null,
  postUrl: string,
): UploadMetadata {
  const { monthDay, monthDaySpaced } = parseSlugDate(mdxSlug);
  const sectorKeywords = extractSectorKeywords(script);
  const top3 = sectorKeywords.slice(0, 3);

  // User-approved title template (2026-04-15):
  //   "4월15일 시장 주도섹터 총정리 | 양자암호·전력설비·건설 강세"
  const titleTail =
    top3.length >= 2 ? ` | ${top3.join("·")} 강세` : "";
  const title = `${monthDay} 시장 주도섹터 총정리${titleTail}`;

  // Build description: full sector list (one per line) + blog link + hashtags.
  const sectorLines = sectorKeywords
    .map((kw, i) => `${i + 1}. ${kw}`)
    .join("\n");
  const hashtags = [
    "#Shorts",
    "#주도섹터",
    "#주식",
    "#시장분석",
    "#특징주",
    "#한국주식",
    `#${monthDay}`,
    ...sectorKeywords.map((k) => `#${k.replace(/\s+/g, "")}`),
  ].join(" ");

  const description = `🔥 전체 분석 보러가기 → ${postUrl}

📊 ${monthDaySpaced} 시장을 주도한 섹터 TOP ${sectorKeywords.length || 7}

${sectorLines || "오늘의 주도 섹터"}

각 섹터별 주요 종목 상승률은 영상에서 확인하세요 👆
자세한 시장 분석 및 섹터별 종목별 심층 분석은 블로그에서
👉 ${postUrl}

${hashtags}

⚠️ 본 영상은 정보 제공 목적이며, 투자 권유가 아닙니다. 투자의 책임은 본인에게 있습니다.`;

  const tags = [
    "주식",
    "주도섹터",
    "시장분석",
    "특징주",
    "테마주",
    "한국주식",
    "shorts",
    "K주식핫이슈",
    monthDay,
    ...sectorKeywords,
  ];

  return { title, description, tags };
}

export function buildSectorLeadersFirstComment(
  mdxSlug: string,
  script: SectorLeadersScript | null,
  postUrl: string,
): string {
  const { monthDaySpaced } = parseSlugDate(mdxSlug);
  const sectorKeywords = extractSectorKeywords(script);
  const sectorLine =
    sectorKeywords.length > 0 ? sectorKeywords.join(" · ") : "오늘의 주도 섹터";
  return `📊 ${monthDaySpaced} 주도 섹터

${sectorLine}

👉 전체 분석: ${postUrl}

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

/**
 * Convert sector headings from MDX into SEO-friendly keywords.
 *
 *   "🔐 양자암호/양자컴퓨팅 관련주" → "양자암호"
 *   "⚡ 전력설비/전선 관련주"       → "전력설비"
 *   "🏗️ 건설/재건 관련주"           → "건설"
 *
 * Rules:
 *   1. Strip emoji prefix
 *   2. Drop trailing "관련주"/"주"
 *   3. Take the first token before "/"
 */
function extractSectorKeywords(script: SectorLeadersScript | null): string[] {
  if (!script?.sectorHeadings) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const heading of script.sectorHeadings) {
    const kw = normalizeSectorKeyword(heading);
    if (kw.length === 0 || seen.has(kw)) continue;
    seen.add(kw);
    out.push(kw);
  }
  return out;
}

function normalizeSectorKeyword(heading: string): string {
  // Strip emoji AND trailing variation selectors (U+FE0F).
  // Example: "🏗️ 건설/재건 관련주" ← "🏗" (U+1F3D7) + "️" (U+FE0F) + " 건설/..."
  // If we only strip the base emoji, the VS-16 stays and shows as a phantom space.
  return heading
    .replace(
      /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\u{FE0F}\u{200D}]+\s*/u,
      "",
    )
    .replace(/^\uFE0F\s*/, "") // defensive: leading VS-16 if base-emoji fell outside the block
    .replace(/\s*관련주\s*$/, "")
    .split("/")[0]
    .trim();
}
