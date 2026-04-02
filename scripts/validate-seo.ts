/**
 * SEO/기술 품질 검증 스크립트
 * 빌드 후 자동 실행 — 문제 있으면 배포 차단
 */
import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve("out");
let errors: string[] = [];
let warnings: string[] = [];

function error(msg: string) { errors.push("❌ " + msg); }
function warn(msg: string) { warnings.push("⚠️ " + msg); }
function ok(msg: string) { console.log("✅ " + msg); }

// 1. 필수 파일 존재 확인
function checkRequiredFiles() {
  const required = [
    "sitemap.xml",
    "robots.txt",
    "favicon.ico",
    "icon.svg",
    "apple-icon.svg",
    "images/logo.png",
    "images/og-default.png",
    "feed.xml",
  ];
  for (const file of required) {
    if (!fs.existsSync(path.join(OUT_DIR, file))) {
      error(`필수 파일 누락: ${file}`);
    }
  }
  ok("필수 파일 존재 확인");
}

// 2. 모든 포스트 HTML 검증
function checkPostPages() {
  const postsDir = path.join(OUT_DIR, "posts");
  if (!fs.existsSync(postsDir)) { error("out/posts/ 디렉토리 없음"); return; }

  const slugs = fs.readdirSync(postsDir).filter(f =>
    fs.statSync(path.join(postsDir, f)).isDirectory()
  );

  let checkedCount = 0;

  for (const slug of slugs) {
    const htmlPath = path.join(postsDir, slug, "index.html");
    if (!fs.existsSync(htmlPath)) { error(`${slug}: index.html 없음`); continue; }

    const html = fs.readFileSync(htmlPath, "utf-8");

    // 가짜 AdSense ID 검사
    if (html.includes("ca-pub-XXXXXXXXXX") || html.includes("ca-pub-xxxxx")) {
      error(`${slug}: 가짜 AdSense ID 발견`);
    }

    // robots noindex 검사 (포스트에는 없어야 함)
    if (html.includes('content="noindex"') && !slug.includes("404")) {
      error(`${slug}: noindex 태그 발견 — 검색 차단됨`);
    }

    // og:url 존재 확인
    if (!html.includes('property="og:url"')) {
      error(`${slug}: og:url 메타태그 누락`);
    }

    // canonical 존재 확인
    if (!html.includes('rel="canonical"')) {
      error(`${slug}: canonical 태그 누락`);
    }

    // title 태그 존재 확인
    if (!html.includes("<title>")) {
      error(`${slug}: title 태그 누락`);
    }

    // description 존재 확인
    if (!html.includes('name="description"')) {
      error(`${slug}: description 메타태그 누락`);
    }

    // BlogPosting 중복 확인 (JSON-LD 내에서만)
    const jsonLdBlocks = html.match(/type="application\/ld\+json"/g) || [];
    const blogPostingCount = (html.match(/"@type":"BlogPosting"/g) || []).length;
    if (blogPostingCount > 1) {
      error(`${slug}: BlogPosting JSON-LD ${blogPostingCount}개 중복`);
    }

    // 썸네일 이미지 참조 확인
    const ogImage = html.match(/property="og:image"\s+content="([^"]+)"/);
    if (ogImage) {
      const imgPath = ogImage[1].replace("https://kstockflow.com", "");
      if (!fs.existsSync(path.join(OUT_DIR, imgPath))) {
        error(`${slug}: og:image 파일 없음 (${imgPath})`);
      }
    }

    // 구조화 데이터 이미지 404 확인
    if (html.includes("/images/logo.png")) {
      if (!fs.existsSync(path.join(OUT_DIR, "images/logo.png"))) {
        error(`${slug}: logo.png 참조하지만 파일 없음`);
      }
    }

    checkedCount++;
  }

  ok(`포스트 ${checkedCount}개 HTML 검증 완료`);
}

// 3. 홈페이지 검증
function checkHomePage() {
  const htmlPath = path.join(OUT_DIR, "index.html");
  if (!fs.existsSync(htmlPath)) { error("홈페이지 index.html 없음"); return; }

  const html = fs.readFileSync(htmlPath, "utf-8");

  if (!html.includes('google-site-verification')) {
    error("홈페이지: Google 사이트 인증 메타태그 누락");
  }
  if (!html.includes('naver-site-verification')) {
    error("홈페이지: Naver 사이트 인증 메타태그 누락");
  }
  if (html.includes("ca-pub-XXXXXXXXXX")) {
    error("홈페이지: 가짜 AdSense ID 발견");
  }

  ok("홈페이지 검증 완료");
}

// 4. 사이트맵 검증
function checkSitemap() {
  const sitemapPath = path.join(OUT_DIR, "sitemap.xml");
  if (!fs.existsSync(sitemapPath)) { error("sitemap.xml 없음"); return; }

  const sitemap = fs.readFileSync(sitemapPath, "utf-8");
  const urls = (sitemap.match(/<loc>/g) || []).length;

  if (urls < 10) {
    error(`사이트맵에 URL ${urls}개만 있음 — 너무 적음`);
  }

  // 모든 포스트가 사이트맵에 있는지 확인
  const postsDir = path.join(OUT_DIR, "posts");
  if (fs.existsSync(postsDir)) {
    const slugs = fs.readdirSync(postsDir).filter(f =>
      fs.statSync(path.join(postsDir, f)).isDirectory()
    );
    for (const slug of slugs) {
      if (!sitemap.includes(`/posts/${slug}/`)) {
        error(`사이트맵에 /posts/${slug}/ 누락`);
      }
    }
  }

  ok(`사이트맵 검증 완료 (${urls}개 URL)`);
}

// 5. robots.txt 검증
function checkRobots() {
  const robotsPath = path.join(OUT_DIR, "robots.txt");
  if (!fs.existsSync(robotsPath)) { error("robots.txt 없음"); return; }

  const robots = fs.readFileSync(robotsPath, "utf-8");

  if (robots.includes("Disallow: /posts")) {
    error("robots.txt: /posts 크롤링 차단됨");
  }
  if (robots.includes("Disallow: /category")) {
    error("robots.txt: /category 크롤링 차단됨");
  }
  if (!robots.includes("Sitemap:")) {
    warn("robots.txt: 사이트맵 URL 선언 없음");
  }

  ok("robots.txt 검증 완료");
}

// 6. 내부 링크 검증
function checkInternalLinks() {
  const postsDir = path.join(OUT_DIR, "posts");
  if (!fs.existsSync(postsDir)) return;

  const slugs = fs.readdirSync(postsDir).filter(f =>
    fs.statSync(path.join(postsDir, f)).isDirectory()
  );

  let brokenCount = 0;
  for (const slug of slugs) {
    const htmlPath = path.join(postsDir, slug, "index.html");
    if (!fs.existsSync(htmlPath)) continue;

    const html = fs.readFileSync(htmlPath, "utf-8");
    const links = html.matchAll(/href="(\/posts\/[^"]+?)"/g);
    for (const match of links) {
      const target = match[1].replace(/\/$/, "");
      const targetSlug = target.replace("/posts/", "");
      if (!fs.existsSync(path.join(postsDir, targetSlug, "index.html"))) {
        error(`${slug}: 깨진 내부 링크 → ${match[1]}`);
        brokenCount++;
      }
    }
  }

  ok(`내부 링크 검증 완료 (깨진 링크: ${brokenCount}개)`);
}

// 실행
console.log("\n🔍 SEO/기술 품질 검증 시작...\n");

checkRequiredFiles();
checkPostPages();
checkHomePage();
checkSitemap();
checkRobots();
checkInternalLinks();

console.log("");
if (warnings.length > 0) {
  console.log("⚠️  경고:");
  warnings.forEach(w => console.log("  " + w));
  console.log("");
}

if (errors.length > 0) {
  console.log("❌ 오류 " + errors.length + "건 — 배포 차단:");
  errors.forEach(e => console.log("  " + e));
  console.log("\n🚫 SEO 검증 실패. 위 문제를 수정한 후 다시 빌드하세요.\n");
  process.exit(1);
} else {
  console.log("✅ SEO 검증 통과 — 배포 가능\n");
}
