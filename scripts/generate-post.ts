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
  type ExistingPost,
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
const MAX_TOKENS = 16000;

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

/**
 * Load all existing hot-issues posts from content/posts/ so Claude can only
 * link to real slugs. Prevents hallucinated internal links.
 */
function loadExistingHotIssuePosts(): readonly ExistingPost[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".mdx"));
  const posts: ExistingPost[] = [];
  for (const file of files) {
    const full = path.join(POSTS_DIR, file);
    try {
      const raw = fs.readFileSync(full, "utf-8");
      // Parse YAML frontmatter between leading --- markers
      const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!match) continue;
      const fm = match[1];
      const get = (key: string): string => {
        const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
        return m?.[1]?.trim().replace(/^["'](.*)["']$/, "$1") ?? "";
      };
      const category = get("category");
      if (category !== "hot-issues") continue; // only hot-issues are linkable from hot-issues posts
      const title = get("title");
      const slug = file.replace(/\.mdx$/, "");
      const tagsLine = get("tags");
      let tags: string[] = [];
      if (tagsLine) {
        // Handle both ["a","b"] JSON-array and plain comma-separated forms
        const arrMatch = tagsLine.match(/^\[(.*)\]$/);
        const src = arrMatch ? arrMatch[1] : tagsLine;
        tags = src
          .split(",")
          .map((t) => t.trim().replace(/^["'](.*)["']$/, "$1"))
          .filter(Boolean);
      }
      posts.push({ slug, title, tags });
    } catch {
      // skip unparseable files
    }
  }
  // Sort newest first (slug starts with YYYY-MM-DD)
  return posts.sort((a, b) => b.slug.localeCompare(a.slug));
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

// 한글 → 로마자 변환 (초성+중성+종성 분리)
function romanizeKorean(text: string): string {
  const CHO = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
  const JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
  const JONG = ["","k","kk","ks","n","nj","nh","d","l","lg","lm","lb","ls","lt","lp","lh","m","b","bs","s","ss","ng","j","ch","k","t","p","h"];

  let result = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - 0xAC00;
      const cho = Math.floor(offset / (21 * 28));
      const jung = Math.floor((offset % (21 * 28)) / 28);
      const jong = offset % 28;
      result += CHO[cho] + JUNG[jung] + JONG[jong];
    } else {
      result += ch;
    }
  }
  return result;
}

function toSlug(text: string): string {
  // 1단계: 한글 키워드를 영문으로 치환 (긴 키워드부터 매칭)
  let converted = text;
  const sortedKeys = Object.keys(KOREAN_TO_SLUG).sort((a, b) => b.length - a.length);
  for (const ko of sortedKeys) {
    if (converted.includes(ko)) {
      converted = converted.replace(new RegExp(ko, "g"), ` ${KOREAN_TO_SLUG[ko]} `);
    }
  }

  // 2단계: 매핑 안 된 한글은 로마자 변환 (랜덤 슬러그 방지)
  converted = converted.replace(/[가-힣]+/g, (match) => ` ${romanizeKorean(match)} `);

  // 3단계: 영문/숫자만 남기고 슬러그 생성
  const slug = converted
    .replace(/[^\w\s-]/g, "")        // 특수문자 제거
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  // "stocks" 중복 제거 (관련주+수혜주 동시 매칭 시)
  const deduped = [...new Set(slug.split("-"))].join("-").slice(0, 60);

  if (deduped) return deduped;

  // 매핑 실패 시 타임스탬프 fallback (도달하면 안 됨)
  const ts = Date.now().toString(36).slice(-6);
  console.warn(`⚠️  슬러그 생성 실패, 랜덤 fallback 사용: post-${ts}`);
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
  slug: string | null;
  refreshSlug: string | null;
  dateOverride: string | null;
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

  const slugIdx = args.indexOf("--slug");
  const slug = slugIdx !== -1 && args[slugIdx + 1] ? args[slugIdx + 1] : null;

  const refreshIdx = args.indexOf("--refresh");
  const refreshSlug = refreshIdx !== -1 && args[refreshIdx + 1] ? args[refreshIdx + 1] : null;

  const dateIdx = args.indexOf("--date");
  const dateOverride = dateIdx !== -1 && args[dateIdx + 1] ? args[dateIdx + 1] : null;

  const preview = args.includes("--preview");

  if (!keyword && !refreshSlug) {
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
    console.error(
      '   옵션: --slug "my-slug"            (슬러그 직접 지정)',
    );
    process.exit(1);
  }

  if (catRaw && !category) {
    console.error(`❌ 잘못된 카테고리: "${catRaw}"`);
    console.error(`   사용 가능: ${VALID_CATEGORY_SLUGS.join(", ")}`);
    process.exit(1);
  }

  return { keyword: keyword ?? "", stocks, thumbnail, preview, category, dataFile, ipoUrl, slug, refreshSlug, dateOverride };
}

// ---------------------------------------------------------------------------
// Refresh mode: 기존 MDX 의 frontmatter 를 읽어 keyword/stocks/date/slug 를 그대로 재사용
// - Claude API 는 본문만 다시 생성
// - URL, 날짜, 썸네일, 관련주는 보존
// ---------------------------------------------------------------------------
function loadRefreshContext(refreshSlug: string): {
  keyword: string;
  stocks: readonly string[];
  date: string;
  thumbnailLocalPath: string | null;
  originalTitle: string;
  category: CategorySlugType;
} {
  const mdxPath = path.join(process.cwd(), "content", "posts", `${refreshSlug}.mdx`);
  if (!fs.existsSync(mdxPath)) {
    throw new Error(`Refresh 대상 MDX 없음: ${mdxPath}`);
  }
  const raw = fs.readFileSync(mdxPath, "utf-8");
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    throw new Error(`Frontmatter 파싱 실패: ${mdxPath}`);
  }
  const fm = fmMatch[1];
  const titleMatch = fm.match(/title:\s*"([^"]+)"/);
  const dateMatch = fm.match(/date:\s*"([^"]+)"/);
  const thumbMatch = fm.match(/thumbnail:\s*"([^"]+)"/);
  const stocksMatch = fm.match(/relatedStocks:\s*\[([^\]]+)\]/);
  const categoryMatch = fm.match(/category:\s*"([^"]+)"/);

  if (!titleMatch) throw new Error("title 누락");
  if (!categoryMatch) throw new Error("category 누락");
  const categoryRaw = categoryMatch[1];
  if (!VALID_CATEGORY_SLUGS.includes(categoryRaw as CategorySlugType)) {
    throw new Error(`잘못된 category: ${categoryRaw}`);
  }
  const category = categoryRaw as CategorySlugType;
  const fullTitle = titleMatch[1];
  // 제목 형식: "{keyword} TOP N 2026 | 대장주·수혜주·테마주 총정리"
  // keyword 추출 — 뒷부분 suffix 제거
  const keyword = fullTitle
    .replace(/\s*TOP\s+\d+\s+\d{4}\s*\|.*$/, "")
    .replace(/\s*관련주\s*$/, "")
    .trim();

  const date = dateMatch ? dateMatch[1] : refreshSlug.slice(0, 10);
  const thumbnailWebPath = thumbMatch ? thumbMatch[1] : null;
  const thumbnailLocalPath = thumbnailWebPath
    ? path.join(process.cwd(), "public", thumbnailWebPath)
    : null;

  const stocks = stocksMatch
    ? stocksMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    : [];

  return { keyword, stocks, date, thumbnailLocalPath, originalTitle: fullTitle, category };
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
  featuredTradeMap?: ReadonlyMap<string, string>,
): string {
  const tags = post.tags.map((t) => `"${t}"`).join(", ");
  const categorySlug = getCategorySlug(post.category);

  let body = post.content;

  // 특징주 테이블의 거래대금을 실제 네이버 금융 데이터로 교체 + 등락률 내림차순 정렬
  if (body.includes("오늘의 특징주 한눈에 보기")) {
    // 1순위: stockInfoList (Claude relatedStocks 기반 상세 시세)
    // 2순위: featuredTradeMap (HTML 사전 추출 전체 종목 — 상한가 종목 등 커버)
    const stockTradeMap = new Map<string, string>();
    if (featuredTradeMap) {
      for (const [name, amt] of featuredTradeMap) {
        stockTradeMap.set(name, amt);
      }
    }
    for (const s of stockInfoList) {
      if (s.tradeAmount && s.tradeAmount !== "-") {
        stockTradeMap.set(s.name, s.tradeAmount); // stockInfoList가 더 정확 → 덮어씀
      }
    }
    // 1단계: 테이블 각 행에서 종목명 매칭 → 거래대금 열 교체
    const tableRowRegex = /^\| ([^\|]+?) \| ([^\|]+?) \| ([^\|]+?) \| ([^\|]+?) \| ([^\|]+?) \|$/gm;
    let missingRows: string[] = [];
    body = body.replace(tableRowRegex, (match, name, sector, reason, change, tradeAmt) => {
      const trimName = name.trim();
      const realAmount = stockTradeMap.get(trimName);
      if (realAmount) {
        return `| ${name} | ${sector} | ${reason} | ${change} | ${realAmount} |`;
      }
      // 실제 데이터 없는 경우 — 플레이스홀더("-억원") 감지하여 경고
      const trimTrade = tradeAmt.trim();
      if (trimTrade === "-억원" || trimTrade === "-" || trimTrade === "") {
        missingRows.push(trimName);
      }
      return match;
    });
    if (missingRows.length > 0) {
      console.warn(`⚠️ 거래대금 누락 종목 ${missingRows.length}개: ${missingRows.join(", ")} (HTML 파싱 또는 API 조회 실패)`);
    }

    // 2단계: 테이블 전체를 등락률 내림차순으로 재정렬
    body = sortFeaturedStocksTableByChangeDesc(body);
  }

  // Hot-issues: replace 등락률/거래대금 in the 5-column 구분 table with
  // real stock-data.ts values, then sort rows by 거래대금 desc.
  // Table format: | 구분 | 종목 | 핵심 포인트 | 등락률 | 거래대금 |
  if (stockInfoList.length > 0 && categorySlug === "hot-issues") {
    body = rewriteHotIssuesStockTable(body, stockInfoList);
  }

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

/**
 * Parse trade amount string ("6,901억원", "2조974억", "-") into a sortable number.
 * Returns 억원 as base unit. Returns -1 for invalid/missing values.
 */
function parseTradeAmountEok(raw: string): number {
  const clean = raw.replace(/[,\s]/g, "").trim();
  if (!clean || clean === "-" || clean === "-억원") return -1;
  const joMatch = /^(\d+(?:\.\d+)?)조(\d+(?:\.\d+)?)?억?/.exec(clean);
  if (joMatch) {
    const jo = parseFloat(joMatch[1]);
    const eok = joMatch[2] ? parseFloat(joMatch[2]) : 0;
    return jo * 10000 + eok;
  }
  const eokMatch = /^(\d+(?:\.\d+)?)억/.exec(clean);
  if (eokMatch) return parseFloat(eokMatch[1]);
  const numMatch = /^(\d+(?:\.\d+)?)/.exec(clean);
  if (numMatch) return parseFloat(numMatch[1]);
  return -1;
}

/**
 * Sort the featured-stocks summary table by 등락률 descending.
 * Header: | 종목명 | 주요섹터 | 상승이유 | 등락률 | 거래대금 |
 */
function sortFeaturedStocksTableByChangeDesc(body: string): string {
  const tableRegex =
    /(\|\s*종목명\s*\|\s*주요섹터\s*\|\s*상승이유\s*\|\s*등락률\s*\|\s*거래대금\s*\|\s*\n\|[-:\s|]+\|\s*\n)((?:\|[^\n]*\|\s*\n)+)/;
  const match = tableRegex.exec(body);
  if (!match) return body;

  const [fullMatch, header, dataBlock] = match;
  const dataRows = dataBlock.trim().split("\n");

  interface Row {
    line: string;
    changePercent: number;
  }
  const parsed: Row[] = [];
  for (const line of dataRows) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const changeStr = cells[3]; // 등락률 column
    const pctMatch = /([+-]?\d+(?:\.\d+)?)%/.exec(changeStr);
    parsed.push({ line, changePercent: pctMatch ? parseFloat(pctMatch[1]) : -999 });
  }

  parsed.sort((a, b) => b.changePercent - a.changePercent);

  const newRows = parsed.map((r) => r.line).join("\n");
  return body.replace(fullMatch, `${header}${newRows}\n`);
}

/**
 * Post-process the hot-issues "관련주 분석" table:
 *   1. Find the 5-column table with header | 구분 | 종목 | 핵심 포인트 | 등락률 | 거래대금 |
 *   2. Replace 등락률 and 거래대금 cells with real values from stockInfoList
 *   3. Sort rows by 거래대금 descending (rows with no data fall to bottom)
 *
 * Claude sometimes hallucinates % and amounts — this step guarantees accuracy.
 */
function rewriteHotIssuesStockTable(
  body: string,
  stockInfoList: readonly StockInfo[],
): string {
  // Build lookup map: stock name → {changePercent, tradeAmount}
  const infoMap = new Map<string, { change: string; trade: string }>();
  for (const s of stockInfoList) {
    infoMap.set(s.name, {
      change: s.changePercent || "-",
      trade: s.tradeAmount || "-",
    });
  }

  // Match the full 5-col table block (header + separator + data rows)
  // Header must contain "구분" + "종목" + "핵심" + "등락률" + "거래대금"
  const tableRegex =
    /(\|\s*구분\s*\|\s*종목\s*\|\s*핵심[^|]*\|\s*등락률\s*\|\s*거래대금\s*\|\s*\n\|[-:\s|]+\|\s*\n)((?:\|[^\n]*\|\s*\n)+)/;
  const match = tableRegex.exec(body);
  if (!match) {
    console.warn("⚠️ hot-issues 5-컬럼 관련주 테이블을 찾을 수 없음 — 후처리 스킵");
    return body;
  }

  const [fullMatch, header, dataBlock] = match;
  const dataRows = dataBlock.trim().split("\n");

  interface Row {
    category: string;
    name: string;
    keyPoint: string;
    change: string;
    trade: string;
    tradeNum: number;
  }

  const parsed: Row[] = [];
  for (const line of dataRows) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const [category, name, keyPoint] = cells;
    const info = infoMap.get(name);
    const change = info?.change ?? "-";
    const trade = info?.trade ?? "-";
    parsed.push({
      category,
      name,
      keyPoint,
      change,
      trade,
      tradeNum: parseTradeAmountEok(trade),
    });
  }

  // Sort by tradeNum descending; invalid (-1) rows go to the bottom
  parsed.sort((a, b) => {
    if (a.tradeNum === b.tradeNum) return 0;
    if (a.tradeNum === -1) return 1;
    if (b.tradeNum === -1) return -1;
    return b.tradeNum - a.tradeNum;
  });

  const newRows = parsed
    .map((r) => `| ${r.category} | ${r.name} | ${r.keyPoint} | ${r.change} | ${r.trade} |`)
    .join("\n");
  const newTable = `${header}${newRows}\n`;

  return body.replace(fullMatch, newTable);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const parsed = parseArgs();
  let { keyword, stocks: manualStocks, thumbnail: manualThumbnail } = parsed;
  const { preview, dataFile, ipoUrl, slug: manualSlug, refreshSlug, dateOverride } = parsed;
  let categoryOverride = parsed.category;

  // Refresh mode: 기존 MDX 로부터 keyword/stocks/date/thumbnail/category 로드하여 URL/날짜/썸네일 보존
  let refreshContext: ReturnType<typeof loadRefreshContext> | null = null;
  if (refreshSlug) {
    refreshContext = loadRefreshContext(refreshSlug);
    keyword = refreshContext.keyword;
    manualStocks = refreshContext.stocks;
    manualThumbnail = refreshContext.thumbnailLocalPath ?? manualThumbnail;
    categoryOverride = refreshContext.category;
    console.log(`\n♻️  Refresh 모드: ${refreshSlug}`);
    console.log(`   원본 제목: ${refreshContext.originalTitle}`);
    console.log(`   추출 키워드: ${keyword}`);
    console.log(`   카테고리 보존: ${categoryOverride}`);
    console.log(`   관련주 보존: ${manualStocks.join(", ")}`);
    console.log(`   날짜 보존: ${refreshContext.date}`);
  } else {
    console.log(`\n🔍 키워드: "${keyword}"`);
  }

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

  // featured-stocks: HTML에서 종목코드+등락률 추출 → 거래대금만 API 조회
  let featuredTradeContext = "";
  const featuredTradeMap = new Map<string, string>(); // 종목명 → 거래대금 (후처리 교체용)
  if (categoryOverride === "featured-stocks") {
    const featuredDir = path.join(process.cwd(), "특징주");
    if (fs.existsSync(featuredDir)) {
      const codeNameMap = new Map<string, string>();
      // HTML에서 종목별 등락률 추출 (API 등락률보다 HTML이 우선 — 장후/야간거래로 API 데이터 변동 방지)
      const htmlPctMap = new Map<string, number>(); // code → 등락률(%)
      const htmlFiles = fs.readdirSync(featuredDir).filter((f) => f.endsWith(".html"));
      for (const htmlFile of htmlFiles) {
        const filePath = path.join(featuredDir, htmlFile);
        try {
          const raw = fs.readFileSync(filePath);
          const html = new TextDecoder("euc-kr").decode(raw);
          // infostock URL에서 종목코드 + 종목명 추출
          // HTML 4·5 (코스피/코스닥): <b>종목명</b> 형태
          // HTML 6 (상한가/급등): 태그 없이 종목명 직접 노출 (CS, 풍산홀딩스 등)
          const codeRegex = /stockitem\?code=([0-9A-Z]{6})"[^>]*>(?:<b[^>]*>)?([^<]+)/g;
          let m: RegExpExecArray | null;
          while ((m = codeRegex.exec(html)) !== null) {
            const code = m[1];
            const name = m[2].replace(/<[^>]+>/g, "").trim();
            if (name && code && !/^\d+$/.test(name)) {
              codeNameMap.set(code, name);
              // 종목 링크 이후 500자 내에서 등락률 추출
              const after = html.substring(m.index, m.index + 500);
              const pctMatch = after.match(/([+-]?\d+\.\d+)%/);
              if (pctMatch) {
                const pct = parseFloat(pctMatch[1]);
                // 더 높은 등락률 우선 (같은 종목이 여러 HTML에 있을 수 있음)
                const existing = htmlPctMap.get(code);
                if (existing === undefined || pct > existing) {
                  htmlPctMap.set(code, pct);
                }
              }
            }
          }
        } catch { /* skip */ }
      }
      if (codeNameMap.size > 0) {
        console.log(`\n💰 특징주 HTML에서 ${codeNameMap.size}개 종목코드 추출 (등락률 ${htmlPctMap.size}개) → 거래대금 API 조회`);
        const tradeEntries: { name: string; code: string; amount: number; display: string; changePercent: string; pctNum: number; isUp: boolean }[] = [];
        const BATCH = 3;
        const entries = [...codeNameMap.entries()];
        for (let i = 0; i < entries.length; i += BATCH) {
          const batch = entries.slice(i, i + BATCH);
          await Promise.all(batch.map(async ([code, name]) => {
            try {
              const ua = { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } };
              // 1) /basic API → 정확한 등락률 (integration API의 fluctuationsRatio는 동종업체 데이터라 잘못됨)
              let pctNum: number;
              let changePercent: string;
              let isUp: boolean;
              const htmlPct = htmlPctMap.get(code);
              if (htmlPct !== undefined) {
                // HTML 등락률 우선
                pctNum = htmlPct;
                isUp = htmlPct > 0;
                changePercent = htmlPct > 0 ? `+${htmlPct.toFixed(2)}%` : `${htmlPct.toFixed(2)}%`;
              } else {
                // HTML에 없으면 /basic API에서 정확한 등락률 조회
                const basicUrl = `https://m.stock.naver.com/api/stock/${code}/basic`;
                const basicRes = await fetch(basicUrl, ua);
                if (basicRes.ok) {
                  const basicJson = await basicRes.json();
                  const ratio = parseFloat(basicJson.fluctuationsRatio ?? "0");
                  const priceCode = basicJson.compareToPreviousPrice?.code;
                  // code: "1"=상한, "2"=상승, "3"=보합, "4"=하한, "5"=하락
                  isUp = priceCode === "1" || priceCode === "2";
                  pctNum = isUp ? Math.abs(ratio) : -Math.abs(ratio);
                  changePercent = isUp ? `+${Math.abs(ratio).toFixed(2)}%` : `-${Math.abs(ratio).toFixed(2)}%`;
                } else {
                  pctNum = 0;
                  isUp = false;
                  changePercent = "0%";
                }
              }
              // 2) /integration API → 거래대금 (KRX+NXT 합산)
              const integUrl = `https://m.stock.naver.com/api/stock/${code}/integration`;
              const integRes = await fetch(integUrl, ua);
              if (!integRes.ok) return;
              const integStr = await integRes.text();
              const tradeMatch = integStr.match(/accumulatedTradingValue[^}]*?value":"([0-9,]+)백만"/);
              if (tradeMatch) {
                const million = parseInt(tradeMatch[1].replace(/,/g, ""), 10);
                const eok = Math.round(million / 100);
                const display = eok >= 1000 ? `${eok.toLocaleString()}억원` : `${eok}억원`;
                tradeEntries.push({ name, code, amount: eok, display, changePercent, pctNum, isUp });
              }
            } catch { /* skip */ }
          }));
          if (i + BATCH < entries.length) await new Promise((r) => setTimeout(r, 200));
        }
        // 상승 종목만 필터 → 등락률 순 정렬 (가장 많이 오른 종목이 먼저)
        const upEntries = tradeEntries.filter((e) => e.isUp).sort((a, b) => b.pctNum - a.pctNum);
        featuredTradeContext = "\n\n## 상승 종목 시세 데이터 (HTML 등락률 + 네이버 거래대금)\n";
        featuredTradeContext += "등락률이 높은 상승 종목은 시장 주도주이므로 테이블에 반드시 포함하세요. 하락 종목은 테이블에 넣지 마세요.\n\n";
        for (const e of upEntries) {
          featuredTradeContext += `- ${e.name}(${e.code}): 등락률 ${e.changePercent}, 거래대금 ${e.display}\n`;
          featuredTradeMap.set(e.name, e.display);
        }
        console.log(`  ✅ ${tradeEntries.length}개 중 상승 ${upEntries.length}개 조회 완료 (상위: ${upEntries.slice(0, 5).map(e => `${e.name} ${e.changePercent} ${e.display}`).join(", ")})`);
      }
    }
  }

  // 컨텍스트 결합
  let combinedContext: string | undefined;
  if (categoryOverride === "featured-stocks") {
    // featured-stocks: 데이터 파일 + 뉴스 + 거래대금 결합 (데이터 우선)
    combinedContext = [dataFileContent, featuredTradeContext, newsContext].filter(Boolean).join("\n\n") || undefined;
  } else if (categoryOverride === "new-stocks") {
    // 38커뮤니케이션 데이터를 최우선으로 포함 (dataFileContent가 핵심)
    combinedContext = [dataFileContent, ipoData, newsContext, stockContext].filter(Boolean).join("\n\n") || undefined;
  } else {
    combinedContext = [stockContext, newsContext].filter(Boolean).join("\n") || undefined;
  }
  // hot-issues에서만 기존 포스트 목록을 주입 (featured-stocks/new-stocks는 전용 프롬프트 사용)
  const existingPosts = categoryOverride === "hot-issues" || !categoryOverride
    ? loadExistingHotIssuePosts()
    : undefined;
  if (existingPosts && existingPosts.length > 0) {
    console.log(`🔗 내부 링크 풀 로드: ${existingPosts.length}개 핫이슈 포스트`);
  }
  const { system, user } = buildPrompt(
    keyword,
    combinedContext,
    categoryOverride ?? undefined,
    manualStocks.length > 0 ? manualStocks : undefined,
    existingPosts,
  );

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

  // Refresh 모드: 원본 카테고리 강제 보존 (Claude 가 다른 카테고리로 응답할 수 있음)
  if (refreshContext) {
    // categoryOverride 는 slug (hot-issues 등) → getCategorySlug 역매핑이 필요
    const slugToKorean: Record<string, string> = {
      "hot-issues": "핫이슈",
      "featured-stocks": "주식특징주",
      "new-stocks": "신규상장주",
    };
    const expectedKorean = slugToKorean[categoryOverride ?? "hot-issues"] ?? "핫이슈";
    if (post.category !== expectedKorean) {
      console.log(`🔒 카테고리 강제 적용: ${post.category} → ${expectedKorean} (원본 보존)`);
      post = { ...post, category: expectedKorean };
    }
  }

  // 수동 지정 종목이 있으면 relatedStocks 강제 교체
  if (manualStocks.length > 0) {
    post = { ...post, relatedStocks: manualStocks };
    console.log(`🔒 관련주 강제 적용: ${manualStocks.join(", ")}`);
  }

  // 할루시네이션 내부 링크 방어 — 실제 존재하지 않는 /posts/*/ 및 /category/*/ 링크 자동 제거
  if (existingPosts !== undefined) {
    const validSlugs = new Set(existingPosts.map((p) => p.slug));
    const validCategories = new Set(["featured-stocks", "hot-issues", "new-stocks"]);
    let cleaned = post.content;
    let removed = 0;

    // /posts/{slug}/ 검증
    cleaned = cleaned.replace(
      /\[([^\]]+)\]\(\/posts\/([^/)]+)\/?\)/g,
      (full, anchor, slug) => {
        if (validSlugs.has(slug)) return full;
        removed++;
        return anchor; // drop the link, keep the anchor text
      },
    );

    // /category/{slug}/ 검증
    cleaned = cleaned.replace(
      /\[([^\]]+)\]\(\/category\/([^/)]+)\/?\)/g,
      (full, anchor, slug) => {
        if (validCategories.has(slug)) return full;
        removed++;
        return anchor;
      },
    );

    if (removed > 0) {
      console.log(`🧹 할루시네이션 내부 링크 ${removed}개 제거`);
      post = { ...post, content: cleaned };
    }
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

  // 내부 링크 trailing slash 자동 보정 (next.config.ts trailingSlash:true 기준)
  // /posts/slug 또는 /category/slug 가 / 없이 끝나면 308 리다이렉트 발생 → GSC 경고
  let trailingSlashFixed = 0;
  fixedContent = fixedContent.replace(
    /(\]\(\/(?:posts|category)\/[^)#?]+?)(\))/g,
    (_, prefix, suffix) => {
      if (prefix.endsWith("/")) return prefix + suffix;
      trailingSlashFixed++;
      return prefix + "/" + suffix;
    },
  );
  if (trailingSlashFixed > 0) {
    console.log(`🔧 내부 링크 trailing slash ${trailingSlashFixed}개 자동 보정`);
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

  // FAQ 섹션 누락 시 자동 추가 (Claude API 토큰 부족으로 잘렸을 때 최소 폴백)
  // 주의: 본 폴백은 boilerplate 질문을 피하기 위해 종목 중심 1문항만 사용.
  // 정상적으로는 claude-prompt.ts의 주제 특화 FAQ 지시가 동작해야 함.
  if (!/^##\s.*자주 묻는 질문/m.test(fixedContent)) {
    fixedContent = fixedContent.replace(/###\s*자주 묻는 질문[\s\S]*$/, "").trimEnd();
    const kwShort = keyword.replace(/\s*(관련주|수혜주|테마주)\s*/g, "").trim() || keyword;
    const leader = post.relatedStocks[0] || "대장주";
    const faqSection = `\n\n## 자주 묻는 질문\n\n### Q. ${kwShort} 이슈에서 주목받는 종목은 어디인가요?\n\n${post.relatedStocks.join(", ")}이 대표적으로 거론됩니다. 특히 ${leader}가 거래대금·등락률 기준으로 가장 주목받고 있으며, 종목별 사업 연관성과 수혜 경로는 본문의 개별 분석 섹션에서 확인하세요.\n\n> ⚠️ 이 FAQ는 API 응답 불완전으로 자동 생성된 최소 버전입니다. 재생성 권장.\n`;
    fixedContent += faqSection;
    console.log("🔧 FAQ 섹션 자동 추가 (최소 폴백 — 재생성 권장)");
  }

  // 핫이슈 필수 섹션 누락 시 자동 추가 (Claude API가 토큰 부족으로 뒷부분 생략하는 경우 대비)
  // boilerplate 패턴 금지. 최소 폴백으로 섹션 존재만 보장하고 재생성 유도.
  if (categoryOverride === "hot-issues" || !categoryOverride) {
    const kw = keyword.replace(/\s*(관련주|수혜주|테마주)\s*/g, "").trim() || keyword;

    if (!/^## .*투자 시 체크포인트/m.test(fixedContent)) {
      const insertBefore = fixedContent.search(/^## .*투자 결론/m);
      const checkSection = `\n\n## ${kw} 투자 시 체크포인트\n\n✔ <mark>${kw} 관련 뉴스·공시 흐름 지속 모니터링</mark>\n본 주제는 이벤트·정책·기업 공시 등 특수 변수에 영향을 크게 받습니다. 본문 "시장 상세 분석" 섹션의 개별 이슈 경과를 주시하세요.\n\n✔ <mark>개별 종목 사업 연관성 확인</mark>\n같은 테마라도 실제 수혜 구조는 기업마다 다릅니다. 본문 각 종목 분석의 사업 구조·실적 부분을 우선 참고하세요.\n\n> ⚠️ 이 체크포인트는 API 응답 불완전으로 자동 생성된 최소 버전입니다. 재생성 권장.\n`;
      if (insertBefore !== -1) {
        fixedContent = fixedContent.slice(0, insertBefore) + checkSection + "\n" + fixedContent.slice(insertBefore);
      } else {
        fixedContent += checkSection;
      }
      console.log("🔧 투자 시 체크포인트 섹션 자동 추가 (최소 폴백 — 재생성 권장)");
    }

    if (!/^## .*투자 결론/m.test(fixedContent)) {
      const insertBefore = fixedContent.search(/^## .*자주 묻는 질문/m);
      const stocksLine = post.relatedStocks.length > 0 ? post.relatedStocks.join(", ") : "관련주";
      const conclusionSection = `\n\n## ${kw} 관련주 투자 결론\n\n${kw} 관련주로는 ${stocksLine}이 본문에서 다뤄졌습니다. 각 종목의 이벤트별 수혜 구조와 진입·이탈 조건은 본문 상세 분석을 참고하세요.\n\n> ⚠️ 이 결론은 API 응답 불완전으로 자동 생성된 최소 버전입니다. 재생성 권장.\n\n> ※ 본 글은 정보 제공을 목적으로 하며, 투자의 책임은 투자자 본인에게 있습니다.\n`;
      if (insertBefore !== -1) {
        fixedContent = fixedContent.slice(0, insertBefore) + conclusionSection + "\n" + fixedContent.slice(insertBefore);
      } else {
        fixedContent += conclusionSection;
      }
      console.log("🔧 투자 결론 섹션 자동 추가 (최소 폴백 — 재생성 권장)");
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
  // Refresh 모드 또는 --date 플래그로 날짜/슬러그 보존
  const date = refreshContext?.date ?? dateOverride ?? todayDate();
  let slug: string;
  if (refreshContext) {
    // 기존 URL 보존
    slug = refreshSlug as string;
  } else {
    let slugSuffix: string;
    if (manualSlug) {
      slugSuffix = manualSlug;
    } else if (categoryOverride === "featured-stocks") {
      slugSuffix = "featured-stocks";
    } else if (categoryOverride === "new-stocks") {
      // Claude 응답의 영문 slug 우선, 없으면 toSlug fallback
      const claudeSlug = post.slug;
      slugSuffix = claudeSlug
        ? `${claudeSlug}-new-listing`
        : `${toSlug(keyword)}-new-listing`;
      if (!claudeSlug) {
        console.warn(`⚠️ Claude 응답에 slug 누락 — toSlug() fallback 사용 (한글 음역 위험)`);
      }
    } else {
      // hot-issues: Claude 응답의 영문 slug 우선, 없으면 toSlug fallback
      const claudeSlug = post.slug;
      slugSuffix = claudeSlug ?? toSlug(keyword);
      if (claudeSlug) {
        console.log(`✅ Claude 영문 슬러그 사용: ${claudeSlug}`);
      } else {
        console.warn(`⚠️ Claude 응답에 slug 누락 — toSlug() fallback 사용 (한글 음역 위험)`);
      }
    }
    slug = `${date}-${slugSuffix}`;
  }

  let thumbnailPath: string;
  let imageCredit: string;

  if (manualThumbnail) {
    // 사용자가 직접 지정한 썸네일 처리
    const ext = path.extname(manualThumbnail);
    const destDir = path.join(process.cwd(), "public", "images", "thumbnails");
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const destFileName = `${slug}${ext}`;
    const destPath = path.join(destDir, destFileName);
    // Refresh 모드에서 src === dst 인 경우 copy 생략 (자기 자신 덮어쓰기 방지)
    if (path.resolve(manualThumbnail) !== path.resolve(destPath)) {
      fs.copyFileSync(manualThumbnail, destPath);
    }

    thumbnailPath = `/images/thumbnails/${destFileName}`;
    imageCredit = "";
    console.log(`🖼️  썸네일 보존: ${thumbnailPath}`);
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
  const mdx = buildMdx(post, date, slug, thumbnailPath, imageCredit, stockInfoList, featuredTradeMap);

  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }

  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  fs.writeFileSync(filePath, mdx, "utf-8");

  // -----------------------------------------------------------------------
  // Step 6: 네이버 블로그 요약본 자동 생성 (featured-stocks, hot-issues만)
  // -----------------------------------------------------------------------
  if (post.category === "featured-stocks" || post.category === "hot-issues") {
    try {
      const { generateNaverSummary } = await import("./generate-naver-summary-lib");
      const naverPath = generateNaverSummary(slug);
      console.log(`\n📝 네이버 블로그 요약본 생성됨: ${naverPath}`);
    } catch {
      console.log(`\n⚠️ 네이버 요약본 생성 실패 (글 생성에는 영향 없음)`);
    }
  }

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
