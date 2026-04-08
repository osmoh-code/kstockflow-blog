/**
 * One-off CLI: extract first frame from a slug's mp4 and upload as YouTube thumbnail.
 *
 * Usage: npx tsx scripts/shorts/set-thumbnail.ts <videoId> <slug> [frameIndex]
 *
 * Useful for retroactively setting thumbnails on videos that were uploaded
 * before the auto-thumbnail flow was added, or for re-uploading with a
 * different frame.
 */
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { createAuthenticatedClient } from "./lib/youtube-oauth";
import { extractFrameToJpg, uploadVideoThumbnail } from "./lib/thumbnail";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const [, , videoId, slug, frameStr] = process.argv;
  if (!videoId || !slug) {
    console.error("Usage: tsx set-thumbnail.ts <videoId> <slug> [frameIndex]");
    console.error("  frameIndex defaults to 0 (first frame)");
    process.exit(1);
  }
  const frameIdx = frameStr ? parseInt(frameStr, 10) : 0;

  const candidates = [
    path.join("dist", "shorts", "approved", slug, `${slug}.mp4`),
    path.join("dist", "shorts", "pending", slug, `${slug}.mp4`),
  ];
  const mp4 = candidates.find((p) => fs.existsSync(p));
  if (!mp4) {
    console.error(`mp4 파일 없음. 검색한 경로:\n  ${candidates.join("\n  ")}`);
    process.exit(1);
  }

  const baseDir = path.dirname(mp4);
  console.log(`📹 mp4: ${mp4}`);
  console.log(`🎞️  frame ${frameIdx} 추출 중...`);
  const jpg = extractFrameToJpg(mp4, baseDir, frameIdx);
  const stat = fs.statSync(jpg);
  console.log(`   ✅ ${jpg} (${(stat.size / 1024).toFixed(0)} KB)`);

  console.log(`🚀 YouTube 썸네일 업로드 (videoId: ${videoId})...`);
  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });
  await uploadVideoThumbnail(youtube, videoId, jpg);
  console.log(`   ✅ 완료: https://youtube.com/shorts/${videoId}`);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
