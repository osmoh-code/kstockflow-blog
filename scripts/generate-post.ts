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
  type CategorySlugType,
} from "./lib/claude-prompt";
import { validatePost } from "./lib/post-validator";
import {
  getMultipleStockInfo,
  stockSummaryTable,
  stockPerItemBlocks,
  stockInfoToContext,
  type StockInfo,
} from "./lib/stock-data";
import { findAndDownloadThumbnail, generateFeaturedStocksThumbnail, generateNewStocksThumbnail } from "./lib/image-search";
import { searchNews, newsToContext } from "./lib/news-search";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 12000;

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

// 한글 키워드 → 영문 슬러그 매핑 (SEO용, 긴 키워드부터 매칭)
const KOREAN_TO_SLUG: Record<string, string> = {
  // 복합어 (긴 것 우선)
  "신재생에너지": "renewable-energy", "광반도체": "optical-semiconductor",
  "광통신": "optical-communication", "양자컴퓨터": "quantum-computing",
  "자율주행": "autonomous-driving", "사이버보안": "cybersecurity",
  "스페이스X": "spacex", "천연가스": "natural-gas", "2차전지": "secondary-battery",
  "전기차": "ev", "경기침체": "recession", "인플레이션": "inflation",
  // 지정학
  "호르무즈": "hormuz", "해협": "strait", "봉쇄": "blockade",
  "중동": "middle-east", "이란": "iran", "우크라이나": "ukraine",
  "러시아": "russia", "대만": "taiwan", "미국": "us",
  // 방산/군사
  "전쟁": "war", "방산": "defense", "드론": "drone",
  "미사일": "missile", "군사": "military",
  // 에너지/자원
  "유가": "oil", "석유": "petroleum", "해운": "shipping",
  "나프타": "naphtha", "태양광": "solar", "풍력": "wind",
  "원전": "nuclear", "수소": "hydrogen", "에너지": "energy",
  "리튬": "lithium", "희토류": "rare-earth", "전력": "power",
  // 테크
  "반도체": "semiconductor", "엔비디아": "nvidia", "로봇": "robot",
  "블록체인": "blockchain", "메타버스": "metaverse", "클라우드": "cloud",
  "통신": "telecom",
  // 산업
  "배터리": "battery", "바이오": "bio", "제약": "pharma",
  "건설": "construction", "조선": "shipbuilding", "철강": "steel",
  "화학": "chemical", "물류": "logistics", "플라스틱": "plastic",
  "포장재": "packaging",
  // 경제
  "상장": "ipo", "공모주": "ipo", "금리": "interest-rate",
  "환율": "forex",
  // 수식어
  "가격": "price", "급등": "surge", "급락": "crash",
  "대란": "crisis", "상용화": "commercialization", "수급": "supply",
  "불안": "uncertainty", "확대": "expansion", "전환": "transition",
  "수혜주": "stocks", "관련주": "stocks", "테마주": "stocks", "대장주": "stocks",
  // 인물/정치
  "이재명": "lee-jaemyung", "트럼프": "trump",
  // 기타
  "우주": "space", "위성": "satellite", "게임": "gaming",
  "식품": "food", "화장품": "cosmetics", "부동산": "real-estate",
  "교육": "education", "관광": "tourism",
};

function toSlug(text: string): string {
  // 1단계: 한글 키워드를 영문으로 치환 (긴 키워드부터 매칭)
  let converted = text;
  const sortedKeys = Object.keys(KOREAN_TO_SLUG).sort((a, b) => b.length - a.length);
  for (const ko of sortedKeys) {
    if (converted.includes(ko)) {
      converted = converted.replace(new RegExp(ko, "g"), ` ${KOREAN_TO_SLUG[ko]} `);
    }
  }

  // 2단계: 영문/숫자만 남기고 슬러그 생성
  const slug = converted
    .replace(/[가-힣]+/g, " ")       // 매핑 안 된 한글 제거
    .replace(/[^\w\s-]/g, "")        // 특수문자 제거
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  // "stocks" 중복 제거 (관련주+수혜주 동시 매칭 시)
  const deduped = [...new Set(slug.split("-"))].join("-").slice(0, 60);

  if (deduped) return deduped;

  // 매핑 실패 시 타임스탬프 fallback
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

const VALID_CATEGORY_SLUGS = ["featured-stocks", "hot-issues", "new-stocks", "theme-news"] as const;

function parseArgs(): {
  keyword: string;
  stocks: readonly string[];
  thumbnail: string | null;
  preview: boolean;
  category: CategorySlugType | null;
  dataFile: string | null;
  ipoUrl: string | null;
} {
  const args = process.argv.slice(2);
  const keyword = args.find((a) => !a.startsWith("--"));
  const stocksIdx = args.indexOf("--stocks");
  const stocks: readonly string[] =
    stocksIdx !== -1 && args[stocksIdx + 1]
      ? args[stocksIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const thumbIdx = args.indexOf("--thumbnail");
  const thumbnail = thumbIdx !== -1 && args[thumbIdx + 1] ? args[thumbIdx + 1] : null;

  const catIdx = args.indexOf("--category");
  const catRaw = catIdx !== -1 && args[catIdx + 1] ? args[catIdx + 1] : null;
  const category: CategorySlugType | null =
    catRaw && VALID_CATEGORY_SLUGS.includes(catRaw as CategorySlugType)
      ? (catRaw as CategorySlugType)
      : null;

  const dataIdx = args.indexOf("--data-file");
  const dataFile = dataIdx !== -1 && args[dataIdx + 1] ? args[dataIdx + 1] : null;

  const ipoIdx = args.indexOf("--ipo-url");
  const ipoUrl = ipoIdx !== -1 && args[ipoIdx + 1] ? args[ipoIdx + 1] : null;

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
    console.error(
      '   옵션: --category "featured-stocks" (카테고리 지정: featured-stocks, hot-issues, new-stocks, theme-news)',
    );
    console.error(
      '   옵션: --data-file "파일경로"       (특징주 데이터 파일)',
    );
    console.error(
      '   옵션: --ipo-url "38.co.kr URL"    (신규상장주 공모 데이터 URL)',
    );
    process.exit(1);
  }

  if (catRaw && !category) {
    console.error(`❌ 잘못된 카테고리: "${catRaw}"`);
    console.error(`   사용 가능: ${VALID_CATEGORY_SLUGS.join(", ")}`);
    process.exit(1);
  }

  return { keyword, stocks, thumbnail, preview, category, dataFile, ipoUrl };
}

// ---------------------------------------------------------------------------
// 38.co.kr IPO 데이터 크롤링
// ---------------------------------------------------------------------------

async function fetch38Data(url: string): Promise<string> {
  console.log(`\n📋 38.co.kr 공모 데이터 가져오는 중...`);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // HTML에서 텍스트 추출 (간단한 태그 제거)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();

    console.log(`  ✅ 38.co.kr 데이터 로드 완료 (${text.length}자)`);
    return text.slice(0, 8000); // Claude 컨텍스트 제한 고려
  } catch (error) {
    console.warn(`  ⚠️ 38.co.kr 접근 실패:`, error);
    return "";
  }
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
  const { keyword, stocks: manualStocks, thumbnail: manualThumbnail, preview, category: categoryOverride, dataFile, ipoUrl } = parseArgs();

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

  // 카테고리별 데이터 로드
  let dataFileContent = "";
  if (dataFile) {
    if (!fs.existsSync(dataFile)) {
      throw new Error(`데이터 파일을 찾을 수 없습니다: ${dataFile}`);
    }
    dataFileContent = fs.readFileSync(dataFile, "utf-8");
    console.log(`📄 데이터 파일 로드: ${dataFile} (${dataFileContent.length}자)`);
  }

  // new-stocks: scripts/data/ 폴더에서 38커뮤니케이션 데이터 자동 탐지
  if (categoryOverride === "new-stocks" && !dataFileContent) {
    const dataDir = path.join(process.cwd(), "scripts", "data");
    if (fs.existsSync(dataDir)) {
      const dataFiles = fs.readdirSync(dataDir).filter((f) => f.endsWith(".txt"));
      // 키워드(회사명)와 매칭되는 파일 찾기 (파일명에 키워드 포함 또는 파일 내용에 종목명 포함)
      for (const df of dataFiles) {
        const dfPath = path.join(dataDir, df);
        const dfContent = fs.readFileSync(dfPath, "utf-8");
        if (dfContent.includes(keyword) || df.toLowerCase().includes(keyword.toLowerCase())) {
          dataFileContent = dfContent;
          console.log(`📄 38커뮤니케이션 데이터 자동 탐지: ${df} (${dfContent.length}자)`);
          break;
        }
      }
      if (!dataFileContent) {
        console.warn(`⚠️ scripts/data/에서 "${keyword}" 관련 38데이터 파일을 찾지 못했습니다.`);
      }
    }
  }

  // featured-stocks: 특징주/ 폴더 HTML 자동 로드 (--data-file 없어도 동작)
  if (categoryOverride === "featured-stocks" && !dataFileContent) {
    const featuredDir = path.join(process.cwd(), "특징주");
    // 1) scripts/data/YYYY-MM-DD-featured-stocks.md 자동 탐지
    const autoDataFile = path.join(process.cwd(), "scripts", "data", `${todayDate()}-featured-stocks.md`);
    if (fs.existsSync(autoDataFile)) {
      dataFileContent = fs.readFileSync(autoDataFile, "utf-8");
      console.log(`📄 데이터 파일 자동 로드: ${autoDataFile} (${dataFileContent.length}자)`);
    }
    // 2) 특징주/ 폴더 HTML 파일 자동 로드
    if (fs.existsSync(featuredDir)) {
      const htmlFiles = fs.readdirSync(featuredDir).filter((f) => f.endsWith(".html"));
      if (htmlFiles.length > 0) {
        console.log(`📄 특징주/ 폴더에서 HTML ${htmlFiles.length}개 로드 중...`);
        const htmlTexts: string[] = [];
        for (const htmlFile of htmlFiles) {
          const filePath = path.join(featuredDir, htmlFile);
          let raw: Buffer;
          try {
            raw = fs.readFileSync(filePath);
          } catch {
            continue;
          }
          // EUC-KR → UTF-8 변환 시도
          let text = "";
          try {
            const decoder = new TextDecoder("euc-kr");
            text = decoder.decode(raw);
          } catch {
            text = raw.toString("utf-8");
          }
          // HTML 태그 제거
          text = text
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim();
          if (text.length > 100) {
            htmlTexts.push(`=== ${htmlFile} ===\n${text}`);
            console.log(`  ✅ ${htmlFile} (${text.length}자)`);
          }
        }
        if (htmlTexts.length > 0) {
          const htmlContext = htmlTexts.join("\n\n");
          dataFileContent = dataFileContent
            ? dataFileContent + "\n\n## 원본 HTML 데이터\n\n" + htmlContext
            : htmlContext;
        }
      }
    }
  }

  // 38.co.kr IPO 데이터 (선택사항)
  let ipoData = "";
  if (ipoUrl) {
    ipoData = await fetch38Data(ipoUrl);
  }

  // 컨텍스트 결합
  let combinedContext: string | undefined;
  if (categoryOverride === "featured-stocks") {
    // featured-stocks: 데이터 파일 + 뉴스 결합 (데이터 우선)
    combinedContext = [dataFileContent, newsContext].filter(Boolean).join("\n\n") || undefined;
  } else if (categoryOverride === "new-stocks") {
    // 38커뮤니케이션 데이터를 최우선으로 포함 (dataFileContent가 핵심)
    combinedContext = [dataFileContent, ipoData, newsContext, stockContext].filter(Boolean).join("\n\n") || undefined;
  } else {
    combinedContext = [stockContext, newsContext].filter(Boolean).join("\n") || undefined;
  }
  const { system, user } = buildPrompt(keyword, combinedContext, categoryOverride ?? undefined, manualStocks.length > 0 ? manualStocks : undefined);

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

  let post = parseResponse(rawText, keyword, categoryOverride ?? undefined);

  // 수동 지정 종목이 있으면 relatedStocks 강제 교체
  if (manualStocks.length > 0) {
    post = { ...post, relatedStocks: manualStocks };
    console.log(`🔒 관련주 강제 적용: ${manualStocks.join(", ")}`);
  }

  // -----------------------------------------------------------------------
  // Step 2.5: 자동 후처리 (볼드→mark, 함께보면좋은분석글 제거, FAQ 보장)
  // -----------------------------------------------------------------------
  let fixedContent = post.content;

  // 볼드(**텍스트**) → <mark>텍스트</mark> 자동 변환
  const boldCount = (fixedContent.match(/\*\*[^*]+\*\*/g) || []).length;
  if (boldCount > 0) {
    fixedContent = fixedContent.replace(/\*\*([^*]+)\*\*/g, "<mark>$1</mark>");
    console.log(`🔧 볼드 ${boldCount}개 → <mark> 자동 변환`);
  }

  // "함께 보면 좋은 분석 글" 텍스트 자동 제거 (컴포넌트로 대체)
  if (fixedContent.includes("함께 보면 좋은 분석 글")) {
    fixedContent = fixedContent.replace(/###\s*함께 보면 좋은 분석 글[\s\S]*?(?=##|$)/, "");
    console.log('🔧 "함께 보면 좋은 분석 글" 자동 제거');
  }

  // 미래 날짜 허위사실 자동 제거
  const todayObj = new Date();
  const todayMonth = todayObj.getMonth() + 1;
  const todayDay = todayObj.getDate();
  const todayYear = todayObj.getFullYear();
  // 현재 월 이후의 구체적 날짜 언급 제거 (예: "6월 2일", "8월 12일")
  const futureDateRegex = new RegExp(
    `(${todayYear}년\\s*)?([${todayMonth + 1}-9]|1[0-2])월\\s*\\d{1,2}일[에서]?`,
    "g"
  );
  const futureDateMatches = fixedContent.match(futureDateRegex);
  if (futureDateMatches && futureDateMatches.length > 0) {
    console.log(`🔧 미래 날짜 ${futureDateMatches.length}개 감지 — 포함 문장 제거`);
    for (const match of futureDateMatches) {
      // 해당 날짜가 포함된 문장 전체를 제거
      const sentenceRegex = new RegExp(`[^.。]*${match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^.。]*[.。]\\s*`, "g");
      fixedContent = fixedContent.replace(sentenceRegex, "");
    }
  }

  // 면책 고지 누락 시 자동 추가
  if (!fixedContent.includes("투자의 책임은 투자자 본인에게 있습니다")) {
    // FAQ 섹션 앞에 면책 고지 삽입
    const disclaimerText = "\n\n> ※ 본 글은 정보 제공을 목적으로 하며, 투자의 책임은 투자자 본인에게 있습니다.\n";
    const faqIdx = fixedContent.search(/^##\s.*자주 묻는 질문/m);
    if (faqIdx !== -1) {
      fixedContent = fixedContent.slice(0, faqIdx) + disclaimerText + "\n" + fixedContent.slice(faqIdx);
    } else {
      fixedContent += disclaimerText;
    }
    console.log("🔧 면책 고지 자동 추가");
  }

  // FAQ 섹션 누락 시 자동 추가 (H2 레벨로 존재해야 함)
  if (!/^##\s.*자주 묻는 질문/m.test(fixedContent)) {
    fixedContent = fixedContent.replace(/###\s*자주 묻는 질문[\s\S]*$/, "").trimEnd();
    const faqSection = `\n\n## 자주 묻는 질문\n\n### Q. ${keyword.replace(/관련주$/, "").trim()} 관련주는 어떤 종목이 있나요?\n\n${post.relatedStocks.join(", ")} 등이 대표적인 관련주로 꼽힙니다.\n\n### Q. 대장주는 무엇인가요?\n\n${post.relatedStocks[0] || "해당 테마"}이 시가총액과 거래대금 기준으로 대장주에 해당합니다.\n\n### Q. 주가 전망은 어떤가요?\n\n정책 방향과 관련 산업 성장세에 따라 중장기적 수혜가 기대되나, 단기 변동성에 유의할 필요가 있습니다. 투자 전 기업 실적과 밸류에이션을 반드시 확인하시기 바랍니다.\n`;
    fixedContent += faqSection;
    console.log("🔧 FAQ 섹션 자동 추가");
  }

  // 핫이슈 필수 섹션 누락 시 자동 추가 (Claude API가 토큰 부족으로 뒷부분 생략하는 경우 대비)
  if (categoryOverride === "hot-issues" || !categoryOverride) {
    const kw = keyword.replace(/\s*(관련주|수혜주|테마주)\s*/g, "").trim() || keyword;

    if (!/^## .*투자 시 체크포인트/m.test(fixedContent)) {
      const insertBefore = fixedContent.search(/^## .*투자 결론/m);
      const checkSection = `\n\n## ${kw} 투자 시 체크포인트\n\n✔ <mark>단기 테마인지 실적 개선 구간인지 구분 필수</mark>\n정책이나 이슈 발표 직후 급등한 종목이 실제 수주·매출로 이어질 수 있는지 확인이 필요합니다.\n\n✔ <mark>관련 산업 지표 동반 확인</mark>\n업황 지표, 수주 현황, 수출 데이터 등을 함께 모니터링하세요.\n\n✔ <mark>과도한 집중투자 지양</mark>\n테마주 특성상 변동성이 크므로, 분산투자를 통해 리스크를 관리하는 것이 중요합니다.\n`;
      if (insertBefore !== -1) {
        fixedContent = fixedContent.slice(0, insertBefore) + checkSection + "\n" + fixedContent.slice(insertBefore);
      } else {
        fixedContent += checkSection;
      }
      console.log("🔧 투자 시 체크포인트 섹션 자동 추가");
    }

    if (!/^## .*투자 결론/m.test(fixedContent)) {
      const insertBefore = fixedContent.search(/^## .*자주 묻는 질문/m);
      const conclusionSection = `\n\n## ${kw} 투자 결론\n\n${kw} 관련주는 정책 방향과 산업 성장세에 따라 중장기적 수혜가 기대되는 종목군입니다. 다만 테마주 특성상 단기 변동성이 클 수 있어 신중한 접근이 필요합니다.\n\n향후 관련 정책 발표, 기업 실적 발표, 산업 지표 변화를 주시하며 투자 판단을 내리시기 바랍니다.\n`;
      if (insertBefore !== -1) {
        fixedContent = fixedContent.slice(0, insertBefore) + conclusionSection + "\n" + fixedContent.slice(insertBefore);
      } else {
        fixedContent += conclusionSection;
      }
      console.log("🔧 투자 결론 섹션 자동 추가");
    }
  }

  if (fixedContent !== post.content) {
    post = { ...post, content: fixedContent };
  }

  // -----------------------------------------------------------------------
  // Step 2.6: 카테고리별 필수 요소 검증 (검증 실패해도 진행 — 자동 패치 완료 후이므로)
  // -----------------------------------------------------------------------
  const validation = validatePost(post, categoryOverride ?? "hot-issues", keyword);

  if (validation.warnings.length > 0) {
    console.warn("\n⚠️ 검증 경고:");
    validation.warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  if (!validation.passed) {
    console.warn("\n⚠️ 검증 미통과 항목 (자동 패치 후에도 남은 것 — 진행은 계속됨):");
    validation.errors.forEach((e) => console.warn(`   - ${e}`));
  } else {
    console.log(`✅ ${categoryOverride ?? "hot-issues"} 필수 요소 검증 통과`);
  }

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
  } else if (categoryOverride === "featured-stocks") {
    // 주식특징주: 차트 배경 + 날짜 텍스트 오버레이 썸네일
    const now = new Date();
    const dateLabel = `${now.getMonth() + 1}월 ${now.getDate()}일자`;
    const result = await generateFeaturedStocksThumbnail(slug, dateLabel);
    thumbnailPath = result.path;
    imageCredit = result.credit;
  } else if (categoryOverride === "new-stocks") {
    // 신규상장주: 회사명 + IPO 텍스트 오버레이 썸네일 자체 생성
    const result = await generateNewStocksThumbnail(keyword, slug);
    thumbnailPath = result.path;
    imageCredit = result.credit;
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
