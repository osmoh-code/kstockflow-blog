/**
 * Review pending shorts mp4 files. Opens the latest in the default player.
 *
 * Usage:
 *   npm run shorts:review
 *   npm run shorts:review <slug>
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { mp4Path, PENDING_ROOT, voiceSamplesDir } from "./lib/shorts-paths";

function listPending(): string[] {
  if (!fs.existsSync(PENDING_ROOT)) return [];
  return fs
    .readdirSync(PENDING_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => fs.existsSync(mp4Path(slug)))
    .sort()
    .reverse();
}

function openInDefaultPlayer(filePath: string): void {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", filePath], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [filePath], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [filePath], { detached: true, stdio: "ignore" }).unref();
  }
}

function openFolder(folderPath: string): void {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", folderPath], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [folderPath], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [folderPath], { detached: true, stdio: "ignore" }).unref();
  }
}

function main(): void {
  const argSlug = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const slugs = listPending();

  if (slugs.length === 0) {
    console.log("\n📭 검수 대기 중인 Shorts 없음. (dist/shorts/pending/ 비어있음)\n");
    console.log("   먼저 파이프라인 실행: npm run shorts <slug>");
    return;
  }

  console.log("\n📋 검수 대기 Shorts:");
  for (const slug of slugs) {
    const stat = fs.statSync(mp4Path(slug));
    console.log(`   - ${slug} (${(stat.size / 1024 / 1024).toFixed(2)} MB, ${stat.mtime.toLocaleString("ko-KR")})`);
  }

  const target = argSlug ?? slugs[0];
  if (!slugs.includes(target)) {
    console.error(`\n❌ ${target} 미존재. 사용 가능한 슬러그:\n${slugs.map((s) => `   - ${s}`).join("\n")}`);
    process.exit(1);
  }

  const mp4 = mp4Path(target);
  console.log(`\n🎬 ${target} 재생 중...`);
  console.log(`   ${mp4}`);
  openInDefaultPlayer(mp4);

  // Also open voice samples folder for A/B comparison
  const voicesDir = voiceSamplesDir(target);
  if (fs.existsSync(voicesDir)) {
    console.log(`\n🎤 Voice samples: ${voicesDir}`);
    openFolder(voicesDir);
  }

  console.log(`\n✅ 검수 후 승인: npm run shorts:approve ${target}`);
}

main();
