/**
 * One-off: Test Gemini TTS availability + generate female voice samples.
 *
 * Usage: npx tsx scripts/shorts/test-gemini-voices.ts
 *
 * Strategy:
 *   1. Make 1 test call to verify the model still works in 2026
 *   2. If successful, synthesize 3 female voices with 22s delays (RPM 3 limit)
 *   3. Open the output folder so user can listen and compare
 */
import fs from "node:fs";
import path from "node:path";
import { synthesize } from "./lib/gemini-tts";

// Load .env.local
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const TEST_SENTENCE =
  "안녕하세요, 케이주식핫이슈입니다. 오늘 시장을 주도한 핵심 종목 다섯 개를 알려드릴게요. 엘앤에프 8.44퍼센트 급등, 1분기 실적 서프라이즈 기대감.";

const FEMALE_VOICES = [
  { name: "Sulafat", desc: "여성 따뜻 (Warm) — 차분한 뉴스 톤" },
  { name: "Aoede", desc: "여성 친근 (Breezy) — 부드럽고 자연스러움" },
  { name: "Kore", desc: "여성 단호 (Firm) — 또렷한 아나운서 톤" },
];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("\n🎤 Gemini TTS 가용성 + 여성 음성 샘플 테스트\n");
  console.log(`   문장: "${TEST_SENTENCE}"\n`);

  const outputDir = path.join("dist", "shorts", "voice-samples-gemini");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < FEMALE_VOICES.length; i++) {
    const { name, desc } = FEMALE_VOICES[i];
    console.log(`   ${i + 1}/${FEMALE_VOICES.length} ${name} — ${desc}`);

    try {
      const t0 = Date.now();
      const result = await synthesize(TEST_SENTENCE, name, outputDir, `gemini-${name}`);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `      ✅ ${result.durationSec.toFixed(1)}s 음성 / ${(result.byteLength / 1024).toFixed(0)} KB / API ${elapsed}s`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`      ❌ ${msg.slice(0, 200)}`);
      if (msg.includes("404") || msg.includes("not found") || msg.includes("deprecated")) {
        console.log(`\n   ⚠️  모델 deprecated 가능성. gemini-tts.ts의 MODEL 변수 확인 필요.`);
        return;
      }
      if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
        console.log(`\n   ⚠️  API 키 권한 문제. Gemini TTS API가 활성화돼있는지 확인.`);
        return;
      }
    }

    // RPM 3 → 22초 대기 (마지막은 불필요)
    if (i < FEMALE_VOICES.length - 1) {
      console.log(`      ⏳ rate limit 회피 22초 대기...`);
      await sleep(22_000);
    }
  }

  console.log(`\n   📁 ${path.resolve(outputDir)}`);
  console.log(`\n✨ 완료. 위 폴더에서 wav 파일 들어보세요.\n`);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
