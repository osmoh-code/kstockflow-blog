# KStockFlow Blog — Project Rules

> 이 파일은 모든 Claude Code 세션에서 자동으로 로드됩니다.
> 대화가 끊기거나 새 세션에서 시작해도 이 규칙을 따라야 합니다.

## 실행 원칙 (최우선)

**이 CLAUDE.md에 모든 규칙이 정의되어 있다. 새 세션에서 파일을 탐색하거나 기존 글을 읽어서 구조를 파악하는 행위를 하지 말 것.**

- "글 작성해줘" → 이 문서의 규칙대로 바로 실행
- 기존 글 파일을 읽어서 형식을 확인하는 것은 **토큰 낭비**이므로 금지
- generate-post.ts 스크립트 내부를 탐색할 필요 없음 — 명령어만 실행
- 유일하게 읽어야 하는 것: 사용자가 제공한 **38커뮤니케이션 데이터 파일**

## 프로젝트 개요

- **사이트**: https://kstockflow.com
- **기술 스택**: Next.js 15 + MDX + Tailwind CSS, Vercel 배포
- **용도**: 한국 주식 시장 분석 블로그 (특징주, 신규상장주, 핫이슈)
- **글 자동생성**: `npx tsx scripts/generate-post.ts "키워드" --category <카테고리>`

## 카테고리별 글 작성 명령어

```bash
# 주식특징주 (매일 장 마감 후)
npx tsx scripts/generate-post.ts "3월20일자 주식특징주" --category featured-stocks

# 신규상장주 (38커뮤니케이션 데이터 필수)
npx tsx scripts/generate-post.ts "회사명" --category new-stocks

# 핫이슈
npx tsx scripts/generate-post.ts "키워드" --category hot-issues --stocks "종목1,종목2,종목3"

# 기존 핫이슈 글 재생성 (URL/날짜/관련주/썸네일 보존, 본문만 새 프롬프트로)
# 2026-04-14 신규 추가 (커밋 6c85fd2) — API ~$0.10/건
npx tsx scripts/generate-post.ts --refresh "2026-04-13-ai-inpeura-pilsugisul-optical-communication-stocks"

# 날짜 override (드물게 사용)
npx tsx scripts/generate-post.ts "키워드" --category hot-issues --date "2026-04-10"
```

## 썸네일 규칙 (반드시 준수)

### 주식특징주 (featured-stocks)

- **방식**: Sharp로 자체 생성 (`generateFeaturedStocksThumbnail`)
- **배경**: `public/images/featured-stocks-bg.jpg` (차트 이미지)
- **텍스트**: "N월 N일자" + "주식특징주" (노란색 #FFD700)
- **매번 동일한 디자인**, 날짜만 변경
- 외부 이미지 검색 사용하지 않음

### 신규상장주 (new-stocks)

- **방식**: Sharp로 자체 생성 (`generateNewStocksThumbnail`)
- **디자인**: 보라색-남색 그라디언트 배경 + 회사명 + "신규상장 분석" 텍스트
- **외부 스톡사이트에서 회사 로고를 검색하지 않음** (한국 기업 로고는 스톡사이트에 없음)
- 회사명 길이에 따라 폰트 크기 자동 조절

### 핫이슈

- Unsplash → Pixabay → Pexels 순서로 키워드 기반 이미지 검색
- **한국어 키워드를 영어로 변환 + 관련 분야로 확장**하여 검색
  - 예: "6G" → "6G wireless technology future network" (무선통신, 전파, 전자기기 등으로 확장)
  - 예: "드론" → "military drone UAV flying" (군사용 드론, 무인항공기 등으로 확장)
  - 예: "반도체" → "semiconductor chip wafer closeup" (칩, 웨이퍼 등으로 확장)
- `scripts/lib/image-search.ts`의 KEYWORD_MAP에 137개 키워드 매핑 정의
- 1차 검색 실패 시 fallback 쿼리로 재시도 (2라운드)

---

## 공통 글쓰기 규칙 (모든 카테고리 적용)

### 문체

- 자연스러운 서술형 어투: "~입니다", "~인데요", "~볼 수 있습니다"
- 짧은 문단: 한 문단 2-3문장, 가독성 최우선
- **볼드(별표 두개) 절대 사용 금지**. 강조는 `<mark>태그</mark>`만 사용
- 하이라이트는 문단당 최대 1~2개만. 종목명은 하이라이트하지 않음
- 취소선(~~텍스트~~) 절대 사용 금지
- 틸드(~) 범위 표시는 사용 가능 (singleTilde: false 설정으로 취소선 아님)

### 뉴스 확인된 내용만 작성 (최우선 규칙)

- Google 뉴스 RSS로 수집된 뉴스에 있는 내용만 사실로 서술
- **뉴스에 없는 구체적 사건, 인용문, 수치, 정책 발표, 계약, 수주를 절대 지어내지 않음**
- 절대 금지 예시:
  - 출처 없는 관계자 인용문 ("관계자는 ~라고 밝혔다")
  - 출처 없는 수주/계약 금액 ("2,000억원 규모 수주")
  - 출처 없는 정책 시행 ("1인당 구매 제한 정책 시행")
  - 출처 없는 생산/판매 수치 ("하루 1,000박스 판매")
- 뉴스 부족 시: 일반적 산업 동향, 공개된 기업 정보, 시세 데이터 기반으로 작성
- "최근", "현재" 같은 모호한 표현 대신 구체적 시점(2026년 3월 등) 사용

### SEO 최적화

- H2 제목에 키워드 변형 포함 (예: "드론 관련주 핵심 요약", "드론 시장 상세 분석")
- 메타 설명: 150-160자, 핵심 내용 요약
- 키워드 밀도: 본문에서 메인 키워드 자연스럽게 5-10회 등장
- FAQ 섹션 필수 (구글 리치 스니펫 노출용)

### 🎯 SERP CTR 최적화 (frontmatter title/description — 2026-04-29 강화)

GSC Search Analytics 분석 결과: 노출 대비 클릭이 1/10 수준이면 색인이 아니라 **메타 CTR 문제**.

**title 작성 규칙 (35~55자 권장, 60자 초과 시 SERP 잘림):**
- ❌ boilerplate 긴 suffix 금지: "| 대장주·수혜주·테마주 총정리" 17자가 핵심 정보를 잘라먹음
- ✅ **대표 종목명 1~3개**를 suffix에 포함 → 클릭 유도력 강함
  - 좋은 예: "AI 전력 관련주 TOP 8 2026 | 대원전선·LS ELECTRIC·효성중공업 데이터센터 수혜주"
  - 좋은 예: "중동 재건 관련주 한국 철강주 TOP 7 2026 | 부국철강·현대제철·세아제강"
  - 나쁜 예: "AI 전력 수요 급증 관련주 TOP 8 2026 | 대장주·수혜주·테마주 총정리"
- ❌ **TOP N / 연도 중복 패턴** 금지: "TOP 6 2026 TOP 6 2026" 같은 빌더 버그 → `validate-seo.ts`가 자동 차단
- ✅ **검색 query에서 자주 나오는 long-tail 키워드 1개 포함**: "한국", "주가 전망" 등
  - 사례: 리센스메디컬 검색 query 1위는 "리센스메디컬 **주가 전망** 2026"인데 title에는 "상장 분석" → mismatch로 클릭 0/488 노출
  - 작성 전 GSC `searchanalytics.query` 결과를 확인할 수 있으면 더 정확

**description 작성 규칙 (120~155자):**
- ❌ "투자 포인트를 총정리해보겠습니다" 같은 generic 마무리 금지
- ✅ 구체 수치 + 종목명 + 행동 가능한 정보로 마무리
  - 좋은 예: "부국철강 +10.54% 급등, 현대제철 +3.25% 상승 등 재건 수혜주 움직임을 실시간 시세와 함께 정리합니다."
  - 나쁜 예: "관련주들의 강세 가운데 투자 포인트를 총정리해보겠습니다."

**검증 도구:**
- `npx tsx scripts/gsc-ctr-audit.ts` — 노출 대비 클릭 약한 글 식별 + 검색 query 분포
- `npm run build`의 `validate-seo.ts`가 title 중복 / 빈 description / 가비지 슬러그 자동 차단

**미래 글 자동 적용 — claude-prompt.ts (2026-04-29 fix):**
- hot-issues `parseResponse`가 Claude 응답 title을 우선 사용 (이전엔 무조건 빌더가 덮어써서 중복 버그 발생)
- TOP N / 연도가 2회 이상 등장하면 빌더가 자동으로 제거 후 재조립
- 변경 위치: `scripts/lib/claude-prompt.ts` parseResponse hot-issues 분기

### 슬러그 (URL) 규칙 — SEO 핵심

- **영문 키워드 슬러그만 사용**. 한글 음역(romanization) 절대 금지
  - ❌ 나쁜 예: `seonbakenjin-sujugeubjeung-stocks`, `korona-19-sikada-byeoni-ba32-hwaksan-uryeo`, `samseong-sdi-bencheu-battery-gonggeub-secondary-stocks`
  - ✅ 좋은 예: `ship-engine-orders-surge-stocks`, `covid-19-cikada-variant-spread-concern`, `samsung-sdi-mercedes-battery-supply-stocks`
- 슬러그는 **Claude API 응답의 `slug:` 필드**에서 가져옴 (`scripts/lib/claude-prompt.ts`의 출력 형식에 명시)
- Claude가 영문 슬러그를 못 만들거나 음역 패턴 감지되면 `parseResponse`의 `sanitizeSlug`가 거부 → `toSlug()` fallback (`scripts/generate-post.ts`의 한글-영문 매핑 테이블)
- 30~60자 사이, 모두 소문자, 단어 구분은 하이픈, 숫자 허용
- 핫이슈 슬러그는 `-stocks` 접미사로 통일
- **이미 발행된 글의 슬러그는 절대 변경하지 않음** (308 리다이렉트로도 색인 흔들림 + PageRank 손실)
- 새 키워드가 매핑 테이블에 없어도 Claude가 영문 슬러그 생성하므로 매핑 추가 불필요

#### 🚨 자동 fallback 슬러그(`post-XXXXXX`) 절대 발행 금지

- `scripts/generate-post.ts`의 `toSlug()` 마지막 fallback이 `post-${Date.now()}` 형태를 만듦. **여기 도달하면 안 됨.**
- 과거 사고: `post-woyvk4` (호르무즈), `post-4ej7sd` (광통신) 슬러그가 실제로 발행됨 → 삭제 후 의미있는 슬러그로 재발행했지만 옛 URL이 GSC에 색인되어 호르무즈 키워드 30 imp / 6위까지 잡았는데 클릭 0 (페이지 없음). 한 달간 수백 노출 손실.
- `validate-seo.ts`가 빌드 시 `^\d{4}-\d{2}-\d{2}-post-[a-z0-9]{4,8}$` 패턴 자동 차단 — 발견되면 빌드 실패.
- 발행 전 `npx tsx scripts/generate-post.ts ...` 콘솔에 `⚠️ 슬러그 생성 실패, 랜덤 fallback 사용` 경고가 보이면 즉시 중단하고 `--slug` 옵션으로 의미 있는 영문 슬러그를 직접 지정하거나, KOREAN_TO_SLUG 매핑 테이블에 추가하세요.

### 내부 링크 (SEO 핵심 — 반드시 준수)

- 글당 3~5개의 내부 링크를 본문 중간에 자연스럽게 삽입
- 링크 형식: `[앵커 텍스트](/posts/슬러그/)` 또는 `[앵커 텍스트](/category/슬러그/)`
- 앵커 텍스트에 반드시 키워드 포함 (의미 없는 "자세히 보기", "읽기" 금지)
- 좋은 예: `[전쟁 방산 관련주 TOP 6 분석](/posts/2026-03-19-war-defense-stocks/)에서 자세히 다루었습니다`
- 나쁜 예: `[자세히 보기](/posts/2026-03-19-war-defense-stocks/)`
- 결론 부근에 카테고리 링크 1개: `더 많은 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요`
- "함께 보면 좋은 분석 글" 섹션은 MDX에 작성하지 않음 (RecommendedPosts 컴포넌트가 자동 렌더링)

### 관련주 선정 규칙

- **실제 한국 상장기업**만 선정 (비상장/외국기업/가상기업 절대 금지)
- 해당 키워드 관련 뉴스에서 실제 "관련주/수혜주/테마주"로 언급된 종목
- **중소형 전문기업을 절반 이상** 포함
- **절대 금지 종목**: 삼성전자, 현대차, 기아, LG전자, SK하이닉스, 네이버, 카카오, 현대로템, 포스코홀딩스, 한화에어로스페이스, SK이노베이션, LG화학, 현대모비스 (사업이 너무 다각화)
- 확신 없는 종목은 넣지 않음. 5개 확실한 것 > 7개 애매한 것

### AdSense 정책 준수

- 특정 종목 매수/매도 직접 권유 금지
- 확정적 수익률 보장 표현 금지 ("반드시 오른다", "100% 수익" 등)
- 허위/과장 정보 금지 (뉴스에 없는 사건·인용문·수치 지어내기 = 허위 정보)
- 클릭베이트 제목 금지
- 투자 면책 고지 필수: "> ※ 본 글은 정보 제공을 목적으로 하며, 투자의 책임은 투자자 본인에게 있습니다."

---

## 핫이슈 글 작성 규칙

### 데이터 소스

- Google 뉴스 RSS로 최신 뉴스 자동 검색
- 관련주 실시간 시세 데이터 (네이버 금융 크롤링)

### 글 구조 (고정)

1. **{키워드} 관련주 핵심 요약**

   - 키워드 개요 2-3문단
   - 현재 벌어지고 있는 구체적 사건/분쟁/이슈 명시 (누가, 언제, 무엇을, 왜)
   - 왜 지금 이 주제가 중요한지 배경 설명
   - 시장 영향 흐름 정리 (A → B → C → 증시 영향)
2. **{키워드} 시장 상세 분석**

   - 구체적 데이터와 심층 분석 (4문단 이상, 충분히 길게)
   - 현재 진행 중인 사건의 경과와 최신 상황
   - 관련 종목들의 최근 수주, 계약, 수출, 실적 뉴스 구체적 포함
   - 관련 산업/기업/정책 동향
3. **{키워드} 관련주·수혜주·테마주 분석**

   - 먼저 마크다운 테이블로 관련주 요약: | 구분 | 종목 | 핵심 포인트 |
   - 각 종목을 ### N. 종목명 (H3) 형식으로 개별 분석 (3-4문단씩)
   - 실적, 사업 구조, 시장 점유율 등 근거 포함
   - 시세 데이터 활용하여 현재가, 등락률, PER 등 수치 코멘트
4. **{키워드} 투자 시 체크포인트** — **주제 특화 필수 (2026-04-14 강화)**

   - ✔ 체크리스트 4~5개, 이 주제에서만 의미 있는 이벤트·숫자·임계값·일정 포함
   - ❌ **일반형 금지**: "단기 테마 구분", "PER/PBR 확인", "거래량/기관 동향", "관련 지표 동반 확인", "리스크 해소 시 급락 대비", "기술 경쟁력 검증" → Google boilerplate 감지
   - ✅ **주제별 예시**:
     · 이벤트(IPO/휴전/선거): "SEC 승인 vs 연기 시나리오", "락업 해제 시점 2027-Q1 물량 출회"
     · 정책/법안: "본회의 통과 예상일 전후 주가 반응", "예산 배정 N조원 중 경쟁입찰 참여 비중"
     · 기술/산업: "차세대 표준(112Gbps PAM4) 채택 시점", "엔비디아 Rubin 출시 N월 맞물린 수주"
     · 전쟁/분쟁: "재개 시 물동량 탄성", "재건 발주 국가별 한국 참여 이력(이라크 2003)"
   - 각 항목 구체 숫자/시점/임계값 포함, 1-2문장 부연
   - 일반형은 최대 1개까지만 허용
   - **mark 일관성 필수 (커밋 4038d6e)** — 각 체크포인트 항목 첫 키워드구를 `<mark>...</mark>`로 감쌀 것
     · ❌ "첫째,", "둘째,", "1.", "2." 서수/번호 사용 금지 (항목은 빈 줄로 구분)
     · 좋은 예: `<mark>SEC 예비심사 진행 상황과 승인 vs 연기 시나리오</mark>별 영향을 분석...`
     · 10개 글 중 3개에서 mark 불일치 발견 사례 있음 → 모든 항목 동일 규칙 적용 필수
     · 불일치 발생 시 수동 정규식 수정 가능: `npx tsx scripts/fix-checkpoint-marks.ts` (TARGET_SLUGS 배열 수정 후 실행, API 비용 0)

5. **{키워드} 관련주 투자 결론** — **3가지 구성 중 선택 (2026-04-14 강화)**

   - **(A) 시나리오 분기형**: 낙관/비관/중립 시나리오별 주가 영향·시점·조건
   - **(B) 타임라인형**: 단기(1개월)/중기(3~6개월)/장기(1년+) 관전 포인트
   - **(C) 트레이딩 각도형**: 관련주 간 우선순위 + 진입/이탈 조건
   - ❌ **상투구 금지**: "향후 ~ 주시", "~에 주목해야 할 시점", "투자자들의 관심이 집중", "중장기적인 기회", "실제 ~ 선별해서 투자", "변동성이 클 수 있지만", "진정한 수혜주가 될 것"
   - ✅ 반드시 구체 시점(월/분기), 구체 숫자(수주·실적·밸류에이션), 관찰 트리거 포함
   - "함께 보면 좋은 분석 글" 섹션은 **MDX에 작성하지 않음** (RecommendedPosts 컴포넌트가 자동으로 핫이슈 최신글 3개를 썸네일+제목 카드로 렌더링)
   - 투자 면책 고지

6. **자주 묻는 질문** (FAQ 3~5개) — **주제 고유 질문 필수 (2026-04-14 강화)**

   - ❌ **Boilerplate 금지**: "관련주는 어떤 종목이 있나요?", "대장주는 무엇인가요?", "주가 전망은 어떤가요?" → 모든 글에 있어서 Google이 boilerplate로 감지
   - ✅ 이 주제에서만 물어볼 법한 구체·고유 질문으로 작성
     · 예(IPO): "머스크 지분 보유율은?", "한국 개인투자자 직접 매수 가능?", "스타링크 서비스에 변화?"
     · 예(휴전·재건): "이라크 재건 사업 규모?", "과거 휴전 직후 6개월 건설주 평균 수익률?", "수주 계약 매출 인식 시점?"
     · 예(기술): "실리콘 포토닉스와 기존 광통신 차이?", "엔비디아 Rubin 세대 광통신 채택 비중?"
   - 일반형 질문은 1개까지만 허용
   - 답변은 간결·구체 수치 포함 (2-3문장, 사실 기반)

7. **시장 상세 분석 섹션 내 주제 특화 H3 소섹션 1~2개 자율 추가** — **색인 중복 방지 핵심**

   - H2 "시장 상세 분석" 안에 주제 고유 각도의 ### H3 소섹션 추가
   - 이벤트성: "### IPO 일정과 국내 증시 연결 고리", "### 과거 유사 사례 비교"
   - 정치·전쟁: "### 과거 휴전 후 재건주 성과", "### 현재 국면의 차별점"
   - 기술: "### 기술 진화 단계", "### 글로벌 vs 국내 밸류체인 위치"
   - 정책: "### 법안 주요 조항과 수혜 구간", "### 과거 유사 정책 주가 반응"
   - ⚠️ 모든 글에 같은 H3 제목 쓰면 안 됨 (주제마다 달라야 함)

### 제목 형식

- "{키워드} 관련주 TOP {N} {연도} | 대장주·수혜주·테마주 총정리"
- N은 관련주 종목 수와 일치, 연도는 현재 연도 (예: 2026)

### 분량

- 본문 최소 5,000자(한글) 이상
- 각 종목 분석 3-4문단 (1-2문단은 너무 짧음)
- 관련주 선정: 사용자가 종목을 지정한 경우 전부 포함, 미지정 시 5~7개 자체 선정

---

## 신규상장주 글 작성 규칙 (매우 중요)

### 데이터 소스 (두 가지 모두 필수)

1. **38커뮤니케이션 데이터**: 사용자가 `scripts/data/` 폴더에 텍스트 파일로 제공 — 정량 데이터 (공모가, 재무, 주주 등)
2. **최신 뉴스**: Google News RSS 자동 검색 — 정성 데이터 (파트너십, 임상결과, 시장반응 등)

- DART API는 사용하지 않음

### 38커뮤니케이션 데이터를 반드시 사용해야 하는 항목

- 확정공모가, 희망공모가 밴드
- 청약경쟁률, 기관경쟁률
- 의무보유확약 비율 및 기간별 내역
- 수요예측 가격분포 (상단/하단/초과 등)
- 매출현황, 재무제표 수치
- 주가지표 (EPS, PER, BPS, PBR, PSR)
- 주요주주 현황 (최대주주, 벤처금융 등)
- 유통가능 물량 / 매각제한 물량
- 동종업체 비교

### 글 구조 (고정)

1. **서두** — 공모 핵심 수치 요약 (청약경쟁률, 확정공모가, 의무보유확약, 유통비율 등)
2. **{종목명} 공모 현황** — 테이블: 종목코드, 시장, 희망밴드, 확정공모가, 공모주식수, 공모금액, 청약일, 상장일, 주간사, 경쟁률, 확약비율
3. **수요예측 결과 분석** — 가격분포 테이블 + 의무보유확약 기간별 테이블
4. **{종목명} 사업 및 산업 분석** — 사업 설명 3-4문단, 주요 제품/매출 구성, 산업 트렌드, 경쟁사 대비 포지셔닝, 핵심 기술/파이프라인
5. **{종목명} 주요 재무 분석** — 매출현황 테이블 + 손익 추이 테이블(최근 3개년) + 재무비율 + 주가지표(EPS/PER/BPS/PBR/PSR) ※ 본질가치 분석 포함하지 않음
6. **{종목명} 공모자금 사용계획** — 테이블: 용도별 금액/비율/세부내용, 적정성 분석
7. **{종목명} 주요 주주현황** — 최대주주 테이블 + 벤처금융 투자자 테이블 + 지분율
8. **{종목명} 유통주식 및 보호예수 물량 분석** — 보호예수 기간별 테이블 + 유통비율 분석 + 해제 시점 영향 분석 ※ 장외시장 거래동향 포함하지 않음
9. **{종목명} 투자 포인트** — ✔ 형식, 5개 이상, 각 포인트별 근거/수치
10. **{종목명} 리스크 포인트** — ⚠️ 형식, 5개 이상, 영향도/발생 가능성
11. **{종목명} 상장 전망 및 결론** — 종합 분석 + 상장일 시나리오 + 면책 고지
12. **자주 묻는 질문** — 5문 5답 (공모가, 상장일, 주요사업, 보호예수, 투자주의점)

### 데이터 정확성 규칙

- 제공된 수치를 그대로 사용. 임의 변경·반올림·추정 금지
- 제공된 데이터에 없는 수치는 절대 지어내지 않음
- 종목코드, 주간사, 일정, 고유명사는 제공된 데이터와 정확히 일치
- **Claude API가 자체 생성한 추측성 정보 금지** (존재하지 않는 파트너십, 계약, 학회 발표 등)
- 데이터 부족한 섹션은 간략히 다루거나 생략. "확인 필요"로 채우지 않음

### 제목 형식

- "{종목명} 상장 분석 {연도} | 공모가·재무·투자포인트 총정리"

### 분량

- 본문 최소 5,000자 이상

---

## 주식특징주 글 작성 규칙

### 데이터 소스

- `특징주/` 폴더에 HTML 파일 넣으면 스크립트가 자동으로 읽음 (EUC-KR 자동 변환)
  - 파일 4종 구조: `증시요약(3) 테마`, `(4) 코스피`, `(5) 코스닥`, `(6) 상한가 및 급등종목`
  - HTML 4·5는 `<b>` 태그로 종목명 감싸지만, **HTML 6 (상한가)는 `<b>` 태그 없음**
  - 종목코드 추출 정규식: `/stockitem\?code=([0-9A-Z]{6})"[^>]*>(?:<b[^>]*>)?([^<]+)/g` (`<b>` 옵셔널)
  - 우선주 코드(`0010F0` 등) 대응 위해 `[0-9A-Z]{6}` 사용 (`\d{6}` 아님)
- `scripts/data/YYYY-MM-DD-featured-stocks.md` 파일도 자동 탐지
- Google 뉴스 RSS로 최신 뉴스 자동 검색

### 시세 데이터 플로우 (반드시 이해할 것)

**등락률과 거래대금은 서로 다른 소스에서 가져온다:**

1. **등락률**: HTML 파일에서 직접 추출 (우선) → 없으면 `/basic` API fallback
   - HTML 종목 링크 이후 500자 내 `([+-]?\d+\.\d+)%` 패턴 매칭
   - fallback: `m.stock.naver.com/api/stock/{code}/basic` → `fluctuationsRatio` 필드
   - **`/integration` API의 `fluctuationsRatio`는 동종업체(industryCompareInfo) 데이터이므로 절대 사용 금지**
2. **거래대금**: `/integration` API → `accumulatedTradingValue` (KRX+NXT 합산)
3. 결과는 `featuredTradeMap` (종목명 → 거래대금)에 저장, 등락률과 함께 Claude 컨텍스트에 전달
4. Claude가 테이블 작성 후, **후처리에서 거래대금을 `featuredTradeMap` + `stockInfoList` 기반으로 재교체**
   - 1순위: `stockInfoList` (Claude relatedStocks의 상세 시세)
   - 2순위: `featuredTradeMap` (HTML 사전 추출 전체 종목 — 상한가 종목 커버)
5. **후처리에서 등락률 내림차순 재정렬** (`sortFeaturedStocksTableByChangeDesc`)
6. 거래대금 교체 실패한 행은 `-억원`으로 남음 → **validate-seo.ts에서 빌드 에러로 차단됨**

과거 2026-04-06에 HTML 6 정규식 불일치로 풍산홀딩스·CS가 누락된 사례 있음.

### 글 구조 (고정)

1. **{월}월 {일}일 주식특징주 총정리**

   - 오늘 시장 전체 분위기 2-3문장 요약
   - 주요 테마/이슈 간단 언급
2. **오늘의 특징주 한눈에 보기**

   - 마크다운 테이블: | 종목명 | 주요섹터 | 상승이유 | 등락률 | 거래대금 |
   - 종목 선정: 등락률 상위 20개 (상승 종목만, 하락 종목 제외)
   - 등락률은 +/-% 형식, 거래대금은 네이버 금융 실제 데이터 (억원 단위)
3. **섹터별 특징주 분석**

   - 테마/섹터별 그룹핑
   - 각 그룹에 이모지 사용 (🔋 2차전지, 🤖 AI/로봇, 🛡️ 방산, 💊 바이오, 🏗️ 건설, 📡 통신, ⚡ 에너지, 🚗 자동차 등)
   - 각 섹터별 오늘 주목받은 이유 1-2문장 코멘트
   - **각 섹터 분석 마지막에 반드시 "주요 종목: 종목1, 종목2, ..." 한 줄 추가** (절대 생략 금지)
4. **주요 하락 테마** (반드시 포함)

   - 당일 하락한 섹터/테마 1-2개 분석
   - 하락 원인과 관련 종목 포함
   - 각 하락 테마 마지막에도 "주요 종목:" 포함
5. **투자 참고사항**

   - 3-4줄 간결한 투자 주의사항
   - 투자 면책 고지
6. **자주 묻는 질문** (반드시 포함)

   - ### Q. 형식으로 3~4개
   - 오늘 가장 많이 오른 종목, 대장주, 시장 주도 테마, 하락 원인 등
   - 실제 검색할 법한 질문으로 작성

### 제목 형식

- "{연도}년 {월}월 {일}일 주식특징주 | {주도테마} 강세, {대장주} 급등"

### 관련주 선정 규칙

- **대형주만이 아닌 중소형주도 반드시 섞을 것**
- 최소 10~16개 종목
- related_stocks에 테이블 포함 종목 전부 나열

### 분량

- 1,500~3,000자 (간결한 요약 리포트)

---

## YouTube Shorts 자동 생성 규칙 (반드시 준수)

> 2026-04-08 사용자 검수 완료 포맷. **이 규칙을 임의로 변경하지 말 것.**
> 매번 같은 글로 만들어도 통일된 쇼츠가 나와야 함.

### 명령어

```bash
# featured-stocks / hot-issues (라우터 경유, frontmatter category로 자동 dispatch)
npx tsx scripts/shorts/shorts-pipeline.ts <slug>

# sector-leaders (완전 별도 파이프라인 — 기존 라우터 안 거침)
npx tsx scripts/shorts/sector-leaders-pipeline.ts <featured-stocks-slug>
# 예) npx tsx scripts/shorts/sector-leaders-pipeline.ts 2026-04-15-featured-stocks
# → dist/shorts/pending/{slug}-sector-leaders/*.mp4 로 저장 (캐시 격리)

# 업로드 (반드시 --privacy=private — 사용자가 검수 후 직접 공개)
#   featured / hot-issues → 그냥 slug
#   sector-leaders       → {slug}-sector-leaders (cache slug 그대로)
#   upload.ts / publish.ts가 접미사로 카테고리 자동 dispatch
npx tsx scripts/shorts/upload.ts <slug-or-cache-slug> --privacy=private

# 댓글 추가 + public 전환 (사용자가 검수 OK 후)
npx tsx scripts/shorts/publish.ts <videoId> <slug-or-cache-slug>

# (긴급) 업로드 후 제목/설명/태그만 patch — 메타 빌더 버그 발견 시 재업로드 없이 수정
npx tsx scripts/shorts/sector-leaders/update-title.ts <videoId> <cache-slug>
```

### 디렉토리 구조 (분리됨 — 절대 섞지 말 것)

```
scripts/shorts/
├── extract.ts / script.ts / assets.ts    ← router only (featured/hot-issues dispatch)
├── shorts-pipeline.ts                    ← featured/hot-issues CLI
├── sector-leaders-pipeline.ts            ← sector-leaders 전용 CLI (라우터 경유하지 않음)
├── tts.ts / render.ts                    ← 공통 (분기 없음)
├── featured/                             ← featured-stocks 전용
│   ├── extract.ts (5-col table parser)
│   ├── script.ts (Gemini hook + body)
│   └── assets.ts (date header)
├── hot-issues/                           ← hot-issues 전용
│   ├── extract.ts (3-col table + Gemini summary)
│   ├── script.ts (rule-based + 종목명 prefix)
│   └── assets.ts (Gemini header override 우선)
└── sector-leaders/                       ← sector-leaders 전용 (2026-04-15 신설)
    ├── parse-sectors.ts ("## 섹터별 특징주 분석" H2 파서, 기업이벤트 제외)
    ├── summarize-reason.ts (Gemini batch 1문장 요약, temperature 0.7)
    ├── extract.ts (섹터 + 종목 등락률 lookup 3단계)
    ├── script.ts (규칙 기반 hook/body, loop 생략)
    ├── assets.ts (sector_table scene, dateBadge null)
    ├── upload-meta.ts (제목/설명/태그/첫댓글 빌더, 섹터 키워드 동적 추출)
    ├── update-title.ts (업로드 후 제목만 patch하는 긴급 유틸)
    └── types.ts (sector-leaders 전용 타입)
```

**규칙**:
- featured-stocks 수정은 `featured/` 안에서만
- hot-issues 수정은 `hot-issues/` 안에서만
- sector-leaders 수정은 `sector-leaders/` 안에서만
- router 파일에 카테고리 specific 로직 박지 말 것
- sector-leaders는 라우터와 완전 독립 (사용자 2026-04-15 지시: "특징주랑 핫이슈 쇼츠제작이랑 합쳐지면 안되고 별도로 만들어져야함")

### featured-stocks 쇼츠 (매일 발행)

**Hook (고정 — Gemini 결과 무시)**
- narration: `"{N월 N일} 시장을 주도한 핵심종목 총정리"`
- onScreenText: `"{N월 N일}\n오늘의 주도주?"` (2줄)
- 날짜는 input.date에서 자동 추출 — 매일 글 따라 자동 변경
- 변경 위치: `scripts/shorts/featured/script.ts` 하단 (`formatMonthDay` + force-fix)

**Body (Gemini 자유 생성)**
- 5개 섹터 leader (TOP_N_FEATURED=5)
- 각 narration: `"{종목명} {등락률}% {동작}, {이유}"`
- 차트 + 큰 % 숫자 표시 (suppressStats=false)

**Letterbox header**: `"N월 N일 주목해야 할 종목"` (date-based)

**Loop**: 본문에 안 나온 그 외 종목 8개 테이블

### hot-issues 쇼츠 (테마별 발행)

**Hook + Header (Gemini 자동 생성 — `summarize-hook.ts` one-shot)**
- 한 번의 Gemini 호출로 hook narration + 2-line header 동시 생성
- **개별 종목명 사용 절대 금지** (카카오페이/다날 등 회사명 NO → 일반명사 "결제 플랫폼주")
- Header는 **글 제목 기반**으로 만들고, 2줄 = `{글 제목 키워드}{이슈/기대감/합의 등}\n관련주 TOP {실제 종목 수}`
- TOP N의 N은 실제 렌더 종목 수 (TOP_N_HOT_ISSUES=7 cap, 6개 글이면 TOP 6)
- 변경 위치: `scripts/shorts/lib/summarize-hook.ts` SYSTEM_PROMPT

**Body (rule-based + Gemini summary)**
- 최대 7개 종목 (TOP_N_HOT_ISSUES=7)
- 각 narration: `"{종목명}{은/는} {Gemini 요약 ~50자}"`
- 종목명 prefix는 자동 (받침 따라 은/는 자동 결정)
- 차트/% 숨김 (suppressStats=true) — 글이 며칠 뒤 읽혀도 데이터 안 어긋남

**Letterbox header**: Gemini 자동 생성 결과 사용 (frontmatter `shorts_header_title`이 있으면 그게 우선)

**Loop**: 전체 관련주 10개 테이블 (compact mode)

### sector-leaders 쇼츠 (2026-04-15 신설, featured-stocks MDX 재활용)

**Hook (고정 템플릿 — 규칙 기반, Gemini 안 씀)**
- narration: `"{N월 N일} 시장을 주도한 섹터와 종목은?"`
- onScreenText: `"{N월 N일}\n주도 섹터 TOP {N}"` (N = 실제 섹터 개수)
- 변경 위치: `scripts/shorts/sector-leaders/script.ts` — `buildSectorLeadersScript`
- ⚠️ featured-stocks의 hook과 혼동 금지 (featured는 "핵심종목 총정리", sector-leaders는 "섹터와 종목은?")

**Body (Gemini batch 1문장 요약 + 종목 테이블)**
- 섹터당 1 scene, 최대 개수 제한 없음 (블로그 H3 전부 반영, 단 "기업이벤트" 섹터는 제외)
- narration: Gemini 2.5 Flash batch 요약 (한 번 호출로 모든 섹터 동시 처리)
  - 프롬프트 규칙: 25~45자, 구체적 트리거 필수, 종목명 금지, "~이끌었습니다" 어미 최대 1회, 어미·구조 다양화 강제
  - temperature 0.7 (creative but on-topic)
  - 변경 위치: `scripts/shorts/sector-leaders/summarize-reason.ts` SYSTEM_PROMPT
  - 실패 시 fallback: parse-sectors.ts의 truncated 첫 문단
- onScreenText: 섹터 H3 heading 그대로 (예: `"🔐 양자암호/양자컴퓨팅 관련주"`)
- 테이블: MDX "주요 종목:" 라인의 전부를 row로 (종목명 / 상승률 2열, 종목 수에 따라 폰트 auto-fit 5단계)
- 등락률 lookup 3단계: 1) 상단 5-col 테이블 → 2) 본문 regex (`{name} … NN.NN%` 120자 window) → 3) 네이버 API `getStockInfo` 병렬

**CTA**: 기존 featured/hot-issues와 동일 (K주식핫이슈 + "매일 장 마감 후 업로드! 좋아요와 구독" 자동 append)

**Loop**: **제거됨** — `script.loop.narration = ""`로 두면 collectSegments가 drop.
- 사용자 2026-04-15 지시: "loop에서 오늘 분석한 종목 전체 테이블 보여주는거 생략, CTA만 동일하게"

**Letterbox header**: `"N월 N일 주도 섹터 TOP N"` (date-based)

**dateBadge**: `null` 고정 — 우측 상단 날짜 배지는 hot-issues 전용. sector-leaders는 사용 금지.

**캐시 격리**: 내부적으로 `{mdxSlug}-sector-leaders` 접미사를 붙여 `dist/shorts/pending/` 분리. 같은 MDX 글에 대해 featured-stocks 쇼츠와 sector-leaders 쇼츠 **병행 생성 가능** (서로 간섭 없음).

**신규 Remotion scene**: `remotion/Shorts/scenes/SectorTableScene.tsx` — 섹터 타이틀 + 상승이유 자막 + 종목/상승률 2열 테이블 (rowCount 4~13+ 5단계 auto-fit)

**YouTube 업로드 메타 (2026-04-15 사용자 승인)**
- 제목 템플릿: `"{N월N일} 시장 주도섹터 총정리 | {상위 3 섹터 키워드} 강세"`
  - 예) `"4월15일 시장 주도섹터 총정리 | 양자암호·전력설비·건설 강세"`
- 섹터 키워드는 `script.sectorHeadings`에서 **동적 추출** (매일 다른 주도 섹터 반영)
- 첫 댓글: 주도 섹터 나열 + `K주식핫이슈에서 매일 업데이트됩니다` + 블로그 링크
- 태그: `["주식","주도섹터","시장분석","특징주","테마주","한국주식","shorts","K주식핫이슈","{월일}", ...섹터키워드]`
- 변경 위치: `scripts/shorts/sector-leaders/upload-meta.ts` — `buildSectorLeadersMetadata` / `buildSectorLeadersFirstComment`

**이모지 제거 정규식 주의 (normalizeSectorKeyword)**
- 이모지는 **base codepoint + VS-16 (U+FE0F) 조합**으로 렌더링되는 경우가 있음 (예: "🏗️" = U+1F3D7 + U+FE0F)
- 정규식에 U+FE0F와 ZWJ(U+200D)도 포함해야 함. 누락 시 "·️ 건설"처럼 유령 문자가 남음 (2026-04-15 첫 업로드에서 실제 발생)
- 확정 패턴: `/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\u{FE0F}\u{200D}]+\s*/u`

**upload.ts / publish.ts 카테고리 감지 (완전 분리 유지하면서 dispatch)**
- **`-sector-leaders` 슬러그 접미사**가 sector-leaders의 authoritative signal
  - sector-leaders MDX 파일이 존재하지 않음(featured-stocks MDX 재활용) → frontmatter 기반 감지 불가 → 접미사로 판정
- `toMdxSlug()` 헬퍼로 suffix 제거 → `buildPostUrl(mdxSlug)` → featured-stocks 원본 글 링크 유지
- featured-stocks / hot-issues는 기존 frontmatter dispatch 그대로 (변경 없음)

**긴급 메타 수정 유틸 (`update-title.ts`)**
- 업로드 이후 메타 빌더 버그를 발견했을 때 영상 재업로드 없이 YouTube API `videos.update`로 **제목·설명·태그만 patch**
- 사용: `npx tsx scripts/shorts/sector-leaders/update-title.ts <videoId> <cache-slug>`
- 내부적으로 `buildSectorLeadersMetadata`를 재호출 → 수정된 빌더 결과로 업데이트 (API 할당량 ~50 units)
- 2026-04-15 이모지 regex 버그 수정에서 처음 사용됨

### Remotion 폰트 auto-fit (HookScene)

- 글 제목 길이에 따라 폰트 크기 자동 조정
- 8자 이하: 100/88px
- 9~11자: 80px
- 12~14자: 66px
- 15자 이상: 56px
- `wordBreak: keep-all` + `whiteSpace: pre-line` 적용 → 한국어 단어 중간 끊김 방지

### CTA 구독 유도 (공통 — featured/hot-issues 모두 적용)

**화면 (CTAScene.tsx)**:
- 기존 CTA 유지: "더 자세한 내용" → "K주식핫이슈" → 빨간 버튼 "프로필 링크 클릭" → kstockflow.com
- 구분선 아래 추가: "매일 장 마감 후 / 주도주 및 이슈 업로드" (38px, bold) + 회색 버튼 "좋아요 & 구독"

**보이스 (tts.ts + assets.ts)**:
- Gemini CTA narration 뒤에 고정 멘트 자동 append: `"매일 장 마감 후 업로드! 좋아요와 구독 부탁드립니다."`
- SSML: 블로그 CTA → 400ms break → `<prosody rate="108%">` 구독 멘트 (같은 목소리, 약간 빠르게)
- pitch 변경 금지 (목소리 얇아짐 — 2026-04-13 검증 완료)

**변경 위치**:
- 화면: `remotion/Shorts/scenes/CTAScene.tsx`
- 나레이션 텍스트: `scripts/shorts/assets.ts` (collectSegments CTA 부분)
- TTS SSML: `scripts/shorts/tts.ts` (collectSceneTexts + wrapCtaWithSsml)

### TTS 콤마 자동 break (전 카테고리 — 2026-04-28 추가)

`scripts/shorts/tts.ts`의 `wrapWithBreakAfterFirstWord`가 모든 body scene narration에 SSML break 자동 삽입:

1. 첫 단어(종목명) 뒤 300ms break
2. % + 액션 동사 뒤 300ms break
3. **mid-sentence 콤마(", ") 자리에 400ms break** ← 신규

`chartIntro`는 hook 분류라 wrapWithBreak 적용 안 됨 (첫 단어 break가 chartIntro에선 어색했음).

**작성 가이드**: narration/chartNote에 콤마를 적극 활용하면 자연스러운 호흡 자동 생성.
- ❌ "매집구간 형성 빠른 상한가로" — 한 호흡에 줄줄
- ✅ "매집구간 형성, 빠른 상한가로" — 콤마에서 0.4초 호흡

featured-stocks/hot-issues/sector-leaders 모두 동일 정책. 새 카테고리 추가 시에도 `synthesizeForSlug` 그대로 사용.

### BGM

- 기본: `public/audio/bgm-1.mp3`
- 환경변수 `SHORTS_BGM_FILE`로 override 가능
- 자동 fallback 순서: bgm-1.mp3 → bgm-2.mp3 → bgm.mp3
- "none" 또는 `SHORTS_BGM_FILE=none`이면 BGM 비활성화

### 절대 금지 사항

- **블로그 글 생성 프로세스(`scripts/lib/claude-prompt.ts`, `scripts/generate-post.ts`)는 절대 건드리지 말 것** — 글은 이미 완벽함. 쇼츠 통일성 문제는 반드시 `scripts/shorts/` 안에서만 해결.
- featured-stocks의 hook narration/onScreenText 변경 금지 (사용자 승인 없이)
- HookScene 분기 로직을 onScreenText의 `\n` 감지로 되돌리지 말 것 — `scene.category` 명시 분기 사용
- assets.ts에 카테고리 specific 로직 직접 박지 말 것 — `featured/assets.ts` 또는 `hot-issues/assets.ts`로 위임
- TypeScript 검증: `tsconfig.json`이 `scripts/`를 exclude하므로 수동 호출 필요:
  ```bash
  npx tsc --noEmit --target ES2020 --module esnext --moduleResolution bundler --esModuleInterop --strict --skipLibCheck --allowJs scripts/shorts/extract.ts scripts/shorts/script.ts scripts/shorts/assets.ts scripts/shorts/shorts-pipeline.ts
  ```

### 회귀 테스트 (변경 후 반드시 실행)

두 기준 슬러그로 풀 파이프라인 재생성:
```bash
# featured-stocks 기준
rm -rf dist/shorts/pending/2026-04-08-featured-stocks
npx tsx scripts/shorts/shorts-pipeline.ts 2026-04-08-featured-stocks

# hot-issues 기준
rm -rf dist/shorts/pending/2026-04-08-us-iran-ceasefire-construction
npx tsx scripts/shorts/shorts-pipeline.ts 2026-04-08-us-iran-ceasefire-construction
```

mp4가 60초 이내 생성, BGM 들어있고, hook/header가 위 규칙대로 나오면 OK.

---

## 빌드 & 배포

```bash
npm run build    # Next.js 빌드 → next-sitemap → validate-seo → 색인 자동 제출
git add -A && git commit -m "feat: 글 제목" && git push   # Vercel 자동 배포
```

### 색인 자동 제출 (2026-04-17 구축)

`npm run build` 실행 시 postbuild에서 자동 실행:
1. **IndexNow** → Bing, Naver, Yandex 즉시 색인
2. **Google Indexing API** → Google 즉시 색인 요청

Google 인증: `google-credentials.json` (프로젝트 루트, **절대 git 커밋 금지**)
- 서비스 계정: `kstockflow-indexing@gen-lang-client-0915144229.iam.gserviceaccount.com`
- Search Console 소유자 등록 완료

수동 실행도 가능:
```bash
npx tsx scripts/submit-urls.ts          # 새 URL만 제출
npx tsx scripts/submit-urls.ts --all    # 전체 URL 재제출
```

## 세션 연속성

### 대화가 끊겼을 때

1. 이 CLAUDE.md가 자동 로드됨 — 코드를 다시 분석할 필요 없음
2. 필요 시 `/resume-session`으로 마지막 작업 상태 확인

### 세션 저장

- 작업 중간이나 끝에 `/save-session`으로 상태 저장

## 주요 파일 경로

| 파일                                     | 설명                               |
| ---------------------------------------- | ---------------------------------- |
| `scripts/generate-post.ts`             | 글 자동생성 메인 스크립트 (신규: `--refresh <slug>`, `--date <YYYY-MM-DD>`) |
| `scripts/lib/claude-prompt.ts`         | Claude API 시스템/유저 프롬프트    |
| `scripts/lib/image-search.ts`          | 썸네일 생성 (Sharp) + 이미지 검색  |
| `scripts/lib/news-search.ts`           | Google 뉴스 RSS 검색               |
| `scripts/lib/stock-data.ts`            | 관련주 시세+거래대금 크롤링 (KRX+NXT 합산) |
| `scripts/fix-checkpoint-marks.ts`      | 체크포인트 `<mark>` 일관성 일괄 보정 (API 호출 없음) |
| `scripts/submit-urls.ts`              | 색인 자동 제출 (IndexNow + Google Indexing API) |
| `scripts/data/`                        | 38커뮤니케이션 등 수동 데이터 파일 |
| `google-credentials.json`             | Google 서비스 계정 키 (**git 커밋 금지**) |
| `content/posts/`                       | MDX 블로그 글                      |
| `public/images/thumbnails/`            | 생성된 썸네일 이미지               |
| `public/images/featured-stocks-bg.jpg` | 주식특징주 썸네일 배경             |

## 환경 변수 (.env.local)

- `ANTHROPIC_API_KEY` — Claude API
- `UNSPLASH_ACCESS_KEY` — 이미지 검색
- `PIXABAY_API_KEY` — 이미지 검색 (fallback)
- `PEXELS_API_KEY` — 이미지 검색 (2nd fallback)
