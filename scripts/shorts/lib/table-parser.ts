import type { TopStock } from "../types";

/**
 * Parse the hot-issues 3-column related-stocks table.
 *
 * Expected format:
 *   | 구분 | 종목 | 핵심 포인트 |
 *   |------|------|-------------|
 *   | 대장주 | 대우건설 | +24.95% 급등, 중동 플랜트 ... |
 *
 * Unlike featured-stocks, this table has no explicit 등락률 or 거래대금 columns.
 * We extract any `+XX.XX%` pattern from the 핵심 포인트 cell into changePercent;
 * if absent, changePercent defaults to 0 (UI renders "-" gracefully).
 *
 * Returns rows in the table's original order (which matches post priority:
 * 대장주 → 수혜주 → 관련주).
 */
export function parseHotIssuesTable(content: string): readonly TopStock[] {
  const lines = content.split("\n");
  const stocks: TopStock[] = [];

  let inTable = false;
  let headerSeen = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect hot-issues table header: has 구분 + 종목 + 핵심
    if (!inTable && trimmed.startsWith("|") && trimmed.includes("구분") && trimmed.includes("종목") && trimmed.includes("핵심")) {
      inTable = true;
      headerSeen = false;
      continue;
    }

    if (!inTable) continue;

    if (!trimmed.startsWith("|")) {
      if (stocks.length > 0) break;
      continue;
    }

    if (!headerSeen) {
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        headerSeen = true;
        continue;
      }
      headerSeen = true;
    }

    const cells = parseRow(trimmed);
    if (cells.length < 3) continue;

    const [category, name, keyPoint] = cells;
    if (name.length === 0) continue;

    // Extract changePercent from 핵심 포인트 if present (e.g. "+24.95% 급등, ...")
    const pctMatch = /([+-]?\d+(?:\.\d+)?)\s*%/.exec(keyPoint);
    const changePercent = pctMatch ? parseFloat(pctMatch[1]) : 0;

    stocks.push({
      name,
      sector: category, // 대장주/수혜주/관련주 → sector field
      reason: keyPoint, // full "핵심 포인트" text → reason field (shown below chart)
      changePercent,
      tradeAmount: "", // not available in hot-issues table
    });
  }

  return stocks;
}

/**
 * Parse the "오늘의 특징주 한눈에 보기" markdown table from a featured-stocks post.
 *
 * Expected format:
 *   | 종목명 | 주요섹터 | 상승이유 | 등락률 | 거래대금 |
 *   |--------|----------|----------|--------|----------|
 *   | 다날   | 스테이블코인 | 에이전틱 AI ... | +30.00% | 547억원 |
 *
 * Returns rows sorted by changePercent descending. Caller can take top N.
 */
export function parseFeatureTable(content: string): readonly TopStock[] {
  const lines = content.split("\n");
  const stocks: TopStock[] = [];

  let inTable = false;
  let headerSeen = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect table start: a header row with 종목명 and 등락률
    if (!inTable && trimmed.startsWith("|") && trimmed.includes("종목명") && trimmed.includes("등락률")) {
      inTable = true;
      headerSeen = false;
      continue;
    }

    if (!inTable) continue;

    // Empty line or non-pipe line ends the table
    if (!trimmed.startsWith("|")) {
      if (stocks.length > 0) break;
      continue;
    }

    // Skip the separator row (|---|---|...)
    if (!headerSeen) {
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        headerSeen = true;
        continue;
      }
      // Some posts skip the separator row
      headerSeen = true;
    }

    const cells = parseRow(trimmed);
    if (cells.length < 5) continue;

    const [name, sector, reason, changeStr, tradeAmount] = cells;
    const changePercent = parseChangePercent(changeStr);

    if (name.length === 0 || isNaN(changePercent)) continue;

    stocks.push({
      name,
      sector,
      reason,
      changePercent,
      tradeAmount,
    });
  }

  return stocks.slice().sort((a, b) => b.changePercent - a.changePercent);
}

function parseRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parseChangePercent(raw: string): number {
  const cleaned = raw.replace(/[+%\s,]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
}

/**
 * Group raw sector strings into broader categories so we can pick
 * one leader per category. This avoids 4 semiconductor stocks dominating
 * the shorts when we want sector diversity.
 *
 * Order matters: first match wins. List most-specific first.
 */
const SECTOR_GROUPS: ReadonlyArray<readonly [string, string]> = [
  ["스테이블", "핀테크"],
  ["코인", "핀테크"],
  ["핀테크", "핀테크"],
  ["2차전지", "2차전지"],
  ["배터리", "2차전지"],
  ["반도체", "반도체"],
  ["PCB", "반도체"],
  ["방산", "방산"],
  ["탄약", "방산"],
  ["광통신", "통신"],
  ["통신", "통신"],
  ["AI", "AI/로봇"],
  ["로봇", "AI/로봇"],
  ["친환경", "친환경"],
  ["탈플라스틱", "친환경"],
  ["에너지플랜트", "에너지"],
  ["에너지", "에너지"],
  ["바이오", "바이오"],
  ["제약", "바이오"],
  ["식품", "식품"],
  ["화장품", "화장품"],
  ["화학", "화학"],
  ["섬유", "화학"],
  ["건설", "건설"],
  ["자동차", "자동차"],
  ["전자부품", "전자부품"],
  ["유통", "유통"],
  ["백화점", "유통"],
  ["편의점", "유통"],
];

export function normalizeSector(sector: string): string {
  const trimmed = sector.trim();
  for (const [keyword, group] of SECTOR_GROUPS) {
    if (trimmed.includes(keyword)) return group;
  }
  return trimmed;
}

/**
 * Pick the highest-gain stock from each sector group.
 * Returns sector leaders sorted by 등락률 descending.
 */
export function pickSectorLeaders(stocks: readonly TopStock[]): readonly TopStock[] {
  const sorted = [...stocks].sort((a, b) => b.changePercent - a.changePercent);
  const seen = new Set<string>();
  const leaders: TopStock[] = [];

  for (const stock of sorted) {
    const group = normalizeSector(stock.sector);
    if (seen.has(group)) continue;
    seen.add(group);
    leaders.push(stock);
  }

  return leaders;
}
