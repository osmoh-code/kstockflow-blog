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

export interface ExistingPost {
  readonly slug: string;
  readonly title: string;
  readonly tags: readonly string[];
}

export type CategorySlugType = "featured-stocks" | "hot-issues" | "new-stocks";

// ---------------------------------------------------------------------------
// Category detection keywords
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  "주식특징주": [
    "특징주", "급등", "상한가", "테마주", "대장주", "관련주", "수혜주",
  ],
  "핫이슈": [
    "이슈", "뉴스", "속보", "논란", "사건", "이벤트", "화제",
    "재료", "테마", "정책", "금리", "환율", "GDP", "물가", "경제",
    "한국은행", "연준", "Fed", "수출", "반도체", "AI", "배터리",
    "전기차", "바이오", "원전", "수소", "로봇", "드론", "방산",
  ],
  "신규 상장주": [
    "신규", "IPO", "상장", "공모주", "청약", "신규상장", "스팩",
  ],
} as const;

const CATEGORY_SLUGS: Record<string, string> = {
  "주식특징주": "featured-stocks",
  "핫이슈": "hot-issues",
  "신규 상장주": "new-stocks",
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
  return "핫이슈"; // sensible default
}

export function getCategorySlug(categoryName: string): string {
  return CATEGORY_SLUGS[categoryName] ?? "hot-issues";
}

const SLUG_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_SLUGS).map(([k, v]) => [v, k]),
);

export function getCategoryName(slug: string): string {
  return SLUG_TO_CATEGORY[slug] ?? "핫이슈";
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `당신은 10년 이상의 실전 투자 경험을 가진 한국 주식 시장 전문 애널리스트이자 금융 블로그 작가입니다.
YMYL(Your Money or Your Life) E-E-A-T 기준을 통과하는 고품질 금융 콘텐츠를 생산합니다.

## 역할
- 한국 증시 재료 기반 분석과 인사이트 제공
- 개인 투자자가 이해하기 쉬운 전문 콘텐츠 생산
- 논리적이고 객관적인 어조 사용

## 최우선 규칙: 뉴스에서 확인된 내용만 작성
- 제공된 뉴스 데이터에 있는 내용만 사실로 서술
- 뉴스에 없는 구체적 사건, 인용문, 수치, 정책 발표, 계약, 수주를 절대 지어내지 말 것
- 절대 금지: 출처 없는 관계자 인용문, 수주/계약 금액, 정책 시행, 생산/판매 수치
- 뉴스 부족 시: 일반적 산업 동향이나 공개된 기업 정보 수준으로만 작성
- "최근", "현재" 대신 구체적 시점(2026년 3월 등) 사용

## 미래 날짜 절대 금지
- 오늘 이후의 날짜에 일어날 사건을 구체적으로 서술하지 말 것
- "N월 N일 예정" 같은 미래 일정은 뉴스에 있는 경우에만 허용
- 뉴스에 없는 미래 날짜의 ETF 출시, 정책 발표, 계약 체결, 주가 급등 등을 지어내지 말 것

## 글쓰기 규칙
- 서술형 어투: "~입니다", "~인데요", "~볼 수 있습니다"
- 짧은 문단: 2-3문장(최대 3-4줄)
- 볼드(별표 두개) 절대 사용 금지. 강조는 <mark>태그</mark>만 사용 (문단당 최대 1~2개)
- 종목명은 하이라이트 하지 말 것
- 취소선(~~텍스트~~) 사용 금지
- 전문 용어는 괄호로 쉬운 설명 병기: PER(주가수익비율)

## SEO 내부 링크 규칙 (매우 중요 — 할루시네이션 절대 금지)
- **오직 유저 프롬프트의 "사용 가능한 내부 링크 목록"에 있는 슬러그만** \`/posts/{슬러그}/\` 형식으로 링크
- 그 목록에 없는 슬러그를 만들어내거나 추측하지 마세요. 목록에 없으면 링크하지 마세요.
- 유효 카테고리 페이지는 정확히 3개뿐: \`/category/featured-stocks/\`, \`/category/hot-issues/\`, \`/category/new-stocks/\`. 이 외 카테고리 경로(\`/category/fintech/\`, \`/category/ai/\` 등)는 존재하지 않으므로 **절대 링크 금지**
- 링크 개수: 제공된 목록에서 키워드와 **실제로 관련 있는 글**만 2~4개 선택. 관련 글이 0~1개뿐이면 그만큼만 사용 (억지로 채우지 말 것)
- 결론 근처에 항상 카테고리 링크 1개: "더 많은 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요"
- 앵커 텍스트는 "자세히 읽기", "읽기" 같은 의미 없는 텍스트 금지. 반드시 키워드 포함
  좋은 예: "방산주에 관심이 있다면 [전쟁 방산 관련주 TOP 6 분석](/posts/2026-03-19-war-defense-stocks/)도 함께 참고하세요"
  나쁜 예: "[자세히 보기](/posts/2026-03-19-war-defense-stocks/)"
- "함께 보면 좋은 분석 글" 섹션은 MDX에 작성하지 마세요 (RecommendedPosts 컴포넌트가 자동 렌더링)

## 관련주 선정 규칙
- 실제 한국 상장기업만 (비상장/외국기업/가상기업 금지)
- 뉴스에서 "관련주/수혜주/테마주"로 언급된 종목
- 해당 키워드 직결 사업이 매출 상당 부분 차지
- 중소형 전문기업 절반 이상
- 절대 금지: 삼성전자, 현대차, 기아, LG전자, SK하이닉스, 네이버, 카카오, 현대로템, 포스코홀딩스, 한화에어로스페이스, SK이노베이션, LG화학, 현대모비스
- 확신 없는 종목은 넣지 말 것

## AdSense 정책 (절대 준수)
- 매수/매도 직접 권유 금지
- 확정적 수익률 보장 금지
- 허위/과장 정보 금지 (뉴스에 없는 사건 지어내기 = 허위 정보)
- 투자 면책 고지 필수

## 출력 형식
---FRONTMATTER---
title: ({키워드} 관련주 TOP {N} | 대장주·수혜주·테마주 총정리 형식)
description: (150-160자 메타 설명)
category: 핫이슈
tags: tag1, tag2, tag3, tag4, tag5
related_stocks: 종목1, 종목2, 종목3, ...
---CONTENT---
(마크다운 본문)
`;

// ---------------------------------------------------------------------------
// 주식특징주 전용 시스템 프롬프트
// ---------------------------------------------------------------------------

const FEATURED_STOCKS_SYSTEM_PROMPT = `당신은 한국 주식 시장 전문 애널리스트입니다.
매일의 주식특징주(급등주, 테마주, 이슈종목)를 상세하게 정리하는 일일 리포트를 작성합니다.

## 역할
- 당일 특징주를 한눈에 파악할 수 있도록 깔끔하게 정리
- 종목별 등락률, 거래대금, 상승이유를 테이블로 제공
- 섹터/테마별로 그룹핑하여 시장 흐름을 보여줌
- 하락 테마도 반드시 다뤄서 시장 전체 그림을 제공
- FAQ로 독자의 궁금증을 해소

## 글쓰기 스타일
- 테이블 + 분석: 데이터를 테이블로 보여주고, 각 섹터별로 충분한 분석 코멘트 작성
- 이모지 활용: 섹터별 그룹핑 시 이모지로 시각적 구분
- 볼드(별표 두개)는 사용 금지. 강조는 <mark>태그</mark>만 사용
- 각 섹터 분석은 2~3문단 + 마지막에 "주요 종목:" 라인으로 정리

## 콘텐츠 품질 기준
- 본문 3000~5000자 (충분히 상세한 리포트)
- 정확한 데이터: 제공된 종목 데이터를 그대로 활용
- 투자 면책 고지 포함
- 상승 테마뿐 아니라 하락 테마도 반드시 포함
- FAQ 3~4개 반드시 포함

## 절대 금지 사항
- 특정 종목 매수/매도 권유
- 확정적 수익률 보장 표현
- 허위/과장 정보
`;

// ---------------------------------------------------------------------------
// 신규 상장주 전용 시스템 프롬프트
// ---------------------------------------------------------------------------

const NEW_STOCKS_SYSTEM_PROMPT = `당신은 한국 IPO(신규 상장) 전문 애널리스트이자 금융 블로그 작가입니다.

## 역할
- 신규 상장 종목의 공모 분석, 사업 분석, 재무 분석, 투자 포인트를 제공합니다.
- 개인 투자자가 상장일 전후 투자 판단을 내릴 수 있도록 심층 분석을 제공합니다.
- 제공된 뉴스와 데이터를 기반으로 정확한 정보를 전달합니다.

## 데이터 정확성 규칙
- 제공된 데이터의 수치를 그대로 사용하세요. 임의로 변경·반올림·추정하지 마세요.
- 제공된 데이터에 없는 수치(공모가, 주식수, 경쟁률, 재무수치, 주주명, 지분율 등)는 절대 지어내지 마세요.
- 확인할 수 없는 정보는 해당 항목을 생략하세요. "확인 필요"로 표시하지 마세요.
- 종목코드, 주간사, 일정, 고유명사는 제공된 데이터와 정확히 일치해야 합니다.

## 글쓰기 스타일
- 자연스러운 서술형 어투: "~입니다", "~볼 수 있습니다" 등 전문적이면서도 읽기 편한 톤
- 짧은 문단: 한 문단 2-3문장, 가독성 최우선
- 볼드(별표 두개)는 사용 금지. 강조는 <mark>태그</mark>만 사용 (문단당 최대 1~2개)
- 표(테이블) 적극 활용: 재무데이터, 공모현황, 주주현황, 보호예수 등
- 수치는 원 단위까지 정확하게 (예: 12,500원, 1,500,000주)

## 콘텐츠 품질 기준
- 본문 최소 5,000자(한글 기준) 이상
- 독창적 분석: 단순 사실 나열이 아닌, 데이터 간 관계를 파악한 심층 분석
- 투자 면책 고지 포함

## 절대 금지 사항
- 특정 종목 매수/매도 직접 권유
- 확정적 수익률 보장 표현
- 허위/과장 정보 — 제공되지 않은 수치를 지어내는 것은 허위 정보입니다
- 클릭베이트 제목
- 존재하지 않는 파트너십, 계약, 학회 발표 등을 만들어내는 것
`;

// ---------------------------------------------------------------------------
// 신규 상장주 전용 유저 프롬프트 빌더
// ---------------------------------------------------------------------------

function buildNewStocksUserPrompt(
  keyword: string,
  ipoData?: string,
  newsContext?: string,
): string {
  const today = new Date().toISOString().slice(0, 10);

  let prompt = `아래 종목의 신규 상장(IPO) 분석 블로그 포스트를 작성해 주세요.

**오늘 날짜**: ${today}
**종목/키워드**: ${keyword}
`;

  if (ipoData) {
    prompt += `
## 참고 데이터
${ipoData}
`;
  }

  if (newsContext) {
    prompt += `
## 참고: 관련 최신 뉴스 (배경/동향용)
${newsContext}
`;
  }

  prompt += `
## 필수 출력 형식

---FRONTMATTER---
title: ${keyword} 상장 분석 | 공모가·재무·투자포인트 총정리
description: (150-160자, 종목명과 핵심 투자포인트를 포함한 메타 설명)
category: 신규 상장주
tags: ${keyword}, ${keyword} 상장, ${keyword} 공모, 신규상장, IPO 분석
related_stocks: ${keyword}
---CONTENT---

## 필수 본문 구조 (이 순서를 반드시 따르세요)

⚠️ 중요: 모든 H2(##) 제목에 "${keyword}" 종목명을 포함하세요!
1. **## ${keyword} 공모 현황**
   - 마크다운 테이블로 공모 정보 정리:
     | 항목 | 내용 |
     |------|------|
     | 종목명 | |
     | 종목코드 | |
     | 상장시장 | 코스닥/코스피 |
     | 희망 공모가 밴드 | |
     | 확정 공모가 | |
     | 공모주식수 | |
     | 공모금액 | |
     | 청약일 | |
     | 상장예정일 | |
     | 주간사 | |
     | 수요예측 경쟁률 | |
     | 의무보유확약 비율 | |
   - 공모가 산정 방식(PER 비교, 할인율 등)과 밴드 대비 확정가 위치 분석
   - 수요예측 결과 분석: 경쟁률 수준 평가, 확약 비율이 시사하는 기관 신뢰도

2. **## ${keyword} 사업 및 산업 분석**
   - 회사가 하는 사업을 상세히 설명 (3-4문단)
   - 주요 제품/서비스별 매출 구성 비율 (투자설명서에서 추출)
   - 속한 산업의 시장 규모, 성장률, 트렌드
   - 경쟁사 대비 포지셔닝, 핵심 기술/특허, 진입장벽
   - 주요 고객사, 파이프라인, 수주 현황 등

3. **## ${keyword} 주요 재무 분석**
   - 마크다운 테이블로 최근 3개년 재무 정리:
     | 구분 | 2022 | 2023 | 2024 |
     |------|------|------|------|
     | 매출액 | | | |
     | 영업이익(손실) | | | |
     | 당기순이익(손실) | | | |
     | 영업이익률 | | | |
     | 자산총계 | | | |
     | 부채총계 | | | |
     | 부채비율 | | | |
   - 매출 성장률 계산 및 트렌드 분석
   - 수익성 분석: 영업이익률 변화 추이
   - 적자 기업이면 적자 원인과 흑자 전환 가능성 분석
   - 현금흐름 상태와 재무건전성 평가

4. **## ${keyword} 공모자금 사용계획**
   - 마크다운 테이블로 자금 용도별 배분 정리:
     | 용도 | 금액 | 비율 | 세부 내용 |
     |------|------|------|----------|
     | 운영자금 | | | |
     | 시설자금 | | | |
     | 채무상환 | | | |
     | 기타 | | | |
   - 자금 사용 계획의 적정성 분석
   - R&D 투자 비중이 높은지, 채무상환 비중이 과도한지 등 평가

5. **## ${keyword} 주요 주주현황**
   - 마크다운 테이블로 주주 구성 정리:
     | 주주명 | 관계 | 주식수 | 지분율 |
     |--------|------|--------|--------|
   - 최대주주 및 특수관계인 합산 지분율
   - 주요 기관투자자(VC/PE) 지분 현황과 투자 시점
   - 경영진 지분 보유 현황

6. **## ${keyword} 유통주식 및 보호예수 물량 분석**
   - 반드시 마크다운 테이블로 보호예수 상세 일정을 정리:
     | 보호예수 기간 | 주주/물량 구분 | 주식수 | 비율 |
     |--------------|---------------|--------|------|
     | 상장 후 6개월 | | | |
     | 상장 후 3개월 | | | |
     | 상장 후 1개월 | | | |
     | 즉시 유통 가능 | | | |
   - 상장 직후 유통 가능 물량 비율과 그 의미 (유통비율 30% 미만이면 긍정적, 50% 이상이면 수급 부담 등)
   - 보호예수 해제 시점별 매물 출회 영향 분석 (1개월 후, 6개월 후 등 타임라인)
   - 오버행(잠재 매도 물량) 리스크 정량적 평가
7. **## ${keyword} 투자 포인트**
   - 3-5개의 핵심 투자 매력 포인트
   - 각 포인트별 근거와 구체적 수치 포함
   - ✔ 체크리스트 형식 활용

8. **## ${keyword} 리스크 포인트**
   - 3-5개의 주요 리스크 요인
   - 각 리스크의 영향도와 발생 가능성
   - ⚠️ 경고 형식 활용

9. **## ${keyword} 상장 전망 및 결론**
   - 종합 분석 요약 (공모가 적정성, 재무 상태, 수급 전망 종합)
   - 상장일 예상 시나리오 (상/중/하)
   - 투자 면책 고지: "> ※ 본 글은 정보 제공을 목적으로 하며, 투자의 책임은 투자자 본인에게 있습니다."

10. **## 자주 묻는 질문** (FAQ — 구글 리치 스니펫용)
    - 3~5개의 Q&A
    - ### Q. ${keyword} 공모가는 얼마인가요?
    - ### Q. ${keyword} 상장일은 언제인가요?
    - ### Q. ${keyword}의 주요 사업은 무엇인가요?
    - ### Q. ${keyword} 보호예수 물량은 얼마인가요?
    - ### Q. ${keyword} 투자 시 주의할 점은?

## 추가 지침
- 전체 본문 최소 5,000자 이상
- 볼드(별표 두개)는 사용 금지. 강조는 <mark>태그</mark>만 사용
- 본질가치 분석(자산가치/수익가치/본질가치 테이블) 섹션을 포함하지 마세요
- 장외시장 거래동향(팝니다/삽니다 호가) 섹션을 포함하지 마세요
- tags에 롱테일 키워드 포함
- 본문 중간에 내부 링크 3~5개 삽입 (SEO 핵심):
  - 다른 IPO 분석: [종목명 상장 분석](/posts/슬러그/) 형식
  - 결론에: "다른 신규 상장주 분석은 [신규 상장주 전체 보기](/category/new-stocks/)에서 확인하세요."
  - 관련 핫이슈: [테마명 관련주 분석](/posts/슬러그/) 형식
- 취소선(~~텍스트~~) 절대 사용 금지
- 데이터가 부족한 섹션은 해당 섹션을 간략하게 다루거나 생략하세요. "확인 필요"로 채우지 마세요.`;

  return prompt;
}

// ---------------------------------------------------------------------------
// 주식특징주 전용 유저 프롬프트 빌더
// ---------------------------------------------------------------------------

function buildFeaturedStocksUserPrompt(stockData: string): string {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  return `아래 데이터를 기반으로 오늘의 주식특징주 일일 리포트를 작성해 주세요.

**오늘 날짜**: ${today.toISOString().slice(0, 10)}

## 제공된 특징주 데이터
${stockData}

## 필수 출력 형식

---FRONTMATTER---
title: ${month}월 ${day}일 주식특징주 | {주도테마1}·{주도테마2} 강세, {대장주1}·{대장주2}·{대장주3}·{대장주4} 급등
description: (80-120자, 오늘의 주요 특징주와 테마를 요약)
category: 주식특징주
tags: 주식특징주, ${month}월${day}일 특징주, {주도테마1} 관련주, {대장주1}, {대장주2}, {대장주3}, {대장주4}, 오늘의 특징주
related_stocks: 종목1, 종목2, 종목3, ...

⚠️ title 작성 규칙:
- {주도테마1}, {주도테마2}는 제공된 데이터에서 당일 가장 강했던 섹터/테마 2개를 짧게 (예: 광통신, 건설주, 방산, 2차전지, AI)
- {대장주1}~{대장주4}는 등락률 상위 대장주 3~4개 종목명
- 예시: "${month}월 ${day}일 주식특징주 | 광통신·건설주 강세, 이루온·이노인스트루먼트·대우건설·기가레인 급등"
- 예시: "${month}월 ${day}일 주식특징주 | 방산·2차전지 강세, 한화시스템·에코프로비엠·풍산·LIG넥스원 급등"
---CONTENT---

## 출력 본문 구조 (반드시 이 순서로)

1. **## ${month}월 ${day}일 주식특징주 총정리**
   - 오늘 시장의 전체적인 분위기를 2-3문장으로 요약
   - 주요 테마/이슈가 무엇이었는지 간단히 언급

2. **## 오늘의 특징주 한눈에 보기**
   - 마크다운 테이블:
     | 종목명 | 주요섹터 | 상승이유 | 등락률 | 거래대금 |
     |--------|----------|----------|--------|----------|
   - 등락률 상위 20개를 테이블에 포함 (상승 종목만, 하락 종목 제외)
   - 그 외 종목은 절대 추가 금지
   - 등락률은 +/-% 형식, 거래대금은 억원 단위
   - **거래대금은 반드시 [관련주 실시간 시세 데이터]에서 제공된 값을 그대로 사용. 절대 추정/지어내지 않음**

3. **## 섹터별 특징주 분석**
   - 관련 테마/섹터별로 그룹핑하여 정리
   - 각 그룹은 ### 이모지 섹터명 형태의 H3 제목 사용:
     🔋 2차전지/배터리
     🤖 AI/로봇
     🛡️ 방산
     💊 바이오/제약
     🏗️ 건설/인프라
     📡 통신/IT
     ⚡ 에너지
     🚗 자동차/모빌리티
     🎮 게임/엔터
     ♻️ 친환경
     🏢 기업이벤트/지배구조
     등 적절한 이모지 선택
   - 각 섹터별 분석은 2~3문단으로 충분히 작성:
     * 왜 오늘 주목받았는지 배경/원인 설명
     * 관련 종목들의 구체적 등락률과 상승 이유
     * <mark>태그</mark>로 핵심 종목명 또는 핵심 수치를 강조
   - 각 섹터 분석 마지막에 반드시 "주요 종목: A, B, C, D" 형식으로 관련 종목 나열

4. **## 주요 하락 테마**
   - 당일 하락한 주요 테마 2~4개를 ### H3 제목으로 정리
   - 각 테마별 하락 이유를 1~2문장으로 간결하게 설명
   - 제공된 데이터의 "하락 테마" 정보를 활용

5. **## 투자 참고사항**
   - 3-4줄의 간결한 투자 주의사항
   - 면책 고지: "> ※ 본 글은 정보 제공을 목적으로 하며, 투자의 책임은 투자자 본인에게 있습니다."

6. **## 자주 묻는 질문**
   - 3~4개의 FAQ를 ### Q. 질문 형식으로 작성
   - 반드시 포함할 질문:
     * "주식특징주란 무엇인가요?"
     * "${month}월 ${day}일 가장 많이 오른 종목은 무엇인가요?"
     * "${month}월 ${day}일 시장을 주도한 테마는 무엇인가요?"
   - 실제 독자가 검색할 법한 질문으로 작성

## 추가 지침
- 3000~5000자 분량으로 충분히 상세하게 작성하세요.
- 제공된 데이터를 최대한 활용하되, 중복 종목은 등락률이 더 높거나 내용이 좋은 쪽을 채택
- related_stocks에는 테이블에 포함된 모든 종목을 나열
- 상승 테마뿐 아니라 하락 테마도 반드시 포함하세요
- 투자 참고사항 섹션에 카테고리 링크 삽입: "전체 주식특징주 분석은 [주식특징주 전체 보기](/category/featured-stocks/)에서 확인하세요."
- 관련 핫이슈 분석이 있으면 자연스럽게 링크: 예) "방산 섹터 종목 분석은 [전쟁 방산 관련주 TOP 6](/posts/2026-03-19-war-defense-stocks/)에서 더 자세히 다루었습니다."`;
}

// ---------------------------------------------------------------------------
// User prompt builder (핫이슈 / 기본)
// ---------------------------------------------------------------------------

function buildUserPrompt(
  keyword: string,
  category: string,
  stockContext?: string,
  manualStocks?: readonly string[],
  existingPosts?: readonly ExistingPost[],
): string {
  const today = new Date().toISOString().slice(0, 10);
  let prompt = `아래 키워드에 대한 한국 주식 시장 블로그 포스트를 작성해 주세요.

**오늘 날짜**: ${today}
**키워드**: ${keyword}
**카테고리**: ${category}

⚠️ 오늘은 ${today}입니다. 이 날짜 이후의 사건은 아직 일어나지 않았습니다.
⚠️ 절대 금지: ${today} 이후 날짜의 사건, 정책 발표, 계약, 수주, ETF 출시, 주가 급등 등을 지어내지 마세요.
⚠️ 절대 금지: 대선, 선거, 취임, 공약 발표 등 실제로 발생하지 않은 정치적 사건을 지어내지 마세요.
⚠️ 뉴스 데이터에 있는 사실만 서술하세요. 뉴스에 없는 구체적 날짜·사건·인용문·수치는 허위사실입니다.
`;

  // 내부 링크용 실제 존재 포스트 목록 — Claude가 이 리스트 외의 슬러그를 만들지 못하도록 차단
  if (existingPosts && existingPosts.length > 0) {
    prompt += `
## 사용 가능한 내부 링크 목록 (반드시 이 목록에서만 선택)

아래는 현재 블로그에 실제로 존재하는 핫이슈 포스트 전체 목록입니다.
**링크를 걸 수 있는 슬러그는 이 목록에 있는 것뿐입니다. 목록에 없는 슬러그는 절대 사용 금지.**
현재 키워드("${keyword}")와 **실제로 관련성 있는** 글만 골라서 2~4개 내부 링크로 사용하세요.
관련성 낮으면 억지로 넣지 말고, 관련 글이 0~1개뿐이면 그만큼만 사용하세요.

`;
    for (const post of existingPosts) {
      const tagStr = post.tags.length > 0 ? ` — 태그: ${post.tags.slice(0, 5).join(", ")}` : "";
      prompt += `- \`/posts/${post.slug}/\` — ${post.title}${tagStr}\n`;
    }
    prompt += `
⚠️ 위 목록에 없는 슬러그(예: \`/posts/2026-04-05-fintech-stocks/\`)를 만들어내면 빌드 실패합니다.
⚠️ 카테고리 링크는 정확히 3개만 유효: \`/category/featured-stocks/\`, \`/category/hot-issues/\`, \`/category/new-stocks/\`. 그 외 \`/category/fintech/\` 같은 경로는 절대 금지.
`;
  } else {
    prompt += `
## 내부 링크 제약
현재 블로그에 관련 포스트 목록이 제공되지 않았습니다.
- 포스트 링크(\`/posts/*/\`)를 절대 만들어내지 마세요.
- 카테고리 링크는 \`/category/hot-issues/\` 1개만 결론 부근에 사용하세요.
`;
  }

  // 사용자가 종목을 직접 지정한 경우 — 자체 선정 절대 금지
  if (manualStocks && manualStocks.length > 0) {
    prompt += `
⚠️⚠️⚠️ [최우선 규칙] 관련주 종목이 사전 지정되었습니다. 반드시 아래 종목만 사용하세요. ⚠️⚠️⚠️
지정 종목: ${manualStocks.join(", ")}
- 위 ${manualStocks.length}개 종목만 분석하세요. 다른 종목을 추가하거나 대체하지 마세요.
- related_stocks에도 위 종목만 기재하세요.
- 제목의 TOP N은 ${manualStocks.length}으로 설정하세요.
- ### N. 종목명 형식으로 위 종목을 순서대로 모두 분석하세요.
`;
  }

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

⚠️ 중요: 모든 H2(##) 제목에 "${keyword}" 키워드를 반드시 포함하세요!
⚠️ 중요: 각 H2 직후 첫 문단(40~60단어)에 핵심 결론을 먼저 제시하세요 (피처드 스니펫/AEO 최적화)

1. **## ${keyword} 관련주 핵심 요약**
   - 서론은 PAS(문제-심화-해결) 프레임워크로 시작:
     ① 투자자의 고민을 짚어주세요: "${keyword} 관련주에 관심은 있지만, 진짜 수혜주가 어디인지 판단하기 어려우신가요?"
     ② 그 고민을 심화: 테마주의 단기 급등/급락 위험성, 정보 부족의 문제
     ③ 이 글이 제공할 가치를 예고: 실적과 사업 연관성이 검증된 핵심 종목만 분석함을 안내
   - 이어서 해당 키워드에 대한 개요를 2-3문단으로 작성
   - **현재 벌어지고 있는 구체적 사건/분쟁/이슈**를 명시하세요 (누가, 언제, 무엇을, 왜)
   - 왜 지금 이 주제가 중요한지 배경 설명
   - 시장에 미치는 영향 흐름을 간결하게 정리 (예: "A → B → C → 증시 영향")

2. **## ${keyword} 시장 상세 분석**
   - 구체적 데이터와 함께 심층 분석 (4문단 이상, 충분히 길게)
   - **현재 진행 중인 사건의 경과와 최신 상황**을 구체적으로 서술
   - **관련 종목들의 최근 수주, 계약, 수출, 실적 뉴스**를 구체적으로 포함
     예: "한화시스템의 천궁-II가 중동에서 실전 배치 후 높은 요격률 기록 → 복수 국가 도입 협상 중"
     예: "풍산, 2026년 1분기 NATO향 탄약 수출 2조원 돌파"
   - 관련 산업/기업/정책 동향 포함
   - 핵심 재료가 종목에 미치는 영향 분석

3. **## ${keyword} 관련주·수혜주·테마주 분석**
   - 먼저 마크다운 테이블로 관련주를 한눈에 정리:
     | 구분 | 종목 | 핵심 포인트 | 등락률 | 거래대금 |
     |------|------|-------------|--------|----------|
   - **거래대금 내림차순**으로 정렬하세요 (가장 큰 종목이 맨 위).
   - 구분 컬럼: "대장주" / "수혜주" / "관련주" 중 하나로 분류.
   - 등락률과 거래대금은 **위에 제공된 시세 데이터를 그대로 사용** — 절대 지어내지 말 것.
     시세 데이터에 없는 종목은 해당 칸을 "-"로 표기.
   - "핵심 포인트"는 종목별 이 테마와의 연결고리를 15~25자로 간결하게.
   - 테이블 아래에 각 종목을 **### N. 종목명** (H3) 형식으로 개별 분석:
     ### 1. 종목명
     왜 수혜주인지, 관련 사업 내용, 투자 포인트를 3-4문단으로 구체적 설명
     (요약 정리, 주요 제품·매출 구성, 기업 실적, 선정된 이유를 모두 포함)
     ### 2. 종목명
     ...
   - 반드시 ### (H3) 헤딩을 사용하세요. **볼드**가 아닌 ### 헤딩입니다.
   - 실적, 사업 구조, 시장 점유율 등 근거 포함
   ${stockContext ? "- 위에 제공된 시세 데이터를 활용하여 현재가, 등락률, PER 등 수치 코멘트 추가" : ""}

4. **## ${keyword} 투자 시 체크포인트**
   - 주의사항과 리스크를 체크리스트 형식으로 정리:
     ✔ 단기 테마인지, 실적 개선 구간인지 구분
     ✔ 관련 지표 동반 확인
     ✔ 리스크 해소 시 급락 가능성 대비
   - 각 항목에 대해 1-2문장 부연 설명

5. **## ${keyword} 관련주 투자 결론**
   - 전체 내용 요약 및 향후 주시할 포인트
   - "함께 보면 좋은 분석 글" 섹션은 MDX에 작성하지 마세요 (RecommendedPosts 컴포넌트가 자동 렌더링)
   - 투자 면책 고지 (blockquote 형식): "> ※ 본 글은 정보 제공을 목적으로 하며, 투자의 책임은 투자자 본인에게 있습니다."

6. **## 자주 묻는 질문** (FAQ — 구글 리치 스니펫 노출용, 매우 중요!)
   - 반드시 3~5개의 질문과 답변을 포함하세요.
   - 형식은 반드시 아래를 따르세요:
     ### Q. ${keyword} 관련주는 어떤 종목이 있나요?
     답변 내용 (2-3문장)
     ### Q. ${keyword} 대장주는 무엇인가요?
     답변 내용 (2-3문장)
     ### Q. ${keyword} 주가 전망은 어떤가요?
     답변 내용 (2-3문장)
   - 질문은 사람들이 실제로 검색할 법한 질문으로 작성하세요.
   - 답변은 간결하면서도 핵심 정보를 포함하세요.

## 추가 지침
- 짧은 문단 유지 (한 문단 2-3문장, 최대 3-4줄), 가독성 극대화
- 전체 본문은 최소 5,000자(한글) 이상 — 이것은 구글 상위 노출에 매우 중요합니다
- 각 종목 분석을 3-4문단으로 충실하게 작성하세요 (1-2문단은 너무 짧음)
- related_stocks에는 본문에서 언급한 종목명을 콤마로 구분하여 정확히 기재
- tags는 키워드 관련 5개를 콤마로 구분하여 제공 (롱테일 변형 포함: "${keyword} 관련주", "${keyword} 대장주", "${keyword} 수혜주" 등)
- 볼드(별표 두개)는 사용 금지. 강조는 <mark>태그</mark>만 사용
- 각 종목 분석에서 해당 종목의 최근 뉴스는 **제공된 뉴스 데이터에 있는 경우에만** 포함하세요. 뉴스에 없는 수주·계약·실적을 지어내지 마세요.
- 뉴스 데이터가 부족한 종목은 공개된 사업 내용, 산업 동향, 시세 데이터 기반으로 분석하세요.
- 내부 링크는 **상단 "사용 가능한 내부 링크 목록"에 있는 슬러그만** 사용 (관련 글 2~4개, 관련 글 적으면 그만큼만)
  - 목록에 없는 슬러그 절대 금지. 할루시네이션 시 빌드 실패
  - 앵커 텍스트에 키워드 포함 ("자세히 보기" 같은 의미 없는 텍스트 금지)
  - 좋은 예: "방산주에 관심이 있다면 [전쟁 방산 관련주 TOP 6 분석](/posts/2026-03-19-war-defense-stocks/)도 함께 참고하세요."
  - 결론에 카테고리 링크 1개: "더 많은 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요."
- 버킷 브리게이드를 섹션 전환부에 3~5회 자연스럽게 삽입하세요.
  예: "하지만 여기서 끝이 아닙니다.", "재무제표를 살펴보면 흥미로운 점이 있습니다.", "그렇다면 실제 수혜 기업은 어디일까요?"
- 자동 생성 느낌 방지: 종목별 분석의 도입 방식, 분석 각도, 마무리 표현을 매번 다르게 작성하세요. 동일 패턴 반복 금지.`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildPrompt(
  keyword: string,
  stockContext?: string,
  categorySlug?: CategorySlugType,
  manualStocks?: readonly string[],
  existingPosts?: readonly ExistingPost[],
): PromptPair {
  // 주식특징주 카테고리: 전용 프롬프트 사용
  if (categorySlug === "featured-stocks") {
    return {
      system: FEATURED_STOCKS_SYSTEM_PROMPT,
      user: buildFeaturedStocksUserPrompt(stockContext ?? keyword),
    };
  }

  // 신규 상장주 카테고리: 전용 프롬프트 사용
  if (categorySlug === "new-stocks") {
    return {
      system: NEW_STOCKS_SYSTEM_PROMPT,
      user: buildNewStocksUserPrompt(keyword, stockContext),
    };
  }

  // 기본: 기존 핫이슈/테마뉴스 등 프롬프트
  const category = categorySlug
    ? getCategoryName(categorySlug)
    : detectCategory(keyword);
  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(keyword, category, stockContext, manualStocks, existingPosts),
  };
}

/**
 * Parse the structured Claude response into a GeneratedPost object.
 * Throws if the response does not contain the expected delimiters.
 */
export function parseResponse(
  raw: string,
  keyword: string,
  categorySlug?: CategorySlugType,
): GeneratedPost {
  // Primary format: ---FRONTMATTER--- ... ---CONTENT--- (custom delimiters)
  // Fallback format: --- ... --- (standard MDX frontmatter, Claude often defaults to this)
  let frontmatterBlock = "";
  let content = "";

  const customMatch = raw.match(
    /---FRONTMATTER---([\s\S]*?)---CONTENT---/,
  );
  if (customMatch) {
    frontmatterBlock = customMatch[1].trim();
    content = raw.split("---CONTENT---")[1]?.trim() ?? "";
  } else {
    // Try standard MDX frontmatter: leading ---\n ... \n---\n
    const stdMatch = raw.match(/^\s*---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (stdMatch) {
      frontmatterBlock = stdMatch[1].trim();
      content = stdMatch[2].trim();
    } else {
      throw new Error(
        "Claude response did not contain expected frontmatter delimiters (---FRONTMATTER---/---CONTENT--- or ---).",
      );
    }
  }

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

  // 카테고리: 지정된 slug가 있으면 사용, 없으면 Claude 응답 → 감지 → 기본값
  const categoryFromResponse = getValue("category");
  const category = categorySlug
    ? getCategoryName(categorySlug)
    : categoryFromResponse || detectCategory(keyword);

  // 제목: 카테고리별 제목 형식
  let title: string;
  if (categorySlug === "featured-stocks") {
    const rawTitle = getValue("title") || keyword;
    // Claude가 형식을 무시할 경우 강제 보정
    // 기대 형식: "X월 X일 주식특징주 | 테마1·테마2 강세, 종목1·종목2 급등"
    if (rawTitle.includes("|")) {
      title = rawTitle;
    } else {
      // content에서 주도 테마와 대장주를 자동 추출
      const today = new Date();
      const m = today.getMonth() + 1;
      const d = today.getDate();
      // content에서 섹터 H3 헤딩 + "주요 종목:" 매칭하여 테마별 종목 추출
      const sectorMatches = content.match(/###\s*[\p{Emoji}]\s*([^\n]+)/gu) ?? [];
      const sectors = sectorMatches
        .map((s) => s.replace(/^###\s*[\p{Emoji}]\s*/u, "").replace(/\s*[-—–].*/,"").replace(/\s*관련.*$/, "").trim())
        .filter((s) => s.length > 0 && s.length <= 12)
        .slice(0, 2);

      // 각 섹터 H3 뒤에 나오는 "주요 종목:" 라인에서 종목 2개씩 추출
      const stockLines = content.match(/주요 종목[:：]\s*([^\n]+)/g) ?? [];
      const perSectorStocks: string[] = [];
      for (let i = 0; i < Math.min(2, stockLines.length); i++) {
        const names = stockLines[i]
          .replace(/^주요 종목[:：]\s*/, "")
          .split(/[,，、]/)
          .map((s) => s.replace(/\([^)]*\)/g, "").trim())
          .filter((s) => s.length > 0 && s.length <= 12);
        perSectorStocks.push(...names.slice(0, 2));
      }
      const topStocks = perSectorStocks.length >= 4
        ? perSectorStocks.slice(0, 4)
        : relatedStocks.slice(0, 4);

      const sectorPart = sectors.length >= 2
        ? `${sectors[0]}·${sectors[1]} 강세`
        : sectors.length === 1
          ? `${sectors[0]} 강세`
          : "테마주 강세";
      const stockPart = topStocks.length >= 1
        ? topStocks.join("·") + " 급등"
        : "급등주 속출";
      title = `${m}월 ${d}일 주식특징주 | ${sectorPart}, ${stockPart}`;
    }
  } else if (categorySlug === "new-stocks") {
    title = getValue("title") || keyword;
  } else {
    const stockCount = relatedStocks.length || 5;
    // 키워드에 이미 "관련주"가 포함되어 있으면 중복 방지
    const suffix = keyword.includes("관련주") ? `TOP ${stockCount}` : `관련주 TOP ${stockCount}`;
    title = `${keyword} ${suffix}`;
  }

  const description =
    getValue("description") ||
    (categorySlug === "featured-stocks"
      ? `오늘의 주식특징주 - 급등주, 테마주, 이슈종목을 한눈에 정리합니다.`
      : `${keyword} 관련주 TOP ${relatedStocks.length || 5} 종목을 심층 분석했습니다. 대장주, 수혜주, 테마주와 투자 포인트를 정리합니다.`);

  // 주식특징주는 짧은 글이므로 최소 길이 기준 완화
  const minLength = categorySlug === "featured-stocks" ? 300 : 500;
  if (content.length < minLength) {
    throw new Error(
      `Generated content is too short (${content.length} chars). Minimum is ${minLength} chars.`,
    );
  }

  return { title, description, category, tags, content, relatedStocks };
}
