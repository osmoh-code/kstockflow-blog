/**
 * Stage 4 helpers (featured-stocks): category-specific asset builders.
 *
 * featured-stocks rendering conventions:
 *   - Header: date-based single-line title ("4월 8일 주목해야 할 종목")
 *   - Body: full chart + large % number shown (no suppressStats)
 *   - Loop: table of stocks NOT already shown in body (legacy "그 외 특징주" feel)
 */
import type { ShortsScript, TableRow, TopStock } from "../types";

/**
 * featured-stocks: body scenes always show live stats (candles + huge %).
 * Kept as a boolean constant for symmetry with hot-issues logic.
 */
export const FEATURED_SUPPRESS_STATS = false;

/**
 * Build a date-based header title for featured-stocks.
 *   "2026-04-08" → "4월 8일 주목해야 할 종목"
 * Falls back to a generic title if the slug date is malformed.
 */
export function formatFeaturedHeaderTitle(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return "오늘 주목해야 할 종목";
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  return `${month}월 ${day}일 주목해야 할 종목`;
}

/**
 * featured-stocks loop table: show top gainers NOT already covered in body
 * scenes (up to 8 extras). This gives the viewer a sense of "here are more
 * stocks you should know about" beyond the sector leaders.
 */
export function buildFeaturedLoopTableRows(
  allStocks: readonly TopStock[],
  script: ShortsScript,
): TableRow[] {
  const bodyStockNames = new Set(
    script.body.map((s) => s.stockFocus).filter((n): n is string => n !== null),
  );
  return allStocks
    .filter((s) => !bodyStockNames.has(s.name))
    .slice(0, 8)
    .map((s) => ({
      name: s.name,
      changePercent: s.changePercent,
      sector: s.sector,
    }));
}
