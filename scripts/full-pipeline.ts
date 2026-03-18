#!/usr/bin/env tsx
/**
 * Level 3 — Full Automation Pipeline: Crawl, generate, thumbnail, publish, index.
 *
 * Usage:
 *   npx tsx scripts/full-pipeline.ts
 *
 * Google Indexing API setup:
 *   1. Enable "Web Search Indexing API" in Google Cloud Console
 *   2. Create a Service Account and download the JSON key
 *   3. Add the service account email as an owner in Google Search Console
 *   4. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env.local
 *   5. Install googleapis: npm install googleapis
 */

import { crawlKeywords, type TrendingKeyword } from "./crawl-keywords";
import { buildPrompt, parseResponse, getCategorySlug, type GeneratedPost } from "./lib/claude-prompt";
import { getMultipleStockInfo, stockSummaryTable, stockPerItemBlocks, stockInfoToContext } from "./lib/stock-data";
import { findAndDownloadThumbnail } from "./lib/image-search";
import { searchNews, newsToContext } from "./lib/news-search";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_POSTS = 3;
const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const THUMBNAILS_DIR = path.join(process.cwd(), "public", "images", "thumbnails");
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kstockflow.com";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineResult {
  readonly keyword: string;
  readonly slug: string;
  readonly title: string;
  readonly postPath: string;
  readonly thumbnailPath: string;
  readonly success: boolean;
  readonly error?: string;
}

interface PipelineReport {
  readonly startTime: Date;
  readonly endTime: Date;
  readonly keywords: readonly TrendingKeyword[];
  readonly results: readonly PipelineResult[];
  readonly publishSuccess: boolean;
  readonly indexingResults: readonly { url: string; success: boolean }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadEnvVar(key: string): string | null {
  // Try .env.local
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
    if (match) return match[1].trim().replace(/^"(.*)"$/, "$1");
  }
  return process.env[key] ?? null;
}

function toSlug(text: string): string {
  const slug = text
    .replace(/[가-힣]+/g, " ")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();
  if (slug) return slug;
  const ts = Date.now().toString(36).slice(-6);
  return `post-${ts}`;
}

function todayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", cwd: process.cwd() }).trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Command failed: ${cmd}\n${message}`);
  }
}

// ---------------------------------------------------------------------------
// Step 1: Generate a single post via Claude API
// ---------------------------------------------------------------------------

async function generateSinglePost(keyword: string): Promise<PipelineResult> {
  const date = todayDate();
  const slug = `${date}-${toSlug(keyword)}`;

  try {
    const apiKey = loadEnvVar("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    // Dynamic import to handle case where SDK is not installed
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    // 최신 뉴스 검색
    const newsItems = await searchNews(keyword, 10);
    const newsContext = newsToContext(newsItems);
    const { system, user } = buildPrompt(keyword, newsContext || undefined);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    });

    const rawText = response.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const post = parseResponse(rawText, keyword);

    // Fetch stock data for related stocks mentioned by Claude
    let stockInfoList: Awaited<ReturnType<typeof getMultipleStockInfo>> = [];
    if (post.relatedStocks.length > 0) {
      console.log(`    📊 관련주 시세 조회: ${post.relatedStocks.join(", ")}`);
      stockInfoList = await getMultipleStockInfo(post.relatedStocks);
    }

    // Search and download thumbnail image
    const { path: thumbnailImagePath, credit: imageCredit } =
      await findAndDownloadThumbnail(keyword, slug);

    // Build MDX content
    if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

    const tags = post.tags.map((t) => `"${t}"`).join(", ");
    const categorySlug = getCategorySlug(post.category);

    let body = post.content;

    // 시세 데이터 삽입
    if (stockInfoList.length > 0) {
      // 요약 테이블을 Claude 테이블 뒤에 삽입
      const summaryMd = stockSummaryTable(stockInfoList);
      const sectionIdx = body.indexOf("## 관련주 분석");
      if (sectionIdx !== -1) {
        const afterHeader = body.slice(sectionIdx);
        const tableEndMatch = afterHeader.match(/(\|[^\n]+\|\n)+/);
        if (tableEndMatch) {
          const tableEndPos = sectionIdx + (tableEndMatch.index ?? 0) + tableEndMatch[0].length;
          body = body.slice(0, tableEndPos) + "\n" + summaryMd + "\n" + body.slice(tableEndPos);
        }
      }

      // 개별 종목 시세+차트 삽입
      const perItemBlocks = stockPerItemBlocks(stockInfoList);
      for (const [stockName, block] of perItemBlocks) {
        const escaped = stockName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const headingRegex = new RegExp(`(### \\d+\\.\\s*${escaped}[^\n]*)(\n)`, "g");
        body = body.replace(headingRegex, `$1$2${block}\n`);
      }
    }

    if (imageCredit) body += `\n\n---\n\n*${imageCredit}*`;

    const mdx = `---
title: "${post.title}"
description: "${post.description}"
date: "${date}"
category: "${categorySlug}"
tags: [${tags}]
thumbnail: "${thumbnailImagePath}"
relatedStocks: [${post.relatedStocks.map((s) => `"${s}"`).join(", ")}]
---

${body}
`;

    const postPath = path.join(POSTS_DIR, `${slug}.mdx`);
    fs.writeFileSync(postPath, mdx, "utf-8");

    return {
      keyword,
      slug,
      title: post.title,
      postPath,
      thumbnailPath: thumbnailImagePath,
      success: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      keyword,
      slug,
      title: "",
      postPath: "",
      thumbnailPath: "",
      success: false,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Step 2: Git publish
// ---------------------------------------------------------------------------

function gitPublish(): boolean {
  try {
    run("git add content/posts/");
    run("git add public/images/thumbnails/");

    const diff = run("git diff --cached --name-only");
    if (!diff) {
      console.log("  ⚠️  스테이징된 변경사항 없음");
      return false;
    }

    const date = todayDate();
    run(`git commit -m "feat: auto-publish ${date} daily posts"`);
    run("git push origin main");
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ Git 오류: ${message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Step 3: Request Google indexing
// ---------------------------------------------------------------------------

async function requestIndexing(
  slugs: readonly string[],
): Promise<readonly { url: string; success: boolean }[]> {
  const serviceEmail = loadEnvVar("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = loadEnvVar("GOOGLE_PRIVATE_KEY");

  if (!serviceEmail || !privateKey) {
    console.log("  ⚠️  Google 서비스 계정 미설정 — 인덱싱 요청 건너뜀");
    console.log("     .env.local에 GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY를 설정하세요.");
    return slugs.map((slug) => ({
      url: `${SITE_URL}/post/${slug}`,
      success: false,
    }));
  }

  /**
   * Google Indexing API integration.
   *
   * Prerequisites:
   *   npm install googleapis
   *
   * The code below uses the googleapis package to authenticate with a
   * service account and submit URL_UPDATED notifications.
   */
  try {
    const { google } = await import("googleapis");

    const auth = new google.auth.JWT(
      serviceEmail,
      undefined,
      privateKey.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/indexing"],
    );

    const indexing = google.indexing({ version: "v3", auth });

    const results: { url: string; success: boolean }[] = [];

    for (const slug of slugs) {
      const url = `${SITE_URL}/post/${slug}`;
      try {
        await indexing.urlNotifications.publish({
          requestBody: { url, type: "URL_UPDATED" },
        });
        results.push({ url, success: true });
        console.log(`  ✅ 인덱싱 요청: ${url}`);
      } catch {
        results.push({ url, success: false });
        console.log(`  ❌ 인덱싱 실패: ${url}`);
      }
    }

    return results;
  } catch {
    console.log("  ⚠️  googleapis 패키지를 찾을 수 없습니다. npm install googleapis 를 실행하세요.");
    return slugs.map((slug) => ({
      url: `${SITE_URL}/post/${slug}`,
      success: false,
    }));
  }
}

// ---------------------------------------------------------------------------
// Step 4: Print report
// ---------------------------------------------------------------------------

function printReport(report: PipelineReport): void {
  const duration = (report.endTime.getTime() - report.startTime.getTime()) / 1000;

  console.log("\n" + "═".repeat(60));
  console.log("📋 전체 파이프라인 실행 보고서");
  console.log("═".repeat(60));
  console.log();
  console.log(`⏱️  실행 시간: ${duration.toFixed(1)}초`);
  console.log(`📆 실행 일시: ${report.startTime.toLocaleString("ko-KR")}`);
  console.log();

  // Keywords
  console.log("🔍 수집된 키워드:");
  for (const kw of report.keywords) {
    console.log(`   [${kw.trend_score}] ${kw.keyword} (${kw.source})`);
  }
  console.log();

  // Post generation results
  console.log("📝 포스트 생성 결과:");
  for (const r of report.results) {
    if (r.success) {
      console.log(`   ✅ ${r.title}`);
      console.log(`      └─ ${r.postPath}`);
    } else {
      console.log(`   ❌ ${r.keyword}`);
      console.log(`      └─ ${r.error?.slice(0, 80)}`);
    }
  }
  console.log();

  // Deployment
  const successCount = report.results.filter((r) => r.success).length;
  const failCount = report.results.length - successCount;
  console.log(`📊 통계: 성공 ${successCount} / 실패 ${failCount}`);
  console.log(`🚀 배포: ${report.publishSuccess ? "✅ 완료" : "❌ 실패 또는 건너뜀"}`);

  // Indexing
  if (report.indexingResults.length > 0) {
    const indexed = report.indexingResults.filter((r) => r.success).length;
    console.log(`🔗 인덱싱: ${indexed}/${report.indexingResults.length} 요청 완료`);
  }

  console.log("\n" + "═".repeat(60));
  console.log();
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = new Date();

  console.log("═".repeat(60));
  console.log("🏭 KStockFlow 전체 자동화 파이프라인");
  console.log(`📆 ${startTime.toLocaleString("ko-KR")}`);
  console.log("═".repeat(60));
  console.log();

  // --- Step 1: Crawl keywords ---
  console.log("🔎 Step 1/4: 키워드 크롤링");
  const keywords = await crawlKeywords();
  const selected = keywords.slice(0, MAX_POSTS);

  // --- Step 2: Generate posts + thumbnails ---
  console.log("\n📝 Step 2/4: 포스트 및 썸네일 생성");
  const results: PipelineResult[] = [];

  for (let i = 0; i < selected.length; i++) {
    const kw = selected[i];
    console.log(`\n  [${i + 1}/${selected.length}] "${kw.keyword}" 처리 중...`);

    const result = await generateSinglePost(kw.keyword);
    results.push(result);

    if (result.success) {
      console.log(`  ✅ 생성 완료: ${result.title}`);
    } else {
      console.log(`  ❌ 생성 실패: ${result.error?.slice(0, 80)}`);
    }

    if (i < selected.length - 1) await sleep(2000);
  }

  // --- Step 3: Git publish ---
  console.log("\n🚀 Step 3/4: Git 퍼블리싱");
  const successSlugs = results.filter((r) => r.success).map((r) => r.slug);
  let publishSuccess = false;

  if (successSlugs.length > 0) {
    publishSuccess = gitPublish();
  } else {
    console.log("  ⚠️  성공한 포스트가 없어 퍼블리싱 건너뜀");
  }

  // --- Step 4: Google indexing ---
  console.log("\n🔗 Step 4/4: Google 인덱싱 요청");
  const indexingResults = publishSuccess
    ? await requestIndexing(successSlugs)
    : [];

  // --- Report ---
  const report: PipelineReport = {
    startTime,
    endTime: new Date(),
    keywords: selected,
    results,
    publishSuccess,
    indexingResults,
  };

  printReport(report);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ 파이프라인 치명적 오류: ${message}`);
  process.exit(1);
});
