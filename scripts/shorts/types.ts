/**
 * Shared types for the YouTube Shorts pipeline.
 *
 * Stage flow: extract → script → tts → assets → render
 * Each stage's output type is the next stage's input.
 */

// ============================================================
// Stage 1: extract.ts output
// ============================================================

export interface ShortsInputData {
  readonly slug: string;
  readonly date: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;                        // "featured-stocks" | "hot-issues" | etc.
  readonly relatedStocks: readonly string[];
  readonly tags: readonly string[];
  readonly thumbnailPath: string | null;
  readonly topStocks: readonly TopStock[];          // 섹터 leader Top 5 (featured-stocks) / 관련주 (hot-issues)
  readonly allStocks: readonly TopStock[];          // 테이블 전체 (loop scene용)
  readonly markPhrases: readonly string[];
  readonly sectorHeadings: readonly string[];
  readonly hookCandidates: readonly string[];
  readonly hookSummary: string | null;              // hot-issues only: 핵심 요약 첫 2~3문장 (Hook narration 원천)
}

export interface TopStock {
  readonly name: string;
  readonly sector: string;
  readonly reason: string;
  readonly changePercent: number;
  readonly tradeAmount: string;
}

// ============================================================
// Stage 2: script.ts output (Gemini → ShortsScript JSON)
// ============================================================

export interface ShortsScript {
  readonly hook: HookSegment;
  readonly body: readonly BodyScene[];
  readonly cta: CTASegment;
  readonly loop: LoopSegment;
  readonly totalDurationSec: number;
  readonly tableFormat: readonly ShortsTableRow[];
}

export interface HookSegment {
  readonly narration: string;
  readonly onScreenText: string;
  readonly visualDirection: string;
  readonly fomoTrigger: string;
}

export interface BodyScene {
  readonly idx: number;
  readonly narration: string;
  readonly onScreenText: string;
  readonly visualDirection: string;
  readonly stockFocus: string | null;
  readonly mainBusiness?: string;          // 종목 주요 사업 1줄 (10~20자)
  readonly durationSec: number;
  readonly emphasisWords: readonly string[];
  readonly sfxCue: SFXName | null;
}

export interface CTASegment {
  readonly narration: string;
  readonly onScreenText: string;
  readonly visualDirection: string;
  readonly arrowDirection: ArrowDirection;
  readonly brandName: string;
  readonly siteUrl: string;
  readonly durationSec: number;
  readonly sfxCue: SFXName;
}

export interface LoopSegment {
  readonly narration: string;
  readonly onScreenText: string;
  readonly hookConnector: string;
  readonly visualDirection: string;
  readonly durationSec: number;
}

export interface ShortsTableRow {
  readonly time: string;
  readonly visuals: string;
  readonly captions: string;
  readonly sfx: string;
}

export type SFXName = "swoosh" | "pop" | "impact" | "notification";
export type ArrowDirection = "to_profile_top_left" | "to_profile_top_right" | "to_description";

// ============================================================
// Stage 3: tts.ts output
// ============================================================

export interface TTSResult {
  readonly audioPath: string;            // {slug}.audio.wav
  readonly voice: string;
  readonly durationSec: number;          // Total audio length
  readonly sampleRate: number;
  readonly sceneDurations?: readonly number[]; // Per-scene exact duration (seconds)
}

// ============================================================
// Stage 4: assets.ts output (Remotion input props)
// ============================================================

export interface ShortsAssets {
  readonly slug: string;
  readonly audioSrc: string;
  readonly bgmSrc: string | null;     // BGM 파일명 (publicDir 기준 basename), null이면 BGM 없음
  readonly bgmVolume: number;          // BGM 볼륨 0.0~1.0, 권장 0.08~0.15
  readonly scenes: readonly RenderScene[];
  readonly sfxCues: readonly SFXCue[];
  readonly totalDurationSec: number;
  readonly headerTitle: string;       // "4월 6일 주목해야 할 종목"
  readonly footerBrand: string;       // "K주식핫이슈"
  readonly footerHint: string;        // "프로필 → 전체 분석"
}

export interface RenderScene {
  readonly type: SceneType;
  readonly narration: string;
  readonly onScreenText: string;
  readonly visualDirection: string;
  readonly emphasisWords: readonly string[];
  readonly stockData: StockSnapshot | null;
  readonly priceHistory: readonly PricePoint[] | null;
  readonly mainBusiness: string | null;            // 종목 주요 사업 1줄
  readonly reason: string | null;                  // MDX 테이블 "상승이유" 컬럼 (chart 밑 표시)
  readonly suppressStats: boolean;                 // hot-issues: hide giant % number (data drifts over time)
  readonly startFrame: number;
  readonly durationFrames: number;
  readonly ctaProps: CTAProps | null;
  readonly tableRows: readonly TableRow[] | null;
}

export interface TableRow {
  readonly name: string;
  readonly changePercent: number;
  readonly sector: string;
}

export type SceneType = "hook" | "stock_card" | "chart" | "cta" | "loop";

export interface CTAProps {
  readonly brandName: string;
  readonly siteUrl: string;
  readonly arrowDirection: ArrowDirection;
}

export interface SFXCue {
  readonly file: SFXName;
  readonly atFrame: number;
  readonly volume: number;
}

export interface StockSnapshot {
  readonly name: string;
  readonly code: string | null;
  readonly currentPrice: number;
  readonly changePercent: number;
  readonly tradeAmount: string;
  readonly sector?: string;
}

export interface PricePoint {
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

// ============================================================
// Pipeline run options
// ============================================================

export interface RunOpts {
  readonly force?: boolean;
  readonly forceScript?: boolean;
  readonly forceTTS?: boolean;
  readonly forceRender?: boolean;
  readonly voice?: string;
}
