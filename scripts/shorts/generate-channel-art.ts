/**
 * Generate K주식핫이슈 YouTube channel profile + banner.
 *
 * Outputs:
 *   public/channel-profile.png    (800x800, 채널 프로필 사진)
 *   public/channel-banner.png     (2560x1440, 채널 배너)
 *
 * Usage:
 *   npx tsx scripts/shorts/generate-channel-art.ts
 *
 * Then upload manually in YouTube Studio:
 *   1. https://studio.youtube.com → 맞춤설정 → 프로필
 *   2. 사진 변경 → channel-profile.png 업로드
 *   3. 배너 이미지 변경 → channel-banner.png 업로드
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const PROFILE_PATH = path.join(PUBLIC_DIR, "channel-profile.png");
const BANNER_PATH = path.join(PUBLIC_DIR, "channel-banner.png");

const FONT_FAMILY = "'Noto Sans KR', 'Malgun Gothic', sans-serif";

async function generateProfile(): Promise<void> {
  const svg = `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0A0A0B"/>
        <stop offset="50%" stop-color="#16161A"/>
        <stop offset="100%" stop-color="#1F1F24"/>
      </linearGradient>
      <radialGradient id="redGlow" cx="50%" cy="100%" r="70%">
        <stop offset="0%" stop-color="#DC2626" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#DC2626" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- Background circle -->
    <circle cx="400" cy="400" r="400" fill="url(#bgGrad)"/>
    <circle cx="400" cy="400" r="400" fill="url(#redGlow)"/>

    <!-- Outer ring -->
    <circle cx="400" cy="400" r="384" fill="none" stroke="#DC2626" stroke-width="10"/>

    <!-- "K" big -->
    <text x="400" y="340" text-anchor="middle"
          font-family="${FONT_FAMILY}" font-size="320" font-weight="900"
          fill="#FFFFFF" letter-spacing="-10">K</text>

    <!-- "주식핫이슈" small -->
    <text x="400" y="500" text-anchor="middle"
          font-family="${FONT_FAMILY}" font-size="120" font-weight="900"
          fill="#FFFFFF" letter-spacing="-3">주식핫이슈</text>

    <!-- Red underline -->
    <line x1="200" y1="540" x2="600" y2="540" stroke="#DC2626" stroke-width="6" stroke-linecap="round"/>

    <!-- Up arrow / chart accent -->
    <text x="400" y="650" text-anchor="middle"
          font-family="${FONT_FAMILY}" font-size="80" font-weight="800"
          fill="#DC2626">📈 STOCK</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(PROFILE_PATH);
  const stat = fs.statSync(PROFILE_PATH);
  console.log(`✅ 프로필: ${PROFILE_PATH} (${(stat.size / 1024).toFixed(0)} KB)`);
}

async function generateBanner(): Promise<void> {
  // 2560×1440 — TV-safe size (recommended max)
  // Mobile safe area: center 1235×338 (lower-center)
  const svg = `<svg width="2560" height="1440" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#000000"/>
        <stop offset="50%" stop-color="#0A0A0B"/>
        <stop offset="100%" stop-color="#16161A"/>
      </linearGradient>
      <radialGradient id="redGlow1" cx="20%" cy="50%" r="60%">
        <stop offset="0%" stop-color="#DC2626" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#DC2626" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="redGlow2" cx="80%" cy="80%" r="50%">
        <stop offset="0%" stop-color="#DC2626" stop-opacity="0.20"/>
        <stop offset="100%" stop-color="#DC2626" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- Background -->
    <rect width="2560" height="1440" fill="url(#bgGrad)"/>
    <ellipse cx="500" cy="720" rx="800" ry="600" fill="url(#redGlow1)"/>
    <ellipse cx="2050" cy="1200" rx="700" ry="500" fill="url(#redGlow2)"/>

    <!-- Vertical accent lines -->
    <line x1="1280" y1="0" x2="1280" y2="1440" stroke="rgba(255,255,255,0.03)" stroke-width="2"/>

    <!-- ====== MOBILE SAFE AREA (1235×338, center) ====== -->
    <!-- Eyebrow tag -->
    <rect x="1130" y="555" width="300" height="60" rx="30" fill="rgba(220,38,38,0.15)" stroke="#DC2626" stroke-width="2"/>
    <text x="1280" y="597" text-anchor="middle"
          font-family="${FONT_FAMILY}" font-size="32" font-weight="700"
          fill="#F87171" letter-spacing="2">🔥 DAILY KOREAN STOCK</text>

    <!-- Main brand name -->
    <text x="1280" y="730" text-anchor="middle"
          font-family="${FONT_FAMILY}" font-size="160" font-weight="900"
          fill="#FFFFFF" letter-spacing="-5">K주식핫이슈</text>

    <!-- Subtitle -->
    <text x="1280" y="810" text-anchor="middle"
          font-family="${FONT_FAMILY}" font-size="48" font-weight="600"
          fill="#A1A1A6" letter-spacing="0">매일 평일 장 마감 후 시장 주도주 분석</text>

    <!-- Blog URL with red accent -->
    <text x="1280" y="900" text-anchor="middle"
          font-family="${FONT_FAMILY}" font-size="56" font-weight="800"
          fill="#DC2626" letter-spacing="0">👉 kstockflow.com</text>
    <!-- ====== END MOBILE SAFE AREA ====== -->

    <!-- Decorative chart icon (left, off-mobile) -->
    <g transform="translate(300,720)">
      <text x="0" y="0" font-family="${FONT_FAMILY}" font-size="240" font-weight="900" fill="rgba(220,38,38,0.4)">📈</text>
    </g>
    <!-- Decorative chart icon (right, off-mobile) -->
    <g transform="translate(2150,720)">
      <text x="0" y="0" font-family="${FONT_FAMILY}" font-size="240" font-weight="900" fill="rgba(220,38,38,0.4)">💹</text>
    </g>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(BANNER_PATH);
  const stat = fs.statSync(BANNER_PATH);
  console.log(`✅ 배너: ${BANNER_PATH} (${(stat.size / 1024).toFixed(0)} KB)`);
}

async function main(): Promise<void> {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  console.log("\n🎨 K주식핫이슈 채널 아트 생성\n");
  await generateProfile();
  await generateBanner();
  console.log(`
📤 YouTube Studio 업로드:
  1. https://studio.youtube.com → 맞춤설정 → 프로필
  2. 사진 변경: ${PROFILE_PATH}
  3. 배너 이미지 변경: ${BANNER_PATH}
  4. 게시
`);
}

main().catch((err) => {
  console.error("❌ 실패:", err);
  process.exit(1);
});
