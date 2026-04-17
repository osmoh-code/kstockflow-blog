/**
 * 네이버 블로그용 요약본 자동 생성
 *
 * 사용법:
 *   npx tsx scripts/generate-naver-summary.ts <slug>
 *   npx tsx scripts/generate-naver-summary.ts 2026-04-16-featured-stocks
 *
 * 결과:
 *   - 콘솔에 요약본 출력 (복사해서 네이버 블로그에 붙여넣기)
 *   - dist/naver/<slug>.txt 파일로도 저장
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const OUT_DIR = path.join(process.cwd(), "dist", "naver");
const SITE_URL = "https://kstockflow.com";

interface PostData {
  title: string;
  description: string;
  date: string;
  category: string;
  slug: string;
  tags: string[];
  relatedStocks: string[];
  content: string;
}

function loadPost(slug: string): PostData {
  const mdxPath = path.join(POSTS_DIR, `${slug}.mdx`);
  const mdPath = path.join(POSTS_DIR, `${slug}.md`);
  const filePath = fs.existsSync(mdxPath) ? mdxPath : mdPath;

  if (!fs.existsSync(filePath)) {
    console.error(`❌ 글을 찾을 수 없습니다: ${slug}`);
    console.error(`   경로: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    title: data.title ?? "",
    description: data.description ?? "",
    date: data.date ?? "",
    category: data.category ?? "",
    slug,
    tags: data.tags ?? [],
    relatedStocks: data.relatedStocks ?? [],
    content,
  };
}

/** MDX 본문에서 첫 번째 H2 아래 도입부 2~3문장 추출 */
function extractIntro(content: string): string {
  const lines = content.split("\n");
  const paragraphs: string[] = [];

  let foundFirstH2 = false;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (foundFirstH2) break; // 두 번째 H2 만나면 종료
      foundFirstH2 = true;
      continue;
    }
    if (!foundFirstH2) continue;

    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("|") || trimmed.startsWith("#")) break;

    // MDX 태그/마크다운 정리
    const clean = trimmed
      .replace(/<mark>/g, "")
      .replace(/<\/mark>/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\*\*/g, "");

    paragraphs.push(clean);
    if (paragraphs.length >= 3) break;
  }

  return paragraphs.join("\n\n");
}

/** 특징주 테이블에서 상위 N개 종목+등락률 추출 */
function extractTopStocks(
  content: string,
  n: number
): { name: string; change: string }[] {
  const rows: { name: string; change: string }[] = [];
  const tableRegex =
    /\|\s*([^|]+?)\s*\|\s*[^|]+?\s*\|\s*[^|]+?\s*\|\s*([+-]?\d+\.?\d*%)\s*\|/g;

  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(content)) !== null) {
    const name = match[1].trim();
    if (name === "종목명" || name.startsWith("---")) continue;
    rows.push({ name, change: match[2].trim() });
    if (rows.length >= n) break;
  }

  return rows;
}

/** 섹터 H3 헤딩에서 섹터명 추출 */
function extractSectors(content: string): string[] {
  const sectors: string[] = [];
  const regex = /### .+?\s+(.+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const name = match[1]
      .replace(
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\u{FE0F}\u{200D}]+\s*/gu,
        ""
      )
      .trim();
    if (name && !name.startsWith("Q.")) {
      sectors.push(name);
    }
  }

  return sectors;
}

/** 핫이슈 본문에서 종목별 요약 추출 */
function extractHotIssueStocks(
  content: string
): { name: string; point: string }[] {
  const stocks: { name: string; point: string }[] = [];
  const regex = /### \d+\.\s*(.+)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim();
    stocks.push({ name, point: "" });
  }

  return stocks;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─── 카테고리별 요약 생성 ───

function generateFeaturedSummary(post: PostData): string {
  const date = formatDate(post.date);
  const topStocks = extractTopStocks(post.content, 5);
  const sectors = extractSectors(post.content);
  const intro = extractIntro(post.content);

  const stockList = topStocks
    .map((s) => `  ${s.name} (${s.change})`)
    .join("\n");

  const sectorList = sectors
    .filter((s) => !s.includes("하락"))
    .slice(0, 4)
    .join(", ");

  return `${date} 주식특징주 - ${sectorList} 강세

${intro}

📊 오늘 상승률 TOP 5
${stockList}

주도 섹터: ${sectorList}

종목별 상세 분석, 거래대금, 투자 체크포인트는
아래 글에서 확인하세요.

👉 ${SITE_URL}/posts/${post.slug}/

#주식특징주 #오늘의특징주 #${date.replace(" ", "")}특징주 #주식 #주도주`;
}

function buildHashtags(post: PostData): string {
  const skip = new Set(["관련주", "대장주", "수혜주", "테마주", "총정리", "급등", "강세", "분석", "TOP"]);
  const titleWords = post.title
    .replace(/[|·,()]/g, " ")
    .split(/\s+/)
    .filter((w) => /^[가-힣A-Za-z0-9]{2,10}$/.test(w))
    .filter((w) => !skip.has(w) && !/^\d{4}$/.test(w));
  const unique = [...new Set(titleWords)].slice(0, 4);
  const tags = unique.map((w) => `#${w}`);
  return [...tags, "#관련주", "#주식분석"].join(" ");
}

function generateHotIssueSummary(post: PostData): string {
  const intro = extractIntro(post.content);
  const stocks = post.relatedStocks.slice(0, 5);

  let keyword = post.title.split(" 관련주")[0].split(" TOP")[0];
  if (keyword.length > 25) {
    keyword = keyword.slice(0, 25);
  }

  const hashtags = buildHashtags(post);

  return `${keyword} - 관련주 분석

${intro}

📌 주요 관련주: ${stocks.join(", ")}

종목별 심층 분석과 투자 체크포인트는
아래 글에서 확인하세요.

👉 ${SITE_URL}/posts/${post.slug}/

${hashtags}`;
}

function generateNewStocksSummary(post: PostData): string {
  const intro = extractIntro(post.content);

  // 제목에서 종목명 추출
  const companyName = post.title.split(" 상장")[0];

  return `${companyName} 신규상장 분석

${intro}

📋 공모 핵심 정보와 재무 분석, 투자 포인트,
리스크 체크리스트까지 총정리했습니다.

👉 ${SITE_URL}/posts/${post.slug}/

#${companyName.replace(/\s/g, "")} #신규상장 #공모주 #IPO분석`;
}

function generateSummary(post: PostData): string {
  switch (post.category) {
    case "featured-stocks":
      return generateFeaturedSummary(post);
    case "hot-issues":
      return generateHotIssueSummary(post);
    case "new-stocks":
      return generateNewStocksSummary(post);
    default:
      return generateHotIssueSummary(post); // fallback
  }
}

// ─── Main ───

const slug = process.argv[2];

if (!slug) {
  console.error("사용법: npx tsx scripts/generate-naver-summary.ts <slug>");
  console.error("예시:   npx tsx scripts/generate-naver-summary.ts 2026-04-16-featured-stocks");
  process.exit(1);
}

const post = loadPost(slug);
const summary = generateSummary(post);

// 파일 저장
fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, `${slug}.txt`);
fs.writeFileSync(outPath, summary, "utf-8");

// 콘솔 출력
console.log("\n" + "=".repeat(50));
console.log("📋 네이버 블로그용 요약본");
console.log("=".repeat(50) + "\n");
console.log(summary);
console.log("\n" + "=".repeat(50));
console.log(`✅ 저장됨: ${outPath}`);
console.log("   → 위 내용을 네이버 블로그에 복사·붙여넣기 하세요");
console.log("=".repeat(50) + "\n");
