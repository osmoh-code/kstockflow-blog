/**
 * One-off: change a YouTube video's privacy status.
 * Usage: npx tsx scripts/shorts/set-privacy.ts <videoId> <public|unlisted|private>
 */
import fs from "node:fs";
import { google } from "googleapis";
import { createAuthenticatedClient } from "./lib/youtube-oauth";

// Load .env.local
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const [, , videoId, privacy] = process.argv;
  if (!videoId || !privacy) {
    console.error("Usage: tsx set-privacy.ts <videoId> <public|unlisted|private>");
    process.exit(1);
  }
  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });
  const before = await youtube.videos.list({ part: ["status"], id: [videoId] });
  console.log("BEFORE:", before.data.items?.[0]?.status?.privacyStatus);
  await youtube.videos.update({
    part: ["status"],
    requestBody: {
      id: videoId,
      status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
    },
  });
  const after = await youtube.videos.list({ part: ["status"], id: [videoId] });
  console.log("AFTER:", after.data.items?.[0]?.status?.privacyStatus);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
