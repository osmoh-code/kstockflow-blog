/**
 * Gemini 2.5 Flash TTS wrapper.
 *
 * Why Gemini TTS over Edge TTS:
 *  - Edge TTS Korean voices are robotic (only 3 working voices)
 *  - Gemini TTS uses the latest Google audio model — natural, expressive
 *  - Same API key as script generation (no extra setup)
 *
 * Free tier limits (2026):
 *  - RPM: 3 requests per minute (per project per model)
 *  - Production usage: 1 video/day = 1 call/day → safely under limit
 *  - Voice comparison runs need sequential calls (22s spacing)
 *
 * Output format: PCM 24kHz mono 16-bit → wrapped in WAV header.
 * Remotion <Audio src="..."> handles WAV files natively.
 */

import fs from "node:fs";
import path from "node:path";

const MODEL = "gemini-2.5-flash-preview-tts";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 60_000;

/**
 * Curated Korean-friendly voices.
 * Gemini voices are language-agnostic — any voice can speak Korean naturally.
 */
export const GEMINI_VOICES = {
  charon: "Charon",       // 남성 정보전달 (Informative) — default
  kore: "Kore",           // 여성 단호 (Firm)
  aoede: "Aoede",         // 여성 친근 (Breezy)
  sulafat: "Sulafat",     // 여성 따뜻 (Warm)
  puck: "Puck",           // 남성 활기 (Upbeat)
  iapetus: "Iapetus",     // 남성 명확 (Clear)
} as const;

export type GeminiVoice = typeof GEMINI_VOICES[keyof typeof GEMINI_VOICES];

export interface SynthesizeResult {
  readonly wavPath: string;
  readonly durationSec: number;
  readonly sampleRate: number;
  readonly byteLength: number;
}

/**
 * Synthesize narration text → WAV file.
 *
 * @param text - Narration text in Korean
 * @param voice - Gemini voice name (e.g., "Charon")
 * @param outputDir - Output directory (created if missing)
 * @param filename - Output filename (.wav extension auto-added)
 */
export async function synthesize(
  text: string,
  voice: string,
  outputDir: string,
  filename: string,
): Promise<SynthesizeResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY 환경변수 누락 (.env.local 확인)");
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const finalName = filename.endsWith(".wav") ? filename : `${filename}.wav`;
  const wavPath = path.join(outputDir, finalName);

  const url = `${API_BASE}/${MODEL}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errText = await response.text();
    // Auto-retry once on 429 (rate limit) with the suggested retry delay
    if (response.status === 429) {
      const retryMatch = /"retryDelay":\s*"(\d+)s"/.exec(errText);
      const waitMs = retryMatch ? (parseInt(retryMatch[1], 10) + 5) * 1000 : 65_000;
      console.log(`   ⏳ Gemini TTS RPM 한도 — ${(waitMs / 1000).toFixed(0)}초 대기 후 재시도`);
      await new Promise((r) => setTimeout(r, waitMs));

      const retryRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!retryRes.ok) {
        const retryErr = await retryRes.text();
        throw new Error(`Gemini TTS HTTP ${retryRes.status} (retry 실패): ${retryErr.slice(0, 200)}`);
      }
      const retryJson = (await retryRes.json()) as GeminiTTSResponse;
      const retryPart = retryJson.candidates?.[0]?.content?.parts?.[0];
      if (!retryPart?.inlineData?.data) {
        throw new Error("Gemini TTS retry 응답에 audio 없음");
      }
      const retryPcm = Buffer.from(retryPart.inlineData.data, "base64");
      const retryRate = parseSampleRate(retryPart.inlineData.mimeType ?? "");
      const retryWav = pcmToWav(retryPcm, retryRate);
      fs.writeFileSync(wavPath, retryWav);
      const retrySamples = retryPcm.length / 2;
      return {
        wavPath,
        durationSec: retrySamples / retryRate,
        sampleRate: retryRate,
        byteLength: retryWav.length,
      };
    }
    throw new Error(`Gemini TTS HTTP ${response.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await response.json()) as GeminiTTSResponse;
  const part = json.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error("Gemini TTS 응답에 audio 데이터 없음");
  }

  const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
  const sampleRate = parseSampleRate(part.inlineData.mimeType ?? "");
  const wav = pcmToWav(pcmBuffer, sampleRate);

  fs.writeFileSync(wavPath, wav);

  // Duration = sample count / sample rate
  // PCM 16-bit mono → 2 bytes per sample
  const sampleCount = pcmBuffer.length / 2;
  const durationSec = sampleCount / sampleRate;

  return {
    wavPath,
    durationSec,
    sampleRate,
    byteLength: wav.length,
  };
}

interface GeminiTTSResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
}

/**
 * Per-scene PCM synthesis (no file write, no WAV header).
 *
 * Returns raw 16-bit signed PCM so the caller can concatenate multiple
 * scene buffers into a single WAV with fade-in/out + DC offset removal
 * (see cloud-tts.ts pcmBuffersToWav). This is the function used by the
 * Shorts pipeline when SHORTS_TTS_PROVIDER=gemini.
 *
 * SSML stripping: Gemini TTS does not parse SSML. <speak>/<break/> tags
 * are removed; <break/> is replaced with a comma so the prosody engine
 * still inserts a natural pause.
 *
 * Rate limit handling: caller must space calls ~22s apart (RPM 3).
 * On 429 we wait the suggested retryDelay then retry once.
 */
export async function synthesizePcmGemini(
  text: string,
  voice: string,
): Promise<{ pcm: Buffer; sampleRate: number; durationSec: number }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY 환경변수 누락 (.env.local 확인)");
  }

  // Strip SSML — Gemini doesn't parse it. Replace <break/> with comma for natural pause.
  const cleanText = text
    .replace(/<\/?speak[^>]*>/g, "")
    .replace(/<break[^>]*\/>/g, ", ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const url = `${API_BASE}/${MODEL}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [{ parts: [{ text: cleanText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  };

  const doFetch = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let response = await doFetch();

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) {
      const retryMatch = /"retryDelay":\s*"(\d+)s"/.exec(errText);
      const waitMs = retryMatch ? (parseInt(retryMatch[1], 10) + 5) * 1000 : 65_000;
      console.log(`      ⏳ Gemini TTS RPM 한도 — ${(waitMs / 1000).toFixed(0)}초 대기 후 재시도`);
      await new Promise((r) => setTimeout(r, waitMs));
      response = await doFetch();
      if (!response.ok) {
        const retryErr = await response.text();
        throw new Error(`Gemini TTS HTTP ${response.status} (retry 실패): ${retryErr.slice(0, 200)}`);
      }
    } else {
      throw new Error(`Gemini TTS HTTP ${response.status}: ${errText.slice(0, 300)}`);
    }
  }

  const json = (await response.json()) as GeminiTTSResponse;
  const part = json.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error("Gemini TTS 응답에 audio 데이터 없음");
  }

  const pcm = Buffer.from(part.inlineData.data, "base64");
  const sampleRate = parseSampleRate(part.inlineData.mimeType ?? "");
  const sampleCount = pcm.length / 2;
  const durationSec = sampleCount / sampleRate;

  return { pcm, sampleRate, durationSec };
}

function parseSampleRate(mimeType: string): number {
  const match = /rate=(\d+)/.exec(mimeType);
  return match ? parseInt(match[1], 10) : 24000;
}

/**
 * Wrap raw PCM (16-bit mono) in a WAV header.
 * Remotion's <Audio> tag plays WAV files natively, no FFmpeg conversion needed.
 */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const channels = 1;
  const bitDepth = 16;
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const dataSize = pcm.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);          // PCM chunk size
  header.writeUInt16LE(1, 20);            // Audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}
