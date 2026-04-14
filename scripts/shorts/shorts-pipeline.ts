/**
 * Orchestrator for the YouTube Shorts pipeline.
 *
 * Stages: extract → script → tts → assets → render → notify
 *
 * Usage:
 *   npx tsx scripts/shorts/shorts-pipeline.ts <slug> [--force]
 *
 * Idempotency: each stage caches its output. `--force` resets all caches.
 */

import fs from "node:fs";
import { extract } from "./extract";
import { generateScript } from "./script";
import { synthesizeForSlug } from "./tts";
import { buildAssets } from "./assets";
import { renderShorts } from "./render";
import { mp4Path, pendingDir } from "./lib/shorts-paths";
import type { RunOpts } from "./types";

export async function runShortsPipeline(slug: string, opts: RunOpts = {}): Promise<string> {
  const startedAt = Date.now();
  console.log("\n══════════════════════════════════════");
  console.log(`🎬 Shorts Pipeline — ${slug}`);
  console.log("══════════════════════════════════════\n");

  // Stage 1: extract
  console.log("📄 Step 1/5: MDX 파싱");
  const input = await extract(slug, { force: opts.force, topN: opts.topN });
  console.log(`   ✅ Top ${input.topStocks.length}개 종목, mark ${input.markPhrases.length}개\n`);

  // Stage 2: script (Gemini)
  console.log("🤖 Step 2/5: Gemini 후크형 스크립트 생성");
  const script = await generateScript(input, { force: opts.force || opts.forceScript });
  console.log(`   ✅ ${script.totalDurationSec.toFixed(1)}초 / Hook + ${script.body.length} body + CTA + Loop\n`);

  // Stage 3: TTS (Gemini Charon/Algenib)
  console.log("🎤 Step 3/5: Gemini TTS 합성");
  const tts = await synthesizeForSlug(slug, { force: opts.force || opts.forceTTS, voice: opts.voice });
  console.log(`   ✅ ${tts.voice}, ${tts.durationSec.toFixed(2)}초\n`);

  // Stage 4: assets (시세 + scene timing)
  console.log("📊 Step 4/5: 자산 준비 (scene timing + 시세)");
  const assets = await buildAssets(input, script, tts, { force: opts.force });
  console.log(`   ✅ ${assets.scenes.length}개 scene, SFX cue ${assets.sfxCues.length}개, 총 ${assets.totalDurationSec.toFixed(1)}초\n`);

  // Stage 5: render
  console.log("🎞️  Step 5/5: Remotion 렌더");
  const outputPath = await renderShorts(slug, assets, { force: opts.force || opts.forceRender });
  const stat = fs.statSync(outputPath);
  console.log(`   ✅ ${outputPath}`);
  console.log(`      ${(stat.size / 1024 / 1024).toFixed(2)} MB\n`);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`🔔 검수: npm run shorts:review`);
  console.log(`   총 소요 시간: ${elapsed}초\n`);

  return outputPath;
}

// ============================================================
// CLI entry
// ============================================================

const isMain = (() => {
  try {
    const argv = (process.argv[1] ?? "").replace(/\\/g, "/");
    return argv.endsWith("/scripts/shorts/shorts-pipeline.ts");
  } catch {
    return false;
  }
})();

if (isMain) {
  // Load .env.local
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
  const topNArg = args.find((a) => a.startsWith("--top="));
  const topN = topNArg ? parseInt(topNArg.split("=")[1], 10) : undefined;

  if (!slug) {
    console.error("사용법: npx tsx scripts/shorts/shorts-pipeline.ts <slug> [--top=N] [--force|--force-script|--force-tts|--force-render]");
    process.exit(1);
  }

  runShortsPipeline(slug, { force, forceScript, forceTTS, forceRender, topN }).catch((err) => {
    console.error(`\n❌ 파이프라인 실패:`, err);
    process.exit(1);
  });
}
