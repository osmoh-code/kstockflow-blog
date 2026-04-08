/**
 * Stage 1: Extract structured shorts input data from a blog post MDX file.
 *
 * Usage:
 *   npx tsx scripts/shorts/extract.ts <slug> [--force]
 *
 * Output:
 *   dist/shorts/pending/{slug}/{slug}.input.json
 */

import fs from "node:fs";
import { loadPost, getRelatedStocks, getTags } from "./lib/load-post";
import { parseFeatureTable, parseHotIssuesTable } from "./lib/table-parser";
import {
  extractHookSummary,
  extractMarkPhrases,
  extractSectorHeadings,
  extractSectorLeaders,
  extractStockDescriptions,
} from "./lib/mark-extractor";
import { summarizeStockDescriptions } from "./lib/summarize-stocks";
import { ensureDir, inputJsonPath, pendingDir } from "./lib/shorts-paths";
import type { ShortsInputData, TopStock } from "./types";

const TOP_N_FEATURED = 5;     // featured-stocks: sector Top 5
const TOP_N_HOT_ISSUES = 10;  // hot-issues: include all related stocks up to 10
const MAX_HOOK_CANDIDATES = 5;

export async function extract(slug: string, opts: { force?: boolean } = {}): Promise<ShortsInputData> {
  const cachePath = inputJsonPath(slug);

  if (!opts.force && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as ShortsInputData;
    console.log(`   ♻️  캐시 사용: ${cachePath}`);
    return cached;
  }

  const post = loadPost(slug);
  const category = String(post.data.category ?? "hot-issues");

  // =====================================================
  // Branch: hot-issues (3-column table, theme-based post)
  // =====================================================
  if (category === "hot-issues") {
    const hotStocks = parseHotIssuesTable(post.content);
    // Per-stock long descriptions from "### N. 종목명" sections (1~3 sentences,
    // up to ~300 chars), then Gemini summarizes each into ~70~95 char single
    // sentences that combine theme rationale + stock-specific strength.
    const descriptions = extractStockDescriptions(post.content, 3, 300);
    console.log(`   📝 ${descriptions.size}개 종목 설명 추출, Gemini 요약 호출 중...`);
    let summaries: Map<string, string>;
    try {
      summaries = await summarizeStockDescriptions(
        Array.from(descriptions.entries()).map(([name, description]) => ({ name, description })),
      );
      console.log(`   ✅ ${summaries.size}개 요약 완료`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️  Gemini 요약 실패, raw description 사용: ${msg.slice(0, 100)}`);
      summaries = descriptions; // fallback
    }

    const enrichedStocks = hotStocks.map((s) => ({
      ...s,
      // Priority: Gemini summary > raw description > table 핵심 포인트
      reason: summaries.get(s.name) ?? descriptions.get(s.name) ?? s.reason,
    }));

    // Include all up to TOP_N_HOT_ISSUES (10). User's requirement: all stocks
    // unless the post has more than 10 related stocks.
    const topStocks = enrichedStocks.slice(0, TOP_N_HOT_ISSUES);
    const hookSummary = extractHookSummary(post.content, 2);
    const markPhrases = extractMarkPhrases(post.content);

    const data: ShortsInputData = {
      slug,
      date: String(post.data.date ?? ""),
      title: String(post.data.title ?? ""),
      description: String(post.data.description ?? ""),
      category,
      relatedStocks: getRelatedStocks(post),
      tags: getTags(post),
      thumbnailPath: typeof post.data.thumbnail === "string" ? post.data.thumbnail : null,
      topStocks,
      allStocks: enrichedStocks,
      markPhrases,
      sectorHeadings: [],
      hookCandidates: hookSummary ? [hookSummary] : [],
      hookSummary,
    };

    ensureDir(pendingDir(slug));
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");
    return data;
  }

  // =====================================================
  // Branch: featured-stocks (existing logic)
  // =====================================================

  // 1. Parse the full stocks table for prices/등락률/거래대금 data
  const allStocks = parseFeatureTable(post.content);
  const stockMap = new Map<string, TopStock>();
  for (const s of allStocks) {
    stockMap.set(s.name, s);
  }

  // 2. Extract one leader per sector from the blog's "섹터별 특징주 분석" section
  //    (uses the blog's own sector grouping — never invents new sectors)
  const sectorLeaders = extractSectorLeaders(post.content);

  // 3. Join leader names with the table data (changePercent + tradeAmount)
  const topStocks: TopStock[] = sectorLeaders
    .map((leader) => stockMap.get(leader.leaderName))
    .filter((s): s is TopStock => s !== undefined)
    .slice(0, TOP_N_FEATURED);

  // Fallback: if sector leaders can't be matched (e.g., post format differs),
  // fall back to the top-gain stocks from the table
  const finalTopStocks = topStocks.length >= 3 ? topStocks : allStocks.slice(0, TOP_N_FEATURED);

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
  };

  ensureDir(pendingDir(slug));
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");

  return data;
}

function buildHookCandidates(stocks: readonly TopStock[], marks: readonly string[]): readonly string[] {
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

// CLI entry
const isMain = (() => {
  try {
    const argvScript = (process.argv[1] ?? "").replace(/\\/g, "/");
    return argvScript.endsWith("/scripts/shorts/extract.ts") || argvScript.endsWith("\\scripts\\shorts\\extract.ts");
  } catch {
    return false;
  }
})();

if (isMain) {
  const slug = process.argv[2];
  const force = process.argv.includes("--force");

  if (!slug) {
    console.error("사용법: npx tsx scripts/shorts/extract.ts <slug> [--force]");
    process.exit(1);
  }

  extract(slug, { force })
    .then((data) => {
      console.log(`\n✅ ${slug} extract 완료`);
      console.log(`   제목: ${data.title}`);
      console.log(`   Top ${data.topStocks.length} stocks:`);
      for (const s of data.topStocks) {
        console.log(`     - ${s.name} (${s.sector}) +${s.changePercent.toFixed(2)}% / ${s.tradeAmount}`);
      }
      console.log(`   Mark phrases: ${data.markPhrases.length}개`);
      data.markPhrases.slice(0, 3).forEach((m) => console.log(`     · ${m}`));
      console.log(`   Sector headings: ${data.sectorHeadings.length}개`);
      data.sectorHeadings.forEach((h) => console.log(`     · ${h}`));
      console.log(`   Hook candidates: ${data.hookCandidates.length}개`);
      data.hookCandidates.forEach((h) => console.log(`     · ${h}`));
      console.log(`\n   💾 ${inputJsonPath(slug)}`);
    })
    .catch((err) => {
      console.error(`\n❌ extract 실패:`, err);
      process.exit(1);
    });
}
