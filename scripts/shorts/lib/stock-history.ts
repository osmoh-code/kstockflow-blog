/**
 * Naver Finance daily candle fetcher.
 *
 * Endpoint: https://api.finance.naver.com/siseJson.naver
 *   ?symbol={code}     6-digit Korean stock code
 *   &requestType=1     daily
 *   &count=30          last 30 days
 *   &timeframe=day
 *
 * Response is non-standard JSON: an array of arrays.
 * First row is the header: ['날짜', '시가', '고가', '저가', '종가', '거래량', '외국인소진율']
 * Subsequent rows are data: [20260101, 1000, 1100, 980, 1050, 12345, 30.5]
 */

import type { PricePoint, TopStock } from "../types";

// Naver Finance fchart endpoint — XML, EUC-KR, returns OHLC
const BASE_URL = "https://fchart.stock.naver.com/sise.nhn";
const TIMEOUT_MS = 10_000;

export interface FetchHistoryOptions {
  readonly count?: number;
}

/**
 * Fetch daily OHLC history for a stock by 6-digit code (last 20 trading days by default).
 * Returns null on any failure (caller should fall back to synthetic data).
 */
export async function fetchDailyHistory(
  code: string,
  opts: FetchHistoryOptions = {},
): Promise<readonly PricePoint[] | null> {
  const count = opts.count ?? 20;
  const url = `${BASE_URL}?symbol=${encodeURIComponent(code)}&timeframe=day&count=${count}&requestType=0`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://finance.naver.com/",
        "Accept": "*/*",
      },
    });
    if (!res.ok) {
      console.log(`      ❌ ${code}: HTTP ${res.status}`);
      return null;
    }
    const text = await res.text();
    const parsed = parseFchartXml(text);
    if (!parsed) {
      console.log(`      ❌ ${code}: parse 실패 (응답 ${text.length} bytes)`);
    }
    return parsed;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`      ❌ ${code}: ${msg}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse Naver fchart XML response.
 *
 * Format:
 *   <protocol>
 *     <chartdata symbol="064260" name="..." count="20" ...>
 *       <item data="20260311|7510|7720|7330|7500|1834381" />
 *       <item data="YYYYMMDD|open|high|low|close|volume" />
 *       ...
 *     </chartdata>
 *   </protocol>
 */
function parseFchartXml(xml: string): readonly PricePoint[] | null {
  try {
    const itemRegex = /<item\s+data="([^"]+)"\s*\/>/g;
    const points: PricePoint[] = [];
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
      const parts = match[1].split("|");
      if (parts.length < 5) continue;
      const dateStr = parts[0];
      const open = parseFloat(parts[1]);
      const high = parseFloat(parts[2]);
      const low = parseFloat(parts[3]);
      const close = parseFloat(parts[4]);
      if (dateStr.length !== 8 || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        continue;
      }
      const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      points.push({ date: formatted, open, high, low, close });
    }
    return points.length > 0 ? points : null;
  } catch {
    return null;
  }
}

function parseSiseJson(raw: string): readonly PricePoint[] | null {
  try {
    // Naver returns malformed JSON-ish text. Clean trailing commas.
    const cleaned = raw
      .replace(/,\s*]/g, "]")
      .replace(/,\s*}/g, "}")
      .trim();
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 2) return null;

    // First row is header: ['날짜', '시가', '고가', '저가', '종가', '거래량', '외국인소진율']
    const rows = parsed.slice(1);
    const points: PricePoint[] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 5) continue;
      const dateNum = row[0];
      const open = row[1];
      const high = row[2];
      const low = row[3];
      const close = row[4];
      if (
        typeof dateNum !== "number" ||
        typeof open !== "number" ||
        typeof high !== "number" ||
        typeof low !== "number" ||
        typeof close !== "number"
      ) {
        continue;
      }

      // 20260106 → "2026-01-06"
      const dateStr = String(dateNum);
      if (dateStr.length !== 8) continue;
      const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      points.push({ date: formatted, open, high, low, close });
    }
    return points.length > 0 ? points : null;
  } catch {
    return null;
  }
}

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
