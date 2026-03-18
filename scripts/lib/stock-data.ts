/**
 * 관련주 시세/재무정보 자동 크롤링
 * - 종목코드 매핑 테이블 + 네이버 금융 웹 크롤링 fallback
 * - 현재가, 등락률, 시가총액, PER, PBR, 52주 최고/최저
 * - 차트 이미지 URL 생성 (네이버 금융 차트 API)
 */

export interface StockInfo {
  readonly name: string;
  readonly code: string;
  readonly price: string;
  readonly change: string;
  readonly changePercent: string;
  readonly changeDirection: "up" | "down" | "flat";
  readonly marketCap: string;
  readonly per: string;
  readonly pbr: string;
  readonly high52w: string;
  readonly low52w: string;
  readonly chartImageUrl: string;
  readonly naverUrl: string;
}

/**
 * 주요 종목 코드 매핑 (ac.finance.naver.com DNS 문제 대응)
 */
const STOCK_CODE_MAP: Record<string, string> = {
  // 대형주
  "삼성전자": "005930", "SK하이닉스": "000660", "현대차": "005380", "기아": "000270",
  "LG에너지솔루션": "373220", "삼성바이오로직스": "207940", "NAVER": "035420", "네이버": "035420",
  "카카오": "035720", "삼성SDI": "006400", "LG화학": "051910", "현대모비스": "012330",
  "포스코홀딩스": "005490", "POSCO홀딩스": "005490", "셀트리온": "068270", "KB금융": "105560",
  "신한지주": "055550", "SK이노베이션": "096770", "한국전력": "015760", "삼성물산": "028260",
  "하나금융지주": "086790", "삼성생명": "032830", "LG전자": "066570", "삼성화재": "000810",
  "SK텔레콤": "017670", "KT": "030200", "LG유플러스": "032640", "한화솔루션": "009830",
  "두산에너빌리티": "034020", "SK": "034730", "롯데케미칼": "011170", "한화에어로스페이스": "012450",
  // 우주항공/방산
  "한화시스템": "272210", "한국항공우주산업": "047810", "한국항공우주": "047810", "KAI": "047810",
  "쎄트렉아이": "099320", "인텔리안테크": "189300", "AP위성": "211270", "켄코아에어로스페이스": "274090",
  "LIG넥스원": "079550", "한화오션": "042660", "현대로템": "064350", "풍산": "103140",
  "이노스페이스": "462350", "스페코": "013810", "유니온머티리얼": "047400",
  "컨텍": "451480", "제노코": "217530", "비츠로셀": "082920",
  // 반도체
  "DB하이텍": "000990", "리노공업": "058470", "한미반도체": "042700", "이오테크닉스": "039030",
  "주성엔지니어링": "036930", "원익IPS": "240810", "HPSP": "403870", "피에스케이": "319660",
  "테크윙": "089030", "ISC": "095340",
  // AI/로봇
  "레인보우로보틱스": "277810", "두산로보틱스": "454910", "뉴로메카": "348340",
  // 바이오
  "삼성바이오에피스": "326030", "SK바이오팜": "326030", "에이치엘비": "028300",
  "유한양행": "000100", "녹십자": "006280", "한미약품": "128940",
  // 2차전지/전기차
  "에코프로비엠": "247540", "에코프로": "086520", "포스코퓨처엠": "003670",
  "엘앤에프": "066970", "성일하이텍": "365340",
  // 원전
  "한전기술": "052690", "비에이치아이": "083650",
  // 엔터
  "하이브": "352820", "SM": "041510", "JYP엔터테인먼트": "035900", "YG엔터테인먼트": "122870",
  // 기타
  "성창기업": "000180", "현대건설": "000720", "대한항공": "003490",
  "CJ제일제당": "097950", "아모레퍼시픽": "090430", "네이처셀": "007390",
};

/**
 * 네이버 금융 시가총액 페이지에서 종목코드 검색 (fallback)
 */
async function searchStockCodeFromWeb(stockName: string): Promise<string | null> {
  try {
    for (const sosok of [0, 1]) {
      for (let page = 1; page <= 5; page++) {
        const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}&page=${page}`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        if (!response.ok) continue;

        const html = await response.text();
        const regex = /code=(\d{6})"[^>]*>\s*([^<]+)\s*</g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(html)) !== null) {
          const code = match[1];
          const name = match[2].trim();
          if (name === stockName || name.includes(stockName) || stockName.includes(name)) {
            return code;
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 종목명으로 종목코드 검색 (매핑 → 웹 크롤링 fallback)
 */
async function searchStockCode(stockName: string): Promise<string | null> {
  // 1. 하드코딩 매핑에서 찾기
  if (STOCK_CODE_MAP[stockName]) {
    return STOCK_CODE_MAP[stockName];
  }

  // 2. 부분 매칭 시도
  for (const [name, code] of Object.entries(STOCK_CODE_MAP)) {
    if (name.includes(stockName) || stockName.includes(name)) {
      return code;
    }
  }

  // 3. 웹 크롤링 fallback
  console.log(`  🔍 매핑에 없는 종목 — 네이버 금융에서 검색: ${stockName}`);
  return searchStockCodeFromWeb(stockName);
}

/**
 * 네이버 금융에서 종목 상세 정보 크롤링
 * - sise.naver: 현재가, 전일대비, 등락률 (blind 태그 순서 기반)
 * - main.naver: PER, PBR (id 속성 기반)
 */
async function fetchStockDetail(code: string): Promise<Partial<StockInfo> | null> {
  try {
    // 시세 페이지 — 현재가, 전일대비, 등락률
    const siseUrl = `https://finance.naver.com/item/sise.naver?code=${code}`;
    const siseRes = await fetch(siseUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!siseRes.ok) return null;
    const siseHtml = await siseRes.text();

    // blind 태그에서 숫자 데이터 추출 (한글 라벨은 EUC-KR 깨짐 → 순서 기반)
    const blindValues: string[] = [];
    const blindRegex = /<span class="blind">([^<]+)<\/span>/g;
    let match: RegExpExecArray | null;
    while ((match = blindRegex.exec(siseHtml)) !== null) {
      blindValues.push(match[1]);
    }
    const numericBlinds = blindValues.filter((v) => /[\d,.]/.test(v) && !/[a-zA-Z]{3,}/.test(v));

    // [0]=현재가, [1]=전일대비, [2]=등락률, [3]=전일가
    const price = numericBlinds[0] ?? "-";
    const change = numericBlinds[1] ?? "0";
    const changePercentRaw = numericBlinds[2] ?? "0";
    const changePercent = changePercentRaw.includes("%") ? changePercentRaw : `${changePercentRaw}%`;

    // 상승/하락 판단 — 현재가 vs 전일가 비교
    const curPrice = parseInt(price.replace(/,/g, "") || "0", 10);
    const prevPrice = parseInt((numericBlinds[3] ?? "0").replace(/,/g, ""), 10);
    const changeDirection: "up" | "down" | "flat" =
      curPrice > prevPrice ? "up" : curPrice < prevPrice ? "down" : "flat";

    // main.naver에서 PER, PBR 가져오기
    const mainUrl = `https://finance.naver.com/item/main.naver?code=${code}`;
    const mainRes = await fetch(mainUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    let per = "-";
    let pbr = "-";
    let marketCap = "-";
    let high52w = "-";
    let low52w = "-";

    if (mainRes.ok) {
      const mainHtml = await mainRes.text();

      const perMatch = mainHtml.match(/id="_per"[^>]*>([\d.]+)/);
      per = perMatch?.[1] ?? "-";

      const pbrMatch = mainHtml.match(/id="_pbr"[^>]*>([\d.]+)/);
      pbr = pbrMatch?.[1] ?? "-";
    }

    return {
      price,
      change,
      changePercent,
      changeDirection,
      marketCap,
      per,
      pbr,
      high52w,
      low52w,
    };
  } catch (error) {
    console.warn(`  ⚠️ 종목 상세 크롤링 실패 (${code}):`, error);
    return null;
  }
}

/**
 * 네이버 금융 차트 이미지 URL 생성
 */
function getChartImageUrl(code: string): string {
  return `https://ssl.pstatic.net/imgfinance/chart/item/area/month3/${code}.png`;
}

/**
 * 종목명으로 전체 주식 정보 조회
 */
export async function getStockInfo(stockName: string): Promise<StockInfo | null> {
  console.log(`  📊 종목 조회: ${stockName}`);

  const code = await searchStockCode(stockName);
  if (!code) {
    console.warn(`  ⚠️ "${stockName}" 종목코드를 찾을 수 없습니다.`);
    return null;
  }

  console.log(`  ✅ 종목코드: ${code}`);

  const detail = await fetchStockDetail(code);
  if (!detail) {
    return null;
  }

  return {
    name: stockName,
    code,
    price: detail.price ?? "-",
    change: detail.change ?? "0",
    changePercent: detail.changePercent ?? "0%",
    changeDirection: detail.changeDirection ?? "flat",
    marketCap: detail.marketCap ?? "-",
    per: detail.per ?? "-",
    pbr: detail.pbr ?? "-",
    high52w: detail.high52w ?? "-",
    low52w: detail.low52w ?? "-",
    chartImageUrl: getChartImageUrl(code),
    naverUrl: `https://finance.naver.com/item/main.naver?code=${code}`,
  };
}

/**
 * 여러 종목 한번에 조회
 */
export async function getMultipleStockInfo(
  stockNames: readonly string[]
): Promise<readonly StockInfo[]> {
  console.log(`\n📈 관련주 데이터 수집 (${stockNames.length}개 종목)`);

  const results: StockInfo[] = [];

  for (const name of stockNames) {
    const info = await getStockInfo(name);
    if (info) {
      results.push(info);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`  ✅ ${results.length}/${stockNames.length}개 종목 데이터 수집 완료`);
  return results;
}

/**
 * 관련주 요약 테이블 (관련주 분석 섹션 상단에 삽입)
 */
export function stockSummaryTable(stocks: readonly StockInfo[]): string {
  if (stocks.length === 0) return "";

  let md = `\n> 아래 시세 정보는 글 작성 시점 기준이며, 실시간 시세와 다를 수 있습니다.\n\n`;

  md += `| 종목명 | 현재가 | 등락률 | PER | PBR |\n`;
  md += `|--------|--------|--------|-----|-----|\n`;

  for (const stock of stocks) {
    const arrow =
      stock.changeDirection === "up"
        ? "▲"
        : stock.changeDirection === "down"
          ? "▼"
          : "-";
    const sign = stock.changeDirection === "up" ? "+" : stock.changeDirection === "down" ? "-" : "";

    md += `| [${stock.name}](${stock.naverUrl}) `;
    md += `| ${stock.price}원 `;
    md += `| ${arrow} ${sign}${stock.changePercent} `;
    md += `| ${stock.per}배 `;
    md += `| ${stock.pbr}배 |\n`;
  }

  return md;
}

/**
 * 개별 종목 시세 + 차트 마크다운 (종목명 → 블록 매핑)
 * 각 종목의 ### 헤딩 바로 뒤에 삽입됨
 */
export function stockPerItemBlocks(stocks: readonly StockInfo[]): ReadonlyMap<string, string> {
  const blocks = new Map<string, string>();

  for (const stock of stocks) {
    const arrow =
      stock.changeDirection === "up"
        ? "▲"
        : stock.changeDirection === "down"
          ? "▼"
          : "-";
    const sign = stock.changeDirection === "up" ? "+" : stock.changeDirection === "down" ? "-" : "";

    let md = `\n| 현재가 | 등락률 | PER | PBR |\n`;
    md += `|--------|--------|-----|-----|\n`;
    md += `| ${stock.price}원 | ${arrow} ${sign}${stock.changePercent} | ${stock.per}배 | ${stock.pbr}배 |\n\n`;
    md += `![${stock.name} 3개월 차트](${stock.chartImageUrl})\n`;

    blocks.set(stock.name, md);
  }

  return blocks;
}

/**
 * Claude에게 전달할 주식 컨텍스트 생성
 */
export function stockInfoToContext(stocks: readonly StockInfo[]): string {
  if (stocks.length === 0) return "";

  let context = `\n[관련주 실시간 데이터]\n`;

  for (const stock of stocks) {
    context += `- ${stock.name}(${stock.code}): `;
    context += `현재가 ${stock.price}원, `;
    context += `등락 ${stock.changeDirection === "up" ? "+" : "-"}${stock.changePercent}, `;
    context += `PER ${stock.per}, PBR ${stock.pbr}\n`;
  }

  return context;
}
