/**
 * Publish a private/unlisted YouTube video: set to public + post first comment.
 *
 * Usage: npx tsx scripts/shorts/publish.ts <videoId> <slug>
 *   videoId: YouTube video ID
 *   slug:    blog post slug (e.g. "2026-04-07-featured-stocks") — used to
 *            derive both the date for the comment and the post URL link.
 *
 * Hot-issues vs featured-stocks comment template:
 *   We load script.json from approved/{slug}/ to detect category.
 *   If hook.onScreenText contains a newline (the 2-line "{theme}\n{category} TOP N"
 *   format used only by hot-issues), we use the keyword-based comment template
 *   ("📈 중동전쟁 종전 기대감 건설주 TOP 7 전체 분석 보기").
 *   Otherwise we fall back to the date-based template ("📈 4월 7일 전체 분석 보기").
 *
 * Backwards compat: if the second arg is a bare YYYY-MM-DD (no full slug),
 * we treat it as the legacy date-only mode and link to https://kstockflow.com.
 */
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { createAuthenticatedClient } from "./lib/youtube-oauth";
import { extractFrameToJpg, uploadVideoThumbnail } from "./lib/thumbnail";
import { buildFirstCommentText, buildPostUrl } from "./upload";

// Load .env.local
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

/**
 * Detect hot-issues by reading script.json from approved/{slug}/ and checking
 * whether hook.onScreenText is a multi-line title (only hot-issues uses that).
 * Returns the joined title for hot-issues, null otherwise.
 */
function detectHotIssuesTitle(slug: string): string | null {
  const candidates = [
    path.join("dist", "shorts", "approved", slug, `${slug}.script.json`),
    path.join("dist", "shorts", "pending", slug, `${slug}.script.json`),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const script = JSON.parse(fs.readFileSync(p, "utf-8"));
      const onScreen = script?.hook?.onScreenText;
      if (typeof onScreen === "string" && onScreen.includes("\n")) {
        return onScreen.replace(/\n/g, " ").trim();
      }
      return null;
    } catch {
      continue;
    }
  }
  return null;
}

async function main() {
  const [, , videoId, slugOrDate] = process.argv;
  if (!videoId || !slugOrDate) {
    console.error("Usage: tsx publish.ts <videoId> <slug>");
    console.error("  e.g.  tsx publish.ts abc123 2026-04-08-middle-east-war-construction");
    process.exit(1);
  }

  // Detect: bare YYYY-MM-DD (legacy) vs full slug
  const isBareDate = /^\d{4}-\d{2}-\d{2}$/.test(slugOrDate);
  const slug = slugOrDate;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(slug);
  if (!dateMatch) {
    console.error("slug must start with YYYY-MM-DD");
    process.exit(1);
  }
  const monthDay = `${parseInt(dateMatch[2], 10)}월 ${parseInt(dateMatch[3], 10)}일`;
  const postUrl = isBareDate ? "https://kstockflow.com" : buildPostUrl(slug);
  const hotIssuesTitle = isBareDate ? null : detectHotIssuesTitle(slug);

  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });

  // 1. Set public
  console.log(`🔓 ${videoId} → public 전환 중...`);
  await youtube.videos.update({
    part: ["status"],
    requestBody: {
      id: videoId,
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    },
  });
  console.log(`   ✅ public 전환 완료`);

  // 2. Upload custom thumbnail — DISABLED by default (2026-04-08).
  //    See upload.ts comment for rationale: new channels show blank on mobile
  //    when API custom thumbnails are set. Set SHORTS_THUMBNAIL_FRAME env to
  //    re-enable when the channel matures.
  if (!isBareDate && process.env.SHORTS_THUMBNAIL_FRAME) {
    try {
      const mp4 = path.join("dist", "shorts", "approved", slug, `${slug}.mp4`);
      const baseDir = path.join("dist", "shorts", "approved", slug);
      if (fs.existsSync(mp4)) {
        const frameIdx = parseInt(process.env.SHORTS_THUMBNAIL_FRAME, 10);
        const thumbnailJpg = extractFrameToJpg(mp4, baseDir, frameIdx);
        await uploadVideoThumbnail(youtube, videoId, thumbnailJpg);
        console.log(`   🖼️  썸네일 업로드 완료 (frame ${frameIdx})`);
      } else {
        console.log(`   ⏭️  mp4 없음, 썸네일 업로드 건너뜀`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️  썸네일 업로드 실패 (publish는 계속): ${msg.slice(0, 150)}`);
    }
  }

  // 3. Post first comment with direct post link.
  // Hot-issues uses keyword title, featured-stocks uses date-based template.
  console.log(`💬 첫 댓글 추가 중... (${hotIssuesTitle ? "hot-issues" : "featured/legacy"} 모드)`);
  const text = buildFirstCommentText(monthDay, postUrl, hotIssuesTitle);

  try {
    await youtube.commentThreads.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: text } },
        },
      },
    });
    console.log(`   ✅ 댓글 추가 완료 (수동으로 핀 고정 권장)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`   ❌ 댓글 추가 실패: ${msg.slice(0, 200)}`);
  }

  console.log(`\n✨ 완료: https://youtube.com/shorts/${videoId}`);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
