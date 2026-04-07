import path from "node:path";
import fs from "node:fs";

const PROJECT_ROOT = process.cwd();

export const DIST_ROOT = path.join(PROJECT_ROOT, "dist", "shorts");
export const PENDING_ROOT = path.join(DIST_ROOT, "pending");
export const APPROVED_ROOT = path.join(DIST_ROOT, "approved");
export const LOGS_ROOT = path.join(DIST_ROOT, "logs");
export const VOICE_TEST_ROOT = path.join(DIST_ROOT, "voice-samples-test");

export function pendingDir(slug: string): string {
  return path.join(PENDING_ROOT, slug);
}

export function approvedDir(slug: string): string {
  return path.join(APPROVED_ROOT, slug);
}

export function voiceSamplesDir(slug: string): string {
  return path.join(pendingDir(slug), "voice-samples");
}

export function inputJsonPath(slug: string): string {
  return path.join(pendingDir(slug), `${slug}.input.json`);
}

export function scriptJsonPath(slug: string): string {
  return path.join(pendingDir(slug), `${slug}.script.json`);
}

export function assetsJsonPath(slug: string): string {
  return path.join(pendingDir(slug), `${slug}.assets.json`);
}

export function audioMp3Path(slug: string): string {
  return path.join(pendingDir(slug), `${slug}.audio.mp3`);
}

export function subtitlesJsonPath(slug: string): string {
  return path.join(pendingDir(slug), `${slug}.subtitles.json`);
}

export function mp4Path(slug: string): string {
  return path.join(pendingDir(slug), `${slug}.mp4`);
}

export function logPath(slug: string, timestamp: string): string {
  return path.join(LOGS_ROOT, `${slug}-${timestamp}.log`);
}

export function postMdxPath(slug: string): string {
  return path.join(PROJECT_ROOT, "content", "posts", `${slug}.mdx`);
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
