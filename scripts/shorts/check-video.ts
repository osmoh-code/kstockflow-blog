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
  const videoId = process.argv[2];
  if (!videoId) {
    console.error("Usage: tsx check-video.ts <videoId>");
    process.exit(1);
  }
  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });
  const res = await youtube.videos.list({
    part: ["contentDetails", "snippet", "status"],
    id: [videoId],
  });
  const v = res.data.items?.[0];
  if (!v) {
    console.log("not found");
    return;
  }
  console.log("title:", v.snippet?.title);
  console.log("duration:", v.contentDetails?.duration);
  console.log("definition:", v.contentDetails?.definition);
  console.log("dimension:", v.contentDetails?.dimension);
  console.log("categoryId:", v.snippet?.categoryId);
  console.log("privacyStatus:", v.status?.privacyStatus);
  console.log("uploadStatus:", v.status?.uploadStatus);
  console.log("tags:", v.snippet?.tags?.slice(0, 5).join(", "));
  console.log("desc preview:", v.snippet?.description?.slice(0, 200));
  console.log("\nthumbnails:");
  for (const [k, t] of Object.entries(v.snippet?.thumbnails ?? {})) {
    const tt = t as { url?: string; width?: number; height?: number };
    console.log(`  ${k}: ${tt.url} (${tt.width}x${tt.height})`);
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
