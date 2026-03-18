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

## 중요: 최신 정보 기반 작성
- 키워드와 관련된 **가장 최근 뉴스, 발표, 이벤트**를 기반으로 글을 작성하세요.
- 과거 정보가 아닌 **현재 시점(오늘 날짜 기준)**의 최신 동향을 반영해야 합니다.
- 예: "엔비디아 GTC 2026"이면 2024년이 아닌 **2026년 GTC** 내용을 다루세요.
- 확인되지 않은 미래 정보는 "~할 것으로 전망됩니다", "~예정입니다" 등으로 표현하세요.

## 글쓰기 스타일
- **자연스러운 서술형 어투**: "~입니다", "~인데요", "~볼 수 있습니다" 등 전문적이면서도 읽기 편한 톤
- **짧은 문단**: 한 문단은 2-3문장, 가독성을 최우선으로
- 강조 표현 규칙 (매우 중요):
  - 볼드(별표 두개)는 절대 사용하지 마세요.
  - 정말 중요한 핵심 수치, 핵심 키워드만 mark 태그(<mark>텍스트</mark>)로 노란색 하이라이트 처리하세요.
  - 예: <mark>HBM4 메모리</mark>, <mark>연평균 60% 성장</mark>
  - 하이라이트는 문단당 최대 1~2개만 사용하세요. 남용하면 가독성이 떨어집니다.
  - 종목명은 하이라이트 하지 마세요. 종목명은 그냥 텍스트로 쓰세요.
- **표(테이블) 활용**: 관련주를 한눈에 비교할 수 있도록 마크다운 테이블 포함
- **체크리스트 활용**: 투자 주의사항이나 핵심 포인트를 ✔ 기호로 정리하면 가독성 향상

## 콘텐츠 품질 기준 (AdSense 준수 필수)

### 반드시 지켜야 할 사항
1. **충분한 분량**: 본문은 최소 2,000자(한글 기준) 이상이어야 합니다.
2. **독창적 분석**: 단순 사실 나열이 아닌, 원인·배경·전망을 포함한 심층 분석을 제공합니다.
3. **구체적 데이터 언급**: 수치, 비율, 전년 대비 변화율 등 구체적 데이터를 포함합니다.
4. **전문적이면서 읽기 쉬운 문체**: 금융 전문 용어를 사용하되 괄호 안에 쉬운 설명을 병기합니다.
5. **투자 면책 고지**: 글 끝에 반드시 면책 조항을 포함합니다.
6. **관련주 선정 (매우 중요 — 반드시 아래 규칙을 모두 준수)**:
   - 키워드와 **직접적으로 연관된** 종목 5~7개를 선정합니다.
   - **선정 필수 조건 (3가지 모두 충족해야 함)**:
     ① **실제 한국 상장기업**이어야 합니다. 비상장, 외국기업, 존재하지 않는 기업 절대 금지.
     ② **해당 키워드 관련 뉴스/기사에서 실제로 "관련주", "수혜주", "테마주"로 언급된 종목**이어야 합니다.
     ③ **해당 키워드와 직결되는 사업이 매출의 상당 부분을 차지**해야 합니다.
   - **절대 금지 종목**: 삼성전자, 현대차, 기아, LG전자, SK하이닉스, 네이버, 카카오, 현대로템, 포스코홀딩스, 한화에어로스페이스, SK이노베이션, LG화학, 현대모비스
     → 이 종목들은 사업이 너무 다각화되어 어떤 테마에도 끼워넣을 수 있으므로 분석 가치 없음.
   - **중소형 전문기업을 절반 이상** 포함하세요.
   - 확신이 없는 종목은 넣지 마세요. 5개의 확실한 관련주가 7개의 애매한 관련주보다 낫습니다.
   - 예: "스페이스X" → 쎄트렉아이(위성제조), AP위성(위성통신), 이노스페이스(민간발사체), 한화시스템(위성체), 인텔리안테크(위성안테나)
   - 예: "2차전지" → 에코프로비엠(양극재), 엘앤에프(양극재), 성일하이텍(리사이클링), 포스코퓨처엠(양극재)

### 절대 금지 사항 (AdSense 정책 위반)
- 특정 종목의 매수/매도를 직접 권유하는 문구
- 확정적 수익률 보장 표현 ("반드시 오른다", "100% 수익" 등)
- 허위 또는 과장된 정보
- 클릭베이트 제목 (과도한 감탄사, 자극적 표현)
- 저품질 자동 생성 느낌의 반복적 문구

## SEO 최적화 규칙
1. **제목**: 반드시 "{키워드} 관련주 TOP {N}" 형식으로 작성. N은 related_stocks에 포함된 종목 수와 일치해야 합니다. 예: "스페이스X 관련주 TOP 5", "반도체 관련주 TOP 7"
2. **메타 설명**: 150-160자, 핵심 내용 요약, 클릭을 유도하는 서술
3. **헤더 구조**: H2(##)를 주요 섹션에, H3(###)를 하위 섹션에 사용
4. **키워드 밀도**: 본문에서 메인 키워드가 자연스럽게 3-5회 등장
5. **내부 링크 유도**: 관련 주제 언급 시 "~에 대해서는 별도 분석이 필요합니다" 등 후속 콘텐츠 유도
6. **카테고리**: 항상 "핫이슈"로 설정

## 출력 형식

반드시 아래 형식으로 출력하십시오. 구분자를 정확히 사용하세요.

---FRONTMATTER---
title: ({키워드} 관련주 TOP {N} 형식, N은 관련주 개수)
description: (150-160자 메타 설명)
category: 핫이슈
tags: tag1, tag2, tag3, tag4, tag5
related_stocks: 종목1, 종목2, 종목3, ...
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
  const today = new Date().toISOString().slice(0, 10);
  let prompt = `아래 키워드에 대한 한국 주식 시장 블로그 포스트를 작성해 주세요.

**오늘 날짜**: ${today}
**키워드**: ${keyword}
**카테고리**: ${category}

⚠️ 반드시 오늘 날짜 기준 최신 정보와 뉴스를 바탕으로 작성하세요. 과거 이벤트를 현재처럼 쓰지 마세요.
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
   - 테이블 아래에 각 종목을 **### N. 종목명** (H3) 형식으로 개별 분석:
     ### 1. 종목명
     왜 수혜주인지, 관련 사업 내용, 투자 포인트를 2-3문단으로 구체적 설명
     ### 2. 종목명
     ...
   - 반드시 ### (H3) 헤딩을 사용하세요. **볼드**가 아닌 ### 헤딩입니다.
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

  const tagsRaw = getValue("tags");
  const tags: readonly string[] = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [keyword];

  const relatedStocksRaw = getValue("related_stocks");
  const relatedStocks: readonly string[] = relatedStocksRaw
    ? relatedStocksRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // 제목: 항상 "키워드 관련주 TOP N" 형식으로 강제
  const stockCount = relatedStocks.length || 5;
  const title = `${keyword} 관련주 TOP ${stockCount}`;

  const description =
    getValue("description") ||
    `${keyword} 관련주 TOP ${stockCount} 종목을 심층 분석했습니다. 수혜주와 투자 포인트를 정리합니다.`;

  // 카테고리: 항상 "핫이슈"로 고정
  const category = "핫이슈";

  if (content.length < 500) {
    throw new Error(
      `Generated content is too short (${content.length} chars). Minimum is 1500 chars for AdSense compliance.`,
    );
  }

  return { title, description, category, tags, content, relatedStocks };
}
