/**
 * Stage 5: Render the Remotion composition to mp4.
 *
 * Uses Remotion's programmatic API (bundle + renderMedia) so we can pass
 * inputProps without serializing through CLI argv.
 */

import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ensureDir, mp4Path, pendingDir } from "./lib/shorts-paths";
import type { ShortsAssets } from "./types";

let cachedBundle: string | null = null;

interface RenderOpts {
  readonly force?: boolean;
}

export async function renderShorts(slug: string, assets: ShortsAssets, opts: RenderOpts = {}): Promise<string> {
  const outputPath = mp4Path(slug);

  if (!opts.force && fs.existsSync(outputPath)) {
    const stat = fs.statSync(outputPath);
    console.log(`   ♻️  렌더 캐시 사용 (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    return outputPath;
  }

  ensureDir(pendingDir(slug));

  // publicDir = the slug's pending folder so Audio src={staticFile("{slug}.audio.wav")}
  // resolves to the generated TTS file. Must be passed to BOTH bundle() and
  // renderMedia() so the bundler copies the file into its temp public folder.
  const staticDir = pendingDir(slug);

  // Always re-bundle when slug changes (publicDir differs per render)
  console.log(`   📦 Remotion 번들링...`);
  cachedBundle = await bundle({
    entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
    publicDir: staticDir,
    onProgress: (progress) => {
      if (progress % 10 === 0) {
        process.stdout.write(`\r      bundle: ${progress}%`);
      }
    },
  });
  process.stdout.write("\n");

  // Resolve composition with the actual assets so duration is correct
  const composition = await selectComposition({
    serveUrl: cachedBundle,
    id: "Shorts",
    inputProps: assets as unknown as Record<string, unknown>,
  });

  console.log(`   🎞️  렌더 시작 (${composition.durationInFrames} frames @ ${composition.fps}fps)`);

  let lastLoggedPct = -10;
  await renderMedia({
    composition,
    serveUrl: cachedBundle,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: assets as unknown as Record<string, unknown>,
    pixelFormat: "yuv420p",
    audioCodec: "aac",
    concurrency: 2,
    publicDir: staticDir,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct - lastLoggedPct >= 10) {
        process.stdout.write(`\r      render: ${pct.toString().padStart(3, " ")}%`);
        lastLoggedPct = pct;
      }
    },
  });
  process.stdout.write("\n");

  return outputPath;
}
