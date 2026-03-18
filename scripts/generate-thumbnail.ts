#!/usr/bin/env tsx
/**
 * Level 3 — Thumbnail Generator: Create an HTML thumbnail template (1200x630 OG image).
 *
 * Usage:
 *   npx tsx scripts/generate-thumbnail.ts "삼성전자 실적" "시장분석"
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Category color schemes
// ---------------------------------------------------------------------------

interface CategoryTheme {
  readonly gradient: string;
  readonly emoji: string;
  readonly badgeBg: string;
  readonly badgeText: string;
}

const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  "주식특징주": {
    gradient: "linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #c44569 100%)",
    emoji: "📈",
    badgeBg: "rgba(255, 255, 255, 0.25)",
    badgeText: "#fff",
  },
  "핫이슈": {
    gradient: "linear-gradient(135deg, #f7971e 0%, #ffd200 50%, #f97316 100%)",
    emoji: "🔥",
    badgeBg: "rgba(255, 255, 255, 0.3)",
    badgeText: "#7c2d12",
  },
  "투자전략": {
    gradient: "linear-gradient(135deg, #2563eb 0%, #1e40af 50%, #7c3aed 100%)",
    emoji: "🎯",
    badgeBg: "rgba(255, 255, 255, 0.2)",
    badgeText: "#fff",
  },
  "시장분석": {
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 50%, #4f46e5 100%)",
    emoji: "📊",
    badgeBg: "rgba(255, 255, 255, 0.2)",
    badgeText: "#fff",
  },
  "경제뉴스": {
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    emoji: "📰",
    badgeBg: "rgba(255, 255, 255, 0.25)",
    badgeText: "#fff",
  },
} as const;

const DEFAULT_THEME: CategoryTheme = {
  gradient: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)",
  emoji: "💹",
  badgeBg: "rgba(255, 255, 255, 0.2)",
  badgeText: "#fff",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(text: string): string {
  return text
    .replace(/[^\w가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .toLowerCase();
}

function todayFormatted(): string {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
}

// ---------------------------------------------------------------------------
// HTML template builder
// ---------------------------------------------------------------------------

function buildThumbnailHtml(title: string, category: string): string {
  const theme = CATEGORY_THEMES[category] ?? DEFAULT_THEME;

  // Truncate title for display if needed
  const displayTitle = title.length > 30 ? `${title.slice(0, 28)}...` : title;
  const fontSize = title.length > 20 ? "42px" : "52px";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1200">
<title>${title} — KStockFlow Thumbnail</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Malgun Gothic', '맑은 고딕', sans-serif;
  }
  .container {
    width: 1200px;
    height: 630px;
    background: ${theme.gradient};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 60px 70px;
    position: relative;
  }
  /* Decorative circles */
  .container::before {
    content: '';
    position: absolute;
    top: -80px;
    right: -80px;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
  }
  .container::after {
    content: '';
    position: absolute;
    bottom: -60px;
    left: -60px;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: rgba(255,255,255,0.04);
  }
  .top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    position: relative;
    z-index: 1;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: ${theme.badgeBg};
    color: ${theme.badgeText};
    padding: 10px 22px;
    border-radius: 30px;
    font-size: 20px;
    font-weight: 600;
    backdrop-filter: blur(4px);
  }
  .date {
    color: rgba(255,255,255,0.7);
    font-size: 18px;
    font-weight: 400;
  }
  .title-area {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    align-items: center;
  }
  .title {
    color: #ffffff;
    font-size: ${fontSize};
    font-weight: 800;
    line-height: 1.35;
    letter-spacing: -0.5px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.2);
    word-break: keep-all;
  }
  .bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    position: relative;
    z-index: 1;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-icon {
    width: 44px;
    height: 44px;
    background: rgba(255,255,255,0.2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 900;
    color: #fff;
  }
  .brand-text {
    color: rgba(255,255,255,0.9);
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .url {
    color: rgba(255,255,255,0.5);
    font-size: 16px;
    font-weight: 400;
  }
</style>
</head>
<body>
<div class="container">
  <div class="top-row">
    <div class="badge">${theme.emoji} ${category}</div>
    <div class="date">${todayFormatted()}</div>
  </div>
  <div class="title-area">
    <h1 class="title">${displayTitle}</h1>
  </div>
  <div class="bottom-row">
    <div class="brand">
      <div class="brand-icon">K</div>
      <span class="brand-text">KStockFlow</span>
    </div>
    <div class="url">kstockflow.com</div>
  </div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const title = process.argv[2];
  const category = process.argv[3] ?? "시장분석";

  if (!title) {
    console.error('❌ 사용법: npx tsx scripts/generate-thumbnail.ts "제목" "카테고리"');
    process.exit(1);
  }

  const slug = toSlug(title);
  const outDir = path.join(process.cwd(), "public", "images", "thumbnails");

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const html = buildThumbnailHtml(title, category);
  const filePath = path.join(outDir, `${slug}.html`);
  fs.writeFileSync(filePath, html, "utf-8");

  console.log(`\n🎨 썸네일 HTML 생성 완료!`);
  console.log(`📄 파일: ${filePath}`);
  console.log(`📐 크기: 1200 x 630 (OG 이미지 표준)`);
  console.log(`🏷️  카테고리: ${category}`);
  console.log();
  console.log(
    "💡 실제 이미지(PNG/JPG) 변환이 필요하면 Puppeteer를 사용하세요:",
  );
  console.log(
    "   npx puppeteer screenshot --width=1200 --height=630 " + filePath,
  );
  console.log();
}

main();

export { buildThumbnailHtml };
