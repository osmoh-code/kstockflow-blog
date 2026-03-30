/**
 * 생성된 포스트의 필수 요소를 카테고리별로 검증.
 * 프롬프트(claude-prompt.ts)에 정의된 규칙과 1:1 대응.
 * 검증 실패 시 에러 목록을 반환 → generate-post.ts에서 process.exit(1).
 */

import type { GeneratedPost } from "./claude-prompt";

interface ValidationResult {
  readonly passed: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// ─── 공통 검증 ───────────────────────────────────────────────────────────────

function validateCommon(content: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1) 볼드(**텍스트**) 사용 금지 — <mark> 태그만 허용
  const boldMatches = content.match(/\*\*[^*]+\*\*/g) ?? [];
  if (boldMatches.length > 0) {
    errors.push(`볼드(**) ${boldMatches.length}회 사용 감지 — <mark>태그만 허용 (예: ${boldMatches[0]})`);
  }

  // 2) "함께 보면 좋은 분석 글" 텍스트 금지 (컴포넌트가 자동 렌더링)
  if (content.includes("함께 보면 좋은 분석 글")) {
    errors.push('"함께 보면 좋은 분석 글" 텍스트 포함됨 — MDX에 쓰면 안 됨 (컴포넌트가 자동 렌더링)');
  }

  // 3) 면책 고지 확인
  if (!content.includes("투자의 책임은 투자자 본인에게 있습니다")) {
    errors.push("면책 고지 누락 — '투자의 책임은 투자자 본인에게 있습니다' 문구 필수");
  }

  // 4) FAQ 섹션 확인
  if (!content.includes("자주 묻는 질문")) {
    errors.push('"## 자주 묻는 질문" 섹션 누락');
  }
  const faqCount = (content.match(/###\s*Q\./g) ?? []).length;
  if (faqCount < 3) {
    errors.push(`FAQ ${faqCount}개 — 최소 3개 필요`);
  }

  // 5) 취소선(~~텍스트~~) 사용 금지
  if (/~~[^~]+~~/.test(content)) {
    errors.push("취소선(~~) 사용 감지 — 절대 사용 금지");
  }

  return { errors, warnings };
}

// ─── 주식특징주 검증 ─────────────────────────────────────────────────────────

function validateFeaturedStocks(post: GeneratedPost): ValidationResult {
  const { errors, warnings } = validateCommon(post.content);
  const c = post.content;

  // 1) 필수 H2 섹션 확인
  const requiredH2 = [
    "주식특징주 총정리",
    "오늘의 특징주 한눈에 보기",
    "섹터별 특징주 분석",
    "주요 하락 테마",
    "투자 참고사항",
    "자주 묻는 질문",
  ];
  for (const h2 of requiredH2) {
    if (!c.includes(h2)) {
      errors.push(`필수 섹션 누락: "## ${h2}"`);
    }
  }

  // 2) 특징주 테이블 확인 (종목명 | 주요섹터 | ...)
  if (!c.includes("| 종목명")) {
    errors.push("특징주 요약 테이블 누락 — '| 종목명 | 주요섹터 | 상승이유 | 등락률 | 거래대금 |' 필수");
  }

  // 3) 섹터별 "주요 종목:" 확인
  // 섹터 H3 = "### 이모지 섹터명" (FAQ Q. 와 하락테마 제외)
  const sectorSection = c.split("## 주요 하락 테마")[0]?.split("## 섹터별 특징주 분석")[1] ?? "";
  const sectorH3s = (sectorSection.match(/^### .+$/gm) ?? []);
  const mainStocksInSector = (sectorSection.match(/^주요 종목:/gm) ?? []).length;
  if (sectorH3s.length > 0 && mainStocksInSector < sectorH3s.length) {
    errors.push(
      `섹터 ${sectorH3s.length}개 중 "주요 종목:" ${mainStocksInSector}개만 있음 — 각 섹터 마지막에 필수`
    );
  }

  // 4) 분량 확인 (3000~5000자)
  const charCount = c.replace(/\s/g, "").length;
  if (charCount < 2000) {
    errors.push(`분량 부족: ${charCount}자 (공백 제외) — 최소 2000자 이상`);
  }

  // 5) relatedStocks 확인
  if (post.relatedStocks.length < 8) {
    warnings.push(`relatedStocks ${post.relatedStocks.length}개 — 10~16개 권장`);
  }

  return { passed: errors.length === 0, errors, warnings };
}

// ─── 핫이슈 검증 ─────────────────────────────────────────────────────────────

function validateHotIssues(post: GeneratedPost, keyword: string): ValidationResult {
  const { errors, warnings } = validateCommon(post.content);
  const c = post.content;

  // 1) 필수 H2 섹션 확인 (키워드 포함)
  const requiredPatterns = [
    "관련주 핵심 요약",
    "시장 상세 분석",
    "관련주", // "관련주·수혜주·테마주 분석" 의 일부
    "투자 시 체크포인트",
    "투자 결론",
    "자주 묻는 질문",
  ];
  for (const pattern of requiredPatterns) {
    const regex = new RegExp(`^## .*${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m");
    if (!regex.test(c)) {
      errors.push(`필수 섹션 누락: "${pattern}" 포함된 H2 없음`);
    }
  }

  // 2) 개별 종목 분석 H3 확인 (### N. 종목명)
  const stockH3s = (c.match(/^### \d+\.\s+.+$/gm) ?? []);
  if (stockH3s.length < 3) {
    errors.push(`개별 종목 분석 ${stockH3s.length}개 — 최소 3개 이상 (### N. 종목명 형식)`);
  }

  // 3) 관련주 요약 테이블 확인
  if (!c.includes("| 구분") && !c.includes("| 종목")) {
    errors.push("관련주 요약 테이블 누락 — '| 구분 | 종목 | 핵심 포인트 |' 형식 필수");
  }

  // 4) 체크포인트 섹션에 ✔ 기호 확인
  const checkSection = c.split(/##.*투자 시 체크포인트/)[1]?.split(/^##/m)[0] ?? "";
  const checkmarks = (checkSection.match(/✔/g) ?? []).length;
  if (checkmarks < 2) {
    warnings.push(`체크포인트 ✔ ${checkmarks}개 — 3개 이상 권장`);
  }

  // 5) 분량 확인 (5000자 이상)
  const charCount = c.replace(/\s/g, "").length;
  if (charCount < 3000) {
    errors.push(`분량 부족: ${charCount}자 (공백 제외) — 최소 3000자 이상`);
  }

  // 6) relatedStocks 확인
  if (post.relatedStocks.length < 3) {
    errors.push(`relatedStocks ${post.relatedStocks.length}개 — 최소 5개 이상`);
  }

  return { passed: errors.length === 0, errors, warnings };
}

// ─── 신규상장주 검증 ─────────────────────────────────────────────────────────

function validateNewStocks(post: GeneratedPost, keyword: string): ValidationResult {
  const { errors, warnings } = validateCommon(post.content);
  const c = post.content;

  // 1) 필수 H2 섹션 확인
  const requiredSections = [
    "공모 현황",
    "사업 및 산업 분석",
    "주요 재무 분석",
    "공모자금 사용계획",
    "주요 주주현황",
    "유통주식",
    "투자 포인트",
    "리스크 포인트",
    "상장 전망 및 결론",
    "자주 묻는 질문",
  ];
  for (const section of requiredSections) {
    if (!c.includes(section)) {
      errors.push(`필수 섹션 누락: "${section}" 포함된 H2 없음`);
    }
  }

  // 2) 테이블 최소 개수 확인 (공모현황, 재무, 주주, 보호예수 등)
  const tableCount = (c.match(/\|.*\|.*\|/g) ?? []).length;
  if (tableCount < 10) {
    warnings.push(`테이블 행 ${tableCount}개 — 공모현황/재무/주주/보호예수 테이블 확인 필요`);
  }

  // 3) 투자 포인트 ✔ 확인
  const investSection = c.split(/##.*투자 포인트/)[1]?.split(/^##/m)[0] ?? "";
  const checkmarks = (investSection.match(/✔/g) ?? []).length;
  if (checkmarks < 3) {
    warnings.push(`투자 포인트 ✔ ${checkmarks}개 — 3~5개 권장`);
  }

  // 4) 리스크 포인트 ⚠️ 확인
  const riskSection = c.split(/##.*리스크 포인트/)[1]?.split(/^##/m)[0] ?? "";
  const riskMarks = (riskSection.match(/⚠️/g) ?? []).length;
  if (riskMarks < 3) {
    warnings.push(`리스크 포인트 ⚠️ ${riskMarks}개 — 3~5개 권장`);
  }

  // 5) 분량 확인 (5000자 이상)
  const charCount = c.replace(/\s/g, "").length;
  if (charCount < 3000) {
    errors.push(`분량 부족: ${charCount}자 (공백 제외) — 최소 3000자 이상`);
  }

  // 6) "본질가치" / "장외시장" 포함 시 경고 (금지 항목)
  if (c.includes("본질가치")) {
    errors.push('"본질가치" 분석 포함됨 — 금지 항목');
  }
  if (c.includes("장외시장") && c.includes("팝니다")) {
    errors.push('"장외시장 거래동향" 포함됨 — 금지 항목');
  }

  return { passed: errors.length === 0, errors, warnings };
}

// ─── 공개 API ────────────────────────────────────────────────────────────────

export function validatePost(
  post: GeneratedPost,
  categorySlug: string,
  keyword: string,
): ValidationResult {
  switch (categorySlug) {
    case "featured-stocks":
      return validateFeaturedStocks(post);
    case "hot-issues":
      return validateHotIssues(post, keyword);
    case "new-stocks":
      return validateNewStocks(post, keyword);
    default:
      return validateHotIssues(post, keyword); // 기본값
  }
}
