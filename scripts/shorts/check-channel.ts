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
  // auditDetails requires extra OAuth scope; try without first
  const res = await youtube.channels.list({
    part: ["snippet", "status", "contentDetails", "brandingSettings"],
    mine: true,
  });
  const ch = res.data.items?.[0];
  console.log("title:", ch?.snippet?.title);
  console.log("id:", ch?.id);
  console.log("publishedAt:", ch?.snippet?.publishedAt);
  console.log("status:", JSON.stringify(ch?.status, null, 2));
}

main().catch((e) => {
  console.error("ERROR FULL:", e);
  console.error("MSG:", e instanceof Error ? e.message : String(e));
  if (e?.errors) console.error("ERRORS:", JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
