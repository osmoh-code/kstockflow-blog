/**
 * Approve a reviewed short — moves it from pending/ to approved/
 * and optionally uploads to YouTube.
 *
 * Usage:
 *   npm run shorts:approve <slug>                    # 이동만
 *   npm run shorts:approve <slug> -- --upload        # 이동 + 자동 업로드 (unlisted)
 *   npm run shorts:approve <slug> -- --upload --privacy=public
 */

import fs from "node:fs";
import path from "node:path";
import { approvedDir, ensureDir, pendingDir, mp4Path, APPROVED_ROOT } from "./lib/shorts-paths";

async function main(): Promise<void> {
  // Load .env.local
  if (fs.existsSync(".env.local")) {
    for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }

  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--"));
  const shouldUpload = args.includes("--upload");
  const privacyArg = args.find((a) => a.startsWith("--privacy="));
  const privacy = (privacyArg?.split("=")[1] ?? "unlisted") as "public" | "unlisted" | "private";

  if (!slug) {
    console.error("사용법: npm run shorts:approve <slug> [-- --upload --privacy=unlisted|public|private]");
    process.exit(1);
  }

  const src = pendingDir(slug);
  const dst = approvedDir(slug);

  if (!fs.existsSync(src)) {
    console.error(`❌ ${src} 없음`);
    process.exit(1);
  }
  if (!fs.existsSync(mp4Path(slug))) {
    console.error(`❌ mp4 파일 없음: ${mp4Path(slug)}`);
    process.exit(1);
  }

  ensureDir(APPROVED_ROOT);

  if (fs.existsSync(dst)) {
    console.log(`⚠️  ${dst} 이미 존재 — 덮어쓰기`);
    fs.rmSync(dst, { recursive: true, force: true });
  }

  fs.renameSync(src, dst);

  const finalMp4 = path.join(dst, `${slug}.mp4`);
  console.log(`\n✅ ${slug} 승인 완료`);
  console.log(`   📁 ${dst}`);
  console.log(`   🎬 ${finalMp4}`);

  if (shouldUpload) {
    console.log(`\n📤 YouTube 자동 업로드 시작...`);
    try {
      const { uploadShort } = await import("./upload");
      const result = await uploadShort(slug, { privacy });
      console.log(`\n✅ 업로드 완료!`);
      console.log(`   📺 ${result.url}`);
      console.log(`   🔐 ${result.privacyStatus}`);
      console.log(`\n   유튜브 스튜디오: https://studio.youtube.com/video/${result.videoId}/edit`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ 업로드 실패: ${msg}`);
      console.error(`   수동 업로드: ${finalMp4}`);
      process.exit(1);
    }
  } else {
    console.log(`\n📤 YouTube 업로드:`);
    console.log(`   자동 업로드: npm run shorts:approve ${slug} -- --upload`);
    console.log(`   별도 업로드: npm run shorts:upload ${slug}`);
    console.log(`   수동 업로드: 위 mp4 파일을 YouTube Studio에서 업로드`);
  }
}

main().catch((err) => {
  console.error("\n❌ 실패:", err);
  process.exit(1);
});
