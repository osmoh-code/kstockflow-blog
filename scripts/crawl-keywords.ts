#!/usr/bin/env tsx
/**
 * Level 2 — Keyword Crawler: Fetch trending Korean stock keywords.
 *
 * Usage:
 *   npx tsx scripts/crawl-keywords.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrendingKeyword {
  readonly keyword: string;
  readonly source: string;
  readonly trend_score: number;
}

// ---------------------------------------------------------------------------
// Fallback keywords (used when crawling fails)
// ---------------------------------------------------------------------------

const FALLBACK_KEYWORDS: readonly TrendingKeyword[] = [
  { keyword: "코스피 전망", source: "fallback", trend_score: 80 },
  { keyword: "반도체 관련주", source: "fallback", trend_score: 75 },
  { keyword: "배당주 추천", source: "fallback", trend_score: 70 },
  { keyword: "금리 인하 수혜주", source: "fallback", trend_score: 65 },
  { keyword: "AI 관련주", source: "fallback", trend_score: 60 },
] as const;

// ---------------------------------------------------------------------------
// HTML parsing helpers (regex-based, no external dependency)
// ---------------------------------------------------------------------------

function extractTextBetweenTags(html: string, pattern: RegExp): readonly string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(pattern, "gi");
  while ((match = re.exec(html)) !== null) {
    const text = match[1]
      ?.replace(/<[^>]*>/g, "")
      .replace(/&[a-z]+;/gi, "")
      .trim();
    if (text && text.length > 1 && text.length < 40) {
      results.push(text);
    }
  }
  return results;
}

function isStockRelated(text: string): boolean {
  const stockTerms = [
    "주", "증시", "코스피", "코스닥", "상장", "실적", "매출", "영업이익",
    "반도체", "배터리", "ETF", "금리", "환율", "수출", "투자", "배당",
    "테마", "급등", "급락", "시장", "경제", "산업", "기업", "전망",
    "분석", "AI", "2차전지", "바이오", "자동차", "은행", "보험",
  ];
  return stockTerms.some((term) => text.includes(term));
}

// ---------------------------------------------------------------------------
// Naver Finance — popular search keywords
// ---------------------------------------------------------------------------

async function crawlNaverFinance(): Promise<readonly TrendingKeyword[]> {
  const url = "https://finance.naver.com/";
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) {
    throw new Error(`Naver Finance returned ${resp.status}`);
  }

  const html = await resp.text();

  // Extract popular search terms and headline keywords
  const keywords: TrendingKeyword[] = [];

  // Pattern: ranking keywords / popular searches
  const rankPatterns = [
    /<a[^>]*class="[^"]*"[^>]*title="([^"]+)"[^>]*>/gi,
    /<span class="blind">([^<]{2,30})<\/span>/gi,
    /<a[^>]*href="[^"]*item[^"]*"[^>]*>([^<]{2,20})<\/a>/gi,
  ];

  for (const pattern of rankPatterns) {
    const extracted = extractTextBetweenTags(html, pattern);
    for (const text of extracted) {
      if (isStockRelated(text) || text.match(/[가-힣]{2,}/)) {
        const existing = keywords.find((k) => k.keyword === text);
        if (!existing) {
          keywords.push({
            keyword: text,
            source: "naver-finance",
            trend_score: Math.max(90 - keywords.length * 5, 50),
          });
        }
      }
    }
  }

  return keywords.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Naver News — stock section headlines
// ---------------------------------------------------------------------------

async function crawlNaverStockNews(): Promise<readonly TrendingKeyword[]> {
  const url = "https://news.naver.com/breakingnews/section/101/258";
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) {
    throw new Error(`Naver News returned ${resp.status}`);
  }

  const html = await resp.text();

  // Extract headline texts
  const headlinePattern = /<a[^>]*class="[^"]*sa_text_title[^"]*"[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>/gi;
  const altPattern = /<a[^>]*href="[^"]*article[^"]*"[^>]*>([^<]{5,50})<\/a>/gi;

  const headlines = [
    ...extractTextBetweenTags(html, headlinePattern),
    ...extractTextBetweenTags(html, altPattern),
  ];

  // Extract key noun phrases from headlines
  const keywordCounts = new Map<string, number>();

  for (const headline of headlines) {
    // Simple Korean noun-phrase extraction via pattern matching
    const phrases = headline.match(/[가-힣A-Za-z0-9]{2,10}(?:\s[가-힣]{2,6})?/g) ?? [];
    for (const phrase of phrases) {
      if (isStockRelated(phrase) && phrase.length >= 2) {
        keywordCounts.set(phrase, (keywordCounts.get(phrase) ?? 0) + 1);
      }
    }
  }

  // Sort by frequency
  const sorted = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return sorted.map(([keyword], idx) => ({
    keyword,
    source: "naver-news",
    trend_score: Math.max(85 - idx * 5, 40),
  }));
}

// ---------------------------------------------------------------------------
// Deduplicate & rank
// ---------------------------------------------------------------------------

function deduplicateKeywords(
  lists: readonly (readonly TrendingKeyword[])[],
): readonly TrendingKeyword[] {
  const seen = new Map<string, TrendingKeyword>();

  for (const list of lists) {
    for (const kw of list) {
      const existing = seen.get(kw.keyword);
      if (!existing || existing.trend_score < kw.trend_score) {
        seen.set(kw.keyword, kw);
      }
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.trend_score - a.trend_score)
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function crawlKeywords(): Promise<readonly TrendingKeyword[]> {
  console.log("🔎 트렌딩 키워드 크롤링 시작...\n");

  const results: (readonly TrendingKeyword[])[] = [];

  // Crawl sources in parallel; individual failures are non-fatal
  const sources = [
    { name: "Naver Finance", fn: crawlNaverFinance },
    { name: "Naver Stock News", fn: crawlNaverStockNews },
  ] as const;

  const outcomes = await Promise.allSettled(sources.map((s) => s.fn()));

  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    if (outcome.status === "fulfilled" && outcome.value.length > 0) {
      console.log(`  ✅ ${sources[i].name}: ${outcome.value.length}개 키워드 수집`);
      results.push(outcome.value);
    } else {
      const reason =
        outcome.status === "rejected"
          ? (outcome.reason as Error).message
          : "결과 없음";
      console.log(`  ⚠️  ${sources[i].name}: 실패 (${reason})`);
    }
  }

  if (results.length === 0) {
    console.log("\n⚠️  모든 크롤링 실패 — 기본 키워드 목록 사용\n");
    return FALLBACK_KEYWORDS;
  }

  const keywords = deduplicateKeywords(results);
  console.log(`\n📊 최종 키워드 ${keywords.length}개 선정:\n`);
  for (const kw of keywords) {
    console.log(`  ${kw.trend_score >= 70 ? "🔥" : "📌"} [${kw.trend_score}] ${kw.keyword} (${kw.source})`);
  }
  console.log();

  return keywords;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1]?.includes("crawl-keywords")) {
  crawlKeywords().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ 크롤링 오류: ${message}`);
    process.exit(1);
  });
}
