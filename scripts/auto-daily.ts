#!/usr/bin/env tsx
/**
 * Level 2 — Daily Scheduler: Crawl keywords and generate posts automatically.
 *
 * Usage:
 *   npx tsx scripts/auto-daily.ts
 */

import { crawlKeywords, type TrendingKeyword } from "./crawl-keywords";
import { execSync } from "child_process";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_POSTS_PER_DAY = 3;
const DELAY_BETWEEN_POSTS_MS = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runScript(scriptName: string, args: readonly string[] = []): string {
  const scriptPath = path.join(process.cwd(), "scripts", scriptName);
  const quotedArgs = args.map((a) => `"${a}"`).join(" ");
  const cmd = `npx tsx "${scriptPath}" ${quotedArgs}`;

  try {
    return execSync(cmd, {
      encoding: "utf-8",
      cwd: process.cwd(),
      timeout: 120_000, // 2 minute timeout per post
      env: { ...process.env },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Script ${scriptName} failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("═".repeat(60));
  console.log("📅 KStockFlow 일일 자동 포스팅");
  console.log(`📆 ${new Date().toLocaleDateString("ko-KR")}`);
  console.log("═".repeat(60));
  console.log();

  // Step 1: Crawl keywords
  const keywords = await crawlKeywords();
  const selected = keywords.slice(0, MAX_POSTS_PER_DAY);

  if (selected.length === 0) {
    console.log("❌ 사용 가능한 키워드가 없습니다. 종료합니다.");
    process.exit(1);
  }

  console.log(`\n📝 오늘 생성할 포스트: ${selected.length}개\n`);

  // Step 2: Generate posts
  const results: Array<{
    readonly keyword: string;
    readonly success: boolean;
    readonly error?: string;
  }> = [];

  for (let i = 0; i < selected.length; i++) {
    const kw = selected[i];
    console.log("─".repeat(60));
    console.log(`[${i + 1}/${selected.length}] 🔧 "${kw.keyword}" 포스트 생성 중...`);
    console.log("─".repeat(60));

    try {
      const output = runScript("generate-post.ts", [kw.keyword]);
      console.log(output);
      results.push({ keyword: kw.keyword, success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ 실패: ${message}`);
      results.push({ keyword: kw.keyword, success: false, error: message });
    }

    // Delay between posts (except after the last one)
    if (i < selected.length - 1) {
      console.log(`  ⏳ ${DELAY_BETWEEN_POSTS_MS / 1000}초 대기...\n`);
      await sleep(DELAY_BETWEEN_POSTS_MS);
    }
  }

  // Step 3: Publish all at once
  const successCount = results.filter((r) => r.success).length;

  if (successCount > 0) {
    console.log("\n" + "─".repeat(60));
    console.log("🚀 전체 포스트 퍼블리싱...");
    console.log("─".repeat(60));

    try {
      const output = runScript("publish.ts");
      console.log(output);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ 퍼블리싱 실패: ${message}`);
    }
  }

  // Step 4: Summary
  console.log("\n" + "═".repeat(60));
  console.log("📊 일일 포스팅 결과 요약");
  console.log("═".repeat(60));
  console.log();

  for (const result of results) {
    const status = result.success ? "✅ 성공" : "❌ 실패";
    console.log(`  ${status} — ${result.keyword}`);
    if (result.error) {
      console.log(`         └─ ${result.error.slice(0, 80)}`);
    }
  }

  console.log();
  console.log(`  📈 성공: ${successCount}/${results.length}`);
  console.log(`  📉 실패: ${results.length - successCount}/${results.length}`);
  console.log();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ 일일 스케줄러 오류: ${message}`);
  process.exit(1);
});
