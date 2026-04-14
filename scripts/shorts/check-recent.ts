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
  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });
  const ch = await youtube.channels.list({ part: ["contentDetails"], mine: true });
  const uploadsId = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) { console.log("No uploads playlist"); return; }
  const items = await youtube.playlistItems.list({
    part: ["snippet"],
    playlistId: uploadsId,
    maxResults: 5,
  });
  const ids = (items.data.items ?? []).map((i) => i.snippet?.resourceId?.videoId).filter(Boolean) as string[];
  if (ids.length === 0) { console.log("No videos"); return; }
  const vids = await youtube.videos.list({ part: ["status", "snippet", "statistics"], id: ids });
  for (const v of vids.data.items ?? []) {
    console.log(`\n[${v.id}] ${v.snippet?.title}`);
    console.log(`  publishedAt: ${v.snippet?.publishedAt}`);
    console.log(`  privacy: ${v.status?.privacyStatus}  category: ${v.snippet?.categoryId}  kids: ${v.status?.madeForKids}`);
    console.log(`  tags: ${(v.snippet?.tags ?? []).slice(0, 10).join(", ")}`);
    console.log(`  views: ${v.statistics?.viewCount}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
