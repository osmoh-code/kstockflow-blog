#!/usr/bin/env tsx
/**
 * Level 1 — Auto Publish: Stage, commit, and push new blog posts.
 *
 * Usage:
 *   npx tsx scripts/publish.ts
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", cwd: process.cwd() }).trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Command failed: ${cmd}\n${message}`);
  }
}

function getLatestMdx(): string | null {
  const postsDir = path.join(process.cwd(), "content", "posts");
  if (!fs.existsSync(postsDir)) return null;

  const files = fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".mdx"))
    .sort()
    .reverse();

  return files[0] ?? null;
}

function extractTitle(fileName: string): string {
  const filePath = path.join(process.cwd(), "content", "posts", fileName);
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/^title:\s*"?([^"\n]+)"?$/m);
  return match?.[1]?.trim() ?? fileName.replace(/\.mdx$/, "");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("\n🚀 블로그 포스트 퍼블리싱 시작...\n");

  // 1. Stage post files
  console.log("📂 content/posts/ 스테이징...");
  run("git add content/posts/");

  // Also stage thumbnails if any were generated
  const thumbDir = path.join(process.cwd(), "public", "images", "thumbnails");
  if (fs.existsSync(thumbDir)) {
    run("git add public/images/thumbnails/");
  }

  // 2. Get latest file & title
  const latestFile = getLatestMdx();
  if (!latestFile) {
    console.log("⚠️  새로운 포스트가 없습니다.");
    process.exit(0);
  }

  const title = extractTitle(latestFile);
  console.log(`📝 최신 포스트: ${title}`);

  // 3. Check if there are staged changes
  const diff = run("git diff --cached --name-only");
  if (!diff) {
    console.log("⚠️  스테이징된 변경사항이 없습니다.");
    process.exit(0);
  }

  // 4. Commit
  const commitMsg = `feat: publish ${title}`;
  console.log(`💾 커밋: "${commitMsg}"`);
  run(`git commit -m "${commitMsg}"`);

  // 5. Push
  console.log("☁️  원격 저장소 푸시 중...");
  run("git push origin main");

  console.log(`\n✅ 퍼블리싱 완료!`);
  console.log(`🌐 URL: https://kstockflow.com/post/${latestFile.replace(/\.mdx$/, "")}`);
  console.log();
}

main();
