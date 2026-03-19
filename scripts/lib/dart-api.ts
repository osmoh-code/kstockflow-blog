/**
 * DART OpenAPI integration for IPO / 신규상장주 data.
 *
 * Fetches structured data from DART (전자공시시스템) including:
 * - Company overview (기업개황)
 * - Financial statements (재무제표)
 * - Major shareholders (주주현황)
 * - Disclosure list & document content (공시 목록 & 투자설명서/증권신고서)
 *
 * Requires DART_API_KEY in .env.local or environment variable.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DartCompany {
  readonly corpCode: string;
  readonly corpName: string;
  readonly stockCode: string;
  readonly ceoName: string;
  readonly address: string;
  readonly homepage: string;
  readonly industryCode: string;
  readonly establishDate: string;
}

export interface DartDisclosure {
  readonly rceptNo: string;
  readonly rceptDt: string;
  readonly reportNm: string;
  readonly corpName: string;
}

export interface DartFinancial {
  readonly accountNm: string;
  readonly thstrmAmount: string;
  readonly frmtrmAmount: string;
  readonly bfefrmtrmAmount: string;
}

export interface DartIpoData {
  readonly company: DartCompany | null;
  readonly disclosures: readonly DartDisclosure[];
  readonly financials: readonly DartFinancial[];
  readonly prospectusContent: string;
  readonly newsContext: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = "https://opendart.fss.or.kr/api";
const CORP_CODE_CACHE = path.join(process.cwd(), "scripts", ".dart-corpcode-cache.xml");

function getApiKey(): string {
  const key = process.env["DART_API_KEY"];
  if (!key) {
    throw new Error("DART_API_KEY not found. Set it in .env.local or environment variable.");
  }
  return key;
}

// ---------------------------------------------------------------------------
// Corp Code Lookup
// ---------------------------------------------------------------------------

async function downloadCorpCodeXml(): Promise<string> {
  // Cache for 24 hours
  if (fs.existsSync(CORP_CODE_CACHE)) {
    const stat = fs.statSync(CORP_CODE_CACHE);
    const hoursSinceModified = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
    if (hoursSinceModified < 24) {
      return fs.readFileSync(CORP_CODE_CACHE, "utf-8");
    }
  }

  console.log("  📥 DART 기업코드 목록 다운로드 중...");
  const apiKey = getApiKey();
  const url = `${BASE_URL}/corpCode.xml?crtfc_key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Corp code download failed: HTTP ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // It's a zip file containing CORPCODE.xml
  const tmpZip = path.join(process.cwd(), "scripts", ".dart-corpcode.zip");
  fs.writeFileSync(tmpZip, buffer);

  try {
    execSync(`cd "${path.dirname(tmpZip)}" && unzip -o "${tmpZip}" CORPCODE.xml -d .`, {
      stdio: "pipe",
    });
    const xmlPath = path.join(path.dirname(tmpZip), "CORPCODE.xml");
    const xml = fs.readFileSync(xmlPath, "utf-8");
    // Save as cache
    fs.writeFileSync(CORP_CODE_CACHE, xml, "utf-8");
    // Cleanup
    fs.unlinkSync(xmlPath);
    fs.unlinkSync(tmpZip);
    return xml;
  } catch {
    // Try PowerShell on Windows
    execSync(
      `powershell -Command "Expand-Archive -Path '${tmpZip}' -DestinationPath '${path.dirname(tmpZip)}' -Force"`,
      { stdio: "pipe" },
    );
    const xmlPath = path.join(path.dirname(tmpZip), "CORPCODE.xml");
    const xml = fs.readFileSync(xmlPath, "utf-8");
    fs.writeFileSync(CORP_CODE_CACHE, xml, "utf-8");
    fs.unlinkSync(xmlPath);
    fs.unlinkSync(tmpZip);
    return xml;
  }
}

export async function findCorpCode(companyName: string): Promise<{ corpCode: string; corpName: string } | null> {
  const xml = await downloadCorpCodeXml();

  // Simple XML parsing — find <list> blocks matching company name
  const listRegex = /<list>\s*<corp_code>(\d+)<\/corp_code>\s*<corp_name>([^<]+)<\/corp_name>\s*<corp_eng_name>[^<]*<\/corp_eng_name>\s*<stock_code>([^<]*)<\/stock_code>\s*<modify_date>[^<]*<\/modify_date>\s*<\/list>/g;

  let match: RegExpExecArray | null;
  const candidates: Array<{ corpCode: string; corpName: string; stockCode: string }> = [];

  while ((match = listRegex.exec(xml)) !== null) {
    const corpName = match[2].trim();
    if (corpName.includes(companyName) || companyName.includes(corpName)) {
      candidates.push({
        corpCode: match[1],
        corpName,
        stockCode: match[3].trim(),
      });
    }
  }

  if (candidates.length === 0) return null;

  // Prefer exact match, then shortest name match
  const exact = candidates.find((c) => c.corpName === companyName);
  if (exact) return { corpCode: exact.corpCode, corpName: exact.corpName };

  return { corpCode: candidates[0].corpCode, corpName: candidates[0].corpName };
}

// ---------------------------------------------------------------------------
// DART API Calls
// ---------------------------------------------------------------------------

async function dartFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const apiKey = getApiKey();
  const searchParams = new URLSearchParams({ crtfc_key: apiKey, ...params });
  const url = `${BASE_URL}/${endpoint}?${searchParams.toString()}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`DART API error: HTTP ${response.status}`);

  return response.json() as Promise<T>;
}

interface DartApiResponse {
  readonly status: string;
  readonly message: string;
  readonly list?: readonly Record<string, string>[];
}

export async function fetchCompanyOverview(corpCode: string): Promise<DartCompany | null> {
  const data = await dartFetch<Record<string, string>>("company.json", { corp_code: corpCode });
  if (data.status !== "000") return null;

  return {
    corpCode: data.corp_code ?? "",
    corpName: data.corp_name ?? "",
    stockCode: data.stock_code ?? "",
    ceoName: data.ceo_nm ?? "",
    address: data.adres ?? "",
    homepage: data.hm_url ?? "",
    industryCode: data.induty_code ?? "",
    establishDate: data.est_dt ?? "",
  };
}

export async function fetchDisclosureList(
  corpCode: string,
  beginDate: string,
  endDate: string,
): Promise<readonly DartDisclosure[]> {
  const data = await dartFetch<DartApiResponse>("list.json", {
    corp_code: corpCode,
    bgn_de: beginDate,
    end_de: endDate,
    page_count: "30",
  });

  if (data.status !== "000" || !data.list) return [];

  return data.list.map((item) => ({
    rceptNo: item.rcept_no ?? "",
    rceptDt: item.rcept_dt ?? "",
    reportNm: item.report_nm ?? "",
    corpName: item.corp_name ?? "",
  }));
}

export async function fetchFinancials(
  corpCode: string,
  year: string,
  reportCode: string = "11011",
): Promise<readonly DartFinancial[]> {
  const data = await dartFetch<DartApiResponse>("fnlttSinglAcnt.json", {
    corp_code: corpCode,
    bsns_year: year,
    reprt_code: reportCode,
    fs_div: "OFS",
  });

  if (data.status !== "000" || !data.list) return [];

  return data.list.map((item) => ({
    accountNm: item.account_nm ?? "",
    thstrmAmount: item.thstrm_amount ?? "",
    frmtrmAmount: item.frmtrm_amount ?? "",
    bfefrmtrmAmount: item.bfefrmtrm_amount ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Prospectus Content Fetching
// ---------------------------------------------------------------------------

/**
 * Extract clean text from DART HTML, preserving table structures as markdown.
 */
function extractTextFromHtml(html: string): string {
  // Remove scripts and styles
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Convert <table> to simplified markdown-like text (preserve data structure)
  cleaned = cleaned
    .replace(/<tr[^>]*>/gi, "\n| ")
    .replace(/<\/tr>/gi, " |")
    .replace(/<t[dh][^>]*>/gi, " | ")
    .replace(/<\/t[dh]>/gi, "");

  // Convert remaining HTML to text
  return cleaned
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

/**
 * Detect section topic from content for labeling.
 */
function detectSectionTopic(text: string): string {
  const topicKeywords: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["공모개요", ["공모가", "공모주식수", "주간사", "공모금액", "희망공모가"]],
    ["재무제표", ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "영업손실", "재무상태표", "손익계산서"]],
    ["주주현황", ["최대주주", "특수관계인", "지분율", "주주명"]],
    ["보호예수", ["보호예수", "의무보유", "유통가능", "유통제한"]],
    ["사업내용", ["사업의 내용", "주요 사업", "매출 구성", "사업 개요", "영위하는"]],
    ["자금사용계획", ["자금의 사용목적", "자금사용계획", "운영자금", "시설자금", "채무상환"]],
    ["수요예측", ["수요예측", "기관투자자", "경쟁률", "의무보유확약"]],
    ["위험요소", ["투자위험요소", "위험요인", "리스크", "투자 위험"]],
    ["인수인의의견", ["인수인의 의견", "주간사 의견", "대표주관"]],
  ];

  for (const [topic, keywords] of topicKeywords) {
    if (keywords.some((kw) => text.includes(kw))) {
      return topic;
    }
  }
  return "기타";
}

interface ProspectusSection {
  readonly eleId: number;
  readonly topic: string;
  readonly content: string;
}

async function fetchProspectusContent(rcpNo: string): Promise<string> {
  console.log(`  📄 투자설명서/증권신고서 전체 본문 읽는 중 (rcpNo: ${rcpNo})...`);

  // First, get dcmNo from the main page
  const mainUrl = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`;
  const mainResponse = await fetch(mainUrl);
  const mainHtml = await mainResponse.text();

  // Extract dcmNo from JavaScript (format: dcmNo'] = "11103357")
  const dcmNoMatch = mainHtml.match(/dcmNo[^"]*"(\d+)"/);
  if (!dcmNoMatch) {
    console.warn("  ⚠️ dcmNo를 찾을 수 없습니다.");
    return "";
  }
  const dcmNo = dcmNoMatch[1];

  // Fetch ALL sections of the document (투자설명서는 보통 15~25개 섹션)
  const sections: ProspectusSection[] = [];
  let consecutiveEmpty = 0;
  const MAX_SECTIONS = 30;
  const MAX_CONSECUTIVE_EMPTY = 5;

  for (let eleId = 0; eleId < MAX_SECTIONS; eleId++) {
    const eleIdStr = String(eleId).padStart(7, "0");
    const viewerUrl = `https://dart.fss.or.kr/report/viewer.do?rcpNo=${rcpNo}&dcmNo=${dcmNo}&eleId=${eleIdStr}&offset=0&length=0&dtd=dart3.xsd`;

    try {
      const response = await fetch(viewerUrl);
      if (!response.ok) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
        continue;
      }

      const html = await response.text();
      const text = extractTextFromHtml(html);

      if (text.length > 100) {
        const topic = detectSectionTopic(text);
        sections.push({ eleId, topic, content: text });
        consecutiveEmpty = 0;
        console.log(`     섹션 ${eleId}: [${topic}] (${text.length}자)`);
      } else {
        consecutiveEmpty++;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
      }
    } catch {
      consecutiveEmpty++;
      if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
    }
  }

  console.log(`  ✅ 투자설명서 ${sections.length}개 섹션 로드 완료`);

  if (sections.length === 0) return "";

  // 핵심 섹션 우선 배치: 재무, 보호예수, 공모개요, 주주현황 → 나머지
  const priorityTopics = ["공모개요", "재무제표", "주주현황", "보호예수", "자금사용계획", "수요예측"];
  const prioritySections = sections.filter((s) => priorityTopics.includes(s.topic));
  const otherSections = sections.filter((s) => !priorityTopics.includes(s.topic));
  const orderedSections = [...prioritySections, ...otherSections];

  // 섹션별로 라벨링하여 구조화된 텍스트 생성
  const formattedSections = orderedSections.map(
    (s) => `[섹션: ${s.topic}]\n${s.content}`,
  );

  const fullContent = formattedSections.join("\n\n---\n\n");

  // 충분한 컨텍스트 제공 (Claude sonnet max input ~200k tokens)
  // 핵심 데이터 섹션은 잘리지 않도록 넉넉하게 설정
  const MAX_CONTENT_LENGTH = 60000;
  if (fullContent.length <= MAX_CONTENT_LENGTH) {
    return fullContent;
  }

  // 초과 시: 핵심 섹션은 전체 유지, 나머지를 줄임
  let result = "";
  for (const s of orderedSections) {
    const block = `[섹션: ${s.topic}]\n${s.content}\n\n---\n\n`;
    if (result.length + block.length > MAX_CONTENT_LENGTH) {
      // 핵심 섹션이면 가능한 한 포함
      if (priorityTopics.includes(s.topic)) {
        const remaining = MAX_CONTENT_LENGTH - result.length - 50;
        if (remaining > 500) {
          result += `[섹션: ${s.topic}]\n${s.content.slice(0, remaining)}\n...(이하 생략)\n\n---\n\n`;
        }
      }
      break;
    }
    result += block;
  }

  console.log(`  📏 최종 컨텐츠 길이: ${result.length}자 (원본 ${fullContent.length}자)`);
  return result;
}

// ---------------------------------------------------------------------------
// Public: Fetch All IPO Data
// ---------------------------------------------------------------------------

/**
 * Fetch all available IPO data for a company from DART.
 *
 * @param companyName - Korean company name (e.g., "아이엠바이오로직스")
 * @returns Structured IPO data including company overview, disclosures, financials, prospectus
 */
export async function fetchDartIpoData(companyName: string): Promise<DartIpoData> {
  console.log(`\n🏛️  DART 공시 데이터 수집 중: "${companyName}"`);

  // 1. Find corp_code
  console.log("  🔍 기업코드 검색...");
  const corpInfo = await findCorpCode(companyName);
  if (!corpInfo) {
    console.warn(`  ⚠️ DART에서 "${companyName}" 기업을 찾을 수 없습니다.`);
    return { company: null, disclosures: [], financials: [], prospectusContent: "", newsContext: "" };
  }
  console.log(`  ✅ 기업코드: ${corpInfo.corpCode} (${corpInfo.corpName})`);

  // 2. Company overview
  console.log("  📋 기업개황 조회...");
  const company = await fetchCompanyOverview(corpInfo.corpCode);
  if (company) {
    console.log(`  ✅ 대표이사: ${company.ceoName}, 홈페이지: ${company.homepage}`);
  }

  // 3. Disclosure list (recent 6 months)
  console.log("  📑 공시 목록 조회...");
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const endDate = now.toISOString().slice(0, 10).replace(/-/g, "");
  const beginDate = sixMonthsAgo.toISOString().slice(0, 10).replace(/-/g, "");

  const disclosures = await fetchDisclosureList(corpInfo.corpCode, beginDate, endDate);
  console.log(`  ✅ 공시 ${disclosures.length}건 확인`);
  for (const d of disclosures.slice(0, 10)) {
    console.log(`     ${d.rceptDt} | ${d.reportNm}`);
  }

  // 4. Find and fetch 투자설명서 or 증권신고서
  const prospectusDoc = disclosures.find(
    (d) => d.reportNm.includes("투자설명서") || d.reportNm.includes("증권신고서"),
  );
  let prospectusContent = "";
  if (prospectusDoc) {
    prospectusContent = await fetchProspectusContent(prospectusDoc.rceptNo);
  } else {
    console.warn("  ⚠️ 투자설명서/증권신고서를 찾을 수 없습니다.");
  }

  // 5. Financial statements (try recent years)
  console.log("  📊 재무제표 조회...");
  let financials: readonly DartFinancial[] = [];
  const currentYear = now.getFullYear();
  for (let year = currentYear; year >= currentYear - 2; year--) {
    financials = await fetchFinancials(corpInfo.corpCode, String(year));
    if (financials.length > 0) {
      console.log(`  ✅ ${year}년 재무제표 ${financials.length}개 항목`);
      break;
    }
  }
  if (financials.length === 0) {
    console.log("  ℹ️  재무제표 없음 (상장 전 기업은 사업보고서 미제출)");
  }

  return {
    company,
    disclosures,
    financials,
    prospectusContent,
    newsContext: "",
  };
}

// ---------------------------------------------------------------------------
// Format Data for Claude Prompt
// ---------------------------------------------------------------------------

/**
 * Format DART data into a structured text block for the Claude prompt.
 */
export function formatDartDataForPrompt(data: DartIpoData): string {
  const sections: string[] = [];

  // Company overview
  if (data.company) {
    sections.push(`## DART 기업개황 (공식 데이터)
| 항목 | 내용 |
|------|------|
| 회사명 | ${data.company.corpName} |
| 종목코드 | ${data.company.stockCode || "상장 전"} |
| 대표이사 | ${data.company.ceoName} |
| 소재지 | ${data.company.address} |
| 홈페이지 | ${data.company.homepage} |
| 설립일 | ${data.company.establishDate} |`);
  }

  // Financials from API
  if (data.financials.length > 0) {
    const finLines = data.financials
      .filter((f) => ["매출액", "영업이익", "당기순이익", "영업손실", "당기순손실"].some((k) => f.accountNm.includes(k)))
      .map((f) => `| ${f.accountNm} | ${f.thstrmAmount} | ${f.frmtrmAmount} | ${f.bfefrmtrmAmount} |`);
    if (finLines.length > 0) {
      sections.push(`## DART 재무제표 API (공식 데이터)
| 항목 | 당기 | 전기 | 전전기 |
|------|------|------|--------|
${finLines.join("\n")}`);
    }
  }

  // Recent disclosures
  if (data.disclosures.length > 0) {
    const discLines = data.disclosures
      .slice(0, 10)
      .map((d) => `| ${d.rceptDt} | ${d.reportNm} |`);
    sections.push(`## DART 최근 공시 목록
| 날짜 | 공시명 |
|------|--------|
${discLines.join("\n")}`);
  }

  // Prospectus content — now includes ALL sections with labels
  if (data.prospectusContent) {
    sections.push(`## DART 투자설명서/증권신고서 전문 (공식 데이터)

⚠️ 최우선 데이터 소스: 아래는 DART 전자공시시스템에서 직접 읽어온 투자설명서/증권신고서 전문입니다.
이 데이터에 포함된 모든 수치(공모가, 재무제표, 주주현황, 보호예수, 자금사용계획 등)를 반드시 그대로 사용하세요.

### 데이터 활용 지침
1. [섹션: 공모개요] → 공모가, 공모주식수, 주간사, 상장시장, 수요예측 결과 추출
2. [섹션: 재무제표] → 매출액, 영업이익, 당기순이익, 자산/부채 총계 추출 (3개년)
3. [섹션: 주주현황] → 최대주주, 특수관계인, VC/PE 지분율 추출
4. [섹션: 보호예수] → 보호예수 기간별 물량, 즉시 유통 가능 물량 추출
5. [섹션: 자금사용계획] → 공모 자금 용도별 배분 추출
6. [섹션: 수요예측] → 기관 경쟁률, 의무보유확약 비율 추출
7. [섹션: 사업내용] → 주요 사업, 제품/서비스, 매출 구성, 시장 현황 추출
8. [섹션: 위험요소] → 투자 리스크 요인 추출

${data.prospectusContent}`);
  }

  if (sections.length === 0) {
    return "DART에서 조회된 데이터가 없습니다. 확인되지 않은 정보는 '확인 필요'로 표시하세요.";
  }

  return sections.join("\n\n");
}
