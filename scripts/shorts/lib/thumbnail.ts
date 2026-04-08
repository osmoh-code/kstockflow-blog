/**
 * YouTube Shorts thumbnail automation.
 *
 * Extracts a single frame from the rendered mp4 (default: frame 0 / first
 * frame) using the ffmpeg binary bundled by ffmpeg-static, then uploads it
 * to YouTube via the Data API v3 thumbnails.set endpoint.
 *
 * Default frame:
 *   30 (= 1.0 second @ 30fps). The HookScene entrance animation runs over
 *   frames 0~18 (opacity 0→1, spring slideY 50→0), so frame 0 is nearly
 *   pure black (only the static letterbox header is visible). Frame 30 is
 *   well after the animation settles, capturing the title + chip + body.
 *   Override per-render with SHORTS_THUMBNAIL_FRAME env var.
 *
 * Why a separate function (not in upload.ts):
 *   Thumbnail upload is a distinct YouTube API call (different endpoint:
 *   upload.youtube.com/youtube/v3/thumbnails/set) and requires the channel
 *   to have phone verification enabled. Keeping it separate makes failures
 *   non-fatal — if thumbnail upload fails, the video upload still succeeds.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { google } from "googleapis";

const FPS = 30;

/**
 * Extract a single frame from mp4 to a JPG file.
 * Returns the absolute path to the extracted JPG.
 */
export function extractFrameToJpg(
  mp4Path: string,
  outputDir: string,
  frameIndex = 0,
): string {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static not installed (npm install ffmpeg-static)");
  }
  if (!fs.existsSync(mp4Path)) {
    throw new Error(`mp4 파일 없음: ${mp4Path}`);
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Resolve to seconds (ffmpeg accepts both timestamp and frame seek)
  // For exact frame seek we use the -vf select filter, but seeking by timestamp
  // is faster for the very first frames.
  const timestampSec = frameIndex / FPS;
  const outputPath = path.join(outputDir, `thumbnail-frame-${frameIndex}.jpg`);

  // High quality JPG (q:v 2 = visually lossless)
  // -y to overwrite existing
  // -ss before -i = fast seek (less accurate at exact frame but fine for frame 0)
  // For frames > 0 we use -ss after -i for accurate seek
  const args =
    frameIndex === 0
      ? [
          "-y",
          "-ss",
          "0",
          "-i",
          mp4Path,
          "-frames:v",
          "1",
          "-q:v",
          "2",
          outputPath,
        ]
      : [
          "-y",
          "-i",
          mp4Path,
          "-vf",
          `select=eq(n\\,${frameIndex})`,
          "-frames:v",
          "1",
          "-q:v",
          "2",
          outputPath,
        ];

  execFileSync(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });

  if (!fs.existsSync(outputPath)) {
    throw new Error(`프레임 추출 실패: ${outputPath} 생성 안 됨`);
  }
  return outputPath;
}

/**
 * Upload a JPG file as the YouTube video thumbnail via thumbnails.set.
 *
 * Requirements:
 *   - youtube.upload OAuth scope (we already have it)
 *   - Channel must be phone-verified (custom thumbnail eligibility)
 *   - JPG/PNG, ≤2MB, 16:9 or 9:16 supported
 *
 * Note: For Shorts, the API DOES set the thumbnail, but YouTube's Shorts
 * shelf may still display an auto-generated frame. The custom thumbnail
 * appears on the watch page and in regular video listings.
 */
export async function uploadVideoThumbnail(
  youtube: ReturnType<typeof google.youtube>,
  videoId: string,
  jpgPath: string,
): Promise<void> {
  const stat = fs.statSync(jpgPath);
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`thumbnail 크기 초과 ${(stat.size / 1024 / 1024).toFixed(2)}MB > 2MB`);
  }

  await youtube.thumbnails.set({
    videoId,
    media: {
      mimeType: "image/jpeg",
      body: fs.createReadStream(jpgPath),
    },
  });
}
