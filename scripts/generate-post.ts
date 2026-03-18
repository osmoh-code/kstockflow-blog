#!/usr/bin/env tsx
/**
 * Level 1 — Semi-auto CLI: Generate a blog post with Claude API.
 *
 * Features:
 * - Claude API로 SEO + AdSense 최적화된 블로그 포스트 생성
 * - 관련주 실시간 시세 데이터 자동 크롤링 (네이버 금융)
 * - 키워드 기반 썸네일 이미지 자동 검색 (Unsplash/Pixabay)
 * - 관련주 차트 이미지 + 시세 테이블 자동 삽입
 *
 * Usage:
 *   npx tsx scripts/generate-post.ts "삼성전자 실적 분석"
 *   npx tsx scripts/generate-post.ts "반도체 관련주" --stocks "삼성전자,SK하이닉스,DB하이텍"
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import {
  buildPrompt,
  parseResponse,
  getCategorySlug,
  type GeneratedPost,
} from "./lib/claude-prompt";
import {
  getMultipleStockInfo,
  stockSummaryTable,
  stockPerItemBlocks,
  stockInfoToContext,
  type StockInfo,
} from "./lib/stock-data";
import { findAndDownloadThumbnail } from "./lib/image-search";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadEnvValue(key: string): string | undefined {
  // Try .env.local first
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, "m"));
    if (match) return match[1].trim();
  }
  return process.env[key];
}

function loadApiKey(): string {
  const key = loadEnvValue("ANTHROPIC_API_KEY");
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY not found. Set it in .env.local or as an environment variable.",
    );
  }
  return key;
}

function toSlug(text: string): string {
  // 한글은 제거하고 영문/숫자만 slug에 포함 (URL 호환성)
  return text
    .replace(/[가-힣]+/g, "") // 한글 제거
    .replace(/[^\w\s-]/g, "") // 특수문자 제거
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") // 앞뒤 하이픈 제거
    .slice(0, 60)
    .toLowerCase() || "post"; // 빈 문자열 방지
}

function todayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseArgs(): { keyword: string; stocks: readonly string[]; thumbnail: string | null } {
  const args = process.argv.slice(2);
  const keyword = args.find((a) => !a.startsWith("--"));
  const stocksIdx = args.indexOf("--stocks");
  const stocks: readonly string[] =
    stocksIdx !== -1 && args[stocksIdx + 1]
      ? args[stocksIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const thumbIdx = args.indexOf("--thumbnail");
  const thumbnail = thumbIdx !== -1 && args[thumbIdx + 1] ? args[thumbIdx + 1] : null;

  if (!keyword) {
    console.error('❌ 사용법: npx tsx scripts/generate-post.ts "키워드"');
    console.error(
      '   옵션: --stocks "종목1,종목2,종목3"  (관련주 수동 지정)',
    );
    console.error(
      '   옵션: --thumbnail "이미지파일경로"  (썸네일 직접 지정)',
    );
    process.exit(1);
  }

  return { keyword, stocks, thumbnail };
}

function buildMdx(
  post: GeneratedPost,
  date: string,
  slug: string,
  thumbnailPath: string,
  imageCredit: string,
  stockInfoList: readonly StockInfo[],
): string {
  const tags = post.tags.map((t) => `"${t}"`).join(", ");
  const categorySlug = getCategorySlug(post.category);

  let body = post.content;

  if (stockInfoList.length > 0) {
    // 1. "## 관련주 분석" 섹션의 Claude 테이블 뒤에 시세 요약 테이블 삽입
    const summaryMd = stockSummaryTable(stockInfoList);
    const sectionHeader = "## 관련주 분석";
    const sectionIdx = body.indexOf(sectionHeader);
    if (sectionIdx !== -1) {
      const afterHeader = body.slice(sectionIdx);
      const tableEndMatch = afterHeader.match(/(\|[^\n]+\|\n)+/);
      if (tableEndMatch) {
        const tableEndPos = sectionIdx + (tableEndMatch.index ?? 0) + tableEndMatch[0].length;
        body = body.slice(0, tableEndPos) + "\n" + summaryMd + "\n" + body.slice(tableEndPos);
      }
    }

    // 2. 각 "### N. 종목명" 헤딩 바로 뒤에 시세+차트 삽입
    const perItemBlocks = stockPerItemBlocks(stockInfoList);
    for (const [stockName, block] of perItemBlocks) {
      // "### 1. 쎄트렉아이" 또는 "### 2. AP위성" 형태 매칭
      const headingRegex = new RegExp(`(### \\d+\\.\\s*${escapeRegex(stockName)}[^\n]*)(\n)`, "g");
      body = body.replace(headingRegex, `$1$2${block}\n`);
    }
  }

  // 이미지 크레딧이 있으면 추가
  if (imageCredit) {
    body += `\n\n---\n\n*${imageCredit}*`;
  }

  return `---
title: "${post.title}"
description: "${post.description}"
date: "${date}"
category: "${categorySlug}"
tags: [${tags}]
thumbnail: "${thumbnailPath}"
relatedStocks: [${post.relatedStocks.map((s) => `"${s}"`).join(", ")}]
---

${body}
`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { keyword, stocks: manualStocks, thumbnail: manualThumbnail } = parseArgs();

  console.log(`\n🔍 키워드: "${keyword}"`);

  // -----------------------------------------------------------------------
  // Step 1: 관련주 시세 데이터 수집 (수동 지정 또는 1차 Claude 호출 후)
  // -----------------------------------------------------------------------
  let stockInfoList: readonly StockInfo[] = [];
  let stockContext = "";

  if (manualStocks.length > 0) {
    // 사용자가 --stocks로 직접 지정한 경우
    console.log(`\n📊 수동 지정 관련주: ${manualStocks.join(", ")}`);
    stockInfoList = await getMultipleStockInfo(manualStocks);
    stockContext = stockInfoToContext(stockInfoList);
  }

  // -----------------------------------------------------------------------
  // Step 2: Claude API로 포스트 생성
  // -----------------------------------------------------------------------
  console.log("\n📝 Claude API로 포스트 생성 중...\n");

  const apiKey = loadApiKey();
  const client = new Anthropic({ apiKey });
  const { system, user } = buildPrompt(keyword, stockContext || undefined);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
  });

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  if (!rawText) {
    throw new Error("Claude returned an empty response.");
  }

  console.log("✅ Claude 응답 수신 완료");

  const post = parseResponse(rawText, keyword);

  // -----------------------------------------------------------------------
  // Step 3: 관련주 데이터 (수동 지정 없었으면 Claude 응답의 종목으로 조회)
  // -----------------------------------------------------------------------
  if (stockInfoList.length === 0 && post.relatedStocks.length > 0) {
    console.log(
      `\n📊 Claude가 언급한 관련주 시세 조회: ${post.relatedStocks.join(", ")}`,
    );
    stockInfoList = await getMultipleStockInfo(post.relatedStocks);
  }

  // -----------------------------------------------------------------------
  // Step 4: 썸네일 이미지 검색 & 다운로드
  // -----------------------------------------------------------------------
  const date = todayDate();
  const slug = `${date}-${toSlug(keyword)}`;

  let thumbnailPath: string;
  let imageCredit: string;

  if (manualThumbnail) {
    // 사용자가 직접 지정한 썸네일 처리
    const ext = path.extname(manualThumbnail);
    const destDir = path.join(process.cwd(), "public", "images", "thumbnails");
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const destFileName = `${slug}${ext}`;
    const destPath = path.join(destDir, destFileName);
    fs.copyFileSync(manualThumbnail, destPath);

    thumbnailPath = `/images/thumbnails/${destFileName}`;
    imageCredit = "";
    console.log(`🖼️  수동 썸네일 적용: ${manualThumbnail}`);
  } else {
    const result = await findAndDownloadThumbnail(keyword, slug);
    thumbnailPath = result.path;
    imageCredit = result.credit;
  }

  // -----------------------------------------------------------------------
  // Step 5: MDX 파일 저장
  // -----------------------------------------------------------------------
  const mdx = buildMdx(post, date, slug, thumbnailPath, imageCredit, stockInfoList);

  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }

  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  fs.writeFileSync(filePath, mdx, "utf-8");

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log(`\n✨ 포스트 생성 완료!`);
  console.log(`📄 파일: ${filePath}`);
  console.log(`📌 제목: ${post.title}`);
  console.log(`🏷️  카테고리: ${post.category}`);
  console.log(`🔖 태그: ${post.tags.join(", ")}`);
  console.log(`📊 관련주: ${post.relatedStocks.join(", ") || "없음"}`);
  console.log(`🖼️  썸네일: ${thumbnailPath}`);
  console.log(`📏 본문 길이: ${post.content.length}자\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ 오류 발생: ${message}`);
  process.exit(1);
});

export { main as generatePost };
