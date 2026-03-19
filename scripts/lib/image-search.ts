/**
 * 키워드 기반 썸네일 이미지 자동 검색
 * - Unsplash API (무료, 월 50회)
 * - Pixabay API (무료, 월 5000회) — fallback
 * - Pexels API (무료, 월 200회) — 2nd fallback
 *
 * 키워드 확장 전략:
 *   1. 직접 매핑 (스페이스X → space rocket satellite launch)
 *   2. 부분 매칭으로 여러 키워드 합성
 *   3. 첫 검색 실패 시 대체 쿼리로 재시도
 */

interface ImageResult {
  readonly url: string;
  readonly thumbnailUrl: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly source: string;
  readonly photographerName: string;
  readonly photographerUrl: string;
  readonly downloadUrl: string;
}

// ---------------------------------------------------------------------------
// 키워드 → 영어 확장 매핑
// 각 키워드에 대해 [메인 검색어, 대체 검색어] 를 제공
// ---------------------------------------------------------------------------

interface KeywordMapping {
  readonly primary: string;    // 첫 번째 검색 시도
  readonly fallback: string;   // 실패 시 대체 검색
}

const KEYWORD_MAP: Record<string, KeywordMapping> = {
  // 우주/항공
  "스페이스X": { primary: "SpaceX rocket launch", fallback: "space rocket satellite" },
  "스페이스": { primary: "space rocket launch pad", fallback: "satellite orbit earth" },
  우주: { primary: "space rocket satellite launch", fallback: "spacecraft astronaut" },
  위성: { primary: "satellite orbit earth communication", fallback: "space satellite dish" },
  발사체: { primary: "rocket launch fire", fallback: "space launch vehicle" },
  항공: { primary: "aviation airplane flight", fallback: "airport aircraft runway" },

  // 방산/군사
  방산: { primary: "military defense weapons system", fallback: "army soldier equipment" },
  전쟁: { primary: "military warfare battlefield", fallback: "defense army combat" },
  드론: { primary: "military drone UAV flying", fallback: "drone aerial unmanned aircraft" },
  미사일: { primary: "missile defense system launch", fallback: "military rocket weapon" },
  무기: { primary: "military weapons defense", fallback: "army equipment arsenal" },
  탄약: { primary: "ammunition military shells", fallback: "defense weapons bullets" },
  해군: { primary: "navy warship ocean fleet", fallback: "battleship destroyer sea" },
  공군: { primary: "air force fighter jet", fallback: "military aircraft combat" },
  방어: { primary: "missile defense shield system", fallback: "military defense radar" },

  // 지정학/지역
  호르무즈: { primary: "oil tanker strait ocean ship", fallback: "cargo ship oil sea persian gulf" },
  중동: { primary: "middle east oil refinery desert", fallback: "oil pipeline petroleum" },
  이란: { primary: "oil tanker persian gulf ship", fallback: "middle east oil petroleum" },
  우크라이나: { primary: "military defense europe army", fallback: "combat vehicle tank" },
  NATO: { primary: "NATO military alliance soldiers", fallback: "european defense army" },
  러시아: { primary: "military army defense europe", fallback: "geopolitical conflict map" },
  대만: { primary: "semiconductor taiwan chip factory", fallback: "technology manufacturing asia" },

  // 반도체/테크
  반도체: { primary: "semiconductor chip wafer closeup", fallback: "microchip circuit board" },
  AI: { primary: "artificial intelligence robot technology", fallback: "AI neural network data center" },
  엔비디아: { primary: "nvidia GPU graphics card chip", fallback: "AI computing data center server" },
  GTC: { primary: "nvidia GTC tech conference stage", fallback: "technology conference keynote AI" },
  HBM: { primary: "HBM memory chip semiconductor", fallback: "high bandwidth memory server" },
  GPU: { primary: "GPU graphics card processor chip", fallback: "computer hardware technology" },
  양자컴퓨터: { primary: "quantum computer technology lab", fallback: "quantum computing processor" },
  "5G": { primary: "5G telecommunications tower antenna", fallback: "wireless network technology" },
  "6G": { primary: "6G wireless technology future network", fallback: "telecommunications antenna tower signal" },

  // 에너지/자원
  석유: { primary: "oil refinery petroleum industry", fallback: "oil rig drilling platform" },
  유가: { primary: "oil barrel crude petroleum price", fallback: "oil tanker refinery" },
  천연가스: { primary: "natural gas LNG tanker ship", fallback: "gas pipeline energy" },
  태양광: { primary: "solar panel energy farm field", fallback: "renewable energy solar" },
  풍력: { primary: "wind turbine farm energy ocean", fallback: "wind power renewable" },
  원전: { primary: "nuclear power plant cooling tower", fallback: "atomic energy reactor" },
  수소: { primary: "hydrogen fuel cell energy green", fallback: "hydrogen tank future energy" },
  리튬: { primary: "lithium mining battery mineral", fallback: "lithium ion battery technology" },
  희토류: { primary: "rare earth mining minerals", fallback: "mining excavation minerals" },

  // 산업/섹터
  배터리: { primary: "EV battery technology lithium cell", fallback: "electric vehicle battery pack" },
  전기차: { primary: "electric vehicle EV charging", fallback: "tesla electric car future" },
  자율주행: { primary: "autonomous driving car sensor lidar", fallback: "self driving vehicle technology" },
  바이오: { primary: "biotechnology laboratory research", fallback: "medical science DNA gene" },
  제약: { primary: "pharmaceutical medicine pills", fallback: "medical research laboratory" },
  로봇: { primary: "industrial robot automation factory", fallback: "humanoid robot technology AI" },
  건설: { primary: "construction crane building site", fallback: "architecture skyscraper city" },
  조선: { primary: "shipbuilding shipyard construction", fallback: "cargo ship container port" },
  철강: { primary: "steel industry factory molten metal", fallback: "steel manufacturing plant" },
  화학: { primary: "chemical industry factory plant", fallback: "chemical laboratory science" },
  물류: { primary: "logistics shipping container port", fallback: "warehouse delivery truck" },

  // 금융/경제
  주식: { primary: "stock market trading chart bull", fallback: "stock exchange trading floor" },
  증시: { primary: "stock exchange trading floor screen", fallback: "financial market chart" },
  투자: { primary: "investment finance growth chart", fallback: "money trading stock" },
  은행: { primary: "banking finance building", fallback: "financial institution money" },
  금리: { primary: "interest rate federal reserve bank", fallback: "finance economy graph chart" },
  환율: { primary: "currency exchange forex trading", fallback: "dollar won money exchange" },
  인플레이션: { primary: "inflation economy money price", fallback: "economic crisis chart" },
  경기침체: { primary: "recession economy downturn graph", fallback: "economic crisis stock market" },
  IPO: { primary: "IPO stock market bell ceremony", fallback: "initial public offering exchange" },
  상장: { primary: "stock exchange listing ceremony bell", fallback: "IPO market celebration" },

  // IT/소프트웨어
  클라우드: { primary: "cloud computing data center server", fallback: "cloud technology network" },
  블록체인: { primary: "blockchain cryptocurrency digital", fallback: "bitcoin crypto technology" },
  메타버스: { primary: "metaverse virtual reality headset", fallback: "VR digital world technology" },
  통신: { primary: "telecommunications 5G tower antenna", fallback: "network communication technology" },
  사이버보안: { primary: "cybersecurity hacker code security", fallback: "digital security lock network" },

  // 소비재
  게임: { primary: "gaming esports computer screen", fallback: "video game controller" },
  엔터: { primary: "entertainment media concert stage", fallback: "kpop music performance" },
  식품: { primary: "food industry agriculture farm", fallback: "food production factory" },
  화장품: { primary: "cosmetics beauty skincare product", fallback: "beauty industry makeup" },
  의류: { primary: "fashion clothing textile factory", fallback: "apparel industry design" },
  관광: { primary: "tourism travel airplane beach", fallback: "travel destination vacation" },
  교육: { primary: "education technology classroom", fallback: "online learning edtech" },
  부동산: { primary: "real estate building city skyline", fallback: "apartment housing construction" },

  // 기타
  실적: { primary: "financial report earnings chart profit", fallback: "business growth graph data" },
  공모주: { primary: "IPO stock market trading", fallback: "investment finance chart" },
  증권: { primary: "securities brokerage trading screen", fallback: "stock market finance chart" },
  보험: { primary: "insurance finance protection", fallback: "financial security umbrella" },
  K팝: { primary: "kpop concert stage performance", fallback: "korean music entertainment" },
  "2차전지": { primary: "battery cell lithium ion factory", fallback: "EV battery technology" },
  전력: { primary: "electric power grid transmission tower", fallback: "energy electricity infrastructure" },
  해운: { primary: "cargo ship container ocean port", fallback: "shipping vessel freight sea" },
};

// ---------------------------------------------------------------------------
// 키워드 확장 함수
// ---------------------------------------------------------------------------

interface TranslatedQuery {
  readonly primary: string;
  readonly fallback: string;
}

function translateKeyword(keyword: string): TranslatedQuery {
  // 1. 정확히 전체 키워드가 매핑에 있는 경우
  if (KEYWORD_MAP[keyword]) {
    return KEYWORD_MAP[keyword];
  }

  // 2. 키워드에 포함된 모든 매핑을 수집
  const primaryParts: string[] = [];
  const fallbackParts: string[] = [];
  const matched = new Set<string>();

  // 긴 키워드 먼저 매칭 (스페이스X > 스페이스)
  const sortedKeys = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length);

  for (const ko of sortedKeys) {
    if (keyword.includes(ko) && !matched.has(ko)) {
      // 이미 매칭된 더 긴 키의 부분이면 스킵
      let isSubset = false;
      for (const m of matched) {
        if (m.includes(ko)) { isSubset = true; break; }
      }
      if (isSubset) continue;

      matched.add(ko);
      primaryParts.push(KEYWORD_MAP[ko].primary);
      fallbackParts.push(KEYWORD_MAP[ko].fallback);
    }
  }

  if (primaryParts.length > 0) {
    // 최대 2개 매핑 합성
    return {
      primary: primaryParts.slice(0, 2).join(" ").split(" ").slice(0, 6).join(" "),
      fallback: fallbackParts.slice(0, 2).join(" ").split(" ").slice(0, 6).join(" "),
    };
  }

  // 3. 매핑이 없으면 키워드 자체로 검색
  return {
    primary: `${keyword} industry technology`,
    fallback: `${keyword} business market`,
  };
}

// ---------------------------------------------------------------------------
// API 검색 함수들
// ---------------------------------------------------------------------------

async function searchUnsplash(
  query: string,
  accessKey: string
): Promise<ImageResult | null> {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${accessKey}` } }
    );

    if (!response.ok) {
      console.warn(`  ⚠️ Unsplash 응답 오류: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    const photo = data.results[0];
    return {
      url: photo.urls.regular,
      thumbnailUrl: photo.urls.small,
      width: photo.width,
      height: photo.height,
      alt: photo.alt_description ?? `관련 이미지`,
      source: "Unsplash",
      photographerName: photo.user.name,
      photographerUrl: photo.user.links.html,
      downloadUrl: photo.links.download_location,
    };
  } catch (error) {
    console.warn(`  ⚠️ Unsplash 검색 실패:`, error);
    return null;
  }
}

async function searchPixabay(
  query: string,
  apiKey: string
): Promise<ImageResult | null> {
  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&min_width=1200&per_page=3&safesearch=true`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.hits || data.hits.length === 0) return null;

    const photo = data.hits[0];
    return {
      url: photo.largeImageURL,
      thumbnailUrl: photo.webformatURL,
      width: photo.imageWidth,
      height: photo.imageHeight,
      alt: `관련 이미지`,
      source: "Pixabay",
      photographerName: photo.user,
      photographerUrl: `https://pixabay.com/users/${photo.user}-${photo.user_id}/`,
      downloadUrl: photo.largeImageURL,
    };
  } catch (error) {
    console.warn(`  ⚠️ Pixabay 검색 실패:`, error);
    return null;
  }
}

async function searchPexels(
  query: string,
  apiKey: string
): Promise<ImageResult | null> {
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );

    if (!response.ok) {
      console.warn(`  ⚠️ Pexels 응답 오류: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.photos || data.photos.length === 0) return null;

    const photo = data.photos[0];
    return {
      url: photo.src.large2x ?? photo.src.large,
      thumbnailUrl: photo.src.medium,
      width: photo.width,
      height: photo.height,
      alt: photo.alt ?? `관련 이미지`,
      source: "Pexels",
      photographerName: photo.photographer,
      photographerUrl: photo.photographer_url,
      downloadUrl: photo.src.original,
    };
  } catch (error) {
    console.warn(`  ⚠️ Pexels 검색 실패:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3개 API를 순차 시도하는 헬퍼
// ---------------------------------------------------------------------------

async function searchAllApis(query: string): Promise<ImageResult | null> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const pixabayKey = process.env.PIXABAY_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  let image: ImageResult | null = null;

  if (unsplashKey) {
    console.log(`    🔍 Unsplash: "${query}"`);
    image = await searchUnsplash(query, unsplashKey);
    if (image) { console.log(`    ✅ Unsplash 발견: ${image.photographerName}`); return image; }
  }

  if (pixabayKey) {
    console.log(`    🔍 Pixabay: "${query}"`);
    image = await searchPixabay(query, pixabayKey);
    if (image) { console.log(`    ✅ Pixabay 발견: ${image.photographerName}`); return image; }
  }

  if (pexelsKey) {
    console.log(`    🔍 Pexels: "${query}"`);
    image = await searchPexels(query, pexelsKey);
    if (image) { console.log(`    ✅ Pexels 발견: ${image.photographerName}`); return image; }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 이미지 다운로드
// ---------------------------------------------------------------------------

async function downloadImage(imageUrl: string, slug: string): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");

  const dir = path.join(process.cwd(), "public", "images", "thumbnails");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${slug}.jpg`);
  const publicPath = `/images/thumbnails/${slug}.jpg`;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    console.log(`  ✅ 썸네일 저장: ${publicPath}`);
    return publicPath;
  } catch (error) {
    console.warn(`  ⚠️ 이미지 다운로드 실패:`, error);
    return "/images/og-default.png";
  }
}

// ---------------------------------------------------------------------------
// 주식특징주 전용 썸네일: 어두운 차트 배경 + 날짜 텍스트 오버레이
// ---------------------------------------------------------------------------

export async function generateFeaturedStocksThumbnail(
  slug: string,
  dateLabel: string, // e.g. "3월 18일자"
): Promise<{ path: string; credit: string }> {
  const fs = await import("fs");
  const path = await import("path");
  const sharp = (await import("sharp")).default;

  const dir = path.join(process.cwd(), "public", "images", "thumbnails");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const bgPath = path.join(process.cwd(), "public", "images", "featured-stocks-bg.jpg");
  const outPath = path.join(dir, `${slug}.jpg`);
  const publicPath = `/images/thumbnails/${slug}.jpg`;

  // SVG 텍스트 오버레이 (어두운 반투명 배경 + 흰색 텍스트)
  const svgOverlay = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="rgba(0,0,0,0.55)" />
      <text x="600" y="270" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white" letter-spacing="4">${dateLabel}</text>
      <text x="600" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="#FFD700" letter-spacing="6">주식특징주</text>
      <rect x="350" y="400" width="500" height="3" fill="#FFD700" rx="2" />
      <text x="600" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.8)">K-주식 핫이슈 | 오늘의 급등주 · 테마주 총정리</text>
    </svg>`;

  try {
    await sharp(bgPath)
      .resize(1200, 630, { fit: "cover" })
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 85 })
      .toFile(outPath);

    console.log(`  ✅ 주식특징주 썸네일 생성: ${publicPath}`);
    return { path: publicPath, credit: "" };
  } catch (error) {
    console.warn(`  ⚠️ 썸네일 생성 실패:`, error);
    return { path: "/images/og-default.png", credit: "" };
  }
}

// ---------------------------------------------------------------------------
// 신규상장주 전용 썸네일: 회사명 + IPO 텍스트 오버레이 (Sharp 자체 생성)
// 회사 로고는 스톡사이트에 없으므로, 텍스트 기반 썸네일을 직접 생성
// ---------------------------------------------------------------------------

export async function generateNewStocksThumbnail(
  companyName: string,
  slug: string,
): Promise<{ path: string; credit: string }> {
  const fs = await import("fs");
  const pathMod = await import("path");
  const sharp = (await import("sharp")).default;

  const dir = pathMod.join(process.cwd(), "public", "images", "thumbnails");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const outPath = pathMod.join(dir, `${slug}.jpg`);
  const publicPath = `/images/thumbnails/${slug}.jpg`;

  console.log(`\n🏢 신규상장주 썸네일 생성: "${companyName}"`);

  // 회사명 길이에 따라 폰트 크기 동적 조정
  const nameLen = companyName.length;
  const nameFontSize = nameLen <= 6 ? 72 : nameLen <= 9 ? 60 : nameLen <= 12 ? 50 : 42;

  // 그라디언트 배경 + 회사명 + 신규상장 텍스트 오버레이
  const svgContent = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0f0c29"/>
          <stop offset="50%" style="stop-color:#302b63"/>
          <stop offset="100%" style="stop-color:#24243e"/>
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#00d2ff"/>
          <stop offset="100%" style="stop-color:#3a7bd5"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <!-- 장식 원 -->
      <circle cx="100" cy="100" r="200" fill="rgba(0,210,255,0.05)"/>
      <circle cx="1100" cy="530" r="250" fill="rgba(58,123,213,0.05)"/>
      <!-- 상단 배지 -->
      <rect x="440" y="120" width="320" height="42" rx="21" fill="url(#accent)" opacity="0.9"/>
      <text x="600" y="148" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" letter-spacing="4">NEW IPO LISTING</text>
      <!-- 회사명 -->
      <text x="600" y="290" text-anchor="middle" font-family="Arial, sans-serif" font-size="${nameFontSize}" font-weight="bold" fill="white" letter-spacing="3">${companyName}</text>
      <!-- 구분선 -->
      <rect x="400" y="320" width="400" height="3" rx="2" fill="url(#accent)"/>
      <!-- 신규상장 분석 -->
      <text x="600" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#00d2ff" letter-spacing="6">신규상장 분석</text>
      <!-- 하단 부제 -->
      <text x="600" y="440" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.7)">공모가 · 재무 · 유통물량 · 투자포인트 총정리</text>
      <!-- 브랜드 -->
      <text x="600" y="560" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.4)" letter-spacing="2">KStockFlow.com</text>
    </svg>`;

  try {
    await sharp(Buffer.from(svgContent))
      .resize(1200, 630)
      .jpeg({ quality: 90 })
      .toFile(outPath);

    console.log(`  ✅ 신규상장주 썸네일 생성: ${publicPath}`);
    return { path: publicPath, credit: "" };
  } catch (error) {
    console.warn(`  ⚠️ 썸네일 생성 실패:`, error);
    return { path: "/images/og-default.png", credit: "" };
  }
}

// ---------------------------------------------------------------------------
// 메인: 키워드 → 이미지 검색 → 다운로드
// 전략: primary 쿼리로 3개 API 시도 → 실패 시 fallback 쿼리로 재시도
// ---------------------------------------------------------------------------

export async function findAndDownloadThumbnail(
  keyword: string,
  slug: string
): Promise<{ path: string; credit: string }> {
  const translated = translateKeyword(keyword);

  console.log(`\n🖼️  썸네일 검색: "${keyword}"`);
  console.log(`  📌 Primary: "${translated.primary}"`);
  console.log(`  📌 Fallback: "${translated.fallback}"`);

  // Round 1: Primary query
  console.log(`  🔎 1차 검색...`);
  let image = await searchAllApis(translated.primary);

  // Round 2: Fallback query
  if (!image) {
    console.log(`  🔎 2차 검색 (fallback)...`);
    image = await searchAllApis(translated.fallback);
  }

  // No image found
  if (!image) {
    console.log(`  ℹ️ 이미지를 찾지 못했습니다. 기본 썸네일 사용.`);
    return { path: "/images/og-default.png", credit: "" };
  }

  // Download
  const savedPath = await downloadImage(image.url, slug);
  const credit = `Photo by [${image.photographerName}](${image.photographerUrl}) on ${image.source}`;

  return { path: savedPath, credit };
}
