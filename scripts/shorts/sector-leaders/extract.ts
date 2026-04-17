/**
 * Stage 1 (sector-leaders): Parse a featured-stocks MDX post into
 * SectorLeadersInputData.
 *
 * Sector-leaders flow:
 *   1. Load the MDX post (uses original slug — e.g., "2026-04-15-featured-stocks")
 *   2. Parse the 5-col table (종목명/주요섹터/상승이유/등락률/거래대금) —
 *      source-of-truth for 등락률 lookup
 *   3. Parse the "## 섹터별 특징주 분석" H2 into one entry per H3 sector
 *   4. For each sector's 주요 종목 list, resolve 등락률:
 *        priority 1) table (allStocks) → 2) body regex → 3) live Naver API
 *   5. Write the cache to `dist/shorts/pending/{cacheSlug}/{cacheSlug}.input.json`
 *
 * Caller passes `cacheSlug` (typically `${mdxSlug}-sector-leaders`) so the
 * cache directory stays isolated from the featured-stocks pipeline that runs
 * on the same MDX file.
 */
import "../lib/env-loader";
import fs from "node:fs";
import { loadPost, getRelatedStocks, getTags } from "../lib/load-post";
import { parseFeatureTable } from "../lib/table-parser";
import { ensureDir, inputJsonPath, pendingDir } from "../lib/shorts-paths";
import { getStockInfo } from "../../lib/stock-data";
import type { TopStock } from "../types";
import { parseSectorSections } from "./parse-sectors";
import { summarizeSectorReasons } from "./summarize-reason";
import type { SectorLeadersInputData, SectorScene, SectorStockRow } from "./types";

const EMOJI_PREFIX_REGEX =
  /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}]+)\s*/u;

export async function extractSectorLeadersData(
  mdxSlug: string,
  cacheSlug: string,
): Promise<SectorLeadersInputData> {
  const post = loadPost(mdxSlug);
  const allStocks = parseFeatureTable(post.content);
  const stockMap = new Map<string, TopStock>();
  for (const s of allStocks) stockMap.set(s.name, s);

  const rawSections = parseSectorSections(post.content);
  if (rawSections.length === 0) {
    throw new Error(
      `"## 섹터별 특징주 분석" H2 섹션을 찾을 수 없습니다. sector-leaders 쇼츠는 해당 섹션이 필수입니다.`,
    );
  }

  // Collect all unique stock names that need change% resolution (table miss).
  const needsLookup = new Set<string>();
  for (const raw of rawSections) {
    for (const name of raw.stockNames) {
      if (!stockMap.has(name)) needsLookup.add(name);
    }
  }

  // Body-regex + Naver fallback in parallel for any un-tabled names.
  const resolvedFromOutside = new Map<string, number>();
  if (needsLookup.size > 0) {
    console.log(`   🔎 테이블 밖 ${needsLookup.size}개 종목 등락률 lookup...`);
    await Promise.all(
      Array.from(needsLookup).map(async (name) => {
        const fromBody = extractChangePercentFromBody(post.content, name);
        if (fromBody !== null) {
          resolvedFromOutside.set(name, fromBody);
          return;
        }
        try {
          const live = await getStockInfo(name);
          if (live) {
            const num = parseFloat(String(live.changePercent).replace(/[+%]/g, ""));
            if (!Number.isNaN(num)) {
              resolvedFromOutside.set(name, num);
            }
          }
        } catch {
          // Silent — unresolved stocks fall back to 0 (UI renders "-").
        }
      }),
    );
    console.log(
      `      ✅ ${resolvedFromOutside.size} / ${needsLookup.size} 해결 (나머지는 0%로 표시)`,
    );
  }

  // Gemini 1-sentence summarization for each sector (batch call).
  // Falls back to the truncated first paragraph on failure.
  console.log(`   🧠 Gemini 섹터 상승이유 요약 (${rawSections.length}개 batch)...`);
  const summaries = await summarizeSectorReasons(
    rawSections.map((r) => ({ sectorHeading: r.sectorHeading, fullText: r.fullText })),
  );
  if (summaries) {
    console.log(`      ✅ ${summaries.length}개 요약 생성`);
  } else {
    console.log(`      ⚠️  요약 실패 — 규칙 기반 truncate 사용`);
  }

  const sectors: SectorScene[] = rawSections.map((raw, i) => {
    const stocks: SectorStockRow[] = raw.stockNames.map((name) => {
      const fromTable = stockMap.get(name);
      if (fromTable) return { name, changePercent: fromTable.changePercent };
      const fromOutside = resolvedFromOutside.get(name);
      if (typeof fromOutside === "number") return { name, changePercent: fromOutside };
      return { name, changePercent: 0 };
    });

    const emojiMatch = EMOJI_PREFIX_REGEX.exec(raw.sectorHeading);
    const emoji = emojiMatch ? emojiMatch[1] : "";
    const sectorTitle = raw.sectorHeading
      .replace(EMOJI_PREFIX_REGEX, "")
      .trim();

    const summarized = summaries?.[i]?.trim();
    const reason = summarized && summarized.length > 0 ? summarized : raw.reason;

    return {
      sectorHeading: raw.sectorHeading,
      emoji,
      sectorTitle,
      reason,
      stocks,
    };
  });

  const data: SectorLeadersInputData = {
    slug: cacheSlug,
    date: String(post.data.date ?? ""),
    title: String(post.data.title ?? ""),
    description: String(post.data.description ?? ""),
    category: "sector-leaders",
    relatedStocks: getRelatedStocks(post),
    tags: getTags(post),
    thumbnailPath: typeof post.data.thumbnail === "string" ? post.data.thumbnail : null,
    sectors,
    allStocks,
  };

  ensureDir(pendingDir(cacheSlug));
  fs.writeFileSync(inputJsonPath(cacheSlug), JSON.stringify(data, null, 2), "utf-8");
  return data;
}

/**
 * Pull the first "{name} ... NN.NN%" pattern from the MDX body.
 * Sector-leaders keeps its own extractor rather than sharing featured/'s
 * parseStockFromBody — per the "no logic sharing between categories" rule.
 */
function extractChangePercentFromBody(content: string, name: string): number | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Tight window (0~120 chars) so we don't accidentally grab another stock's %
  const tight = new RegExp(`${escaped}[\\s\\S]{0,120}?([+-]?\\d+(?:\\.\\d+)?)\\s*%`, "u");
  const m = tight.exec(content);
  if (!m) return null;
  const num = parseFloat(m[1]);
  return Number.isNaN(num) ? null : num;
}
