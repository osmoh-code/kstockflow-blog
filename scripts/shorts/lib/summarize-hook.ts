/**
 * Gemini-powered hook copywriter for hot-issues YouTube Shorts.
 *
 * Single Gemini call produces TWO outputs:
 *   1. hook       — 1-sentence narration (60~85 chars) explaining why this theme
 *                   is rallying right now; used for TTS on the Hook scene.
 *   2. headerTitle — 2-line letterbox/hook title (e.g. "미·이란 2주 휴전속\n중동재건 TOP7");
 *                   used as `input.headerTitleOverride` when the frontmatter
 *                   doesn't explicitly specify one.
 *
 * Why one call and not two:
 *   Both outputs are derived from the same "핵심 요약" context, so batching
 *   keeps cost/latency halved and guarantees the hook and header stay
 *   thematically consistent (no risk of divergent phrasing).
 *
 * Why this exists at all:
 *   - Mechanical first-sentence extraction picks up meta/rhetorical openers
 *     ("진짜 수혜주가 어디일까요?") instead of the actual news trigger.
 *   - Heuristic title builders produce awkward line breaks ("미이란\n2주
 *     휴전 속, 중동 재건 TOP 12") that mismatch the rendered stock count.
 *   - Gemini can do both correctly in one shot when given the full context.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 2048;

export interface HookGenerationResult {
  readonly hook: string;
  /** 2-line header with literal "\n" separator. */
  readonly headerTitle: string;
}

const SYSTEM_PROMPT = `당신은 한국 주식 YouTube Shorts 카피라이터입니다.

블로그 글의 "핵심 요약" 섹션 + 글 제목을 받아서 **두 가지**를 동시에 생성합니다.

============================================================
출력 1: hook (공백 포함 60~85자 1문장 — TTS 내레이션용)
============================================================
**왜 이 재료가 지금 부각됐는지**를 한 문장으로 압축.

⚠️ hook 규칙
- 공백 포함 **60~85자** 1문장 (절대 90자 초과 금지)
- 시청자가 첫 5초 안에 "왜 이게 핫한지" 이해
- 사건/사실 중심: 누가, 언제, 무엇을, 왜 → 시장 영향
- **개별 종목명 절대 사용 금지** (카카오페이, 다날, 삼성전자 등 회사명 NO)
  → 일반명사로 표현: "건설주", "반도체 소부장주", "결제 플랫폼주", "관련주" 등
- 메타·도입·질문·자기소개 문장 절대 금지
  ❌ "어디에 투자해야 할지 고민되시나요?"
  ❌ "이 글에서는 ...를 분석합니다"
  ❌ "투자자들의 관심이 집중되고 있습니다" (구체성 없음)
- 종결: "~합의했습니다", "~기대감이 확산되고 있습니다", "~수혜가 예상됩니다", "~급등했습니다"
- 숫자(%·억원)는 가능하면 생략 — 단 사건 핵심이면 1개까지 OK

============================================================
출력 2: headerTitle (쇼츠 letterbox + hook scene 타이틀)
============================================================
**반드시 블로그 제목을 기반**으로 만들 것. 본문에서 임의로 다른 키워드를
추출하지 말고, 글 제목의 핵심 명사를 그대로 보존하면서 **자연스럽게 2줄로**
분리합니다.

⚠️ headerTitle 규칙 (강제)
- 줄바꿈은 **리터럴 \\n** (역슬래시 + n)
- **1줄**: 글 제목의 키워드 부분 + 맥락 단어
  · 글 제목에서 "관련주 TOP N", "| 대장주·수혜주·테마주 총정리" 부분 제거
  · 남은 키워드를 자연스럽게 연결 ("과", "와", "·" 등)
  · 끝에 맥락 단어 1개 추가: "이슈" / "기대감" / "사건" / "합의" / "발표" / "급등"
- **2줄**: 반드시 "관련주 TOP {N}" 형식
  · N은 user prompt에서 명시되는 **stockCount** 값을 그대로 사용 (글 제목의 N과 다를 수 있음)
  · 절대 임의 숫자 쓰지 말 것
- **개별 종목명 절대 사용 금지** (카카오페이, 다날 등) — 글 제목의 테마 키워드만 사용
- 각 줄 최대 16자 이내 권장 (letterbox 폭 제약)

============================================================
좋은 예시 (hook + headerTitle 쌍)
============================================================
글 제목: "스테이블코인 에이전틱 AI 관련주 TOP 6"
stockCount: 6
입력 핵심 요약: (국내 결제 플랫폼이 X402 재단에 합류 ...)
출력:
{
  "hook": "국내 결제 플랫폼주가 에이전틱 AI 결제 글로벌 표준 X402 재단에 합류하며 스테이블코인 결합 자동결제 수혜주로 부각됐습니다.",
  "headerTitle": "스테이블코인과 에이전틱 AI 이슈\\n관련주 TOP 6"
}

글 제목: "미·이란 2주 휴전 속, 중동 재건 관련주 TOP 12"
stockCount: 7
입력 핵심 요약: (4월 8일 미국과 이란 휴전 합의 ...)
출력:
{
  "hook": "미국과 이란이 2주 휴전에 합의하면서 중동 재건 기대감에 한국 건설주가 핵심 수혜주로 부각되고 있습니다.",
  "headerTitle": "미·이란 2주 휴전 합의\\n관련주 TOP 7"
}

글 제목: "엔비디아 광통신 실리콘 포토닉스 관련주 TOP 24"
stockCount: 7
입력 핵심 요약: (엔비디아 AI 칩 광통신 수요 폭증 ...)
출력:
{
  "hook": "엔비디아 AI 칩 성능을 100% 활용하기 위한 광통신·실리콘 포토닉스 기술 수혜주가 부각되고 있습니다.",
  "headerTitle": "엔비디아 광통신 실리콘 포토닉스\\n관련주 TOP 7"
}

============================================================
응답 형식
============================================================
반드시 아래 JSON 형식만 (다른 텍스트 절대 금지):
{"hook": "...", "headerTitle": "..."}
`;

export async function summarizeHookForShorts(
  title: string,
  hookSectionText: string,
  stockCount: number,
): Promise<HookGenerationResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY 누락 (.env.local 확인)");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
    },
  });

  const userPrompt = `블로그 제목: ${title}
stockCount: ${stockCount}

핵심 요약 섹션 원문:
${hookSectionText}

위 내용으로 hook(60~85자 1문장, **개별 종목명 사용 금지**)과
headerTitle(2줄, 1줄=글 제목 키워드+맥락, 2줄=정확히 "관련주 TOP ${stockCount}")을
JSON으로 응답하세요.`;

  const response = await model.generateContent(userPrompt);
  const text = response.response.text();

  const parsed = parseHookJson(text);
  if (!parsed) {
    throw new Error(`Gemini hook 요약 응답 파싱 실패: ${text.slice(0, 200)}`);
  }
  // Normalize: Gemini sometimes outputs real newlines vs literal "\n" — accept both
  const headerTitle = parsed.headerTitle.replace(/\\n/g, "\n");
  return {
    hook: parsed.hook.trim(),
    headerTitle: headerTitle.trim(),
  };
}

function parseHookJson(text: string): { hook: string; headerTitle: string } | null {
  const tryParse = (s: string): { hook: string; headerTitle: string } | null => {
    try {
      const obj = JSON.parse(s) as { hook?: unknown; headerTitle?: unknown };
      if (obj && typeof obj.hook === "string" && typeof obj.headerTitle === "string") {
        return { hook: obj.hook, headerTitle: obj.headerTitle };
      }
    } catch {}
    return null;
  };

  // Strategy 1: direct
  const direct = tryParse(text);
  if (direct) return direct;

  // Strategy 2: strip code fences + escape raw newlines inside string literals
  // (Gemini occasionally pretty-prints multi-line JSON, putting actual \n
  // characters inside the "hook"/"headerTitle" string values, which makes
  // standard JSON.parse fail with "Bad control character in string literal".)
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const escapedNewlines = escapeRawNewlinesInJsonStrings(stripped);
  const fenced = tryParse(escapedNewlines);
  if (fenced) return fenced;

  // Strategy 3: extract first {...}
  const start = escapedNewlines.indexOf("{");
  const end = escapedNewlines.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = escapedNewlines.slice(start, end + 1);
    const sliced = tryParse(slice);
    if (sliced) return sliced;
  }

  // Strategy 4: regex extract "hook" + "headerTitle" separately (last resort).
  // Run on the raw text (with multi-line dot-all flag) so newlines inside
  // string values are tolerated.
  const hookMatch = /"hook"\s*:\s*"([\s\S]*?)(?<!\\)"/m.exec(stripped);
  const headerMatch = /"headerTitle"\s*:\s*"([\s\S]*?)(?<!\\)"/m.exec(stripped);
  if (hookMatch && headerMatch) {
    return {
      hook: hookMatch[1].replace(/\\"/g, '"').replace(/\n/g, " "),
      headerTitle: headerMatch[1].replace(/\\"/g, '"'),
    };
  }

  return null;
}

/**
 * Escape raw newlines (and \r) that appear *inside* JSON string literals.
 *
 * Gemini sometimes returns JSON like this:
 *   {
 *     "hook": "긴 문장
 *   계속되는 텍스트",
 *     "headerTitle": "제목\n2줄"
 *   }
 *
 * The literal \n inside "headerTitle" is fine (escaped), but the raw newline
 * inside "hook" makes JSON.parse throw. This function walks the string with
 * a tiny state machine and replaces raw newlines that occur while we're
 * inside a double-quoted string with the escape sequence \n.
 */
function escapeRawNewlinesInJsonStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString && ch === "\n") {
      out += "\\n";
      continue;
    }
    if (inString && ch === "\r") {
      // strip carriage returns inside strings (Windows line endings)
      continue;
    }
    out += ch;
  }
  return out;
}
