/**
 * Stage 2 (router): Generate ShortsScript dispatched by category.
 *
 *   featured-stocks  → ./featured/script.ts  (Gemini call, creative hook)
 *   hot-issues       → ./hot-issues/script.ts (deterministic rule-based)
 *
 * Shared post-processing applied to both:
 *   - replaceNarrationBrand: fix TTS pronunciation (핫이슈 → 핫 이슈), strip 블로그
 *   - validateScript: character count + duration bounds (category-specific)
 *
 * Output cache: dist/shorts/pending/{slug}/{slug}.script.json
 */

import "./lib/env-loader";
import fs from "node:fs";
import { extract } from "./extract";
import { generateFeaturedScript } from "./featured/script";
import { buildHotIssuesScript } from "./hot-issues/script";
import { ensureDir, inputJsonPath, pendingDir, scriptJsonPath } from "./lib/shorts-paths";
import type { ShortsInputData, ShortsScript } from "./types";

export async function generateScript(
  input: ShortsInputData,
  opts: { force?: boolean } = {},
): Promise<ShortsScript> {
  const cachePath = scriptJsonPath(input.slug);

  if (!opts.force && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as ShortsScript;
    console.log(`   ♻️  스크립트 캐시 사용`);
    return cached;
  }

  // --- Category dispatch ---
  let script: ShortsScript;
  if (input.category === "hot-issues") {
    console.log(`   🤖 hot-issues 규칙 기반 스크립트 생성 중...`);
    script = buildHotIssuesScript(input);
  } else {
    console.log(`   🤖 featured-stocks Gemini 스크립트 생성 중...`);
    script = await generateFeaturedScript(input);
  }

  // --- Shared post-processing ---
  script = replaceNarrationBrand(script);
  validateScript(script, input.category);

  ensureDir(pendingDir(input.slug));
  fs.writeFileSync(cachePath, JSON.stringify(script, null, 2), "utf-8");

  return script;
}

// ============================================================
// Shared post-processing + validation
// ============================================================

// Action verbs that should be followed by a pause for natural pacing
const ACTION_WORDS = "상승|급등|상한가|폭등|하락|급락|반등|약세|강세|돌파|진입|기록|급락세|강세장";

function replaceNarrationBrand(script: ShortsScript): ShortsScript {
  // 1. Pronunciation fix: 핫이슈 → "핫 이슈" (prevent consonant liaison)
  // 2. Strip "블로그" per user preference
  // 3. Insert pause after "{등락률}% {동작}" so TTS doesn't say "상승에너지"
  //    e.g. "12.58% 상승, 에너지 확대" instead of "12.58% 상승에너지 확대"
  const actionPauseRegex = new RegExp(
    `(\\d+(?:\\.\\d+)?\\s*%\\s*(?:${ACTION_WORDS}))(?![.,!?\\s])`,
    "g",
  );
  const actionPauseRegexWithSpace = new RegExp(
    `(\\d+(?:\\.\\d+)?\\s*%\\s*(?:${ACTION_WORDS}))\\s+(?![.,!?])`,
    "g",
  );

  const fix = (s: string): string =>
    s
      .replace(/HotIssue/g, "핫 이슈")
      .replace(/핫이슈/g, "핫 이슈")
      .replace(/핫 이슈\s*블로그에서/g, "핫 이슈에서")
      .replace(/핫 이슈\s*블로그/g, "핫 이슈")
      .replace(/블로그에서/g, "에서")
      .replace(/블로그/g, "")
      .replace(actionPauseRegex, "$1, ")
      .replace(actionPauseRegexWithSpace, "$1, ")
      .replace(/\s{2,}/g, " ")
      .replace(/,\s*,/g, ",")
      .trim();

  return {
    ...script,
    hook: { ...script.hook, narration: fix(script.hook.narration) },
    body: script.body.map((scene) => ({ ...scene, narration: fix(scene.narration) })),
    cta: { ...script.cta, narration: fix(script.cta.narration) },
    loop: { ...script.loop, narration: fix(script.loop.narration) },
  };
}

// Korean speech rate at speakingRate 1.25: ~8 chars/sec
// featured-stocks (no loop scene): 200 chars max → ~25s audio
// hot-issues (up to 7 body scenes + loop): 480 chars max → ~60s audio
const MAX_TOTAL_CHARS_FEATURED = 200;
const MAX_TOTAL_CHARS_HOT_ISSUES = 480;
const MIN_TOTAL_CHARS = 130;

function validateScript(script: ShortsScript, category: string): void {
  const errors: string[] = [];

  if (!script.hook?.narration) errors.push("hook.narration 누락");
  if (!script.cta?.narration) errors.push("cta.narration 누락");
  if (!script.loop?.narration) errors.push("loop.narration 누락");
  if (!Array.isArray(script.body) || script.body.length === 0) {
    errors.push("body 배열 누락");
  }

  const total = script.totalDurationSec;
  const maxDuration = category === "hot-issues" ? 55 : 32;
  if (typeof total !== "number" || total < 15 || total > maxDuration) {
    errors.push(`totalDurationSec 범위 위반 (${total}, 22~${maxDuration} 권장)`);
  }

  const totalChars = countNarrationChars(script);
  const maxChars = category === "hot-issues" ? MAX_TOTAL_CHARS_HOT_ISSUES : MAX_TOTAL_CHARS_FEATURED;
  if (totalChars > maxChars) {
    errors.push(`narration 총 글자수 ${totalChars}자 — 최대 ${maxChars}자 초과`);
  }
  if (totalChars < MIN_TOTAL_CHARS) {
    console.log(
      `   ⚠️  narration 총 글자수 ${totalChars}자 — 최소 ${MIN_TOTAL_CHARS}자 권장 (영상이 너무 짧을 수 있음)`,
    );
  }
  console.log(
    `   📏 총 narration: ${totalChars}자 (예상 약 ${(totalChars / 8).toFixed(1)}초 @ 1.25x)`,
  );

  if (errors.length > 0) {
    throw new Error(`스크립트 검증 실패:\n  - ${errors.join("\n  - ")}`);
  }
}

function countNarrationChars(script: ShortsScript): number {
  const stripSpaces = (s: string) => s.replace(/\s/g, "");
  let total = 0;
  total += stripSpaces(script.hook?.narration ?? "").length;
  for (const scene of script.body ?? []) {
    total += stripSpaces(scene.narration ?? "").length;
  }
  total += stripSpaces(script.cta?.narration ?? "").length;
  total += stripSpaces(script.loop?.narration ?? "").length;
  return total;
}

// ============================================================
// CLI entry
// ============================================================

const isMain = (() => {
  try {
    const argv = (process.argv[1] ?? "").replace(/\\/g, "/");
    return argv.endsWith("/scripts/shorts/script.ts");
  } catch {
    return false;
  }
})();

if (isMain) {
  const slug = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const force = process.argv.includes("--force");

  if (!slug) {
    console.error("사용법: npx tsx scripts/shorts/script.ts <slug> [--force]");
    process.exit(1);
  }

  const run = async () => {
    let input: ShortsInputData;
    if (fs.existsSync(inputJsonPath(slug))) {
      input = JSON.parse(fs.readFileSync(inputJsonPath(slug), "utf-8"));
      console.log(`   📄 input.json 로드`);
    } else {
      console.log(`   📄 extract 단계 자동 실행...`);
      input = await extract(slug);
    }

    const script = await generateScript(input, { force });

    console.log(`\n✅ 스크립트 생성 완료: ${slug}`);
    console.log(`   카테고리: ${input.category}`);
    console.log(`   총 길이: ${script.totalDurationSec.toFixed(1)}초`);
    console.log(`\n   🎬 Hook (0~3초):`);
    console.log(`     "${script.hook.narration}"`);
    console.log(`     화면: ${script.hook.onScreenText}`);
    console.log(`\n   📊 Body (${script.body.length} cuts):`);
    for (const scene of script.body) {
      console.log(`     [${scene.idx}] ${scene.durationSec}s — "${scene.narration.slice(0, 50)}..."`);
      console.log(`         화면: ${scene.onScreenText} ${scene.sfxCue ? `(SFX: ${scene.sfxCue})` : ""}`);
    }
    console.log(`\n   📢 CTA (${script.cta.durationSec}s):`);
    console.log(`     "${script.cta.narration}"`);
    console.log(`\n   🔁 Loop (${script.loop.durationSec}s):`);
    console.log(`     "${script.loop.narration}"`);
    console.log(`     ↪ Hook 연결: "${script.loop.hookConnector}"`);
    console.log(`\n   💾 ${scriptJsonPath(slug)}`);
  };

  run().catch((err) => {
    console.error(`\n❌ 스크립트 생성 실패:`, err);
    process.exit(1);
  });
}
