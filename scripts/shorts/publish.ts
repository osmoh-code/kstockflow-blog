/**
 * Publish a private/unlisted YouTube video: set to public + post first comment.
 *
 * Usage: npx tsx scripts/shorts/publish.ts <videoId> <slug>
 *   videoId: YouTube video ID
 *   slug:    blog post slug (e.g. "2026-04-07-featured-stocks") — used to
 *            derive both the date for the comment and the post URL link.
 *
 * Category routing (matches upload.ts and extract.ts):
 *   Detect category from the post's frontmatter, then dispatch to the
 *   per-category first-comment builder:
 *     featured-stocks → featured/upload-meta.ts → date-based comment
 *     hot-issues      → hot-issues/upload-meta.ts → keyword/theme comment
 *
 * Backwards compat: if the second arg is a bare YYYY-MM-DD (no full slug),
 * we treat it as the legacy date-only mode and link to https://kstockflow.com.
 */
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { createAuthenticatedClient } from "./lib/youtube-oauth";
import { extractFrameToJpg, uploadVideoThumbnail } from "./lib/thumbnail";
import { buildPostUrl } from "./upload";
import { loadPost } from "./lib/load-post";
import { scriptJsonPath, approvedDir } from "./lib/shorts-paths";
import { buildFeaturedStocksFirstComment } from "./featured/upload-meta";
import { buildHotIssuesFirstComment } from "./hot-issues/upload-meta";
import { buildSectorLeadersFirstComment } from "./sector-leaders/upload-meta";
import type { SectorLeadersScript } from "./sector-leaders/types";
import type { ShortsScript } from "./types";

const SECTOR_LEADERS_SUFFIX = "-sector-leaders";
function toMdxSlug(slug: string): string {
  return slug.endsWith(SECTOR_LEADERS_SUFFIX)
    ? slug.slice(0, -SECTOR_LEADERS_SUFFIX.length)
    : slug;
}

// Load .env.local
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

type ShortsCategory = "featured-stocks" | "hot-issues" | "sector-leaders";

/**
 * Detect the shorts category. Mirrors upload.ts:
 *   - "-sector-leaders" suffix on the cache slug → sector-leaders
 *   - otherwise frontmatter `category` field (featured-stocks / hot-issues)
 */
function detectCategory(slug: string): ShortsCategory {
  if (slug.endsWith(SECTOR_LEADERS_SUFFIX)) return "sector-leaders";
  try {
    const post = loadPost(slug);
    const raw = String(post.data.category ?? "hot-issues");
    return raw === "featured-stocks" ? "featured-stocks" : "hot-issues";
  } catch {
    return "hot-issues";
  }
}

/**
 * Load the generated script.json for a slug, preferring approved/ then pending/.
 * Returns null if no script file is found.
 */
function loadShortsScript(slug: string): ShortsScript | null {
  const candidates = [
    path.join(approvedDir(slug), `${slug}.script.json`),
    scriptJsonPath(slug),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8")) as ShortsScript;
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
  const mdxSlug = toMdxSlug(slug);
  const postUrl = isBareDate ? "https://kstockflow.com" : buildPostUrl(mdxSlug);
  const category: ShortsCategory = isBareDate ? "featured-stocks" : detectCategory(slug);
  const script = isBareDate ? null : loadShortsScript(slug);

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
  // Category-specific template is delegated to the per-category upload-meta module.
  // Note: parseSlugDate inside the builders only needs the leading YYYY-MM-DD,
  // so passing the bare date through as the "slug" works for the legacy path.
  console.log(`💬 첫 댓글 추가 중... (${category} 모드)`);
  const text =
    category === "hot-issues"
      ? buildHotIssuesFirstComment(script, postUrl)
      : category === "sector-leaders"
        ? buildSectorLeadersFirstComment(
            mdxSlug,
            script as SectorLeadersScript | null,
            postUrl,
          )
        : buildFeaturedStocksFirstComment(slug, postUrl);

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
