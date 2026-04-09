/**
 * Naver Finance daily candle fetcher (NXT-integrated).
 *
 * Endpoint (2026-04-08 변경):
 *   https://api.stock.naver.com/chart/domestic/item/{code}/day
 *     ?startDateTime=YYYYMMDD&endDateTime=YYYYMMDD
 *
 * Response: JSON array of objects:
 *   [{ localDate, openPrice, highPrice, lowPrice, closePrice, accumulatedTradingVolume, foreignRetentionRate }, ...]
 *
 * Why this endpoint over the old fchart.stock.naver.com:
 *   - fchart는 KRX 거래만 반영하는 차트를 반환 (NXT 거래 종목은 부정확)
 *   - api.stock.naver.com는 m.stock.naver.com과 동일한 NXT+KRX 통합 OHLC 반환
 *   - 통합 데이터로 거래량/거래대금이 정확하며, NXT 거래되는 종목의 candle도 정확
 *
 * 검증: 대우건설 047040 4월 8일 closePrice 22550, accumulatedTradingVolume 90,625,704 →
 *       integration API와 정확히 일치 (NXT 통합 데이터 확인)
 */

import type { PricePoint, TopStock } from "../types";

// Naver Finance api endpoint — JSON, NXT 통합 OHLC
const BASE_URL = "https://api.stock.naver.com/chart/domestic/item";
const TIMEOUT_MS = 10_000;

export interface FetchHistoryOptions {
  readonly count?: number;
}

/**
 * Fetch daily OHLC history for a stock by 6-digit code (last 20 trading days by default).
 * Returns null on any failure (caller should fall back to synthetic data).
 *
 * NXT-integrated source: api.stock.naver.com (m.stock.naver.com 모바일 차트와 동일한 데이터)
 */
export async function fetchDailyHistory(
  code: string,
  opts: FetchHistoryOptions = {},
): Promise<readonly PricePoint[] | null> {
  const count = opts.count ?? 20;
  // Compute date range — fetch ~2x count days to handle weekends/holidays, then slice
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - count * 2);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const url = `${BASE_URL}/${encodeURIComponent(code)}/day?startDateTime=${fmt(startDate)}&endDateTime=${fmt(today)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://m.stock.naver.com/",
        "Accept": "application/json",
      },
    });
    if (!res.ok) {
      console.log(`      ❌ ${code}: HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as Array<{
      localDate: string;
      openPrice: number;
      highPrice: number;
      lowPrice: number;
      closePrice: number;
      accumulatedTradingVolume?: number;
    }>;
    if (!Array.isArray(json) || json.length === 0) {
      console.log(`      ❌ ${code}: 응답이 배열이 아니거나 빈 배열`);
      return null;
    }
    // Parse + slice to last `count` days
    const points: PricePoint[] = json
      .map((row) => {
        const ds = String(row.localDate);
        if (!ds || ds.length !== 8) return null;
        return {
          date: `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`,
          open: row.openPrice,
          high: row.highPrice,
          low: row.lowPrice,
          close: row.closePrice,
        } satisfies PricePoint;
      })
      .filter((p): p is PricePoint => p !== null);
    return points.slice(-count);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`      ❌ ${code}: ${msg}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// (Legacy parseFchartXml + parseSiseJson removed — replaced by inline JSON
//  parsing in fetchDailyHistory which uses the NXT-integrated api.stock.naver.com endpoint.)

/**
 * Synthesize fake OHLC history from a stock's current changePercent.
 * Used as a fallback when fetchDailyHistory() fails.
 */
export function syntheticHistory(stock: TopStock, points = 20): readonly PricePoint[] {
  const result: PricePoint[] = [];
  const today = new Date();
  const finalPrice = 100;
  const startPrice = finalPrice / (1 + stock.changePercent / 100);

  let prevClose = startPrice;
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    // Smooth ease-in curve toward the final price
    const targetClose = startPrice + (finalPrice - startPrice) * Math.pow(t, 1.5);
    const noise = (Math.sin(i * 0.7) + Math.cos(i * 1.3)) * 0.6;
    const close = Math.max(0.1, targetClose + noise);
    const open = i === 0 ? close - 0.5 : prevClose + (Math.cos(i * 1.1) * 0.6);
    const high = Math.max(open, close) + Math.abs(Math.sin(i * 1.4)) * 1.0;
    const low = Math.min(open, close) - Math.abs(Math.cos(i * 0.9)) * 1.0;
    prevClose = close;

    const d = new Date(today);
    d.setDate(d.getDate() - (points - 1 - i));
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    result.push({ date: dateStr, open, high, low, close });
  }
  return result;
}

/**
 * Korean stock code lookup table for the most common stocks.
 * Expand as needed. If a stock isn't here, fetchDailyHistory will be skipped
 * and synthetic data is used instead.
 */
const STOCK_CODE_MAP: Record<string, string> = {
  // Stocks frequently appearing in kstockflow daily featured-stocks posts
  "다날": "064260",
  "진영": "285800",
  "풍산홀딩스": "005810",
  "풍산": "103140",
  "CS": "065770",
  "삼성E&A": "028050",
  "삼성엔지니어링": "028050",
  "엘앤에프": "066970",
  "한국첨단소재": "056700",
  "LG이노텍": "011070",
  "심텍": "036710",
  "롯데에너지머티리얼즈": "020150",
  "SNT에너지": "100840",
  "그린리소스": "402490",
  "엔켐": "348370",
  "CJ제일제당": "097950",
  "효성티앤씨": "298020",
  "네패스아크": "330860",
  "레이저쎌": "412350",
  "신세계": "004170",
  "에이아이코리아": "263540",
  "하이드로리튬": "101670",
  "네오셈": "253590",
  "달바글로벌": "501200",
  "롯데쇼핑": "023530",
  "GS리테일": "007070",
  "한화시스템": "272210",
  "한화에어로스페이스": "012450",
  "퍼스텍": "010820",
  "빅텍": "065450",
  "이노인스트루먼트": "215790",
  "이루온": "065440",
  "기가레인": "049080",
  "대한광통신": "010170",
  "세림B&G": "340440",
  "삼륭물산": "014970",
  "씨티케이": "260930",
  "에코플라스틱": "038110",
};

export function lookupStockCode(name: string): string | null {
  return STOCK_CODE_MAP[name.trim()] ?? null;
}

/**
 * Search for a Korean stock code by name.
 * Reuses the production-grade searchStockCode from scripts/lib/stock-data.ts
 * which has KRX list + alias map + partial matching.
 */
export async function searchStockCode(name: string): Promise<string | null> {
  const cached = STOCK_CODE_MAP[name.trim()];
  if (cached) return cached;

  try {
    const { searchStockCode: searchFromKrx } = await import("../../lib/stock-data");
    return await searchFromKrx(name.trim());
  } catch {
    return null;
  }
}
