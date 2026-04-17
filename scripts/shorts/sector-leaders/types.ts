/**
 * Types specific to the sector-leaders shorts category.
 *
 * These types are intentionally kept in a separate file (not in the shared
 * ../types.ts) so that featured-stocks and hot-issues code can never depend
 * on sector-leaders shapes and vice-versa.
 */

import type {
  BodyScene,
  CTASegment,
  HookSegment,
  LoopSegment,
  RenderScene,
  ShortsTableRow,
  TopStock,
} from "../types";

/**
 * One row in a sector's stock table — the sector-leaders table only shows
 * 종목명 + 상승률. No sector column, no trade amount.
 */
export interface SectorStockRow {
  readonly name: string;
  readonly changePercent: number;
}

/** One sector entry extracted from the "## 섹터별 특징주 분석" H2 section. */
export interface SectorScene {
  /** "🔐 양자암호/양자컴퓨팅 관련주" (emoji + text as-is from H3). */
  readonly sectorHeading: string;
  /** Emoji-only prefix if the heading starts with one, else "". */
  readonly emoji: string;
  /** Heading text minus the leading emoji, for display without icon. */
  readonly sectorTitle: string;
  /** 1~2 sentence explanation (narration + optional on-screen subtitle). */
  readonly reason: string;
  /** Stocks listed in 주요 종목: — every one included, no cap. */
  readonly stocks: readonly SectorStockRow[];
}

/** Sector-leaders input data — mirrors ShortsInputData shape but sector-centric. */
export interface SectorLeadersInputData {
  readonly slug: string;
  readonly date: string;
  readonly title: string;
  readonly description: string;
  readonly category: "sector-leaders";
  readonly relatedStocks: readonly string[];
  readonly tags: readonly string[];
  readonly thumbnailPath: string | null;
  readonly sectors: readonly SectorScene[];
  readonly allStocks: readonly TopStock[];
}

/** Sector-leaders script — identical shape to ShortsScript to reuse TTS/render. */
export interface SectorLeadersScript {
  readonly hook: HookSegment;
  readonly body: readonly BodyScene[];
  readonly cta: CTASegment;
  readonly loop: LoopSegment;
  readonly totalDurationSec: number;
  readonly tableFormat: readonly ShortsTableRow[];
  /**
   * Parallel array to `body` — for each body scene, the sector rows to render
   * in the sector_table scene. Kept here so assets.ts can read it without
   * re-parsing the MDX.
   */
  readonly sectorStocks: readonly (readonly SectorStockRow[])[];
  /** Parallel array to `body` — sector heading (for on-screen title). */
  readonly sectorHeadings: readonly string[];
}

/**
 * Asset build result — we reuse `ShortsAssets` directly so render.ts works
 * unchanged. No new type is defined here on purpose.
 */
export type SectorLeadersAssets = import("../types").ShortsAssets;
