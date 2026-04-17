/**
 * Stage 1 (router): Dispatch MDX extraction by category.
 *
 * Actual logic lives in the category-specific modules — this file only decides
 * which one to call and handles the cache + CLI entry point:
 *
 *   featured-stocks  → ./featured/extract.ts
 *   hot-issues       → ./hot-issues/extract.ts
 *
 * Output cache: dist/shorts/pending/{slug}/{slug}.input.json
 *
 * Why the split exists: featured-stocks and hot-issues read entirely different
 * table shapes, run different Gemini prompts, and produce different hook types.
 * Keeping them in one file caused constant cross-contamination during edits.
 */

import "./lib/env-loader";
import fs from "node:fs";
import { loadPost } from "./lib/load-post";
import { extractFeaturedStocks } from "./featured/extract";
import { extractHotIssues } from "./hot-issues/extract";
import { inputJsonPath } from "./lib/shorts-paths";
import type { ShortsInputData } from "./types";

export async function extract(
  slug: string,
  opts: { force?: boolean; topN?: number; stocksOverride?: readonly string[] } = {},
): Promise<ShortsInputData> {
  const cachePath = inputJsonPath(slug);

  if (!opts.force && !opts.topN && !opts.stocksOverride && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as ShortsInputData;
    console.log(`   ♻️  캐시 사용: ${cachePath}`);
    return cached;
  }

  // Peek at category from frontmatter to decide which extractor to call.
  // Default to hot-issues when missing (legacy posts).
  const post = loadPost(slug);
  const category = String(post.data.category ?? "hot-issues");

  if (category === "hot-issues") {
    return extractHotIssues(slug, opts.topN);
  }
  return extractFeaturedStocks(slug, opts.topN, opts.stocksOverride);
}

// ============================================================
// CLI entry
// ============================================================

const isMain = (() => {
  try {
    const argvScript = (process.argv[1] ?? "").replace(/\\/g, "/");
    return (
      argvScript.endsWith("/scripts/shorts/extract.ts") ||
      argvScript.endsWith("\\scripts\\shorts\\extract.ts")
    );
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
      console.log(`\n✅ ${slug} extract 완료 (${data.category})`);
      console.log(`   제목: ${data.title}`);
      console.log(`   Top ${data.topStocks.length} stocks:`);
      for (const s of data.topStocks) {
        console.log(`     - ${s.name} (${s.sector}) +${s.changePercent.toFixed(2)}% / ${s.tradeAmount}`);
      }
      console.log(`   Mark phrases: ${data.markPhrases.length}개`);
      data.markPhrases.slice(0, 3).forEach((m) => console.log(`     · ${m}`));
      if (data.sectorHeadings.length > 0) {
        console.log(`   Sector headings: ${data.sectorHeadings.length}개`);
        data.sectorHeadings.forEach((h) => console.log(`     · ${h}`));
      }
      console.log(`   Hook candidates: ${data.hookCandidates.length}개`);
      data.hookCandidates.forEach((h) => console.log(`     · ${h}`));
      if (data.hookSummary) {
        console.log(`   Hook summary: ${data.hookSummary}`);
      }
      if (data.headerTitleOverride) {
        console.log(`   Header override: ${data.headerTitleOverride.replace(/\n/g, " / ")}`);
      }
      console.log(`\n   💾 ${inputJsonPath(slug)}`);
    })
    .catch((err) => {
      console.error(`\n❌ extract 실패:`, err);
      process.exit(1);
    });
}
