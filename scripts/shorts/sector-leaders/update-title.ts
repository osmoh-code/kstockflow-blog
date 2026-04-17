/**
 * One-off patch utility: update an already-uploaded sector-leaders Short's
 * title + description after fixing the emoji-stripping bug.
 *
 * Usage:
 *   npx tsx scripts/shorts/sector-leaders/update-title.ts <videoId> <slug>
 */
import fs from "node:fs";
import { google } from "googleapis";
import { createAuthenticatedClient } from "../lib/youtube-oauth";
import { scriptJsonPath } from "../lib/shorts-paths";
import { buildSectorLeadersMetadata } from "./upload-meta";
import type { SectorLeadersScript } from "./types";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const [, , videoId, slug] = process.argv;
  if (!videoId || !slug) {
    console.error("Usage: tsx update-title.ts <videoId> <slug>");
    process.exit(1);
  }

  const mdxSlug = slug.endsWith("-sector-leaders")
    ? slug.slice(0, -"-sector-leaders".length)
    : slug;
  const postUrl = `https://kstockflow.com/posts/${mdxSlug}/`;

  const scriptPath = scriptJsonPath(slug);
  if (!fs.existsSync(scriptPath)) {
    console.error(`script.json 없음: ${scriptPath}`);
    process.exit(1);
  }
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8")) as SectorLeadersScript;

  const { title, description, tags } = buildSectorLeadersMetadata(mdxSlug, script, postUrl);
  console.log(`📝 새 제목: ${title}`);

  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });
  await youtube.videos.update({
    part: ["snippet"],
    requestBody: {
      id: videoId,
      snippet: {
        title,
        description,
        tags: [...tags],
        categoryId: "25",
        defaultLanguage: "ko",
        defaultAudioLanguage: "ko",
      },
    },
  });

  console.log(`✅ 업데이트 완료: https://youtube.com/shorts/${videoId}`);
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
