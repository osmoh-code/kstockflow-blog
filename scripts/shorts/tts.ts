/**
 * Stage 3: Google Cloud TTS (Neural2) — synthesize narration audio.
 *
 * Free tier: 1 million chars/month for Neural2 voices.
 * Our usage: ~24,000 chars/month → 영구 0원.
 *
 * Modes:
 *   1. Sample mode (--sample-only):
 *        Generates 3 Neural2 voice samples into voice-samples-test/.
 *   2. Pipeline mode:
 *        Reads {slug}.script.json and synthesizes with the chosen voice
 *        (env SHORTS_DEFAULT_VOICE or ko-KR-Neural2-C).
 *
 * Note on subtitles: Cloud TTS does not return word-level timestamps either.
 * Subtitles are handled at the scene level via char-proportional timing.
 */

import fs from "node:fs";
import path from "node:path";
import { CLOUD_VOICES, pcmBuffersToWav, synthesizeCloud, synthesizePcm } from "./lib/cloud-tts";
import {
  audioMp3Path,
  ensureDir,
  pendingDir,
  scriptJsonPath,
  VOICE_TEST_ROOT,
} from "./lib/shorts-paths";
import type { ShortsScript, TTSResult } from "./types";

const TEST_SENTENCE =
  "안녕하세요, 케이주식핫이슈입니다. 오늘 다날이 30퍼센트 상한가를 친 진짜 이유, 지금 바로 알려드릴게요.";

const ALL_VOICES = [
  CLOUD_VOICES.chirp3Algenib,
  CLOUD_VOICES.chirp3Orus,
  CLOUD_VOICES.chirp3Charon,
  CLOUD_VOICES.chirp3Iapetus,
];

function getDefaultVoice(): string {
  const env = process.env.SHORTS_DEFAULT_VOICE;
  if (env && env.length > 0) return env;
  return CLOUD_VOICES.chirp3Algenib;
}

// ============================================================
// Mode 1: Sample mode (parallel — Cloud TTS has generous RPM)
// ============================================================

export async function generateVoiceSamples(): Promise<void> {
  ensureDir(VOICE_TEST_ROOT);
  console.log(`\n🎤 Cloud TTS Neural2 — ${ALL_VOICES.length}개 voice 병렬 생성\n`);
  console.log(`   문장: "${TEST_SENTENCE}"\n`);

  const results = await Promise.allSettled(
    ALL_VOICES.map(async (voice) => {
      const filename = `cloud-${voice}.mp3`;
      return synthesizeCloud(TEST_SENTENCE, voice, VOICE_TEST_ROOT, filename);
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const voice = ALL_VOICES[i];
    const r = results[i];
    if (r.status === "fulfilled") {
      console.log(
        `   ✅ ${voice.padEnd(20)} → ${(r.value.byteLength / 1024).toFixed(0)} KB / ~${r.value.durationSec.toFixed(1)}s`,
      );
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.log(`   ❌ ${voice.padEnd(20)} → ${msg.slice(0, 150)}`);
    }
  }

  console.log(`\n   📁 ${VOICE_TEST_ROOT}\n`);
}

// ============================================================
// Mode 2: Pipeline mode
// ============================================================

export async function synthesizeForSlug(
  slug: string,
  opts: { force?: boolean; voice?: string } = {},
): Promise<TTSResult> {
  const audioPath = audioMp3Path(slug).replace(/\.mp3$/, ".wav");
  const sceneDurationsPath = audioPath.replace(/\.wav$/, ".scene-durations.json");
  const voice = opts.voice ?? getDefaultVoice();

  if (!opts.force && fs.existsSync(audioPath) && fs.existsSync(sceneDurationsPath)) {
    const stat = fs.statSync(audioPath);
    const sceneDurations = JSON.parse(fs.readFileSync(sceneDurationsPath, "utf-8")) as number[];
    const durationSec = sceneDurations.reduce((a, b) => a + b, 0);
    console.log(`   ♻️  TTS 캐시 사용 (${(stat.size / 1024).toFixed(0)} KB, ${durationSec.toFixed(1)}s, ${sceneDurations.length}개 scene)`);
    return { audioPath, voice, durationSec, sampleRate: 24000, sceneDurations };
  }

  const scriptPath = scriptJsonPath(slug);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`스크립트 파일 없음. Stage 2(script.ts) 먼저 실행 필요: ${scriptPath}`);
  }

  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8")) as ShortsScript;
  const sceneTexts = collectSceneTexts(script);

  ensureDir(pendingDir(slug));
  console.log(`   🎤 Cloud TTS 합성 (${voice}, ${sceneTexts.length}개 scene 개별 호출)...`);

  // Per-scene synthesis for accurate timing
  // Body scenes get SSML break after first word (종목명) for natural pacing
  const bodyStartIdx = 1; // 0 = hook
  const bodyEndIdx = 1 + script.body.length;

  const pcmBuffers: Buffer[] = [];
  const sceneDurations: number[] = [];
  for (let i = 0; i < sceneTexts.length; i++) {
    const text = sceneTexts[i];
    const isBody = i >= bodyStartIdx && i < bodyEndIdx;
    const input = isBody ? wrapWithBreakAfterFirstWord(text, 300) : text;
    const result = await synthesizePcm(input, voice, isBody);
    pcmBuffers.push(result.pcm);
    sceneDurations.push(result.durationSec);
    console.log(`      ${(i + 1).toString().padStart(2)}/${sceneTexts.length}: ${result.durationSec.toFixed(2)}s — "${text.slice(0, 40)}..."`);
  }

  // Concat all PCM into single WAV
  const wavBuffer = pcmBuffersToWav(pcmBuffers, 24000);
  fs.writeFileSync(audioPath, wavBuffer);
  fs.writeFileSync(sceneDurationsPath, JSON.stringify(sceneDurations, null, 2));

  const totalDurationSec = sceneDurations.reduce((a, b) => a + b, 0);

  return {
    audioPath,
    voice,
    durationSec: totalDurationSec,
    sampleRate: 24000,
    sceneDurations,
  };
}

/**
 * Wrap a body scene narration in SSML with breaks for natural pacing:
 *  1. After the first word (종목명) — gives the stock name room
 *  2. After action verbs following a percentage (상승/급등/상한가/etc.)
 *
 * Example:
 *   "진영 30% 급등 열분해유 사업"
 *   → "<speak>진영<break time='300ms'/> 30% 급등<break time='300ms'/> 열분해유 사업</speak>"
 */
const ACTION_VERBS = "상승|급등|상한가|폭등|하락|급락|반등|약세|강세|돌파|진입|기록|달성|근접|직행|상승세|급등세";

function wrapWithBreakAfterFirstWord(text: string, breakMs: number): string {
  const PLACEHOLDER = "\u0001BREAK\u0001";
  let processed = text.trim();

  // Step 1: Insert break after action verbs that follow a percentage
  const actionRegex = new RegExp(`(\\d+(?:\\.\\d+)?\\s*%\\s*(?:${ACTION_VERBS}))`, "g");
  processed = processed.replace(actionRegex, `$1${PLACEHOLDER}`);

  // Step 2: Insert break after first word (종목명) — only if no placeholder already there
  const firstWordMatch = /^([^\s,]+)([\s,]+)(.*)$/.exec(processed);
  if (firstWordMatch) {
    const [, firstWord, , rest] = firstWordMatch;
    if (!firstWord.includes(PLACEHOLDER)) {
      processed = `${firstWord}${PLACEHOLDER} ${rest}`;
    }
  }

  // Escape XML, then restore break placeholders
  const escaped = escapeXml(processed).replace(
    new RegExp(PLACEHOLDER, "g"),
    `<break time="${breakMs}ms"/>`,
  );

  return `<speak>${escaped}</speak>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Extract narration text per scene in pipeline order: hook, body[0..], cta.
 * Loop scene is intentionally skipped (영상 30초 이내 + 테이블 콘텐츠 제거 요청).
 * Order MUST match the segment order in assets.ts collectSegments().
 */
function collectSceneTexts(script: ShortsScript): string[] {
  const texts: string[] = [];
  texts.push(script.hook.narration);
  for (const scene of script.body) {
    texts.push(scene.narration);
  }
  texts.push(script.cta.narration);
  // Loop scene removed (사용자 요청: 30초 이내 + 테이블 짜르기)
  return texts;
}

// ============================================================
// CLI entry
// ============================================================

const isMain = (() => {
  try {
    const argv = (process.argv[1] ?? "").replace(/\\/g, "/");
    return argv.endsWith("/scripts/shorts/tts.ts");
  } catch {
    return false;
  }
})();

if (isMain) {
  if (fs.existsSync(".env.local")) {
    for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }

  const sampleOnly = process.argv.includes("--sample-only");
  const force = process.argv.includes("--force");
  const slug = process.argv.slice(2).find((a) => !a.startsWith("--"));

  const run = async () => {
    if (sampleOnly || !slug) {
      await generateVoiceSamples();
    } else {
      const result = await synthesizeForSlug(slug, { force });
      console.log(`\n✅ TTS 완료: ${slug}`);
      console.log(`   Voice: ${result.voice}`);
      console.log(`   Audio: ${result.audioPath}`);
      console.log(`   Duration (추정): ${result.durationSec.toFixed(2)}s`);
    }
  };

  run().catch((err) => {
    console.error(`\n❌ TTS 실패:`, err);
    process.exit(1);
  });
}
