/**
 * Extract <mark>...</mark> highlighted phrases from MDX body content.
 *
 * The kstockflow blog uses <mark> tags to highlight key numbers and quotes
 * (e.g., "<mark>영업이익 40조원 돌파</mark>"). These are perfect hook material
 * for YouTube Shorts because they're already curated by Claude as the most
 * impactful phrases in the post.
 */

const MARK_REGEX = /<mark>([^<]+)<\/mark>/g;
const MAX_LENGTH = 80;

export function extractMarkPhrases(content: string): readonly string[] {
  const phrases = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = MARK_REGEX.exec(content)) !== null) {
    const phrase = match[1].trim();
    if (phrase.length > 0 && phrase.length <= MAX_LENGTH) {
      phrases.add(phrase);
    }
  }

  return Array.from(phrases);
}

/**
 * Extract H3 sector headings from the "섹터별 특징주 분석" section.
 * Lines like "### 🔋 반도체/배터리 소재" → "🔋 반도체/배터리 소재"
 */
export function extractSectorHeadings(content: string): readonly string[] {
  const headings: string[] = [];
  const lines = content.split("\n");
  let inSectorSection = false;

  for (const line of lines) {
    if (line.startsWith("## 섹터별 특징주 분석")) {
      inSectorSection = true;
      continue;
    }
    if (inSectorSection && line.startsWith("## ")) {
      break;
    }
    if (inSectorSection && line.startsWith("### ")) {
      headings.push(line.replace(/^###\s+/, "").trim());
    }
  }

  return headings;
}

export interface SectorLeader {
  readonly sectorHeading: string;  // "🔋 반도체/배터리 소재"
  readonly leaderName: string;     // "삼성E&A" — 섹터의 첫 번째 주요 종목
}

/**
 * Parse the "섹터별 특징주 분석" section and extract one leader stock per sector.
 *
 * Each sector section follows this pattern in the blog:
 *   ### 🔋 반도체/배터리 소재
 *   <description...>
 *   주요 종목: 삼성E&A, 롯데에너지머티리얼즈, 그린리소스, 네패스아크
 *
 * The first stock in "주요 종목:" is treated as that sector's leader.
 * Excludes the "주요 하락 테마" section (we only want gainers).
 */
/**
 * Extract the first 2~3 sentences from the "## {keyword} 핵심 요약" section
 * (hot-issues posts). Used as the Hook narration for hot-issues shorts.
 *
 * Cleaning applied:
 *   - Strip <mark>/<tag> markup
 *   - Strip inline markdown ([text](url), **bold**, _italic_)
 *   - Remove leading date prefix like "2026년 4월 1일,"
 *   - Collapse whitespace
 *
 * Returns null if no 핵심 요약 section found.
 */
export function extractHookSummary(content: string, maxSentences = 2): string | null {
  const lines = content.split("\n");
  let inSection = false;
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine;
    // Detect the section: "## ... 핵심 요약" or "## 핵심 요약"
    if (line.startsWith("## ") && line.includes("핵심 요약")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) {
      // Next H2 ends the section
      if (current.length > 0) paragraphs.push(current.join(" "));
      break;
    }
    if (!inSection) continue;
    if (line.trim() === "") {
      if (current.length > 0) {
        paragraphs.push(current.join(" "));
        current = [];
      }
    } else {
      current.push(line.trim());
    }
  }
  if (current.length > 0) paragraphs.push(current.join(" "));

  if (paragraphs.length === 0) return null;

  // Skip "meta" paragraphs (rhetorical questions, intro/navigation copy)
  // and pick the first paragraph that describes actual events/facts.
  // Examples to skip:
  //   "...진짜 수혜주가 어디인지 판단하기 어려우신가요?"
  //   "이 글에서는 ... 분석하여, 투자자들이 판단할 수 있도록 도움을 드리겠습니다."
  //   "테마주 특성상 단기 급등 후 급락 위험이 크고..."
  const META_PATTERNS: RegExp[] = [
    /\?\s*$/,
    /어려우신가요/,
    /혼란이 가중/,
    /도움을 드리/,
    /이 글에서/,
    /분석하여/,
    /선별해/,
    /특성상/,
    /투자자들의 혼란/,
    /명확한 판단/,
  ];
  const isMeta = (p: string): boolean => META_PATTERNS.some((re) => re.test(p));
  const firstPara = paragraphs.find((p) => !isMeta(p)) ?? paragraphs[0];
  const cleaned = cleanInlineMarkdown(firstPara);
  // Remove leading date prefix like "2026년 4월 1일," or "2026년 4월 1일"
  const noDate = cleaned.replace(/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일,?\s*/, "");

  // Split into sentences at "다.", "요.", "다!", "요!" followed by space or end
  const sentences = noDate
    .split(/(?<=[다요][.!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // Strip sentences mentioning market indices with specific %
    // ("코스피 8% 급등", "코스닥도 6%대 상승") — these drift over time,
    // hook content should focus on the underlying news trigger instead
    .filter((s) => !/(코스피|코스닥|나스닥|다우|s&p)[^.]*?%/i.test(s));

  if (sentences.length === 0) return null;

  return sentences.slice(0, maxSentences).join(" ");
}

/**
 * Extract the FULL "## ... 핵심 요약" section as a single cleaned text block,
 * including all paragraphs (meta + factual). Used as input for Gemini-based
 * 1-sentence summarization in extract.ts (hot-issues branch).
 *
 * Returns null if the section is not found.
 */
export function extractHookSection(content: string): string | null {
  const lines = content.split("\n");
  let inSection = false;
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine;
    if (line.startsWith("## ") && line.includes("핵심 요약")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) {
      if (current.length > 0) paragraphs.push(current.join(" "));
      break;
    }
    if (!inSection) continue;
    if (line.trim() === "") {
      if (current.length > 0) {
        paragraphs.push(current.join(" "));
        current = [];
      }
    } else {
      current.push(line.trim());
    }
  }
  if (current.length > 0) paragraphs.push(current.join(" "));

  if (paragraphs.length === 0) return null;

  return paragraphs.map((p) => cleanInlineMarkdown(p)).join("\n\n");
}

/**
 * Extract per-stock descriptions from hot-issues "### N. 종목명" sections.
 *
 * Strategy:
 *   1. Walk all paragraphs in each ### N. {stockName} section
 *   2. Skip the first paragraph if it mentions a specific date/% (those are
 *      time-sensitive — "4월 1일 +24.95% 급등" — and drift over time)
 *   3. Take the FIRST paragraph that talks about the company's structural
 *      strength / business / why it matters (the "evergreen" content)
 *   4. Truncate to first 1~2 sentences, max ~140 chars
 *
 * Example for 대우건설:
 *   ### 1. 대우건설
 *   <table><figure>
 *   대우건설은 이번 중동전쟁 종전 기대감 테마의 대장주입니다. 4월 1일 +24.95% 급등 ...  ← SKIP (date+%)
 *   대우건설의 핵심 강점은 중동·북아프리카(MENA) 지역에서의 오랜 사업 경험입니다. 과거 ... ← PICK
 *
 * Returns a Map<stockName, description>.
 */
export function extractStockDescriptions(
  content: string,
  maxSentences = 2,
  maxChars = 140,
): Map<string, string> {
  const descriptions = new Map<string, string>();
  const lines = content.split("\n");

  let currentStock: string | null = null;
  let pendingParagraphs: string[][] = [];
  let currentParagraph: string[] = [];

  const flushSection = () => {
    if (!currentStock) return;
    if (currentParagraph.length > 0) {
      pendingParagraphs.push(currentParagraph);
      currentParagraph = [];
    }
    if (pendingParagraphs.length === 0) return;

    // Find first "evergreen" paragraph: skip ones with date/% references
    const isTimeSensitive = (text: string) =>
      /\d{1,2}월\s*\d{1,2}일/.test(text) ||
      /[+-]?\d+(?:\.\d+)?\s*%/.test(text) ||
      /(\d+,?\d*)\s*원/.test(text); // also skip price quotes like "19,430원"

    let chosen: string | null = null;
    for (const paraLines of pendingParagraphs) {
      const text = cleanInlineMarkdown(paraLines.join(" "));
      if (text.length < 20) continue;
      if (isTimeSensitive(text)) continue;
      chosen = text;
      break;
    }
    // Fallback: if all paragraphs are time-sensitive, just use the longest one
    if (!chosen) {
      const candidates = pendingParagraphs
        .map((p) => cleanInlineMarkdown(p.join(" ")))
        .filter((t) => t.length >= 20);
      if (candidates.length > 0) {
        chosen = candidates.sort((a, b) => b.length - a.length)[0];
      }
    }

    if (chosen && !descriptions.has(currentStock)) {
      const sentences = chosen
        .split(/(?<=[다요][.!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const picked = sentences.slice(0, maxSentences).join(" ");
      const truncated =
        picked.length > maxChars ? picked.slice(0, maxChars).trim() + "…" : picked;
      descriptions.set(currentStock, truncated);
    }

    pendingParagraphs = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Detect ### N. 종목명 heading (numbered stock section)
    const headingMatch = /^###\s+\d+\.\s*(.+?)\s*$/.exec(line);
    if (headingMatch) {
      flushSection();
      currentStock = headingMatch[1].trim();
      pendingParagraphs = [];
      currentParagraph = [];
      continue;
    }

    // Stop at next H2 or H3 (non-numbered)
    if (line.startsWith("## ") || (line.startsWith("### ") && !/^###\s+\d+\./.test(line))) {
      flushSection();
      currentStock = null;
      continue;
    }

    if (!currentStock) continue;

    // Empty line separates paragraphs
    if (line === "") {
      if (currentParagraph.length > 0) {
        pendingParagraphs.push(currentParagraph);
        currentParagraph = [];
      }
      continue;
    }

    // Skip tables, figures, blockquotes
    if (line.startsWith("|") || line.startsWith("<") || line.startsWith(">")) {
      if (currentParagraph.length > 0) {
        pendingParagraphs.push(currentParagraph);
        currentParagraph = [];
      }
      continue;
    }

    currentParagraph.push(line);
  }
  flushSection();

  return descriptions;
}

/**
 * Build a 2-line concise header title for hot-issues from the blog post title.
 * Same logic as assets.ts buildHotIssuesHeaderTitle — exported here so script.ts
 * can use it without a circular dependency on assets.ts.
 *
 * Returns a string with a single \n separator.
 *
 * Examples:
 *   "중동전쟁 종전 기대감 건설주 관련주 TOP 7 | 대장주·..." → "중동전쟁 종전 기대감\n건설주 TOP 7"
 *   "엔비디아 광통신 관련주 TOP 10 | ..."                    → "엔비디아\n광통신 TOP 10"
 *   "미·이란 2주 휴전 속, 중동 재건 관련주 TOP 12 | ..."     → "미이란 2주 휴전\n중동 재건 TOP 7"
 *     (with actualStockCount=7)
 *
 * @param actualStockCount  If provided, overrides "TOP N" in the title with the
 *                          actual rendered stock count (since TOP_N_HOT_ISSUES
 *                          may cap below the post's full list).
 */
export function buildHotIssuesHeaderTitle(title: string, actualStockCount?: number): string {
  const beforePipe = title.split("|")[0].trim();
  const topInTitle = /TOP\s*(\d+)/i.exec(beforePipe);
  const topNum = actualStockCount ?? (topInTitle ? parseInt(topInTitle[1], 10) : null);
  const topSuffix = topNum ? `TOP ${topNum}` : "";

  const core = beforePipe
    .replace(/TOP\s*\d+/gi, "")
    .replace(/\s*수혜주\s*/g, " ")
    .replace(/\s*테마주\s*/g, " ")
    .replace(/\s*관련주\s*/g, " ")
    // Visual cleanup: middle dot → space ("미·이란" → "미 이란"), strip commas
    .replace(/·/g, " ")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = core.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return title;

  // Anchor strategy:
  //  1) Prefer the position right after an event word ("휴전", "합의", ...) so
  //     the first line carries the trigger and the second line carries the topic.
  //     If a positional particle ("속", "안", "내") follows, include it in line1.
  //  2) Else fall back to a "...주" suffix word (industry/theme marker), but
  //     skip numeric units like "2주" (week count).
  //  3) Else split roughly in the middle.
  let anchor = -1;
  for (let i = 0; i < words.length; i++) {
    if (/(휴전|합의|발표|계약|체결|선언|결정|급등|돌파|폭등|폭락|착공|개시|시작|종전)$/.test(words[i])) {
      anchor = i + 1;
      // Pull positional particle into line1 ("휴전 속" stays together)
      if (anchor < words.length && /^(속|안|내|중|후)$/.test(words[anchor])) {
        anchor += 1;
      }
      break;
    }
  }
  if (anchor < 0) {
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      if (
        /주$/.test(w) &&
        w.length >= 2 &&
        !/(기대감|전망|분석|이슈|뉴스)주$/.test(w) &&
        !/^\d+주$/.test(w) // skip "2주", "3주" (week units)
      ) {
        anchor = i;
        break;
      }
    }
  }
  if (anchor < 0) anchor = Math.max(1, Math.ceil(words.length / 2));

  if (anchor === 0 || anchor >= words.length || words.length === 1) {
    return topSuffix ? `${words.join(" ")} ${topSuffix}` : words.join(" ");
  }

  const line1 = words.slice(0, anchor).join(" ");
  const line2Body = words.slice(anchor).join(" ");
  const line2 = topSuffix ? `${line2Body} ${topSuffix}` : line2Body;
  return `${line1}\n${line2}`;
}

/**
 * Build the loop table title (e.g., "중동전쟁 종전 건설주 관련주 전체").
 * Uses the same anchor logic as the header but joins to single line.
 */
export function buildHotIssuesLoopTitle(title: string): string {
  const headerTwoLine = buildHotIssuesHeaderTitle(title);
  // Take both lines, drop "TOP N" suffix, append "관련주 전체"
  const flat = headerTwoLine.replace(/\n/g, " ").replace(/\s*TOP\s*\d+\s*$/i, "").trim();
  return `${flat} 관련주 전체`;
}

/**
 * Strip inline markdown and HTML tags, leaving plain text.
 */
function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/<mark>([^<]*)<\/mark>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSectorLeaders(content: string): readonly SectorLeader[] {
  const lines = content.split("\n");
  const leaders: SectorLeader[] = [];

  let inSectorAnalysis = false;
  let currentHeading: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("## 섹터별 특징주 분석")) {
      inSectorAnalysis = true;
      continue;
    }

    if (inSectorAnalysis && line.startsWith("## ")) {
      // Any other H2 (including 주요 하락 테마) ends the sector analysis
      break;
    }

    if (!inSectorAnalysis) continue;

    if (line.startsWith("### ")) {
      currentHeading = line.replace(/^###\s+/, "").trim();
      continue;
    }

    if (currentHeading && /^주요\s*종목/.test(line)) {
      const list = line.replace(/^주요\s*종목[:\s]*/, "").trim();
      const firstStock = list.split(/[,，、]/)[0].trim();
      if (firstStock.length > 0) {
        leaders.push({
          sectorHeading: currentHeading,
          leaderName: firstStock,
        });
        currentHeading = null; // avoid double-pick within same section
      }
    }
  }

  return leaders;
}
