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
  TopStock,
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
  // Build table rows for Loop scene.
  //   - hot-issues: show ALL stocks in original table order (up to 10)
  //   - featured-stocks: show stocks not already covered in Body (legacy behavior)
  const loopTableRows: TableRow[] =
    input.category === "hot-issues"
      ? input.allStocks.slice(0, 10).map((s) => ({
          name: s.name,
          changePercent: s.changePercent,
          sector: s.sector,
        }))
      : (() => {
          const bodyStockNames = new Set(
            script.body.map((s) => s.stockFocus).filter((n): n is string => n !== null),
          );
          return input.allStocks
            .filter((s) => !bodyStockNames.has(s.name))
            .slice(0, 8)
            .map((s) => ({
              name: s.name,
              changePercent: s.changePercent,
              sector: s.sector,
            }));
        })();

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

    // Hot-issues: suppress % display in body scenes AND loop table scene
    // because the post may be read days later and the live % has drifted.
    const suppressStats =
      input.category === "hot-issues" &&
      (sceneType === "chart" || sceneType === "stock_card" || sceneType === "loop");

    scenes.push({
      type: sceneType,
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
  // staticFile() can resolve it. SHORTS_BGM_FILE env var = "bgm.mp3" by default,
  // can be overridden per-render (e.g. for A/B testing different tracks).
  // Set to "none" or empty to disable BGM entirely.
  const bgmEnv = (process.env.SHORTS_BGM_FILE ?? "bgm.mp3").trim();
  let bgmSrc: string | null = null;
  if (bgmEnv && bgmEnv !== "none") {
    const bgmSourcePath = path.join(process.cwd(), "public", "audio", bgmEnv);
    if (fs.existsSync(bgmSourcePath)) {
      const bgmDestPath = path.join(pendingDir(input.slug), bgmEnv);
      fs.copyFileSync(bgmSourcePath, bgmDestPath);
      bgmSrc = bgmEnv;
    } else {
      console.log(`   ⚠️  BGM 파일 없음 (skip): ${bgmSourcePath}`);
    }
  }
  const bgmVolumeRaw = Number.parseFloat(process.env.SHORTS_BGM_VOLUME ?? "");
  const bgmVolume = Number.isFinite(bgmVolumeRaw) ? bgmVolumeRaw : 0.10;

  // Header title: featured-stocks uses date, hot-issues uses shortened post title
  const headerTitle =
    input.category === "hot-issues"
      ? buildHotIssuesHeaderTitle(input.title)
      : formatHeaderTitle(input.date);

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

  // CTA (final scene)
  segments.push({
    type: "cta",
    narration: script.cta.narration,
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
    charCount: countKoreanChars(script.cta.narration),
  });

  return segments;
}

function countKoreanChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

function formatHeaderTitle(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return "오늘 주목해야 할 종목";
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  return `${month}월 ${day}일 주목해야 할 종목`;
}

/**
 * Build a 2-line header title for hot-issues from the blog post title.
 *
 * Returns a string with a single \n separator. The Letterbox component uses
 * whiteSpace: "pre-line" to render the newline and auto-reduces font size
 * when 2+ lines are present.
 *
 * Split strategy — context vs. stock-category noun:
 *   Line 1: context/keyword (theme, trigger, 기대감, etc.)
 *   Line 2: stock category + "TOP N"
 *
 * Split anchor priority:
 *   1. Last word ending in "주" (건설주, 방산주, 반도체주, 2차전지주 ...)
 *   2. Last non-trivial word before "관련주"
 *   3. Middle word (fallback)
 *
 * Examples:
 *   "중동전쟁 종전 기대감 건설주 관련주 TOP 7 | 대장주·수혜주·테마주 총정리"
 *     → "중동전쟁 종전 기대감\n건설주 TOP 7"
 *
 *   "엔비디아 광통신 관련주 TOP 10 | ..."
 *     → "엔비디아\n광통신 TOP 10"
 *
 *   "스테이블코인·에이전틱 AI 관련주 TOP 5 | ..."
 *     → "스테이블코인·에이전틱\nAI TOP 5"
 */
function buildHotIssuesHeaderTitle(title: string): string {
  // 1. Remove subtitle
  const beforePipe = title.split("|")[0].trim();

  // 2. Extract "TOP N" (keep separator so line 2 reads naturally)
  const topMatch = /TOP\s*(\d+)/i.exec(beforePipe);
  const topSuffix = topMatch ? `TOP ${topMatch[1]}` : "";

  // 3. Strip "TOP N" and trailing "관련주"/"수혜주"/"테마주" from the core
  const core = beforePipe
    .replace(/TOP\s*\d+/gi, "")
    .replace(/\s*수혜주\s*/g, " ")
    .replace(/\s*테마주\s*/g, " ")
    .replace(/\s*관련주\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = core.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return title;

  // 4. Find anchor — last word ending in "주" (stock category)
  //    Exclude trivial matches (e.g., standalone "주" or "기대감주")
  let anchor = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (/주$/.test(w) && w.length >= 2 && !/(기대감|전망|분석|이슈|뉴스)주$/.test(w)) {
      anchor = i;
      break;
    }
  }

  // 5. Fallback: split in the middle if no "주" anchor found
  if (anchor < 0) {
    anchor = Math.max(1, Math.ceil(words.length / 2));
  }

  // 6. Single-word edge case: don't split, return as-is with TOP suffix
  if (anchor === 0 || words.length === 1) {
    return topSuffix ? `${words.join(" ")} ${topSuffix}` : words.join(" ");
  }

  const line1 = words.slice(0, anchor).join(" ");
  const line2Body = words.slice(anchor).join(" ");
  const line2 = topSuffix ? `${line2Body} ${topSuffix}` : line2Body;

  return `${line1}\n${line2}`;
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
