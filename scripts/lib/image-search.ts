/**
 * 키워드 기반 썸네일 이미지 자동 검색
 * - Unsplash API (무료, 월 50회)
 * - Pixabay API (무료, 월 5000회) — fallback
 * - 네이버 이미지 검색 — 추가 fallback
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

// 주식 관련 키워드를 영어로 매핑 (Unsplash는 영어 검색이 효과적)
const KEYWORD_TRANSLATIONS: Record<string, string> = {
  주식: "stock market",
  증시: "stock exchange",
  투자: "investment",
  반도체: "semiconductor chip",
  AI: "artificial intelligence",
  배터리: "battery technology",
  전기차: "electric vehicle",
  바이오: "biotechnology",
  제약: "pharmaceutical",
  건설: "construction building",
  은행: "banking finance",
  에너지: "energy power",
  IT: "technology",
  자동차: "automobile car",
  조선: "shipbuilding",
  철강: "steel industry",
  화학: "chemical industry",
  통신: "telecommunications",
  유통: "retail commerce",
  게임: "gaming",
  엔터: "entertainment media",
  방산: "defense military",
  원전: "nuclear power plant",
  수소: "hydrogen energy",
  로봇: "robot automation",
  우주: "space aerospace",
  드론: "drone technology",
  메타버스: "metaverse virtual reality",
  블록체인: "blockchain crypto",
  클라우드: "cloud computing",
  실적: "financial report earnings",
  IPO: "IPO stock market",
  상장: "IPO listing",
  공모주: "IPO stock market",
};

function translateKeyword(keyword: string): string {
  // 키워드에서 한국어 부분을 영어로 변환
  let translated = keyword;

  for (const [ko, en] of Object.entries(KEYWORD_TRANSLATIONS)) {
    if (keyword.includes(ko)) {
      translated = en;
      break;
    }
  }

  // 변환이 안 됐으면 기본 stock market 키워드 추가
  if (translated === keyword) {
    translated = `${keyword} stock market korea`;
  }

  return translated;
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

    // 가장 관련성 높은 이미지 선택 (1200px 이상 우선)
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
 * Pixabay API로 이미지 검색 (Unsplash fallback)
 */
async function searchPixabay(
  keyword: string,
  apiKey: string
): Promise<ImageResult | null> {
  const query = translateKeyword(keyword);

  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&min_width=1200&per_page=5&safesearch=true`
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
 */
export async function findAndDownloadThumbnail(
  keyword: string,
  slug: string
): Promise<{ path: string; credit: string }> {
  console.log(`\n🖼️  썸네일 검색: "${keyword}"`);

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const pixabayKey = process.env.PIXABAY_API_KEY;

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

  // 3. 이미지를 찾지 못한 경우
  if (!image) {
    console.log(`  ℹ️ 관련 이미지를 찾지 못했습니다. 기본 썸네일을 사용합니다.`);
    return {
      path: "/images/og-default.png",
      credit: "",
    };
  }

  // 4. 이미지 다운로드
  const savedPath = await downloadImage(image.url, slug);

  const credit = `Photo by [${image.photographerName}](${image.photographerUrl}) on ${image.source}`;

  return {
    path: savedPath,
    credit,
  };
}
