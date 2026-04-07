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
