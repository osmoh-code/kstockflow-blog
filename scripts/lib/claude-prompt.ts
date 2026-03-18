/**
 * Master prompt template for Claude API — Korean stock market blog content generation.
 *
 * This file defines the system prompt and user prompt builders that enforce
 * AdSense-safe, SEO-optimized, high-quality Korean financial content.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedPost {
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly relatedStocks: readonly string[];
}

export interface PromptPair {
  readonly system: string;
  readonly user: string;
}

// ---------------------------------------------------------------------------
// Category detection keywords (updated: 신규주 분석, 재료와 테마 뉴스)
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  "주식특징주": [
    "특징주", "급등", "상한가", "테마주", "대장주", "관련주", "수혜주",
  ],
  "핫이슈": [
    "이슈", "뉴스", "속보", "논란", "사건", "이벤트", "화제",
  ],
  "신규주 분석": [
    "신규", "IPO", "상장", "공모주", "청약", "신규상장", "스팩",
  ],
  "재료와 테마 뉴스": [
    "재료", "테마", "정책", "금리", "환율", "GDP", "물가", "경제",
    "한국은행", "연준", "Fed", "수출", "반도체", "AI", "배터리",
    "전기차", "바이오", "원전", "수소", "로봇", "드론", "방산",
  ],
} as const;

const CATEGORY_SLUGS: Record<string, string> = {
  "주식특징주": "featured-stocks",
  "핫이슈": "hot-issues",
  "신규주 분석": "new-stocks",
  "재료와 테마 뉴스": "theme-news",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function detectCategory(keyword: string): string {
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => keyword.includes(w))) {
      return category;
    }
  }
  return "재료와 테마 뉴스"; // sensible default
}

export function getCategorySlug(categoryName: string): string {
  return CATEGORY_SLUGS[categoryName] ?? "theme-news";
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `당신은 한국 주식 시장 전문 애널리스트이자 금융 블로그 작가입니다.

## 역할
- 한국 증시에 대한 깊이 있는 재료 기반 분석과 인사이트를 제공합니다.
- 종목에 영향을 미치는 핵심 재료(실적, 정책, 산업 트렌드 등)를 파악하고 분석합니다.
- 개인 투자자가 이해하기 쉬운 전문 콘텐츠를 생산합니다.

## 글쓰기 스타일
- **자연스러운 서술형 어투**: "~입니다", "~인데요", "~볼 수 있습니다" 등 전문적이면서도 읽기 편한 톤
- **짧은 문단**: 한 문단은 2-3문장, 가독성을 최우선으로
- **강조 표현**: 핵심 수치, 종목명, 주요 개념은 **볼드** 처리
- **표(테이블) 활용**: 관련주를 한눈에 비교할 수 있도록 마크다운 테이블 포함
- **체크리스트 활용**: 투자 주의사항이나 핵심 포인트를 ✔ 기호로 정리하면 가독성 향상

## 콘텐츠 품질 기준 (AdSense 준수 필수)

### 반드시 지켜야 할 사항
1. **충분한 분량**: 본문은 최소 2,000자(한글 기준) 이상이어야 합니다.
2. **독창적 분석**: 단순 사실 나열이 아닌, 원인·배경·전망을 포함한 심층 분석을 제공합니다.
3. **구체적 데이터 언급**: 수치, 비율, 전년 대비 변화율 등 구체적 데이터를 포함합니다.
4. **전문적이면서 읽기 쉬운 문체**: 금융 전문 용어를 사용하되 괄호 안에 쉬운 설명을 병기합니다.
5. **투자 면책 고지**: 글 끝에 반드시 면책 조항을 포함합니다.
6. **관련주 언급**: 키워드와 관련된 핵심 종목 3~5개를 반드시 언급하고, 각 종목이 왜 관련되는지 설명합니다.

### 절대 금지 사항 (AdSense 정책 위반)
- 특정 종목의 매수/매도를 직접 권유하는 문구
- 확정적 수익률 보장 표현 ("반드시 오른다", "100% 수익" 등)
- 허위 또는 과장된 정보
- 클릭베이트 제목 (과도한 감탄사, 자극적 표현)
- 저품질 자동 생성 느낌의 반복적 문구

## SEO 최적화 규칙
1. **제목**: 키워드를 자연스럽게 포함, 40-60자 이내. "~관련주 TOP5", "~수혜주 총정리" 등 검색 친화적 패턴 활용
2. **메타 설명**: 150-160자, 핵심 내용 요약, 클릭을 유도하는 서술
3. **헤더 구조**: H2(##)를 주요 섹션에, H3(###)를 하위 섹션에 사용
4. **키워드 밀도**: 본문에서 메인 키워드가 자연스럽게 3-5회 등장
5. **내부 링크 유도**: 관련 주제 언급 시 "~에 대해서는 별도 분석이 필요합니다" 등 후속 콘텐츠 유도

## 출력 형식

반드시 아래 형식으로 출력하십시오. 구분자를 정확히 사용하세요.

---FRONTMATTER---
title: (SEO 최적화된 제목)
description: (150-160자 메타 설명)
category: (카테고리명)
tags: tag1, tag2, tag3, tag4, tag5
related_stocks: 종목1, 종목2, 종목3
---CONTENT---
(마크다운 본문)
`;

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

function buildUserPrompt(
  keyword: string,
  category: string,
  stockContext?: string
): string {
  let prompt = `아래 키워드에 대한 한국 주식 시장 블로그 포스트를 작성해 주세요.

**키워드**: ${keyword}
**카테고리**: ${category}
`;

  // 주식 실시간 데이터가 있으면 포함
  if (stockContext) {
    prompt += `
## 참고: 관련주 실시간 시세 데이터
아래 데이터를 분석에 활용하세요. 실제 시세 데이터이므로 정확한 수치를 본문에 포함해 주세요.

${stockContext}
`;
  }

  prompt += `
## 필수 본문 구조 (이 순서를 반드시 따르세요)

1. **## 핵심 요약**
   - 해당 키워드에 대한 개요를 2-3문단으로 작성
   - 왜 지금 이 주제가 중요한지 배경 설명
   - 시장에 미치는 영향 흐름을 간결하게 정리 (예: "A → B → C → 증시 영향")

2. **## 상세 분석**
   - 구체적 데이터와 함께 심층 분석 (3문단 이상)
   - 관련 산업/기업/정책 동향 포함
   - 핵심 재료가 종목에 미치는 영향 분석

3. **## 관련주 분석**
   - 먼저 마크다운 테이블로 관련주를 한눈에 정리:
     | 구분 | 종목 | 핵심 포인트 |
     |------|------|-------------|
   - 테이블 아래에 각 종목을 개별 분석:
     **1. 종목명** — 왜 수혜주인지 2-3문장으로 구체적 설명
     **2. 종목명** — ...
   - 실적, 사업 구조, 시장 점유율 등 근거 포함
   ${stockContext ? "- 위에 제공된 시세 데이터를 활용하여 현재가, 등락률, PER 등 수치 코멘트 추가" : ""}

4. **## 투자 시 체크포인트**
   - 주의사항과 리스크를 체크리스트 형식으로 정리:
     ✔ 단기 테마인지, 실적 개선 구간인지 구분
     ✔ 관련 지표 동반 확인
     ✔ 리스크 해소 시 급락 가능성 대비
   - 각 항목에 대해 1-2문장 부연 설명

5. **## 결론**
   - 전체 내용 요약 및 향후 주시할 포인트
   - 투자 면책 고지 (blockquote 형식): "> ※ 본 글은 정보 제공을 목적으로 하며, 투자의 책임은 투자자 본인에게 있습니다."

## 추가 지침
- 짧은 문단 유지 (한 문단 2-3문장), 가독성 극대화
- 전체 본문은 최소 2,000자(한글) 이상
- related_stocks에는 본문에서 언급한 종목명을 콤마로 구분하여 정확히 기재
- tags는 키워드 관련 5개를 콤마로 구분하여 제공
- 핵심 수치나 종목명은 **볼드** 처리`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildPrompt(keyword: string, stockContext?: string): PromptPair {
  const category = detectCategory(keyword);
  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(keyword, category, stockContext),
  };
}

/**
 * Parse the structured Claude response into a GeneratedPost object.
 * Throws if the response does not contain the expected delimiters.
 */
export function parseResponse(raw: string, keyword: string): GeneratedPost {
  const frontmatterMatch = raw.match(
    /---FRONTMATTER---([\s\S]*?)---CONTENT---/,
  );
  if (!frontmatterMatch) {
    throw new Error(
      "Claude response did not contain expected ---FRONTMATTER--- / ---CONTENT--- delimiters.",
    );
  }

  const frontmatterBlock = frontmatterMatch[1].trim();
  const content = raw.split("---CONTENT---")[1]?.trim() ?? "";

  // Parse frontmatter key-value pairs
  const getValue = (key: string): string => {
    const match = frontmatterBlock.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match?.[1]?.trim() ?? "";
  };

  const title = getValue("title") || `${keyword} — 분석 및 전망`;
  const description =
    getValue("description") ||
    `${keyword}에 대한 심층 분석과 투자 포인트를 정리했습니다.`;
  const category = getValue("category") || detectCategory(keyword);
  const tagsRaw = getValue("tags");
  const tags: readonly string[] = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [keyword];

  const relatedStocksRaw = getValue("related_stocks");
  const relatedStocks: readonly string[] = relatedStocksRaw
    ? relatedStocksRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (content.length < 500) {
    throw new Error(
      `Generated content is too short (${content.length} chars). Minimum is 1500 chars for AdSense compliance.`,
    );
  }

  return { title, description, category, tags, content, relatedStocks };
}
