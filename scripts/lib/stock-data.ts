/**
 * 관련주 시세/재무정보 자동 크롤링
 * - KRX(한국거래소) KIND API로 전체 종목코드 자동 조회
 * - 네이버 금융 웹 크롤링으로 시세 데이터 수집
 * - 현재가, 등락률, PER, PBR
 * - 차트 이미지 URL 생성 (네이버 금융 차트 API)
 */

import https from "https";

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
 * KRX KIND API에서 전체 상장 종목 목록 다운로드 (KOSPI + KOSDAQ)
 * 약 2700+ 종목의 회사명→종목코드 매핑을 반환
 */
let krxCachePromise: Promise<ReadonlyMap<string, string>> | null = null;

function fetchKrxStockList(): Promise<ReadonlyMap<string, string>> {
  if (krxCachePromise) return krxCachePromise;

  krxCachePromise = new Promise<ReadonlyMap<string, string>>((resolve) => {
    const url = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13";

    const req = https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 15000,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        try {
          const buf = Buffer.concat(chunks);
          const decoder = new TextDecoder("euc-kr");
          const text = decoder.decode(buf);

          const map = new Map<string, string>();
          const rows = text.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];

          for (const row of rows.slice(1)) {
            const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? [];
            if (cells.length >= 3) {
              const name = cells[0].replace(/<[^>]+>/g, "").trim();
              const rawCode = cells[2].replace(/<[^>]+>/g, "").replace(/[^0-9A-Z]/g, "").trim();
              if (name && /^\d{6}$/.test(rawCode)) {
                map.set(name, rawCode);
              }
            }
          }

          console.log(`  ✅ KRX 종목 목록 로드 완료: ${map.size}개 종목`);
          resolve(map);
        } catch (error) {
          console.warn("  ⚠️ KRX 데이터 파싱 실패:", error);
          resolve(new Map());
        }
      });
    });

    req.on("error", (error) => {
      console.warn("  ⚠️ KRX API 요청 실패:", error.message);
      resolve(new Map());
    });

    req.on("timeout", () => {
      req.destroy();
      console.warn("  ⚠️ KRX API 타임아웃");
      resolve(new Map());
    });
  });

  return krxCachePromise;
}

/**
 * 수동 매핑 (KRX에 없거나 별칭이 필요한 종목용 — 최소한만 유지)
 */
const STOCK_CODE_ALIASES: Record<string, string> = {
  "NAVER": "035420", "네이버": "035420",
  "POSCO홀딩스": "005490",
  "한국항공우주": "047810", "KAI": "047810",
  "KMW": "285490",
  "S-Oil": "010950",
  "SM상선": "002410",
  "한국석유": "004090",
};

/**
 * 종목명으로 종목코드 검색
 * 1순위: 별칭 매핑 (빠른 조회)
 * 2순위: KRX KIND API 전체 목록 (2700+ 종목)
 * 3순위: KRX 목록에서 부분 매칭
 */
async function searchStockCode(stockName: string): Promise<string | null> {
  // 1. 별칭 매핑 — 정확히 일치
  if (STOCK_CODE_ALIASES[stockName]) {
    return STOCK_CODE_ALIASES[stockName];
  }

  // 2. KRX 전체 목록에서 검색
  const krxMap = await fetchKrxStockList();

  // 2a. 정확히 일치
  if (krxMap.has(stockName)) {
    return krxMap.get(stockName)!;
  }

  // 2b. 부분 매칭 (입력명이 KRX 종목명에 포함되거나 그 반대)
  for (const [name, code] of krxMap) {
    if (name.includes(stockName) || stockName.includes(name)) {
      console.log(`  🔍 부분 매칭: "${stockName}" → "${name}" (${code})`);
      return code;
    }
  }

  // 3. 별칭에서 부분 매칭
  for (const [alias, code] of Object.entries(STOCK_CODE_ALIASES)) {
    if (alias.includes(stockName) || stockName.includes(alias)) {
      return code;
    }
  }

  return null;
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
