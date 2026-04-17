/**
 * Stage 2 (sector-leaders): Build a ShortsScript deterministically.
 *
 * Sector-leaders is a rule-based category (no Gemini call):
 *   - Hook: fixed template "{N월 N일} 주도 섹터와 종목은?"
 *   - Body: one scene per sector (narration = 상승이유, on-screen = sector heading)
 *   - CTA:  identical to featured/hot-issues ("K주식핫이슈" + kstockflow.com)
 *   - Loop: empty narration → collectSegments drops it (per-user: no big
 *           "today's stocks" table ending, only CTA closes the short)
 *
 * Output is shape-compatible with ShortsScript so tts.ts + assets.ts /
 * render.ts can reuse the generic flow.
 */

import fs from "node:fs";
import { ensureDir, pendingDir, scriptJsonPath } from "../lib/shorts-paths";
import type { BodyScene } from "../types";
import type {
  SectorLeadersInputData,
  SectorLeadersScript,
  SectorStockRow,
} from "./types";

// Narration timing: ~8 chars/sec (Cloud TTS Chirp3 at default rate).
const HOOK_DURATION_SEC = 3;
const SECTOR_DURATION_SEC = 3.5;
const CTA_DURATION_SEC = 6;

export function buildSectorLeadersScript(
  input: SectorLeadersInputData,
): SectorLeadersScript {
  const monthDay = formatMonthDay(input.date);
  const sectorCount = input.sectors.length;

  // Hook — fixed template per user spec (2026-04-15).
  const hookNarration = `${monthDay} 시장을 주도한 섹터와 종목은?`;
  const hookOnScreen = `${monthDay}\n주도 섹터 TOP ${sectorCount}`;

  const body: BodyScene[] = [];
  const sectorStocks: SectorStockRow[][] = [];
  const sectorHeadings: string[] = [];

  input.sectors.forEach((sector, i) => {
    const narration = buildSectorNarration(sector.sectorTitle, sector.reason);
    // On-screen: full heading (with emoji) shown inside the sector scene.
    body.push({
      idx: i + 1,
      narration,
      onScreenText: sector.sectorHeading,
      visualDirection: `sector_table: ${sector.sectorTitle}`,
      stockFocus: sector.sectorTitle, // non-null so assets.ts keeps the scene
      mainBusiness: undefined,
      durationSec: SECTOR_DURATION_SEC,
      emphasisWords: [],
      sfxCue: null,
    });
    sectorStocks.push([...sector.stocks]);
    sectorHeadings.push(sector.sectorHeading);
  });

  const cta = {
    narration: "더 자세한 분석은 프로필 링크에서 K주식핫이슈를 확인하세요.",
    onScreenText: "K주식핫이슈",
    visualDirection: "brand card + profile arrow",
    arrowDirection: "to_profile_top_left" as const,
    brandName: "K주식핫이슈",
    siteUrl: "kstockflow.com",
    durationSec: CTA_DURATION_SEC,
    sfxCue: "notification" as const,
  };

  // Empty loop — assets.ts collectSegments drops scenes with no narration.
  const loop = {
    narration: "",
    onScreenText: "",
    hookConnector: "",
    visualDirection: "",
    durationSec: 0,
  };

  const totalDurationSec =
    HOOK_DURATION_SEC + SECTOR_DURATION_SEC * sectorCount + CTA_DURATION_SEC;

  return {
    hook: {
      narration: hookNarration,
      onScreenText: hookOnScreen,
      visualDirection: "big title, 2-line",
      fomoTrigger: "주도 섹터 궁금증",
    },
    body,
    cta,
    loop,
    totalDurationSec,
    tableFormat: [],
    sectorStocks: sectorStocks.map((rows) => [...rows]),
    sectorHeadings,
  };
}

/**
 * Narration for each sector scene — short explanatory line.
 * Structure: "{sector-title}는 {reason (truncated)}"
 * Length target: 30~60 chars so a single scene stays ~3-4s.
 */
function buildSectorNarration(sectorTitle: string, reason: string): string {
  const cleanTitle = sectorTitle.replace(/\s*관련주\s*$/, "").trim();
  // Strip any leading dates from the reason so TTS doesn't double-say "4월 15일".
  const noDate = reason.replace(/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일,?\s*/, "").trim();
  if (noDate.length === 0) return `${cleanTitle} 강세`;
  // Cap narration to ~80 chars for timing predictability.
  const capped = noDate.length > 80 ? noDate.slice(0, 78).trim() + "…" : noDate;
  return capped;
}

function formatMonthDay(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return "오늘";
  return `${parseInt(m[2], 10)}월 ${parseInt(m[3], 10)}일`;
}

/**
 * Narration pronunciation fix — same pattern as the shared router:
 * prevent TTS from running 핫이슈 into "핫티슈".
 */
function fixNarration(s: string): string {
  return s
    .replace(/핫이슈/g, "핫 이슈")
    .replace(/블로그/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function persistSectorLeadersScript(
  slug: string,
  script: SectorLeadersScript,
): void {
  const fixed: SectorLeadersScript = {
    ...script,
    hook: { ...script.hook, narration: fixNarration(script.hook.narration) },
    body: script.body.map((scene) => ({
      ...scene,
      narration: fixNarration(scene.narration),
    })),
    cta: { ...script.cta, narration: fixNarration(script.cta.narration) },
  };
  ensureDir(pendingDir(slug));
  fs.writeFileSync(scriptJsonPath(slug), JSON.stringify(fixed, null, 2), "utf-8");
}
