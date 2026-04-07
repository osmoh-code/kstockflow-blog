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

  // 5. Auto-post first comment with blog link (option B)
  try {
    await postFirstComment(youtube, videoId, monthDayFromSlug(slug));
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
): Promise<void> {
  const text = `📈 ${monthDay} 시장 주도주 전체 분석은 블로그에서 확인하세요!

🔥 K주식핫이슈 → https://kstockflow.com

매일 평일 장 마감 후 업데이트됩니다 ✅`;

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

  const title = `${monthDay} 시장 주도주 급등주 테마주 정리`;

  const stocksLine = uniqueStocks.length > 0 ? uniqueStocks.join(", ") : "오늘의 강세 종목";
  // First line: blog link (most prominent — appears in "더 보기" preview)
  const description = `🔥 K주식핫이슈 블로그 → https://kstockflow.com

📈 ${monthDaySpaced} 시장을 주도한 핵심 종목 TOP ${uniqueStocks.length || 5}

${stocksLine}

자세한 분석과 시장 전망은 블로그에서 확인하세요
👉 https://kstockflow.com

#shorts #주식 #특징주 #급등주 #테마주 #한국주식 #${monthDay} ${uniqueStocks.map((s) => `#${s}`).join(" ")}

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
