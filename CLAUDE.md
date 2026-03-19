# KStockFlow Blog — Project Rules

> 이 파일은 모든 Claude Code 세션에서 자동으로 로드됩니다.
> 대화가 끊기거나 새 세션에서 시작해도 이 규칙을 따라야 합니다.

## 프로젝트 개요

- **사이트**: https://kstockflow.com
- **기술 스택**: Next.js 15 + MDX + Tailwind CSS, Vercel 배포
- **용도**: 한국 주식 시장 분석 블로그 (특징주, 신규상장주, 테마뉴스, 핫이슈)
- **글 자동생성**: `npx tsx scripts/generate-post.ts "키워드" --category <카테고리>`

## 카테고리별 글 작성 명령어

```bash
# 주식특징주 (매일 장 마감 후)
npx tsx scripts/generate-post.ts "3월20일자 주식특징주" --category featured-stocks

# 신규상장주 (38커뮤니케이션 데이터 필수)
npx tsx scripts/generate-post.ts "회사명" --category new-stocks

# 핫이슈
npx tsx scripts/generate-post.ts "키워드" --category hot-issues

# 테마뉴스
npx tsx scripts/generate-post.ts "키워드" --category theme-news
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

### 핫이슈 / 테마뉴스
- Unsplash → Pixabay → Pexels 순서로 키워드 기반 이미지 검색
- `scripts/lib/image-search.ts`의 KEYWORD_MAP으로 한국어→영어 변환

## 신규상장주 글 작성 규칙 (매우 중요)

### 데이터 소스
1. **38커뮤니케이션 데이터**: 사용자가 `scripts/data/` 폴더에 텍스트 파일로 제공
2. **DART 투자설명서**: `scripts/lib/dart-api.ts`로 자동 수집 (보조)

### 38커뮤니케이션 데이터를 반드시 사용해야 하는 항목
- 확정공모가, 희망공모가 밴드
- 청약경쟁률, 기관경쟁률
- 의무보유확약 비율 및 기간별 내역
- 수요예측 가격분포 (상단/하단/초과 등)
- 매출현황, 재무제표 수치
- 주가지표 (EPS, PER, BPS, PBR, PSR)
- 주요주주 현황 (최대주주, 벤처금융 등)
- 유통가능 물량 / 매각제한 물량
- 장외시장 거래동향
- 동종업체 비교

### 글 구조 (고정)
1. 서두 (공모 핵심 수치 요약)
2. 공모 현황 (테이블)
3. 수요예측 결과 분석
4. 사업 및 산업 분석
5. 주요 재무 분석 (매출현황 + 손익 추이 + 재무비율 + 주가지표)
6. 주요 주주현황
7. 유통주식 및 보호예수 물량 분석
8. 투자 포인트 (5개 이상)
9. 리스크 포인트 (5개 이상)
10. 상장 전망 및 결론
11. FAQ (5문 5답)

### 주의사항
- **Claude API가 자체 생성한 추측성 정보를 쓰지 말 것** (주간사, 파트너십 등)
- 38데이터에 없는 정보는 작성하지 않거나 "확인 필요"로 표시
- 모든 수치는 38데이터 원문 그대로 인용
- 글 최소 5,000자 이상

## 주식특징주 글 작성 규칙

### 데이터 소스
- 사용자가 당일 특징주 데이터를 직접 제공
- Google 뉴스 RSS로 최신 뉴스 자동 검색

### 글 구조
1. 시장 요약 (코스피/코스닥 등락)
2. 테마별 특징주 분석 (각 테마에 관련 종목 + 급등 사유)
3. 종목별 상세 분석
4. 관련주 시세 테이블 (자동 생성)
5. 투자 유의사항

### 관련주 선정 규칙
- **대형주만이 아닌 중소형주도 반드시 섞을 것**
- 최소 10~16개 종목

## 빌드 & 배포

```bash
npm run build    # Next.js 빌드 + 사이트맵 생성
git add -A && git commit -m "feat: 글 제목" && git push   # Vercel 자동 배포
```

## 세션 연속성

### 대화가 끊겼을 때
1. `/resume-session`으로 마지막 세션 상태 확인
2. 이 CLAUDE.md를 읽으면 모든 규칙이 자동 로드됨
3. 코드를 다시 분석할 필요 없음 — 이 파일이 규칙의 single source of truth

### 세션 저장
- 작업 중간이나 끝에 `/save-session`으로 상태 저장
- `~/.claude/sessions/` 에 자동 저장됨

## 주요 파일 경로

| 파일 | 설명 |
|------|------|
| `scripts/generate-post.ts` | 글 자동생성 메인 스크립트 |
| `scripts/lib/claude-prompt.ts` | Claude API 시스템/유저 프롬프트 |
| `scripts/lib/image-search.ts` | 썸네일 생성 (Sharp) + 이미지 검색 |
| `scripts/lib/dart-api.ts` | DART 투자설명서 자동 수집 |
| `scripts/lib/news-search.ts` | Google 뉴스 RSS 검색 |
| `scripts/lib/stock-data.ts` | 관련주 시세 크롤링 |
| `scripts/data/` | 38커뮤니케이션 등 수동 데이터 파일 |
| `content/posts/` | MDX 블로그 글 |
| `public/images/thumbnails/` | 생성된 썸네일 이미지 |
| `public/images/featured-stocks-bg.jpg` | 주식특징주 썸네일 배경 |

## 환경 변수 (.env.local)

- `ANTHROPIC_API_KEY` — Claude API
- `DART_API_KEY` — DART 공시 API
- `UNSPLASH_ACCESS_KEY` — 이미지 검색
- `PIXABAY_API_KEY` — 이미지 검색 (fallback)
- `PEXELS_API_KEY` — 이미지 검색 (2nd fallback)
