/**
 * Stage 4 helpers (hot-issues): category-specific asset builders.
 *
 * hot-issues rendering conventions:
 *   - Header: 2-line title ("미·이란 2주 휴전속\n중동재건 TOP7") — uses
 *     frontmatter override when present, else heuristic builder
 *   - Body: suppressStats=true → hide candle chart and live %, enlarge reason
 *     text instead (posts may be read days later, stats drift)
 *   - Loop: show ALL related stocks in original table order (up to 10)
 */
import { buildHotIssuesHeaderTitle } from "../lib/mark-extractor";
import type { SceneType, ShortsInputData, TableRow, TopStock } from "../types";

/**
 * hot-issues: body + loop scenes always hide the live % and chart because
 * the post may be read days later. Intro/CTA scenes are unaffected.
 */
export function shouldSuppressStatsForHotIssues(sceneType: SceneType): boolean {
  return sceneType === "chart" || sceneType === "stock_card" || sceneType === "loop";
}

/**
 * hot-issues header title resolution:
 *   1. frontmatter shorts_header_title (exact override — preferred)
 *   2. heuristic builder with stocks.length so "TOP N" matches actual render
 */
export function resolveHotIssuesHeaderTitle(input: ShortsInputData): string {
  if (input.headerTitleOverride) return input.headerTitleOverride;
  return buildHotIssuesHeaderTitle(input.title, input.topStocks.length);
}

/**
 * hot-issues loop table: ALL related stocks in their original table order
 * (대장주 → 수혜주 → 관련주), capped at 10 rows for readability.
 */
export function buildHotIssuesLoopTableRows(
  allStocks: readonly TopStock[],
): TableRow[] {
  return allStocks.slice(0, 10).map((s) => ({
    name: s.name,
    changePercent: s.changePercent,
    sector: s.sector,
  }));
}
