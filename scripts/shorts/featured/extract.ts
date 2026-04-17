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
import { getStockInfo } from "../../lib/stock-data";
import type { ShortsInputData, TopStock } from "../types";

// Top N sector leaders to render in body scenes. With featured-stocks we
// deliberately keep this to 5 so each sector gets meaningful airtime.
export const TOP_N_FEATURED = 5;
const MAX_HOOK_CANDIDATES = 5;

export async function extractFeaturedStocks(
  slug: string,
  topN?: number,
  stocksOverride?: readonly string[],
): Promise<ShortsInputData> {
  const post = loadPost(slug);
  const category = String(post.data.category ?? "featured-stocks");

  // 1. Parse the full stocks table for prices/등락률/거래대금 data
  const allStocks = parseFeatureTable(post.content);
  const stockMap = new Map<string, TopStock>();
  for (const s of allStocks) {
    stockMap.set(s.name, s);
  }

  let finalTopStocks: TopStock[];

  if (stocksOverride && stocksOverride.length > 0) {
    // User-specified override — use these names verbatim.
    // Source priority: 1) stockMap (table) → 2) body regex → 3) live naver API
    console.log(`   🎯 stocks override: ${stocksOverride.join(", ")}`);
    finalTopStocks = await buildOverrideTopStocks(stocksOverride, stockMap, post.content);
  } else {
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
    finalTopStocks = topStocks.length >= 3 ? topStocks : allStocks.slice(0, limit);
  }

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
 * Build TopStock entries from a user-specified override list.
 * Resolves each name from the table first, then falls back to body regex,
 * and finally fetches live etrade from naver finance.
 */
async function buildOverrideTopStocks(
  names: readonly string[],
  stockMap: Map<string, TopStock>,
  content: string,
): Promise<TopStock[]> {
  const result: TopStock[] = [];
  for (const name of names) {
    const fromTable = stockMap.get(name);
    if (fromTable) {
      result.push(fromTable);
      continue;
    }

    const bodyData = parseStockFromBody(content, name);
    let { changePercent, tradeAmount } = bodyData;

    if (changePercent === undefined) {
      const live = await getStockInfo(name);
      if (live) {
        const num = parseFloat(live.changePercent.replace(/[+%]/g, ""));
        if (!Number.isNaN(num)) changePercent = num;
        if (live.tradeAmount && live.tradeAmount !== "-") tradeAmount = live.tradeAmount;
      }
    }

    if (changePercent === undefined) {
      console.warn(`   ⚠️ "${name}" 데이터 확보 실패, 스킵`);
      continue;
    }

    result.push({
      name,
      sector: bodyData.sector || "관련주",
      reason: bodyData.reason || "",
      changePercent,
      tradeAmount: tradeAmount || "-억원",
    });
  }
  return result;
}

interface BodyStockData {
  sector: string;
  reason: string;
  changePercent?: number;
  tradeAmount?: string;
}

function parseStockFromBody(content: string, name: string): BodyStockData {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let sector = "";
  let reason = "";

  // Find H3 sector whose "주요 종목:" line lists this name
  const sectionRegex = /^### (.+?)\n([\s\S]*?)(?=^### |^## |$(?![\r\n]))/gm;
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(content)) !== null) {
    const heading = m[1].trim();
    const body = m[2];
    const major = body.match(/주요 종목:\s*([^\n]+)/);
    if (major) {
      const listed = major[1].split(",").map((s) => s.trim());
      if (listed.includes(name)) {
        sector = heading.replace(/^[^가-힣A-Za-z]+/, "").replace(/\s*관련주\s*$/, "").trim();
        const sentenceRe = new RegExp(`[^.\\n]*${escaped}[^.\\n]*\\.`, "u");
        const sm = body.match(sentenceRe);
        if (sm) reason = sm[0].trim().replace(/<\/?mark>/g, "");
        break;
      }
    }
  }

  // changePercent: "{name}{조사} <mark>?12.34% 급등" 같은 패턴
  const changeRe = new RegExp(`${escaped}[은는이가]?\\s*(?:<mark>)?\\s*([\\d.]+)%`, "u");
  const cm = changeRe.exec(content);

  // tradeAmount: "{name} ... 거래대금 12,345억원"
  const tradeRe = new RegExp(`${escaped}[\\s\\S]{0,300}거래대금\\s*([\\d,]+)\\s*억원`, "u");
  const tm = tradeRe.exec(content);

  return {
    sector,
    reason,
    changePercent: cm ? parseFloat(cm[1]) : undefined,
    tradeAmount: tm ? `${tm[1]}억원` : undefined,
  };
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
