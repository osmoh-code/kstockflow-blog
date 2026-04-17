/**
 * Sector-leaders YouTube Shorts pipeline — standalone orchestrator.
 *
 * ⚠️ This pipeline is INTENTIONALLY SEPARATE from scripts/shorts/shorts-pipeline.ts.
 * It must NOT share router logic with featured-stocks or hot-issues. It reuses
 * only the generic, scene-agnostic helpers (tts.ts, render.ts) which contain
 * no category-specific code.
 *
 * Cache isolation: writes into dist/shorts/pending/{slug}-sector-leaders/
 * so a featured-stocks pipeline run on the same MDX post (same original slug)
 * never collides.
 *
 * Usage:
 *   npx tsx scripts/shorts/sector-leaders-pipeline.ts <mdx-slug> [--force]
 *
 * Example:
 *   npx tsx scripts/shorts/sector-leaders-pipeline.ts 2026-04-15-featured-stocks
 *   → dist/shorts/pending/2026-04-15-featured-stocks-sector-leaders/*.mp4
 */

import fs from "node:fs";
import { extractSectorLeadersData } from "./sector-leaders/extract";
import {
  buildSectorLeadersScript,
  persistSectorLeadersScript,
} from "./sector-leaders/script";
import { buildSectorLeadersAssets } from "./sector-leaders/assets";
import { synthesizeForSlug } from "./tts";
import { renderShorts } from "./render";
import { mp4Path } from "./lib/shorts-paths";
import type { ShortsAssets } from "./types";

const CACHE_SUFFIX = "-sector-leaders";

export interface SectorLeadersRunOpts {
  readonly force?: boolean;
  readonly forceScript?: boolean;
  readonly forceTTS?: boolean;
  readonly forceRender?: boolean;
  readonly voice?: string;
}

export async function runSectorLeadersPipeline(
  mdxSlug: string,
  opts: SectorLeadersRunOpts = {},
): Promise<string> {
  const cacheSlug = `${mdxSlug}${CACHE_SUFFIX}`;
  const startedAt = Date.now();

  console.log("\n══════════════════════════════════════");
  console.log(`🎬 Sector-Leaders Shorts — ${mdxSlug}`);
  console.log(`   (cache slug: ${cacheSlug})`);
  console.log("══════════════════════════════════════\n");

  // Stage 1: extract
  console.log("📄 Step 1/5: 섹터별 MDX 파싱");
  const input = await extractSectorLeadersData(mdxSlug, cacheSlug);
  console.log(
    `   ✅ ${input.sectors.length}개 섹터, 종목 ${input.sectors.reduce(
      (n, s) => n + s.stocks.length,
      0,
    )}개\n`,
  );

  // Stage 2: script (deterministic, no Gemini)
  console.log("🛠️  Step 2/5: 섹터별 스크립트 생성");
  const script = buildSectorLeadersScript(input);
  persistSectorLeadersScript(cacheSlug, script);
  console.log(
    `   ✅ Hook + ${script.body.length} sector scene + CTA (loop 생략)\n`,
  );

  // Stage 3: TTS — reuses the shared synthesizer (reads scriptJsonPath(cacheSlug))
  console.log("🎤 Step 3/5: Cloud TTS 합성");
  const tts = await synthesizeForSlug(cacheSlug, {
    force: opts.force || opts.forceTTS,
    voice: opts.voice,
  });
  console.log(`   ✅ ${tts.voice}, ${tts.durationSec.toFixed(2)}초\n`);

  // Stage 4: assets
  console.log("📊 Step 4/5: 자산 준비");
  const assets = await buildSectorLeadersAssets(input, script, tts, {
    force: opts.force,
  });
  console.log(
    `   ✅ ${assets.scenes.length}개 scene, 총 ${assets.totalDurationSec.toFixed(1)}초\n`,
  );

  // Stage 5: render — reuses the shared renderer (reads mp4Path(cacheSlug))
  console.log("🎞️  Step 5/5: Remotion 렌더");
  const outputPath = await renderShorts(cacheSlug, assets as unknown as ShortsAssets, {
    force: opts.force || opts.forceRender,
  });
  const stat = fs.statSync(outputPath);
  console.log(`   ✅ ${outputPath}`);
  console.log(`      ${(stat.size / 1024 / 1024).toFixed(2)} MB\n`);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`🔔 검수: ${mp4Path(cacheSlug)}`);
  console.log(`   총 소요 시간: ${elapsed}초\n`);

  return outputPath;
}

// ============================================================
// CLI entry
// ============================================================

const isMain = (() => {
  try {
    const argv = (process.argv[1] ?? "").replace(/\\/g, "/");
    return argv.endsWith("/scripts/shorts/sector-leaders-pipeline.ts");
  } catch {
    return false;
  }
})();

if (isMain) {
  if (fs.existsSync(".env.local")) {
    for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }

  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--"));
  const force = args.includes("--force");
  const forceScript = args.includes("--force-script");
  const forceTTS = args.includes("--force-tts");
  const forceRender = args.includes("--force-render");

  if (!slug) {
    console.error(
      "사용법: npx tsx scripts/shorts/sector-leaders-pipeline.ts <mdx-slug> [--force|--force-script|--force-tts|--force-render]",
    );
    process.exit(1);
  }

  runSectorLeadersPipeline(slug, { force, forceScript, forceTTS, forceRender }).catch(
    (err) => {
      console.error(`\n❌ 파이프라인 실패:`, err);
      process.exit(1);
    },
  );
}
