/**
 * 관련주 종가/차트/재무정보 자동 크롤링
 * - 네이버 금융에서 종목 검색 → 종목코드 획득
 * - 종가, 등락률, 거래량 크롤링
 * - 차트 이미지 URL 생성 (네이버 금융 차트 API)
 * - PER, PBR, 시가총액 등 기본 재무정보
 */

export interface StockInfo {
  readonly name: string;
  readonly code: string;
  readonly price: string;
  readonly change: string;
  readonly changePercent: string;
  readonly changeDirection: "up" | "down" | "flat";
  readonly volume: string;
  readonly marketCap: string;
  readonly per: string;
  readonly pbr: string;
  readonly high52w: string;
  readonly low52w: string;
  readonly chartImageUrl: string;
  readonly naverUrl: string;
}

/**
 * 네이버 금융에서 종목명으로 종목코드 검색
 */
async function searchStockCode(stockName: string): Promise<string | null> {
  try {
    const url = `https://ac.finance.naver.com/ac?q=${encodeURIComponent(stockName)}&q_enc=euc-kr&t_koreng=1&st=111&r_lt=111`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.items && data.items.length > 0 && data.items[0].length > 0) {
      const firstItem = data.items[0][0];
      // firstItem is [name, code, ...]
      return firstItem[1] ?? null;
    }

    return null;
  } catch (error) {
    console.warn(`  ⚠️ 종목 검색 실패 (${stockName}):`, error);
    return null;
  }
}

/**
 * 네이버 금융에서 종목 상세 정보 크롤링
 */
async function fetchStockDetail(code: string): Promise<Partial<StockInfo> | null> {
  try {
    const url = `https://finance.naver.com/item/main.naver?code=${code}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    // 현재가
    const priceMatch = html.match(
      /no_today[\s\S]*?<span class="blind">(\d[\d,]*)<\/span>/
    );
    const price = priceMatch?.[1] ?? "-";

    // 전일대비
    const changeMatch = html.match(
      /no_exday[\s\S]*?<span class="blind">(\d[\d,]*)<\/span>/
    );
    const change = changeMatch?.[1] ?? "0";

    // 등락률
    const percentMatch = html.match(
      /no_exday[\s\S]*?<span class="blind">(\d[\d.]*%)<\/span>/
    );
    const changePercent = percentMatch?.[1] ?? "0%";

    // 상승/하락 판단
    const isUp = html.includes("no_up") && !html.includes("no_down");
    const isDown = html.includes("no_down");
    const changeDirection: "up" | "down" | "flat" = isUp
      ? "up"
      : isDown
        ? "down"
        : "flat";

    // 거래량
    const volumeMatch = html.match(
      /거래량[\s\S]*?<span class="blind">(\d[\d,]*)<\/span>/
    );
    const volume = volumeMatch?.[1] ?? "-";

    // 시가총액
    const marketCapMatch = html.match(
      /시가총액[\s\S]*?<span>(\d[\d,]*)<\/span>\s*<span class="blind">억원/
    );
    const marketCap = marketCapMatch
      ? `${marketCapMatch[1]}억원`
      : "-";

    // PER
    const perMatch = html.match(
      /PER[\s\S]*?<em[^>]*>(\d[\d.]*)<\/em>/
    );
    const per = perMatch?.[1] ?? "-";

    // PBR — 별도 요청으로 시도
    const pbrMatch = html.match(
      /PBR[\s\S]*?<em[^>]*>(\d[\d.]*)<\/em>/
    );
    const pbr = pbrMatch?.[1] ?? "-";

    // 52주 최고/최저
    const high52Match = html.match(
      /최고[\s\S]*?<span class="blind">(\d[\d,]*)<\/span>/
    );
    const high52w = high52Match?.[1] ?? "-";

    const low52Match = html.match(
      /최저[\s\S]*?<span class="blind">(\d[\d,]*)<\/span>/
    );
    const low52w = low52Match?.[1] ?? "-";

    return {
      price,
      change,
      changePercent,
      changeDirection,
      volume,
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
function getChartImageUrl(
  code: string,
  period: "day" | "week" | "month" | "month3" | "year" = "month3"
): string {
  const timeframe: Record<string, string> = {
    day: "day",
    week: "week",
    month: "month",
    month3: "month3",
    year: "year",
  };

  return `https://ssl.pstatic.net/imgfinance/chart/item/area/${timeframe[period]}/${code}.png`;
}

/**
 * 종목명으로 전체 주식 정보 조회
 */
export async function getStockInfo(stockName: string): Promise<StockInfo | null> {
  console.log(`  📊 종목 조회: ${stockName}`);

  // 1. 종목코드 검색
  const code = await searchStockCode(stockName);
  if (!code) {
    console.warn(`  ⚠️ "${stockName}" 종목코드를 찾을 수 없습니다.`);
    return null;
  }

  console.log(`  ✅ 종목코드: ${code}`);

  // 2. 상세 정보 크롤링
  const detail = await fetchStockDetail(code);
  if (!detail) {
    return null;
  }

  // 3. 차트 이미지 URL
  const chartImageUrl = getChartImageUrl(code, "month3");

  return {
    name: stockName,
    code,
    price: detail.price ?? "-",
    change: detail.change ?? "0",
    changePercent: detail.changePercent ?? "0%",
    changeDirection: detail.changeDirection ?? "flat",
    volume: detail.volume ?? "-",
    marketCap: detail.marketCap ?? "-",
    per: detail.per ?? "-",
    pbr: detail.pbr ?? "-",
    high52w: detail.high52w ?? "-",
    low52w: detail.low52w ?? "-",
    chartImageUrl,
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
    // 네이버 서버 부담 방지
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`  ✅ ${results.length}/${stockNames.length}개 종목 데이터 수집 완료`);
  return results;
}

/**
 * 주식 정보를 MDX 마크다운 테이블로 변환
 */
export function stockInfoToMarkdown(stocks: readonly StockInfo[]): string {
  if (stocks.length === 0) return "";

  let md = `\n## 📊 관련주 시세 정보\n\n`;
  md += `> 아래 시세 정보는 글 작성 시점 기준이며, 실시간 시세와 다를 수 있습니다.\n\n`;

  md += `| 종목명 | 현재가 | 등락률 | 거래량 | 시가총액 | PER | PBR |\n`;
  md += `|--------|--------|--------|--------|----------|-----|-----|\n`;

  for (const stock of stocks) {
    const arrow =
      stock.changeDirection === "up"
        ? "🔺"
        : stock.changeDirection === "down"
          ? "🔻"
          : "➖";
    const sign = stock.changeDirection === "up" ? "+" : stock.changeDirection === "down" ? "-" : "";

    md += `| [${stock.name}](${stock.naverUrl}) `;
    md += `| ${stock.price}원 `;
    md += `| ${arrow} ${sign}${stock.changePercent} `;
    md += `| ${stock.volume}주 `;
    md += `| ${stock.marketCap} `;
    md += `| ${stock.per}배 `;
    md += `| ${stock.pbr}배 |\n`;
  }

  // 개별 종목 차트
  md += `\n### 📉 종목별 3개월 차트\n\n`;

  for (const stock of stocks) {
    md += `**${stock.name} (${stock.code})**\n\n`;
    md += `![${stock.name} 3개월 차트](${stock.chartImageUrl})\n\n`;
    md += `- 52주 최고: ${stock.high52w}원 / 52주 최저: ${stock.low52w}원\n\n`;
  }

  return md;
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
    context += `거래량 ${stock.volume}, `;
    context += `시총 ${stock.marketCap}, `;
    context += `PER ${stock.per}, PBR ${stock.pbr}, `;
    context += `52주 고가 ${stock.high52w} / 저가 ${stock.low52w}\n`;
  }

  return context;
}
