/**
 * Stage 4 (sector-leaders): Build RenderScenes for the sector-leaders shorts.
 *
 * Scene order:
 *   Hook → SectorTable × N → CTA          (no Loop scene)
 *
 * The sector_table scene carries its table rows in scene.tableRows, the
 * sector heading in scene.onScreenText, and the reason narration in
 * scene.narration. The Remotion SectorTableScene reads all three.
 */

import fs from "node:fs";
import path from "node:path";
import { assetsJsonPath, ensureDir, pendingDir } from "../lib/shorts-paths";
import type { RenderScene, TTSResult } from "../types";
import type {
  SectorLeadersAssets,
  SectorLeadersInputData,
  SectorLeadersScript,
  SectorStockRow,
} from "./types";

const FPS = 30;

interface BuildOpts {
  readonly force?: boolean;
}

export async function buildSectorLeadersAssets(
  input: SectorLeadersInputData,
  script: SectorLeadersScript,
  tts: TTSResult,
  opts: BuildOpts = {},
): Promise<SectorLeadersAssets> {
  const cachePath = assetsJsonPath(input.slug);
  if (!opts.force && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as SectorLeadersAssets;
    console.log(`   ♻️  assets 캐시 사용`);
    return cached;
  }

  // Build flat segment list (must match tts.ts collectSceneTexts order).
  const segments = collectSectorLeadersSegments(script);
  const totalChars = segments.reduce((sum, seg) => sum + seg.charCount, 0);
  const audioSec = tts.durationSec;
  const sceneDurations = tts.sceneDurations;
  const useExact = sceneDurations !== undefined && sceneDurations.length === segments.length;

  const scenes: RenderScene[] = [];
  let cumulativeFrames = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let segDurationSec: number;
    if (useExact && sceneDurations) {
      segDurationSec = sceneDurations[i];
    } else {
      const proportion = seg.charCount / totalChars;
      segDurationSec = audioSec * proportion;
    }
    let durationFrames = Math.round(segDurationSec * FPS);
    if (durationFrames < 15) durationFrames = 15;

    scenes.push({
      type: seg.type,
      category: "sector-leaders",
      narration: seg.narration,
      onScreenText: seg.onScreenText,
      visualDirection: seg.visualDirection,
      emphasisWords: [],
      stockData: null,
      priceHistory: null,
      mainBusiness: null,
      reason: seg.reason,
      suppressStats: true, // sector scenes render their own tables, no big %
      startFrame: cumulativeFrames,
      durationFrames,
      ctaProps: seg.ctaProps,
      tableRows: seg.tableRows,
    });

    cumulativeFrames += durationFrames;
  }

  const totalDurationSec = cumulativeFrames / FPS;
  const audioFilename = tts.audioPath.split(/[/\\]/).pop() ?? "";

  // BGM — same logic as featured/hot-issues: prefer env, fall back to bgm-1/2.
  const BGM_FALLBACKS = ["bgm-1.mp3", "bgm-2.mp3", "bgm.mp3"] as const;
  const bgmEnvRaw = (process.env.SHORTS_BGM_FILE ?? "").trim();
  let bgmSrc: string | null = null;
  if (bgmEnvRaw !== "none") {
    const candidates = bgmEnvRaw ? [bgmEnvRaw] : BGM_FALLBACKS;
    for (const candidate of candidates) {
      const bgmSourcePath = path.join(process.cwd(), "public", "audio", candidate);
      if (fs.existsSync(bgmSourcePath)) {
        const bgmDestPath = path.join(pendingDir(input.slug), candidate);
        fs.copyFileSync(bgmSourcePath, bgmDestPath);
        bgmSrc = candidate;
        console.log(`   🎵 BGM: ${candidate}`);
        break;
      }
    }
  }
  const bgmVolRaw = Number.parseFloat(process.env.SHORTS_BGM_VOLUME ?? "");
  const bgmVolume = Number.isFinite(bgmVolRaw) ? bgmVolRaw : 0.1;

  const headerTitle = formatSectorLeadersHeader(input.date, input.sectors.length);
  // dateBadge는 hot-issues 전용 — sector-leaders는 letterbox 우측 상단 배지 없음.
  const dateBadge: string | null = null;

  const assets: SectorLeadersAssets = {
    slug: input.slug,
    audioSrc: audioFilename,
    bgmSrc,
    bgmVolume,
    scenes,
    sfxCues: [],
    totalDurationSec,
    headerTitle,
    footerBrand: "K주식핫이슈",
    footerHint: "프로필 → 전체 분석",
    dateBadge,
  };

  ensureDir(pendingDir(input.slug));
  fs.writeFileSync(cachePath, JSON.stringify(assets, null, 2), "utf-8");
  return assets;
}

interface Segment {
  readonly type: RenderScene["type"];
  readonly narration: string;
  readonly onScreenText: string;
  readonly visualDirection: string;
  readonly charCount: number;
  readonly tableRows: readonly { name: string; changePercent: number; sector: string }[] | null;
  readonly reason: string | null;
  readonly ctaProps: RenderScene["ctaProps"];
}

function collectSectorLeadersSegments(script: SectorLeadersScript): Segment[] {
  const segments: Segment[] = [];

  segments.push({
    type: "hook",
    narration: script.hook.narration,
    onScreenText: script.hook.onScreenText,
    visualDirection: script.hook.visualDirection,
    charCount: countChars(script.hook.narration),
    tableRows: null,
    reason: null,
    ctaProps: null,
  });

  script.body.forEach((scene, i) => {
    const rows: readonly SectorStockRow[] = script.sectorStocks[i] ?? [];
    segments.push({
      type: "sector_table",
      narration: scene.narration,
      onScreenText: script.sectorHeadings[i] ?? scene.onScreenText,
      visualDirection: scene.visualDirection,
      charCount: countChars(scene.narration),
      tableRows: rows.map((r) => ({
        name: r.name,
        changePercent: r.changePercent,
        sector: "", // SectorTableScene ignores this; shared shape keeps type
      })),
      reason: scene.narration,
      ctaProps: null,
    });
  });

  // CTA — narration gets the same fixed subscribe tail as featured/hot-issues.
  const ctaNarration = `${script.cta.narration} 매일 장 마감 후 업로드! 좋아요와 구독 부탁드립니다.`;
  segments.push({
    type: "cta",
    narration: ctaNarration,
    onScreenText: script.cta.onScreenText,
    visualDirection: script.cta.visualDirection,
    charCount: countChars(ctaNarration),
    tableRows: null,
    reason: null,
    ctaProps: {
      brandName: script.cta.brandName,
      siteUrl: script.cta.siteUrl,
      arrowDirection: script.cta.arrowDirection,
    },
  });

  return segments;
}

function countChars(s: string): number {
  return s.replace(/\s/g, "").length;
}

/**
 * Letterbox header title for sector-leaders shorts.
 *   "2026-04-15", 8 → "4월 15일 주도 섹터 TOP 8"
 */
export function formatSectorLeadersHeader(dateStr: string, sectorCount: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const label =
    m === null
      ? "오늘의 주도 섹터"
      : `${parseInt(m[2], 10)}월 ${parseInt(m[3], 10)}일 주도 섹터`;
  return sectorCount > 0 ? `${label} TOP ${sectorCount}` : label;
}

