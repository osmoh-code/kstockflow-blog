/**
 * Stage 1 (featured-stocks): Parse a daily market recap MDX post into ShortsInputData.
 *
 * Featured-stocks flow:
 *   1. Parse 5-col table (종목명/주요섹터/상승이유/등락률/거래대금)
 *   2. Extract one leader per sector from "## 섹터별 특징주 분석" headings
 *   3. Join leader names with table data (changePercent + tradeAmount)
 *   4. Build heuristic hook candidates (top gainer, cross-sector mix, ...)
 *   5. Extract <mark> highlight phrases for narration reference
 *
 * This file is the SINGLE source of truth for featured-stocks extraction — no
 * hot-issues logic here.
 */
import "../lib/env-loader";
import fs from "node:fs";
import { loadPost, getRelatedStocks, getTags } from "../lib/load-post";
import { parseFeatureTable } from "../lib/table-parser";
import {
  extractMarkPhrases,
  extractSectorHeadings,
  extractSectorLeaders,
} from "../lib/mark-extractor";
import { ensureDir, inputJsonPath, pendingDir } from "../lib/shorts-paths";
import type { ShortsInputData, TopStock } from "../types";

// Top N sector leaders to render in body scenes. With featured-stocks we
// deliberately keep this to 5 so each sector gets meaningful airtime.
export const TOP_N_FEATURED = 5;
const MAX_HOOK_CANDIDATES = 5;

export async function extractFeaturedStocks(slug: string, topN?: number): Promise<ShortsInputData> {
  const post = loadPost(slug);
  const category = String(post.data.category ?? "featured-stocks");

  // 1. Parse the full stocks table for prices/등락률/거래대금 data
  const allStocks = parseFeatureTable(post.content);
  const stockMap = new Map<string, TopStock>();
  for (const s of allStocks) {
    stockMap.set(s.name, s);
  }

  // 2. Extract one leader per sector from the blog's "섹터별 특징주 분석" section
  //    (uses the blog's own sector grouping — never invents new sectors)
  const sectorLeaders = extractSectorLeaders(post.content);

  // 3. Join leader names with the table data
  const topStocks: TopStock[] = sectorLeaders
    .map((leader) => stockMap.get(leader.leaderName))
    .filter((s): s is TopStock => s !== undefined)
    .slice(0, topN ?? TOP_N_FEATURED);

  // Fallback: if sector leaders can't be matched (e.g., post format differs),
  // fall back to the top-gain stocks from the table
  const limit = topN ?? TOP_N_FEATURED;
  const finalTopStocks = topStocks.length >= 3 ? topStocks : allStocks.slice(0, limit);

  const markPhrases = extractMarkPhrases(post.content);
  const sectorHeadings = extractSectorHeadings(post.content);
  const hookCandidates = buildHookCandidates(finalTopStocks, markPhrases);

  const data: ShortsInputData = {
    slug,
    date: String(post.data.date ?? ""),
    title: String(post.data.title ?? ""),
    description: String(post.data.description ?? ""),
    category,
    relatedStocks: getRelatedStocks(post),
    tags: getTags(post),
    thumbnailPath: typeof post.data.thumbnail === "string" ? post.data.thumbnail : null,
    topStocks: finalTopStocks,
    allStocks,
    markPhrases,
    sectorHeadings,
    hookCandidates,
    hookSummary: null,
    headerTitleOverride: null,
  };

  ensureDir(pendingDir(slug));
  fs.writeFileSync(inputJsonPath(slug), JSON.stringify(data, null, 2), "utf-8");
  return data;
}

/**
 * Heuristic hook candidates for featured-stocks shorts.
 * Gemini (script.ts) picks one of these as a reference when generating the
 * actual on-screen hook text.
 */
function buildHookCandidates(
  stocks: readonly TopStock[],
  marks: readonly string[],
): readonly string[] {
  const candidates: string[] = [];

  // Top stock with biggest gain (always sector leader of biggest sector)
  if (stocks.length > 0) {
    const top = stocks[0];
    const isLimitUp = top.changePercent >= 29.5;
    if (isLimitUp) {
      candidates.push(`${top.name}이 +${top.changePercent.toFixed(0)}% 폭등한 진짜 이유`);
    } else {
      candidates.push(`오늘 ${top.name} +${top.changePercent.toFixed(2)}% 강세`);
    }
  }

  // Cross-sector multi-stock hook
  if (stocks.length >= 3) {
    const sectors = Array.from(new Set(stocks.slice(0, 4).map((s) => s.sector.split(/[\/\s]/)[0])));
    if (sectors.length >= 3) {
      candidates.push(`${sectors.slice(0, 3).join(", ")}까지 오늘 시장 주도주 총정리`);
    }
    candidates.push(`${stocks[0].name}, ${stocks[1].name}, ${stocks[2].name} 오늘 강세 종목 모음`);
  }

  // Sector diversity hook
  if (stocks.length >= 4) {
    candidates.push(`오늘 시장 주도한 ${stocks.length}개 섹터 대장주 한번에`);
  }

  // Mark phrase fallback (dramatic numbers often)
  if (marks.length > 0) {
    const dramaticMark = marks.find((m) => /\d/.test(m)) ?? marks[0];
    candidates.push(dramaticMark);
  }

  return candidates.slice(0, MAX_HOOK_CANDIDATES);
}
