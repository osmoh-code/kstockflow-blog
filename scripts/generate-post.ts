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
import { searchNews, newsToContext } from "./lib/news-search";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadAllEnvFromFile(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  }
}

// Load .env.local into process.env at startup
loadAllEnvFromFile();

function loadEnvValue(key: string): string | undefined {
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
  // 영문/숫자만 slug에 포함 (Next.js 정적 빌드 한글 호환 문제 방지)
  // 한글은 제거하되, 한글만 있는 경우 타임스탬프로 고유 slug 생성
  const slug = text
    .replace(/[가-힣]+/g, " ")      // 한글 → 공백 (단어 구분 유지)
    .replace(/[^\w\s-]/g, "")       // 특수문자 제거
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();

  if (slug) return slug;

  // 순한글 키워드: 현재 시간 기반 고유 ID 생성
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

function parseArgs(): { keyword: string; stocks: readonly string[]; thumbnail: string | null; preview: boolean } {
  const args = process.argv.slice(2);
  const keyword = args.find((a) => !a.startsWith("--"));
  const stocksIdx = args.indexOf("--stocks");
  const stocks: readonly string[] =
    stocksIdx !== -1 && args[stocksIdx + 1]
      ? args[stocksIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const thumbIdx = args.indexOf("--thumbnail");
  const thumbnail = thumbIdx !== -1 && args[thumbIdx + 1] ? args[thumbIdx + 1] : null;

  const preview = args.includes("--preview");

  if (!keyword) {
    console.error('❌ 사용법: npx tsx scripts/generate-post.ts "키워드"');
    console.error(
      '   옵션: --preview                    (종목 선정만 미리보기)',
    );
    console.error(
      '   옵션: --stocks "종목1,종목2,종목3"  (관련주 수동 지정)',
    );
    console.error(
      '   옵션: --thumbnail "이미지파일경로"  (썸네일 직접 지정)',
    );
    process.exit(1);
  }

  return { keyword, stocks, thumbnail, preview };
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
  const { keyword, stocks: manualStocks, thumbnail: manualThumbnail, preview } = parseArgs();

  console.log(`\n🔍 키워드: "${keyword}"`);

  // -----------------------------------------------------------------------
  // Preview mode: 종목 선정만 미리보기
  // -----------------------------------------------------------------------
  if (preview) {
    console.log("\n🔎 종목 선정 미리보기 모드...\n");

    const apiKey = loadApiKey();
    const client = new Anthropic({ apiKey });

    const previewResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: "당신은 한국 주식 시장 전문 애널리스트입니다.",
      messages: [{
        role: "user",
        content: `"${keyword}" 관련주를 선정해주세요.

## 선정 규칙
- 한국 상장기업만 (비상장/외국기업/존재하지 않는 기업 절대 금지)
- 해당 키워드 관련 뉴스/기사에서 "관련주", "수혜주", "테마주"로 실제 언급된 종목만
- 해당 키워드와 직결되는 사업이 매출의 상당 부분을 차지하는 종목만
- 삼성전자, 현대차, 기아, LG전자, SK하이닉스, 네이버, 카카오, 현대로템, 포스코홀딩스, 한화에어로스페이스 등 범용 대기업 제외
- 중소형 전문기업을 절반 이상 포함
- 5~7개 선정

## 출력 형식 (반드시 이 형식으로)
각 종목을 아래 형식으로 출력하세요:

1. 종목명 | 분류 | 선정 이유 (1줄)
2. 종목명 | 분류 | 선정 이유 (1줄)
...`,
      }],
    });

    const previewText = previewResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    console.log("📋 선정된 관련주:\n");
    console.log(previewText);
    console.log("\n✅ 이 종목들로 글을 작성하려면:");
    console.log(`   npx tsx scripts/generate-post.ts "${keyword}"`);
    console.log(`\n🔧 종목을 직접 지정하려면:`);
    console.log(`   npx tsx scripts/generate-post.ts "${keyword}" --stocks "종목1,종목2,종목3"\n`);
    return;
  }

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
  // Step 1.5: 키워드 관련 최신 뉴스 검색 (Google News RSS)
  // -----------------------------------------------------------------------
  console.log("\n📰 최신 뉴스 검색 중...");
  const newsItems = await searchNews(keyword, 10);
  const newsContext = newsToContext(newsItems);

  // -----------------------------------------------------------------------
  // Step 2: Claude API로 포스트 생성
  // -----------------------------------------------------------------------
  console.log("\n📝 Claude API로 포스트 생성 중...\n");

  const apiKey = loadApiKey();
  const client = new Anthropic({ apiKey });

  // 주식 컨텍스트 + 뉴스 컨텍스트 결합
  const combinedContext = [stockContext, newsContext].filter(Boolean).join("\n") || undefined;
  const { system, user } = buildPrompt(keyword, combinedContext);

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
