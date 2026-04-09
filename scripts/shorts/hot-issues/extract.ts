/**
 * Stage 1 (hot-issues): Parse a themed related-stocks MDX post into ShortsInputData.
 *
 * Hot-issues flow:
 *   1. Parse 5-col table (구분/종목/핵심포인트/등락률/거래대금)
 *   2. Extract per-stock "### N. 종목명" long descriptions
 *   3. Gemini batch-summarize each → 50~65 char one-liners (reason field)
 *   4. Extract the full "## 핵심 요약" section
 *   5. Gemini condense → 60~85 char one-sentence hook (hookSummary)
 *   6. Read frontmatter shorts_header_title for exact letterbox/hook override
 *
 * This file is the SINGLE source of truth for hot-issues extraction — no
 * featured-stocks logic here. Add new hot-issues knobs here, not in the router.
 */
import "../lib/env-loader";
import fs from "node:fs";
import { loadPost, getRelatedStocks, getTags } from "../lib/load-post";
import { parseHotIssuesTable } from "../lib/table-parser";
import {
  extractHookSection,
  extractHookSummary,
  extractMarkPhrases,
  extractStockDescriptions,
} from "../lib/mark-extractor";
import { summarizeStockDescriptions } from "../lib/summarize-stocks";
import { summarizeHookForShorts } from "../lib/summarize-hook";
import { ensureDir, inputJsonPath, pendingDir } from "../lib/shorts-paths";
import type { ShortsInputData } from "../types";

// Top N related stocks to render — capped so TTS + all scenes fit within the
// 60s YouTube Shorts preferred window.
export const TOP_N_HOT_ISSUES = 7;

export async function extractHotIssues(slug: string): Promise<ShortsInputData> {
  const post = loadPost(slug);
  const category = String(post.data.category ?? "hot-issues");

  // 1. Parse the theme-related stocks table
  const hotStocks = parseHotIssuesTable(post.content);

  // 2. Extract per-stock long descriptions and Gemini-summarize them
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
    summaries = descriptions; // fallback to raw description
  }

  const enrichedStocks = hotStocks.map((s) => ({
    ...s,
    // Priority: Gemini summary > raw description > table 핵심 포인트
    reason: summaries.get(s.name) ?? descriptions.get(s.name) ?? s.reason,
  }));

  // 3. Top N limit for narration budget
  const topStocks = enrichedStocks.slice(0, TOP_N_HOT_ISSUES);

  // 4. Gemini one-shot: summarize 핵심 요약 → hook narration + 2-line header title.
  //    Both outputs come from the same Gemini call so hook/header stay thematically
  //    consistent and we don't waste API quota on two separate requests.
  const hookSection = extractHookSection(post.content);
  let hookSummary: string | null = null;
  let geminiHeaderTitle: string | null = null;
  if (hookSection && hookSection.length >= 50) {
    try {
      console.log(`   🎯 Gemini 후크 + 헤더 생성 중...`);
      const result = await summarizeHookForShorts(
        String(post.data.title ?? ""),
        hookSection,
        topStocks.length, // header 2번째 줄의 "관련주 TOP N" 정확한 값
      );
      hookSummary = result.hook;
      geminiHeaderTitle = result.headerTitle;
      console.log(`   ✅ 후크: ${hookSummary} (${hookSummary.length}자)`);
      console.log(`   ✅ 헤더: ${geminiHeaderTitle.replace(/\n/g, " / ")}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️  Gemini 후크 생성 실패, 휴리스틱 fallback: ${msg.slice(0, 100)}`);
    }
  }
  if (!hookSummary) {
    hookSummary = extractHookSummary(post.content, 2);
  }

  const markPhrases = extractMarkPhrases(post.content);

  // 5. Header title resolution order (hot-issues always has a header):
  //    1. frontmatter shorts_header_title (manual override — preferred when user
  //       wants exact control, e.g. a specific phrasing that Gemini can't infer)
  //    2. Gemini-generated headerTitle (auto, thematically consistent with hook)
  //    3. null → assets.ts falls back to buildHotIssuesHeaderTitle heuristic
  const rawHeaderOverride =
    typeof post.data.shorts_header_title === "string" ? post.data.shorts_header_title : null;
  const frontmatterHeader = rawHeaderOverride
    ? rawHeaderOverride.replace(/\\n/g, "\n")
    : null;
  const headerTitleOverride = frontmatterHeader ?? geminiHeaderTitle;

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
    sectorHeadings: [], // not used by hot-issues
    hookCandidates: hookSummary ? [hookSummary] : [],
    hookSummary,
    headerTitleOverride,
  };

  ensureDir(pendingDir(slug));
  fs.writeFileSync(inputJsonPath(slug), JSON.stringify(data, null, 2), "utf-8");
  return data;
}
