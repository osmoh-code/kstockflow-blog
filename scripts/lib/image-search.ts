/**
 * 키워드 기반 썸네일 이미지 자동 검색
 * - Unsplash API (무료, 월 50회)
 * - Pixabay API (무료, 월 5000회) — fallback
 * - Pexels API (무료, 월 200회) — 2nd fallback
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

// 주식 관련 키워드를 영어로 매핑 (검색 엔진은 영어가 효과적)
const KEYWORD_TRANSLATIONS: Record<string, string> = {
  // 산업/섹터
  주식: "stock market trading",
  증시: "stock exchange trading floor",
  투자: "investment finance",
  반도체: "semiconductor chip wafer",
  AI: "artificial intelligence technology",
  배터리: "battery technology lithium",
  전기차: "electric vehicle EV",
  바이오: "biotechnology laboratory",
  제약: "pharmaceutical medicine",
  건설: "construction building crane",
  은행: "banking finance",
  에너지: "energy power plant",
  IT: "technology computer",
  자동차: "automobile car factory",
  조선: "shipbuilding shipyard",
  철강: "steel industry factory",
  화학: "chemical industry",
  통신: "telecommunications 5G tower",
  유통: "retail commerce shopping",
  게임: "gaming esports",
  엔터: "entertainment media",
  원전: "nuclear power plant",
  수소: "hydrogen energy fuel cell",
  로봇: "robot automation industrial",
  우주: "space aerospace rocket",
  블록체인: "blockchain cryptocurrency",
  클라우드: "cloud computing server",
  실적: "financial report earnings chart",
  IPO: "IPO stock market bell",
  상장: "IPO listing stock exchange",
  공모주: "IPO stock market",
  // 방산/군사
  방산: "defense military weapons",
  드론: "military drone UAV",
  전쟁: "military warfare defense",
  미사일: "missile defense system",
  무기: "weapons defense military",
  탄약: "ammunition military",
  해군: "navy warship",
  공군: "air force fighter jet",
  // 지역/지정학
  호르무즈: "oil tanker strait ocean",
  중동: "middle east oil refinery",
  이란: "oil tanker persian gulf",
  우크라이나: "military defense europe",
  NATO: "NATO military alliance",
  // 테크
  "6G": "6G wireless technology antenna",
  "5G": "5G telecommunications tower",
  HBM: "semiconductor memory chip",
  GPU: "graphics processor chip",
  양자컴퓨터: "quantum computing technology",
  메타버스: "metaverse virtual reality",
  자율주행: "autonomous driving car sensor",
  // 에너지/자원
  석유: "oil refinery petroleum",
  천연가스: "natural gas LNG tanker",
  태양광: "solar panel energy",
  풍력: "wind turbine energy",
  리튬: "lithium mining battery",
  희토류: "rare earth mining minerals",
  // 기타
  부동산: "real estate building city",
  금리: "interest rate federal reserve",
  환율: "currency exchange forex",
  인플레이션: "inflation economy chart",
  경기침체: "recession economy graph",
  식품: "food industry agriculture",
  화장품: "cosmetics beauty industry",
  의류: "fashion clothing textile",
  물류: "logistics shipping container",
  항공: "aviation airplane airport",
  관광: "tourism travel",
  교육: "education technology",
  보험: "insurance finance",
  증권: "securities brokerage trading",
  // 엔비디아/GTC
  엔비디아: "nvidia GPU technology",
  GTC: "nvidia GTC conference technology",
};

/**
 * 키워드에서 영어 검색어 추출. 여러 매핑이 매치되면 합침.
 */
function translateKeyword(keyword: string): string {
  const matches: string[] = [];

  for (const [ko, en] of Object.entries(KEYWORD_TRANSLATIONS)) {
    if (keyword.includes(ko)) {
      matches.push(en);
    }
  }

  if (matches.length > 0) {
    // 최대 2개 매핑 합쳐서 더 정확한 검색
    return matches.slice(0, 2).join(" ");
  }

  return `${keyword} stock market korea`;
}

/**
 * Unsplash API로 이미지 검색
 */
async function searchUnsplash(
  keyword: string,
  accessKey: string
): Promise<ImageResult | null> {
  const query = translateKeyword(keyword);

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&content_filter=high`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      }
    );

    if (!response.ok) {
      console.warn(`  ⚠️ Unsplash API 응답 오류: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const photo = data.results[0];

    return {
      url: photo.urls.regular,
      thumbnailUrl: photo.urls.small,
      width: photo.width,
      height: photo.height,
      alt: photo.alt_description ?? `${keyword} 관련 이미지`,
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

/**
 * Pixabay API로 이미지 검색
 */
async function searchPixabay(
  keyword: string,
  apiKey: string
): Promise<ImageResult | null> {
  const query = translateKeyword(keyword);

  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&min_width=1200&per_page=3&safesearch=true`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.hits || data.hits.length === 0) {
      return null;
    }

    const photo = data.hits[0];

    return {
      url: photo.largeImageURL,
      thumbnailUrl: photo.webformatURL,
      width: photo.imageWidth,
      height: photo.imageHeight,
      alt: `${keyword} 관련 이미지`,
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

/**
 * Pexels API로 이미지 검색
 */
async function searchPexels(
  keyword: string,
  apiKey: string
): Promise<ImageResult | null> {
  const query = translateKeyword(keyword);

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      console.warn(`  ⚠️ Pexels API 응답 오류: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.photos || data.photos.length === 0) {
      return null;
    }

    const photo = data.photos[0];

    return {
      url: photo.src.large2x ?? photo.src.large,
      thumbnailUrl: photo.src.medium,
      width: photo.width,
      height: photo.height,
      alt: photo.alt ?? `${keyword} 관련 이미지`,
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

/**
 * 이미지 다운로드 → public/images/thumbnails/ 저장
 */
async function downloadImage(
  imageUrl: string,
  slug: string
): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");

  const dir = path.join(process.cwd(), "public", "images", "thumbnails");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ext = "jpg";
  const filePath = path.join(dir, `${slug}.${ext}`);
  const publicPath = `/images/thumbnails/${slug}.${ext}`;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    console.log(`  ✅ 썸네일 저장: ${publicPath}`);
    return publicPath;
  } catch (error) {
    console.warn(`  ⚠️ 이미지 다운로드 실패:`, error);
    return "/images/og-default.png";
  }
}

/**
 * 메인: 키워드로 썸네일 검색 → 다운로드 → 경로 반환
 * 검색 순서: Unsplash → Pixabay → Pexels → 기본 이미지
 */
export async function findAndDownloadThumbnail(
  keyword: string,
  slug: string
): Promise<{ path: string; credit: string }> {
  console.log(`\n🖼️  썸네일 검색: "${keyword}" → "${translateKeyword(keyword)}"`);

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const pixabayKey = process.env.PIXABAY_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  let image: ImageResult | null = null;

  // 1. Unsplash 시도
  if (unsplashKey) {
    console.log(`  🔍 Unsplash 검색 중...`);
    image = await searchUnsplash(keyword, unsplashKey);
    if (image) {
      console.log(`  ✅ Unsplash에서 발견: ${image.photographerName}`);
    }
  }

  // 2. Pixabay fallback
  if (!image && pixabayKey) {
    console.log(`  🔍 Pixabay 검색 중...`);
    image = await searchPixabay(keyword, pixabayKey);
    if (image) {
      console.log(`  ✅ Pixabay에서 발견: ${image.photographerName}`);
    }
  }

  // 3. Pexels fallback
  if (!image && pexelsKey) {
    console.log(`  🔍 Pexels 검색 중...`);
    image = await searchPexels(keyword, pexelsKey);
    if (image) {
      console.log(`  ✅ Pexels에서 발견: ${image.photographerName}`);
    }
  }

  // 4. 이미지를 찾지 못한 경우
  if (!image) {
    console.log(`  ℹ️ 관련 이미지를 찾지 못했습니다. 기본 썸네일을 사용합니다.`);
    return {
      path: "/images/og-default.png",
      credit: "",
    };
  }

  // 5. 이미지 다운로드
  const savedPath = await downloadImage(image.url, slug);

  const credit = `Photo by [${image.photographerName}](${image.photographerUrl}) on ${image.source}`;

  return {
    path: savedPath,
    credit,
  };
}
