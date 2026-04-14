/**
 * 체크포인트 섹션의 <mark> 일관성 수정 (Claude API 호출 없음).
 *
 * Fix:
 * 1. "첫째,", "둘째,", "1.", "2." 등 서수/번호 제거
 * 2. 각 체크포인트 문단의 첫 키워드구를 <mark>로 감싸기 (이미 감싸져 있으면 skip)
 *
 * 체크포인트 항목의 "첫 키워드구" 판단 규칙:
 *   문단 첫 문장에서, 쉼표·조사(을/를/이/가/에/은/는/별) 앞까지를 키워드구로 간주.
 *   단, 이미 <mark>가 있으면 건드리지 않음.
 */
import fs from "node:fs";
import path from "node:path";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

const TARGET_SLUGS = [
  "2026-04-13-us-iran-hormuz-strait-haesang-blockade",
  "2026-04-10-bukgeukhangro-teukbyeolbeob-shipping-ju",
  "2026-04-09-middle-east-reconstruction-steel-stocks",
];

function extractCheckpointSection(content: string): {
  before: string;
  section: string;
  after: string;
} | null {
  const startMatch = content.match(/^##\s+.*투자 시 체크포인트\s*$/m);
  if (!startMatch) return null;
  const startIdx = content.indexOf(startMatch[0]);
  const afterStart = startIdx + startMatch[0].length;
  const rest = content.slice(afterStart);
  const endMatch = rest.match(/^##\s+/m);
  if (!endMatch || endMatch.index === undefined) return null;
  const sectionEnd = afterStart + endMatch.index;
  return {
    before: content.slice(0, afterStart),
    section: content.slice(afterStart, sectionEnd),
    after: content.slice(sectionEnd),
  };
}

function fixCheckpointSection(section: string): string {
  // Split section into blocks by blank lines
  const lines = section.split(/\r?\n/);
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
      blocks.push([""]);
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  const fixed = blocks.map((block) => {
    if (block.length === 1 && block[0] === "") return "";
    const joined = block.join("\n");

    // Skip if this block doesn't look like a checkpoint item (no content)
    if (!joined.trim()) return joined;

    // Skip intro paragraph (doesn't start with ordinal or <mark>)
    // Checkpoint items typically: start with <mark>, "첫째,", "1.", or keyword phrase
    // Intro: ends with "~합니다" / "~확인하세요" without being a distinct item

    // 1. Remove ordinal prefixes: "첫째,", "둘째,", "셋째,", "넷째,", "다섯째,", "1.", "2." etc
    let result = joined.replace(
      /^(첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|1|2|3|4|5|6|7)[,.]?\s*/,
      "",
    );

    // 2. Skip if mark already exists in first 200 chars (first sentence)
    const firstPart = result.slice(0, 200);
    if (firstPart.includes("<mark>")) return result;

    // 3. Detect if this is a checkpoint item by checking if the first line
    //    looks like a statement/claim (not intro paragraph).
    //    Heuristic: checkpoint items tend to state a variable to monitor.
    //    Intro paragraphs often end with "~합니다.", "~기 바랍니다." and refer
    //    to "아래/다음/이하/5가지" etc.
    const isIntro = /(?:아래|다음|이하|5가지|확인하시기 바랍니다|확인해야 합니다\.$)/.test(result.split("\n")[0] ?? "");
    if (isIntro && !result.match(/\n\n/)) return result;

    // 4. Wrap first keyword phrase in <mark>.
    //    핵심 규칙: 조사 뒤에 반드시 공백 또는 구두점이 와야 함 (단어 중간 분리 방지)
    //    예: "알루미늄 현물가격 [의] 임계점" — 의 뒤에 공백 ✓
    //         "다자협의체" — 의 뒤에 "체" (한글) ✗ (단어 내부)
    //    Korean 조사: 을/를/이/가/은/는/에/의/과/와/으로/로/별
    const match = result.match(
      /^([\s\S]{4,70}?)([을를이가은는에의과와]|으?로|별)(?=[\s,.])/,
    );
    if (match) {
      const keyword = match[1].trim();
      const josa = match[2];
      const rest = result.slice(match[0].length);
      if (keyword.length >= 4 && !keyword.includes("<")) {
        return `<mark>${keyword}</mark>${josa}${rest}`;
      }
    }

    // Fallback: wrap first ~40 chars up to first comma/period/newline
    const fallbackMatch = result.match(/^([^,.\n]{4,50})([,.]|$)/);
    if (fallbackMatch && !fallbackMatch[1].includes("<")) {
      const keyword = fallbackMatch[1].trim();
      const rest = result.slice(keyword.length);
      return `<mark>${keyword}</mark>${rest}`;
    }

    return result;
  });

  return fixed.join("\n");
}

function processFile(slug: string): void {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ 파일 없음: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const parts = extractCheckpointSection(content);
  if (!parts) {
    console.log(`⚠️  체크포인트 섹션 없음: ${slug}`);
    return;
  }

  const beforeMarks = (parts.section.match(/<mark>/g) || []).length;
  const fixedSection = fixCheckpointSection(parts.section);
  const afterMarks = (fixedSection.match(/<mark>/g) || []).length;

  if (beforeMarks === afterMarks && parts.section === fixedSection) {
    console.log(`⏭️  변경 없음: ${slug} (mark ${beforeMarks}개)`);
    return;
  }

  const newContent = parts.before + fixedSection + parts.after;
  fs.writeFileSync(filePath, newContent, "utf-8");
  console.log(`✅ 수정됨: ${slug} (mark ${beforeMarks} → ${afterMarks})`);
}

for (const slug of TARGET_SLUGS) {
  processFile(slug);
}
