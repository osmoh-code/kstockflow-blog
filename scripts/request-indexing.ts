/**
 * Google Indexing API를 사용해 모든 URL의 색인 생성을 자동 요청
 *
 * 사전 설정:
 * 1. Google Cloud Console → API 및 서비스 → Indexing API 사용 설정
 * 2. 서비스 계정 생성 → JSON 키 다운로드 → google-credentials.json으로 저장
 * 3. Search Console → 설정 → 사용자 및 권한 → 서비스 계정 이메일을 소유자로 추가
 */
import fs from "fs";
import path from "path";
import { google } from "googleapis";

const CREDENTIALS_PATH = path.resolve("google-credentials.json");
const SITEMAP_PATH = path.resolve("out/sitemap.xml");

async function main() {
  // 1. 인증 정보 확인
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("❌ google-credentials.json 파일이 없습니다.");
    console.error("");
    console.error("설정 방법:");
    console.error("1. https://console.cloud.google.com 접속");
    console.error("2. 프로젝트 선택 (없으면 새로 생성)");
    console.error("3. API 및 서비스 → 라이브러리 → 'Web Search Indexing API' 검색 → 사용");
    console.error("4. API 및 서비스 → 사용자 인증 정보 → 서비스 계정 만들기");
    console.error("5. 서비스 계정 → 키 → 키 추가 → JSON → 다운로드");
    console.error("6. 다운로드한 파일을 프로젝트 루트에 google-credentials.json으로 저장");
    console.error("7. 서비스 계정 이메일(xxx@xxx.iam.gserviceaccount.com)을 복사");
    console.error("8. Google Search Console → 설정 → 사용자 및 권한 → 사용자 추가 → 소유자로 추가");
    console.error("");
    console.error("그 후 다시 실행: npx tsx scripts/request-indexing.ts");
    process.exit(1);
  }

  // 2. 사이트맵에서 URL 추출
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error("❌ out/sitemap.xml이 없습니다. 먼저 npm run build를 실행하세요.");
    process.exit(1);
  }

  const sitemap = fs.readFileSync(SITEMAP_PATH, "utf-8");
  const urls: string[] = [];
  const matches = sitemap.matchAll(/<loc>(.*?)<\/loc>/g);
  for (const m of matches) {
    urls.push(m[1]);
  }

  console.log(`\n📋 사이트맵에서 ${urls.length}개 URL 발견\n`);

  // 3. Google Indexing API 인증
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/indexing"],
  });

  const indexing = google.indexing({ version: "v3", auth });

  // 4. URL 제출
  let success = 0;
  let failed = 0;

  for (const url of urls) {
    try {
      await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: "URL_UPDATED",
        },
      });
      console.log(`  ✅ ${url}`);
      success++;

      // Rate limit 방지 (초당 2개)
      await new Promise((r) => setTimeout(r, 500));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ ${url} — ${msg}`);
      failed++;
    }
  }

  console.log(`\n📊 결과: ${success}개 성공, ${failed}개 실패 (총 ${urls.length}개)\n`);
}

main().catch(console.error);
