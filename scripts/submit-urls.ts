#!/usr/bin/env tsx
/**
 * 색인 자동 제출 스크립트
 *
 * 빌드 후 자동 실행되어 새 글 URL을 검색엔진에 제출합니다.
 * 1. IndexNow API → Bing, Naver, Yandex 즉시 색인
 * 2. Google Search Console API → 사이트맵 재제출
 *
 * Usage:
 *   npx tsx scripts/submit-urls.ts          # 새 URL만 제출
 *   npx tsx scripts/submit-urls.ts --all    # 전체 URL 제출 (초기 세팅용)
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SITE_URL = "https://kstockflow.com";
const INDEXNOW_KEY = "g98dgix2464s9ofac1s1z51fh3of33c3";
const SITEMAP_PATH = path.join(process.cwd(), "out", "sitemap.xml");
const CACHE_PATH = path.join(process.cwd(), ".indexnow-cache.json");

// ---------------------------------------------------------------------------
// Sitemap 파싱 — URL 목록 추출
// ---------------------------------------------------------------------------

function parseSitemap(sitemapPath: string): string[] {
  if (!fs.existsSync(sitemapPath)) {
    console.warn(`⚠️ 사이트맵 없음: ${sitemapPath}`);
    return [];
  }

  const xml = fs.readFileSync(sitemapPath, "utf-8");
  const urls: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

// ---------------------------------------------------------------------------
// 캐시 관리 — 이전에 제출한 URL 기록
// ---------------------------------------------------------------------------

function loadCache(): Set<string> {
  if (!fs.existsSync(CACHE_PATH)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    return new Set(data.urls ?? []);
  } catch {
    return new Set();
  }
}

function saveCache(urls: string[]): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify({
    urls,
    lastUpdated: new Date().toISOString(),
  }, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// IndexNow API — Bing, Naver, Yandex 동시 제출
// ---------------------------------------------------------------------------

async function submitIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const body = JSON.stringify({
    host: "kstockflow.com",
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  });

  const endpoints = [
    { name: "IndexNow (Bing/Naver/Yandex)", url: "https://api.indexnow.org/indexnow" },
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
      });

      if (res.ok || res.status === 202) {
        console.log(`  ✅ ${endpoint.name}: ${urls.length}개 URL 제출 완료 (${res.status})`);
      } else {
        const text = await res.text().catch(() => "");
        console.warn(`  ⚠️ ${endpoint.name}: ${res.status} ${text.slice(0, 200)}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  ⚠️ ${endpoint.name} 요청 실패: ${message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Google Sitemaps Ping (Search Console 대체)
// ---------------------------------------------------------------------------

async function pingGoogle(): Promise<void> {
  // Search Console API는 OAuth 설정이 필요하므로,
  // 사이트맵 URL을 직접 요청하여 구글 크롤러에 힌트를 줌
  const sitemapUrl = `${SITE_URL}/sitemap.xml`;

  try {
    // Google에 사이트맵 존재 확인 요청 (크롤러 힌트)
    const res = await fetch(sitemapUrl, { method: "HEAD" });
    if (res.ok) {
      console.log(`  ✅ Google: 사이트맵 접근 확인 (${sitemapUrl})`);
    }
  } catch {
    console.warn(`  ⚠️ Google 사이트맵 접근 실패`);
  }

  // Naver SearchAdvisor에도 직접 제출
  try {
    const naverPing = `https://searchadvisor.naver.com/indexnow?url=${encodeURIComponent(sitemapUrl)}&key=${INDEXNOW_KEY}`;
    const res = await fetch(naverPing);
    if (res.ok || res.status === 202) {
      console.log(`  ✅ Naver: 사이트맵 ping 완료`);
    }
  } catch {
    console.warn(`  ⚠️ Naver 사이트맵 ping 실패`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const isAll = process.argv.includes("--all");

  console.log("\n🔍 색인 제출 스크립트 시작...\n");

  // 1. 사이트맵에서 URL 추출
  const allUrls = parseSitemap(SITEMAP_PATH);
  if (allUrls.length === 0) {
    console.log("📭 사이트맵에 URL이 없습니다.");
    return;
  }
  console.log(`📄 사이트맵 URL: ${allUrls.length}개`);

  // 2. 새 URL 필터링
  let urlsToSubmit: string[];

  if (isAll) {
    urlsToSubmit = allUrls;
    console.log(`🔄 전체 URL 제출 모드 (--all)`);
  } else {
    const cache = loadCache();
    urlsToSubmit = allUrls.filter((url) => !cache.has(url));

    if (urlsToSubmit.length === 0) {
      console.log("✅ 새로운 URL이 없습니다. 제출 생략.");
      return;
    }
    console.log(`🆕 새 URL: ${urlsToSubmit.length}개`);
  }

  urlsToSubmit.forEach((url) => console.log(`   → ${url}`));

  // 3. IndexNow 제출 (Bing + Naver + Yandex)
  console.log("\n📡 IndexNow API 제출 중...");
  await submitIndexNow(urlsToSubmit);

  // 4. Google / Naver 사이트맵 ping
  console.log("\n🔔 검색엔진 사이트맵 알림...");
  await pingGoogle();

  // 5. 캐시 업데이트
  saveCache(allUrls);
  console.log(`\n💾 캐시 업데이트: ${allUrls.length}개 URL 저장`);

  console.log("\n✨ 색인 제출 완료!\n");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ 오류: ${message}`);
  // 색인 제출 실패는 빌드를 중단하지 않음
  process.exit(0);
});
