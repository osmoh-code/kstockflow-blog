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
import type { ShortsScript } from "./types";

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
  const { title, description, tags } = buildMetadata(slug, script);

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
        tags,
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

  // 5. Extract a frame from mp4 and upload as YouTube thumbnail.
  //    Default: frame 30 (= 1.0 second @ 30fps), which is AFTER the HookScene
  //    entrance animation (opacity 0→1 over frames 0~8, spring slide done at
  //    frame ~18). Frame 0 is intentionally NOT used because the Hook
  //    content is invisible at that point — only the static letterbox
  //    header would show, producing a near-black thumbnail.
  //    Override with SHORTS_THUMBNAIL_FRAME env var.
  try {
    const frameIdx = parseInt(process.env.SHORTS_THUMBNAIL_FRAME ?? "30", 10);
    const thumbnailJpg = extractFrameToJpg(videoFile, baseDir, frameIdx);
    await uploadVideoThumbnail(youtube, videoId, thumbnailJpg);
    console.log(`   🖼️  썸네일 업로드 완료 (frame ${frameIdx})`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  썸네일 업로드 실패 (영상은 정상 업로드됨): ${msg.slice(0, 150)}`);
  }

  // 6. Auto-post first comment with direct link to the blog post
  // Hot-issues uses keyword title, featured-stocks uses date-based template
  const hotIssuesTitleForComment = script?.hook?.onScreenText?.includes("\n")
    ? script.hook.onScreenText.replace(/\n/g, " ").trim()
    : null;
  try {
    await postFirstComment(
      youtube,
      videoId,
      monthDayFromSlug(slug),
      buildPostUrl(slug),
      hotIssuesTitleForComment,
    );
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

function monthDayFromSlug(slug: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(slug);
  return m ? `${parseInt(m[2], 10)}월 ${parseInt(m[3], 10)}일` : "오늘";
}

async function postFirstComment(
  youtube: ReturnType<typeof google.youtube>,
  videoId: string,
  monthDay: string,
  postUrl: string,
  hotIssuesTitle: string | null,
): Promise<void> {
  const text = buildFirstCommentText(monthDay, postUrl, hotIssuesTitle);

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

/**
 * Build the first-comment text for a YouTube Short.
 *
 * - For featured-stocks (hotIssuesTitle === null), uses the date-based template
 *   ("📈 4월 7일 전체 분석 보기")
 * - For hot-issues (hotIssuesTitle provided), uses the keyword/theme template
 *   ("📈 중동전쟁 종전 기대감 건설주 TOP 7 전체 분석 보기")
 *
 * Both formats include the direct post URL so viewers don't have to search.
 */
export function buildFirstCommentText(
  monthDay: string,
  postUrl: string,
  hotIssuesTitle: string | null,
): string {
  if (hotIssuesTitle && hotIssuesTitle.length > 0) {
    return `📈 ${hotIssuesTitle} 전체 분석 보기

👉 ${postUrl}

K주식핫이슈에서 자세한 내용 확인 ✅`;
  }
  return `📈 ${monthDay} 전체 분석 보기

👉 ${postUrl}

K주식핫이슈에서 매일 업데이트됩니다 ✅`;
}

function buildMetadata(
  slug: string,
  script: ShortsScript | null,
): { title: string; description: string; tags: string[] } {
  // Extract date from slug (e.g., "2026-04-06-featured-stocks" → "4월6일")
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(slug);
  const monthDay = dateMatch ? `${parseInt(dateMatch[2], 10)}월${parseInt(dateMatch[3], 10)}일` : "오늘";
  const monthDaySpaced = dateMatch ? `${parseInt(dateMatch[2], 10)}월 ${parseInt(dateMatch[3], 10)}일` : "오늘";

  // Extract stock names from body for tags
  const stockNames: string[] = [];
  if (script?.body) {
    for (const scene of script.body) {
      if (scene.stockFocus) stockNames.push(scene.stockFocus);
    }
  }
  const uniqueStocks = Array.from(new Set(stockNames));

  const isHotIssues = slug.match(/-stocks$/) === null && !slug.endsWith("-featured-stocks");
  // Hot-issues: derive title from script.hook.onScreenText (2-line summarized title
  // like "중동전쟁 종전 기대감\n건설주 TOP 7"), joined into a single searchable line
  const hookTitle = script?.hook?.onScreenText?.includes("\n")
    ? script.hook.onScreenText.replace(/\n/g, " ").trim()
    : null;
  // YouTube Shorts auto-classification: append "#Shorts" to title as the
  // strongest signal that this is a vertical short video
  const baseTitle = isHotIssues
    ? hookTitle ?? `${monthDaySpaced} ${uniqueStocks[0] ?? ""} 관련 주도주 정리`.trim()
    : `${monthDay} 시장 주도주 급등주 테마주 정리`;
  const title = `${baseTitle} #Shorts`;

  const postUrl = buildPostUrl(slug);
  const stocksLine = uniqueStocks.length > 0 ? uniqueStocks.join(", ") : "오늘의 강세 종목";

  // Description headline: hot-issues uses the post's keyword/theme,
  // featured-stocks uses the daily-market template
  const headline = isHotIssues && hookTitle
    ? `📈 ${hookTitle} 관련주 정리`
    : `📈 ${monthDaySpaced} 시장을 주도한 핵심 종목 TOP ${uniqueStocks.length || 5}`;

  // First line: direct link to the specific blog post (not just kstockflow.com).
  // Viewers who tap "더 보기" land directly on the full analysis.
  // #Shorts hashtag is in title for stronger Shorts auto-detection signal
  const description = `🔥 전체 분석 보러가기 → ${postUrl}

${headline}

${stocksLine}

자세한 분석과 시장 전망은 위 링크에서 확인하세요
👉 ${postUrl}

#Shorts #주식 #특징주 #급등주 #테마주 #한국주식 #${monthDay} ${uniqueStocks.map((s) => `#${s}`).join(" ")}

⚠️ 본 영상은 정보 제공 목적이며, 투자 권유가 아닙니다. 투자의 책임은 본인에게 있습니다.`;

  const tags = [
    "주식",
    "특징주",
    "급등주",
    "테마주",
    "주도주",
    "한국주식",
    "shorts",
    "K주식핫이슈",
    monthDay,
    ...uniqueStocks,
  ];

  return { title, description, tags };
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
