/**
 * Sector-leaders MDX parser.
 *
 * Reads the "## 섹터별 특징주 분석" H2 section of a featured-stocks post and
 * returns ONE entry per H3 sector heading, with the sector's own 상승이유
 * (first evergreen paragraph) + its 주요 종목 list.
 *
 * This file is specific to the sector-leaders shorts category — it does NOT
 * depend on and must NOT be imported by featured/ or hot-issues/ code.
 */

export interface SectorSectionRaw {
  /** Raw H3 heading including emoji: "🔐 양자암호/양자컴퓨팅 관련주" */
  readonly sectorHeading: string;
  /**
   * Truncated factual sentence(s) (fallback for when Gemini summarization
   * isn't used). Always 1~2 sentences within 120 chars.
   */
  readonly reason: string;
  /**
   * Concatenated full-paragraph text of this sector (no truncation, no
   * "주요 종목" line). Used as the input to Gemini 1-sentence summarization
   * so the model has rich context.
   */
  readonly fullText: string;
  /** Stock names listed in the "주요 종목:" line, in original order. */
  readonly stockNames: readonly string[];
}

const SECTOR_H2 = "## 섹터별 특징주 분석";
const MAX_REASON_CHARS = 120;
const MAX_REASON_SENTENCES = 2;

/**
 * H3 heading keywords whose sections are excluded from sector-leaders shorts.
 * Reason: "기업이벤트/대형 거래" mixes individual deal news and isn't a
 * proper "주도 섹터" — user decision 2026-04-15.
 */
const EXCLUDED_HEADING_KEYWORDS = ["기업이벤트", "대형 거래"];

function isExcludedSector(heading: string): boolean {
  return EXCLUDED_HEADING_KEYWORDS.some((kw) => heading.includes(kw));
}

/**
 * Parse the "섹터별 특징주 분석" H2 section.
 * Returns [] when the section is missing (defensive — caller decides what to do).
 */
export function parseSectorSections(content: string): readonly SectorSectionRaw[] {
  const lines = content.split("\n");
  const sections: SectorSectionRaw[] = [];

  let inSectorH2 = false;
  let currentHeading: string | null = null;
  let currentParagraph: string[] = [];
  let paragraphs: string[][] = [];
  let currentStocks: string[] = [];

  const flushSection = () => {
    if (!currentHeading) return;
    // Skip excluded sectors ("기업이벤트" etc.) — they still get parsed so we
    // advance the scanner state, but nothing is pushed into `sections`.
    if (!isExcludedSector(currentHeading)) {
      const reason = pickFirstReasonParagraph(paragraphs);
      const fullText = paragraphs
        .map((p) => cleanParagraph(p.join(" ")))
        .filter((t) => t.length > 0)
        .join(" ");
      sections.push({
        sectorHeading: currentHeading,
        reason: truncateReason(reason),
        fullText,
        stockNames: currentStocks.slice(),
      });
    }
    currentHeading = null;
    paragraphs = [];
    currentStocks = [];
    currentParagraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith(SECTOR_H2)) {
      inSectorH2 = true;
      continue;
    }
    if (!inSectorH2) continue;

    // Any other H2 (including "## 주요 하락 테마") ends the sector analysis.
    if (line.startsWith("## ")) {
      flushSection();
      break;
    }

    if (line.startsWith("### ")) {
      flushSection();
      currentHeading = line.replace(/^###\s+/, "").trim();
      continue;
    }

    if (!currentHeading) continue;

    // "주요 종목:" line marks the end of the section's prose.
    const majorMatch = /^주요\s*종목[:\s]*(.+)$/.exec(line);
    if (majorMatch) {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
        currentParagraph = [];
      }
      currentStocks = majorMatch[1]
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      continue;
    }

    if (line === "") {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
        currentParagraph = [];
      }
      continue;
    }

    // Skip blockquotes/tables — paragraphs only.
    if (line.startsWith(">") || line.startsWith("|") || line.startsWith("<")) {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
        currentParagraph = [];
      }
      continue;
    }

    currentParagraph.push(line);
  }
  // End-of-file flush for the last sector.
  if (inSectorH2) flushSection();

  return sections;
}

/**
 * Pick the first paragraph that reads like an explanation (not a bullet list,
 * not a pure number-drop). Falls back to the longest paragraph if none qualify.
 */
function pickFirstReasonParagraph(paragraphs: readonly string[][]): string {
  const texts = paragraphs.map((p) => cleanParagraph(p.join(" ")));
  for (const t of texts) {
    if (t.length >= 20 && /[가-힣]/.test(t)) return t;
  }
  const sorted = [...texts].sort((a, b) => b.length - a.length);
  return sorted[0] ?? "";
}

function cleanParagraph(s: string): string {
  return s
    .replace(/<mark>([^<]*)<\/mark>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trim the explanation to 1~2 sentences within MAX_REASON_CHARS so the
 * narration fits inside the ~3-4s scene budget.
 */
function truncateReason(text: string): string {
  if (!text) return "";
  const sentences = text
    .split(/(?<=[다요][.!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let picked = sentences.slice(0, MAX_REASON_SENTENCES).join(" ");
  if (picked.length > MAX_REASON_CHARS) {
    picked = picked.slice(0, MAX_REASON_CHARS).trim() + "…";
  }
  return picked;
}
