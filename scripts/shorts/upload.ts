/**
 * Stage 6: Upload approved YouTube Shorts to the channel.
 *
 * Usage:
 *   npm run shorts:upload <slug>
 *   npm run shorts:upload <slug> -- --privacy=public
 *
 * Reads from dist/shorts/approved/{slug}/{slug}.mp4 by default.
 * Falls back to pending/{slug}/{slug}.mp4 if not yet approved.
 *
 * Default privacy: "unlisted" (안전 모드 — 처음 며칠은 unlisted로 검수)
 * Use --privacy=public for public, --privacy=private for private.
 *
 * Quota usage: ~1,600 units per upload (free tier 10,000/day → ~6 uploads/day)
 */

import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { createAuthenticatedClient } from "./lib/youtube-oauth";
import { approvedDir, mp4Path, pendingDir, scriptJsonPath } from "./lib/shorts-paths";
import { extractFrameToJpg, uploadVideoThumbnail } from "./lib/thumbnail";
import { loadPost } from "./lib/load-post";
import {
  buildFeaturedStocksMetadata,
  buildFeaturedStocksFirstComment,
} from "./featured/upload-meta";
import {
  buildHotIssuesMetadata,
  buildHotIssuesFirstComment,
} from "./hot-issues/upload-meta";
import {
  buildSectorLeadersMetadata,
  buildSectorLeadersFirstComment,
} from "./sector-leaders/upload-meta";
import type { SectorLeadersScript } from "./sector-leaders/types";
import type { ShortsScript } from "./types";

type ShortsCategory = "featured-stocks" | "hot-issues" | "sector-leaders";

/** Strip the "-sector-leaders" cache-slug suffix to recover the original MDX slug. */
const SECTOR_LEADERS_SUFFIX = "-sector-leaders";
function toMdxSlug(slug: string): string {
  return slug.endsWith(SECTOR_LEADERS_SUFFIX)
    ? slug.slice(0, -SECTOR_LEADERS_SUFFIX.length)
    : slug;
}

type Privacy = "public" | "unlisted" | "private";

interface UploadOpts {
  readonly privacy?: Privacy;
}

interface UploadResult {
  readonly videoId: string;
  readonly url: string;
  readonly title: string;
  readonly privacyStatus: string;
}

export async function uploadShort(slug: string, opts: UploadOpts = {}): Promise<UploadResult> {
  // 1. Locate mp4 file (prefer approved/, fall back to pending/)
  const approvedMp4 = path.join(approvedDir(slug), `${slug}.mp4`);
  const pendingMp4 = mp4Path(slug);
  let videoFile: string;
  let baseDir: string;
  if (fs.existsSync(approvedMp4)) {
    videoFile = approvedMp4;
    baseDir = approvedDir(slug);
  } else if (fs.existsSync(pendingMp4)) {
    videoFile = pendingMp4;
    baseDir = pendingDir(slug);
    console.log(`   ⚠️  approved/ 에 없음 → pending/ 사용`);
  } else {
    throw new Error(`mp4 파일 없음: ${approvedMp4} 또는 ${pendingMp4}`);
  }

  const stat = fs.statSync(videoFile);
  console.log(`   📹 ${videoFile} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  // 2. Load script.json for title/description
  const scriptPath = path.join(baseDir, `${slug}.script.json`);
  const fallbackScriptPath = scriptJsonPath(slug);
  const script = loadScript(scriptPath, fallbackScriptPath);

  // Detect category from frontmatter (authoritative). Never derive category
  // from slug suffix EXCEPT the sector-leaders "-sector-leaders" cache-slug
  // convention — that IS the authoritative signal for this category because
  // sector-leaders posts don't have their own MDX (they reuse featured-stocks).
  const category = detectCategory(slug);
  const mdxSlug = toMdxSlug(slug);
  const postUrl = buildPostUrl(mdxSlug); // blog URL uses the base featured-stocks slug
  const { title, description, tags } =
    category === "hot-issues"
      ? buildHotIssuesMetadata(slug, script, postUrl)
      : category === "sector-leaders"
        ? buildSectorLeadersMetadata(
            mdxSlug,
            script as SectorLeadersScript | null,
            postUrl,
          )
        : buildFeaturedStocksMetadata(slug, script, postUrl);

  console.log(`   📝 제목: ${title}`);
  console.log(`   🏷️  태그: ${tags.slice(0, 5).join(", ")}${tags.length > 5 ? "..." : ""}`);

  // 3. Authenticate
  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });

  // 4. Upload
  const privacyStatus = opts.privacy ?? "unlisted";
  console.log(`   🔐 공개 상태: ${privacyStatus}`);
  console.log(`   🚀 업로드 중... (영상 1개당 약 1,600 units, 일 한도 10,000)`);

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    notifySubscribers: false,
    requestBody: {
      snippet: {
        title,
        description,
        tags: [...tags],
        categoryId: "25", // News & Politics
        defaultLanguage: "ko",
        defaultAudioLanguage: "ko",
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoFile),
    },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error("YouTube API 응답에 video ID 없음");
  }

  // 5. Optional: extract a frame and upload as YouTube custom thumbnail.
  //    DISABLED BY DEFAULT (2026-04-08) because new channels can't propagate
  //    custom thumbnails to mobile YouTube/Studio surfaces — the result is
  //    a blank gray box on mobile while YouTube's auto-pick would at least
  //    show some frame. Re-enable later when the channel has more activity.
  //
  //    To enable: set SHORTS_THUMBNAIL_FRAME=30 (or any frame index) in env.
  //    When unset (default), YouTube auto-picks a frame for the thumbnail.
  if (process.env.SHORTS_THUMBNAIL_FRAME) {
    try {
      const frameIdx = parseInt(process.env.SHORTS_THUMBNAIL_FRAME, 10);
      const thumbnailJpg = extractFrameToJpg(videoFile, baseDir, frameIdx);
      await uploadVideoThumbnail(youtube, videoId, thumbnailJpg);
      console.log(`   🖼️  썸네일 업로드 완료 (frame ${frameIdx})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️  썸네일 업로드 실패 (영상은 정상 업로드됨): ${msg.slice(0, 150)}`);
    }
  } else {
    console.log(`   ⏭️  썸네일 업로드 건너뜀 (YouTube 자동 픽 사용 — SHORTS_THUMBNAIL_FRAME 설정 시 활성화)`);
  }

  // 6. Auto-post first comment with direct link to the blog post.
  // Category-specific template is delegated to the per-category upload-meta module.
  const firstComment =
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
    await postFirstComment(youtube, videoId, firstComment);
    console.log(`   💬 첫 댓글 자동 추가 완료 (수동으로 핀 고정 권장)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  댓글 추가 실패 (영상은 정상 업로드됨): ${msg.slice(0, 100)}`);
  }

  return {
    videoId,
    url: `https://youtube.com/shorts/${videoId}`,
    title,
    privacyStatus,
  };
}

/**
 * Detect the shorts category from the post's frontmatter `category` field.
 * This is the same dispatch pattern used by scripts/shorts/extract.ts so that
 * upload/metadata routing cannot disagree with extract/script/assets routing.
 * Defaults to "hot-issues" for legacy posts without a category field.
 */
function detectCategory(slug: string): ShortsCategory {
  // sector-leaders is driven by the cache-slug suffix, not frontmatter — it
  // reuses the featured-stocks MDX so its own slug has no matching .mdx file.
  if (slug.endsWith(SECTOR_LEADERS_SUFFIX)) return "sector-leaders";
  try {
    const post = loadPost(slug);
    const raw = String(post.data.category ?? "hot-issues");
    return raw === "featured-stocks" ? "featured-stocks" : "hot-issues";
  } catch {
    return "hot-issues";
  }
}

async function postFirstComment(
  youtube: ReturnType<typeof google.youtube>,
  videoId: string,
  text: string,
): Promise<void> {
  await youtube.commentThreads.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        videoId,
        topLevelComment: {
          snippet: {
            textOriginal: text,
          },
        },
      },
    },
  });
}

/**
 * Delete a YouTube video by ID.
 * Requires youtube.force-ssl scope.
 */
export async function deleteVideo(videoId: string): Promise<void> {
  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });
  await youtube.videos.delete({ id: videoId });
}

function loadScript(primary: string, fallback: string): ShortsScript | null {
  const tryPath = fs.existsSync(primary) ? primary : fs.existsSync(fallback) ? fallback : null;
  if (!tryPath) return null;
  try {
    return JSON.parse(fs.readFileSync(tryPath, "utf-8")) as ShortsScript;
  } catch {
    return null;
  }
}

/**
 * Build the canonical blog post URL from a slug.
 * kstockflow uses trailingSlash:true so the URL must end with "/".
 */
export function buildPostUrl(slug: string): string {
  return `https://kstockflow.com/posts/${slug}/`;
}


// ============================================================
// CLI entry
// ============================================================

const isMain = (() => {
  try {
    const argv = (process.argv[1] ?? "").replace(/\\/g, "/");
    return argv.endsWith("/scripts/shorts/upload.ts");
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
  const privacyArg = args.find((a) => a.startsWith("--privacy="));
  const privacy = (privacyArg?.split("=")[1] ?? "unlisted") as Privacy;

  if (!slug) {
    console.error("사용법: npm run shorts:upload <slug> [-- --privacy=unlisted|public|private]");
    process.exit(1);
  }

  console.log(`\n📤 YouTube 업로드 — ${slug}\n`);

  uploadShort(slug, { privacy })
    .then((result) => {
      console.log(`\n✅ 업로드 완료!`);
      console.log(`   📺 ${result.url}`);
      console.log(`   🔐 ${result.privacyStatus}`);
      console.log(`\n   유튜브 스튜디오에서 검수: https://studio.youtube.com/video/${result.videoId}/edit`);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ 업로드 실패: ${msg}`);
      process.exit(1);
    });
}
