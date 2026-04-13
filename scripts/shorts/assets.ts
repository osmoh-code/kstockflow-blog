/**
 * Stage 4: Build the ShortsAssets props for Remotion.
 *
 * Combines:
 *   - ShortsScript (Stage 2 output)
 *   - TTSResult (Stage 3 output)
 *   - Live stock snapshot data (from stock-data.ts)
 *
 * Computes scene timings from character-count proportions of the actual
 * TTS audio length. This gives ~95% accurate sync between subtitles and
 * narration without requiring word-level timestamps.
 */

import fs from "node:fs";
import path from "node:path";
import { fetchDailyHistory, lookupStockCode, searchStockCode, syntheticHistory } from "./lib/stock-history";
import { assetsJsonPath, ensureDir, pendingDir } from "./lib/shorts-paths";
import {
  FEATURED_SUPPRESS_STATS,
  buildFeaturedLoopTableRows,
  formatFeaturedHeaderTitle,
} from "./featured/assets";
import {
  buildHotIssuesLoopTableRows,
  resolveHotIssuesHeaderTitle,
  shouldSuppressStatsForHotIssues,
} from "./hot-issues/assets";
import type {
  PricePoint,
  RenderScene,
  SceneType,
  SFXCue,
  ShortsAssets,
  ShortsInputData,
  ShortsScript,
  StockSnapshot,
  TableRow,
  TTSResult,
} from "./types";

const FPS = 30;

interface BuildOpts {
  readonly force?: boolean;
}

export async function buildAssets(
  input: ShortsInputData,
  script: ShortsScript,
  tts: TTSResult,
  opts: BuildOpts = {},
): Promise<ShortsAssets> {
  const cachePath = assetsJsonPath(input.slug);

  if (!opts.force && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as ShortsAssets;
    console.log(`   ♻️  assets 캐시 사용`);
    return cached;
  }

  // 1. Collect segments (must match collectSceneTexts() order in tts.ts)
  const segments = collectSegments(script);
  const totalChars = segments.reduce((sum, seg) => sum + seg.charCount, 0);
  const audioSec = tts.durationSec;
  // Per-scene exact durations from per-scene TTS calls (preferred path)
  const sceneDurations = tts.sceneDurations;
  const useExactDurations = sceneDurations !== undefined && sceneDurations.length === segments.length;

  // 2. Fetch live stock snapshots for stocks referenced in body scenes
  const stockNames = new Set<string>();
  for (const seg of segments) {
    if (seg.stockFocus) stockNames.add(seg.stockFocus);
  }
  const stockSnapshots = await fetchStockSnapshots(input, Array.from(stockNames));

  // 2b. Fetch price history (Phase 2 chart) for each stock in parallel
  console.log(`   📈 일봉 데이터 fetch (${stockNames.size}개 종목)...`);
  const priceHistoryMap = new Map<string, readonly PricePoint[]>();
  let realCount = 0;
  let fallbackCount = 0;
  let noCodeCount = 0;
  await Promise.all(
    Array.from(stockNames).map(async (name) => {
      // 1. Try cached map, then fall back to live Naver search API
      let code = lookupStockCode(name);
      if (!code) {
        code = await searchStockCode(name);
      }

      let history: readonly PricePoint[] | null = null;
      let usedFallback = false;

      if (code) {
        history = await fetchDailyHistory(code);
      } else {
        noCodeCount++;
        console.log(`      ⚠️  ${name}: 종목 코드 검색 실패 → synthetic`);
      }

      if (!history || history.length === 0) {
        const stock = input.allStocks.find((s) => s.name === name);
        if (stock) {
          history = syntheticHistory(stock);
          usedFallback = true;
        }
      }
      if (history && history.length > 0) {
        priceHistoryMap.set(name, history);
        if (usedFallback) {
          fallbackCount++;
        } else {
          realCount++;
          console.log(`      ✅ ${name} (${code}): 실제 fetch ${history.length}개`);
        }
      }
    }),
  );
  console.log(`      📊 실제 ${realCount}개 / fallback ${fallbackCount}개 / 코드없음 ${noCodeCount}개`);

  // 3. Build RenderScenes with frame-accurate timing
  // Loop table rows — delegated to category-specific helpers for clarity.
  const loopTableRows: TableRow[] =
    input.category === "hot-issues"
      ? buildHotIssuesLoopTableRows(input.allStocks)
      : buildFeaturedLoopTableRows(input.allStocks, script);

  const scenes: RenderScene[] = [];
  let cumulativeChars = 0;
  let cumulativeFrames = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let segDurationSec: number;
    if (useExactDurations && sceneDurations) {
      segDurationSec = sceneDurations[i];
    } else {
      const proportion = seg.charCount / totalChars;
      segDurationSec = audioSec * proportion;
    }
    let durationFrames = Math.round(segDurationSec * FPS);
    // Enforce minimum 0.5s per scene to avoid invisible flashes
    if (durationFrames < 15) durationFrames = 15;

    const stockData = seg.stockFocus ? stockSnapshots.get(seg.stockFocus) ?? null : null;
    const tableRows = seg.type === "loop" ? loopTableRows : null;
    const priceHistory = seg.stockFocus ? priceHistoryMap.get(seg.stockFocus) ?? null : null;
    // MDX 테이블의 "상승이유" 컬럼에서 lookup
    const reason = seg.stockFocus
      ? input.allStocks.find((s) => s.name === seg.stockFocus)?.reason ?? null
      : null;

    // Promote stock_card → chart when we have price history (Phase 2 chart)
    const sceneType: SceneType = seg.type === "stock_card" && priceHistory ? "chart" : seg.type;

    // suppressStats — delegated to category-specific rule so the logic for
    // each category lives next to the rest of its assets code.
    const suppressStats =
      input.category === "hot-issues"
        ? shouldSuppressStatsForHotIssues(sceneType)
        : FEATURED_SUPPRESS_STATS;

    scenes.push({
      type: sceneType,
      category: input.category, // explicit branch flag for Remotion scenes
      narration: seg.narration,
      onScreenText: seg.onScreenText,
      visualDirection: seg.visualDirection,
      emphasisWords: seg.emphasisWords,
      stockData,
      priceHistory,
      mainBusiness: seg.mainBusiness,
      reason,
      suppressStats,
      startFrame: cumulativeFrames,
      durationFrames,
      ctaProps: seg.ctaProps,
      tableRows,
    });

    cumulativeChars += seg.charCount;
    cumulativeFrames += durationFrames;
  }

  const totalDurationSec = cumulativeFrames / FPS;
  // SFX disabled in MVP — needs CC0 sfx files in static dir (Phase 2)
  const sfxCues: SFXCue[] = [];

  // Use basename only — render.ts sets publicDir to pendingDir(slug)
  const audioFilename = tts.audioPath.split(/[/\\]/).pop() ?? "";

  // BGM: copy from public/audio/{SHORTS_BGM_FILE} into pendingDir so Remotion's
  // staticFile() can resolve it. SHORTS_BGM_FILE env var picks a specific track;
  // if unset we auto-pick the first existing file from a fallback list.
  // Set to "none" or empty to disable BGM entirely.
  const BGM_FALLBACKS = ["bgm-1.mp3", "bgm-2.mp3", "bgm.mp3"] as const;
  const bgmEnvRaw = (process.env.SHORTS_BGM_FILE ?? "").trim();
  let bgmSrc: string | null = null;
  if (bgmEnvRaw === "none") {
    // explicitly disabled
  } else {
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
    if (!bgmSrc) {
      console.log(`   ⚠️  BGM 파일 없음 (skip): public/audio/{${candidates.join(",")}}`);
    }
  }
  const bgmVolumeRaw = Number.parseFloat(process.env.SHORTS_BGM_VOLUME ?? "");
  const bgmVolume = Number.isFinite(bgmVolumeRaw) ? bgmVolumeRaw : 0.10;

  // Header title — delegated to category helpers. hot-issues checks frontmatter
  // override first internally; featured-stocks always uses the date-based title.
  const headerTitle =
    input.category === "hot-issues"
      ? resolveHotIssuesHeaderTitle(input)
      : formatFeaturedHeaderTitle(input.date);

  // Date badge for hot-issues (top-right corner): "N월 N일"
  let dateBadge: string | null = null;
  if (input.category === "hot-issues" && input.date) {
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date.trim());
    if (dm) {
      dateBadge = `${parseInt(dm[2], 10)}월 ${parseInt(dm[3], 10)}일`;
    }
  }

  const assets: ShortsAssets = {
    slug: input.slug,
    audioSrc: audioFilename,
    bgmSrc,
    bgmVolume,
    scenes,
    sfxCues,
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
  readonly type: SceneType;
  readonly narration: string;
  readonly onScreenText: string;
  readonly visualDirection: string;
  readonly emphasisWords: readonly string[];
  readonly stockFocus: string | null;
  readonly mainBusiness: string | null;
  readonly ctaProps: RenderScene["ctaProps"];
  readonly charCount: number;
}

function collectSegments(script: ShortsScript): Segment[] {
  const segments: Segment[] = [];

  // Hook
  segments.push({
    type: "hook",
    narration: script.hook.narration,
    onScreenText: script.hook.onScreenText,
    visualDirection: script.hook.visualDirection,
    emphasisWords: [],
    stockFocus: null,
    mainBusiness: null,
    ctaProps: null,
    charCount: countKoreanChars(script.hook.narration),
  });

  // Body scenes — skip any scene without a valid stockFocus (defensive)
  // LLM sometimes generates "시장 intro" cuts with no stock data → skip those.
  for (const scene of script.body) {
    if (!scene.stockFocus || scene.stockFocus.trim() === "") {
      console.log(`   ⏭️  body scene 스킵 (stockFocus 없음): "${scene.narration.slice(0, 30)}..."`);
      continue;
    }
    segments.push({
      type: "stock_card",
      narration: scene.narration,
      onScreenText: scene.onScreenText,
      visualDirection: scene.visualDirection,
      emphasisWords: scene.emphasisWords,
      stockFocus: scene.stockFocus,
      mainBusiness: scene.mainBusiness ?? null,
      ctaProps: null,
      charCount: countKoreanChars(scene.narration),
    });
  }

  // Loop scene — INCLUDED only if loop.narration is non-empty
  // (hot-issues populates it; featured-stocks leaves it empty so it's dropped)
  if (script.loop?.narration && script.loop.narration.trim().length > 0) {
    segments.push({
      type: "loop",
      narration: script.loop.narration,
      onScreenText: script.loop.onScreenText,
      visualDirection: script.loop.visualDirection,
      emphasisWords: [],
      stockFocus: null,
      mainBusiness: null,
      ctaProps: null,
      charCount: countKoreanChars(script.loop.narration),
    });
  }

  // CTA (final scene) — append fixed subscribe line after Gemini narration
  const ctaNarration = `${script.cta.narration} 매일 장 마감 후 업로드! 좋아요와 구독 부탁드립니다.`;
  segments.push({
    type: "cta",
    narration: ctaNarration,
    onScreenText: script.cta.onScreenText,
    visualDirection: script.cta.visualDirection,
    emphasisWords: [script.cta.brandName],
    stockFocus: null,
    mainBusiness: null,
    ctaProps: {
      brandName: script.cta.brandName,
      siteUrl: script.cta.siteUrl,
      arrowDirection: script.cta.arrowDirection,
    },
    charCount: countKoreanChars(ctaNarration),
  });

  return segments;
}

function countKoreanChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

/**
 * Fetch live stock snapshots from the existing stock-data.ts helper.
 * Falls back to a minimal snapshot if the external API fails — never throws.
 */
async function fetchStockSnapshots(
  input: ShortsInputData,
  names: readonly string[],
): Promise<Map<string, StockSnapshot>> {
  const map = new Map<string, StockSnapshot>();

  if (names.length === 0) return map;

  // Use input.topStocks as the primary source — they have changePercent + tradeAmount
  // already, no API call needed for MVP. Phase 2 can add live updates.
  for (const name of names) {
    const top = input.topStocks.find((s) => s.name === name);
    if (top) {
      map.set(name, {
        name: top.name,
        code: null,
        currentPrice: 0,
        changePercent: top.changePercent,
        tradeAmount: top.tradeAmount,
        sector: top.sector,
      });
    }
  }

  return map;
}
