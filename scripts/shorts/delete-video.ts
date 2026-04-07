/**
 * One-off: delete a YouTube video by ID.
 * Usage: npx tsx scripts/shorts/delete-video.ts <videoId>
 */
import fs from "node:fs";
import { google } from "googleapis";
import { createAuthenticatedClient } from "./lib/youtube-oauth";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const [, , videoId] = process.argv;
  if (!videoId) {
    console.error("Usage: tsx delete-video.ts <videoId>");
    process.exit(1);
  }
  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });
  await youtube.videos.delete({ id: videoId });
  console.log(`✅ 삭제 완료: ${videoId}`);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
