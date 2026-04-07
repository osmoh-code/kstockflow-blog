/**
 * Publish a private/unlisted YouTube video: set to public + post first comment.
 *
 * Usage: npx tsx scripts/shorts/publish.ts <videoId> <YYYY-MM-DD>
 *   videoId: YouTube video ID
 *   date:    used to generate "N월N일" comment text
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
  const [, , videoId, date] = process.argv;
  if (!videoId || !date) {
    console.error("Usage: tsx publish.ts <videoId> <YYYY-MM-DD>");
    process.exit(1);
  }
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dateMatch) {
    console.error("date must be YYYY-MM-DD");
    process.exit(1);
  }
  const monthDay = `${parseInt(dateMatch[2], 10)}월 ${parseInt(dateMatch[3], 10)}일`;

  const auth = createAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });

  // 1. Set public
  console.log(`🔓 ${videoId} → public 전환 중...`);
  await youtube.videos.update({
    part: ["status"],
    requestBody: {
      id: videoId,
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    },
  });
  console.log(`   ✅ public 전환 완료`);

  // 2. Post first comment
  console.log(`💬 첫 댓글 추가 중...`);
  const text = `📈 ${monthDay} 시장 주도주 전체 분석은 블로그에서 확인하세요!

🔥 K주식핫이슈 → https://kstockflow.com

매일 평일 장 마감 후 업데이트됩니다 ✅`;

  try {
    await youtube.commentThreads.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: text } },
        },
      },
    });
    console.log(`   ✅ 댓글 추가 완료 (수동으로 핀 고정 권장)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`   ❌ 댓글 추가 실패: ${msg.slice(0, 200)}`);
  }

  console.log(`\n✨ 완료: https://youtube.com/shorts/${videoId}`);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
