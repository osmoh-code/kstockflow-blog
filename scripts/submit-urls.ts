#!/usr/bin/env tsx
/**
 * 색인 자동 제출 스크립트 — postbuild에서 자동 실행
 *
 * 새 글 URL을 모든 주요 검색엔진에 자동 제출합니다:
 * 1. IndexNow API → Bing, Naver, Yandex 즉시 색인
 * 2. Google Indexing API → Google 즉시 색인 요청
 *
 * Google 인증 (둘 중 하나):
 *   A) google-credentials.json (서비스 계정 JSON 키) — 프로젝트 루트
 *   B) .env.local에 GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
 *
 * Usage:
 *   npx tsx scripts/submit-urls.ts          # 새 URL만 제출
 *   npx tsx scripts/submit-urls.ts --all    # 전체 URL 제출 (초기 세팅용)
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// .env.local 로드 (Next.js 외부 실행 시 환경변수 확보)
// ---------------------------------------------------------------------------

function loadEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (key && !process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SITE_URL = "https://kstockflow.com";
const INDEXNOW_KEY = "g98dgix2464s9ofac1s1z51fh3of33c3";
const SITEMAP_PATH = path.join(process.cwd(), "out", "sitemap.xml");
const CREDENTIALS_PATH = path.join(process.cwd(), "google-credentials.json");
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
    { name: "IndexNow (Bing)", url: "https://www.bing.com/indexnow" },
    { name: "IndexNow (Naver)", url: "https://searchadvisor.naver.com/indexnow" },
    { name: "IndexNow (Yandex)", url: "https://yandex.com/indexnow" },
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
// Google Indexing API — 새 URL을 Google에 직접 색인 요청
// ---------------------------------------------------------------------------

async function submitGoogleIndexing(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  try {
    const { google } = await import("googleapis");

    let auth;
    if (fs.existsSync(CREDENTIALS_PATH)) {
      auth = new google.auth.GoogleAuth({
        keyFile: CREDENTIALS_PATH,
        scopes: ["https://www.googleapis.com/auth/indexing"],
      });
    } else {
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const key = process.env.GOOGLE_PRIVATE_KEY;
      if (!email || !key) {
        console.log("  ⚠️ Google 인증 미설정 — 색인 요청 건너뜀");
        console.log("     → google-credentials.json 또는 .env.local에 GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY 설정");
        return;
      }
      auth = new google.auth.JWT(
        email,
        undefined,
        key.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/indexing"],
      );
    }

    const indexing = google.indexing({ version: "v3", auth });
    let success = 0;
    let failed = 0;

    for (const url of urls) {
      try {
        await indexing.urlNotifications.publish({
          requestBody: { url, type: "URL_UPDATED" },
        });
        console.log(`  ✅ Google: ${url}`);
        success++;
        await new Promise((r) => setTimeout(r, 500));
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  ❌ Google: ${url} — ${msg}`);
        failed++;
      }
    }

    console.log(`  📊 Google Indexing: ${success}개 성공, ${failed}개 실패`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`  ⚠️ Google Indexing 모듈 오류: ${msg}`);
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

  // 4. Google Indexing API 제출
  console.log("\n🔗 Google Indexing API 제출 중...");
  await submitGoogleIndexing(urlsToSubmit);

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
