/**
 * Google Cloud Text-to-Speech (Neural2) wrapper.
 *
 * Free tier: 1 million chars/month for Neural2 voices.
 * Our usage: ~24,000 chars/month (4 videos/day × 30 days × 200 chars)
 *           = 2.4% of free tier → 영구 0원
 *
 * Uses the same GOOGLE_AI_API_KEY from .env.local (works for both Gemini API
 * and Cloud Text-to-Speech API as long as the API key is scoped correctly).
 *
 * Note on authentication:
 * Cloud TTS requires either a service account JSON or an API key. For simplicity,
 * this wrapper uses an API key via the REST endpoint. The user must enable the
 * "Cloud Text-to-Speech API" on their Google Cloud project.
 */

import fs from "node:fs";
import path from "node:path";

const API_BASE = "https://texttospeech.googleapis.com/v1/text:synthesize";
const TIMEOUT_MS = 60_000;

export const CLOUD_VOICES = {
  chirp3Algenib: "ko-KR-Chirp3-HD-Algenib",  // 남성 거친 깊은 톤 (gravelly) — default ⭐
  chirp3Orus: "ko-KR-Chirp3-HD-Orus",        // 남성 단호한 (firm)
  chirp3Charon: "ko-KR-Chirp3-HD-Charon",    // 남성 정보전달 (informative)
  chirp3Iapetus: "ko-KR-Chirp3-HD-Iapetus",  // 남성 명확한 (clear)
  neural2A: "ko-KR-Neural2-A",                // 여성 차분형 (legacy)
  neural2B: "ko-KR-Neural2-B",                // 여성 활기형 (legacy)
  neural2C: "ko-KR-Neural2-C",                // 남성 묵직형 (legacy)
} as const;

export type CloudVoice = typeof CLOUD_VOICES[keyof typeof CLOUD_VOICES];

export interface SynthesizeResult {
  readonly mp3Path: string;        // Actually WAV now (kept name for backward compat)
  readonly durationSec: number;    // Accurate duration from PCM sample count
  readonly sampleRate: number;
  readonly byteLength: number;
}

/**
 * Synthesize text via Google Cloud TTS, output as WAV.
 * Uses LINEAR16 PCM encoding so we can compute exact duration from sample count.
 */
export async function synthesizeCloud(
  text: string,
  voice: string,
  outputDir: string,
  filename: string,
): Promise<SynthesizeResult> {
  // Prefer dedicated TTS key (GOOGLE_CLOUD_TTS_KEY), fall back to main key
  const apiKey = process.env.GOOGLE_CLOUD_TTS_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_TTS_KEY 또는 GOOGLE_AI_API_KEY 누락 (.env.local 확인)");
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Force .wav extension (we output WAV regardless of caller's filename)
  const baseName = filename.replace(/\.(mp3|wav)$/i, "");
  const wavPath = path.join(outputDir, `${baseName}.wav`);

  const requestBody = {
    input: { text },
    voice: {
      languageCode: "ko-KR",
      name: voice,
    },
    audioConfig: {
      audioEncoding: "LINEAR16",        // 16-bit PCM for accurate duration calculation
      sampleRateHertz: 24000,
      speakingRate: 1.0,
      pitch: 0.0,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}?key=${apiKey}`, {
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
    throw new Error(`Cloud TTS HTTP ${response.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await response.json()) as { audioContent?: string };
  if (!json.audioContent) {
    throw new Error("Cloud TTS 응답에 audioContent 없음");
  }

  // LINEAR16 = raw 16-bit PCM, 24kHz mono
  const pcmBuffer = Buffer.from(json.audioContent, "base64");
  const sampleRate = 24000;
  const wavBuffer = pcmToWav(pcmBuffer, sampleRate);
  fs.writeFileSync(wavPath, wavBuffer);

  // Exact duration: sample count / sample rate (16-bit = 2 bytes per sample, mono)
  const sampleCount = pcmBuffer.length / 2;
  const durationSec = sampleCount / sampleRate;

  return {
    mp3Path: wavPath, // field name kept for backward compat
    durationSec,
    sampleRate,
    byteLength: wavBuffer.length,
  };
}

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
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);  // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

/**
 * Synthesize text (or SSML) to raw PCM (no file write). Returns the raw 16-bit
 * PCM buffer + accurate duration. Useful for per-scene synthesis where we
 * concat multiple PCM blobs into a single WAV.
 *
 * Set isSsml=true to send the input as SSML (allows <break>, <prosody>, etc).
 */
export async function synthesizePcm(
  text: string,
  voice: string,
  isSsml = false,
  speakingRate?: number,
): Promise<{ pcm: Buffer; sampleRate: number; durationSec: number }> {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_CLOUD_TTS_KEY 누락");

  // Resolve speaking rate: explicit arg > SHORTS_SPEAKING_RATE env > 1.0
  const envRate = Number.parseFloat(process.env.SHORTS_SPEAKING_RATE ?? "");
  const rate = speakingRate ?? (Number.isFinite(envRate) ? envRate : 1.0);

  const requestBody = {
    input: isSsml ? { ssml: text } : { text },
    voice: { languageCode: "ko-KR", name: voice },
    audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000, speakingRate: rate },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}?key=${apiKey}`, {
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
    throw new Error(`Cloud TTS HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await response.json()) as { audioContent?: string };
  if (!json.audioContent) throw new Error("audioContent 없음");

  const pcm = Buffer.from(json.audioContent, "base64");
  const sampleRate = 24000;
  const durationSec = pcm.length / 2 / sampleRate;
  return { pcm, sampleRate, durationSec };
}

/**
 * Apply a raised-cosine fade-in/fade-out to each PCM segment + remove DC offset,
 * then concatenate. This eliminates click/pop artifacts at scene boundaries
 * caused by independent TTS synthesis calls having different DC offsets and
 * non-smooth boundary amplitudes.
 *
 * Default fade: 20ms (480 samples at 24kHz). Raised cosine is C1-continuous
 * (smooth value AND smooth derivative at both ends), unlike linear fade which
 * has a slope discontinuity at the joint that can produce a faint tick.
 */
export function pcmBuffersToWav(pcms: Buffer[], sampleRate: number, fadeMs = 20): Buffer {
  const fadeSamples = Math.max(1, Math.floor((sampleRate * fadeMs) / 1000));
  const processed = pcms.map((buf) => fadeEnvelope(removeDcOffset(buf), fadeSamples));
  return pcmToWav(Buffer.concat(processed), sampleRate);
}

/**
 * Remove DC offset (mean bias) from a 16-bit signed PCM buffer.
 * Some TTS calls return audio with a small DC bias that creates a step
 * discontinuity at concatenation boundaries even after fading.
 */
function removeDcOffset(pcm: Buffer): Buffer {
  const totalSamples = pcm.length / 2;
  if (totalSamples === 0) return pcm;
  let sum = 0;
  for (let i = 0; i < totalSamples; i++) {
    sum += pcm.readInt16LE(i * 2);
  }
  const dc = Math.round(sum / totalSamples);
  if (dc === 0) return pcm;
  const out = Buffer.from(pcm);
  for (let i = 0; i < totalSamples; i++) {
    const offset = i * 2;
    let v = out.readInt16LE(offset) - dc;
    if (v > 32767) v = 32767;
    if (v < -32768) v = -32768;
    out.writeInt16LE(v, offset);
  }
  return out;
}

/**
 * Apply raised-cosine fade-in (first fadeSamples) and fade-out (last fadeSamples)
 * to a 16-bit signed PCM buffer. Returns a new buffer.
 *
 * Raised cosine: gain(t) = 0.5 * (1 - cos(π * t/T))
 *   - gain(0) = 0,  gain(T) = 1
 *   - slope(0) = 0, slope(T) = 0   ← C1 continuous (smooth derivative)
 */
function fadeEnvelope(pcm: Buffer, fadeSamples: number): Buffer {
  const totalSamples = pcm.length / 2;
  if (totalSamples < fadeSamples * 2) {
    return pcm;
  }
  const out = Buffer.from(pcm);
  // Fade in (raised cosine ramping from 0 to 1)
  for (let i = 0; i < fadeSamples; i++) {
    const gain = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
    const offset = i * 2;
    const sample = out.readInt16LE(offset);
    out.writeInt16LE(Math.round(sample * gain), offset);
  }
  // Fade out (raised cosine ramping from 1 to 0)
  for (let i = 0; i < fadeSamples; i++) {
    const gain = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
    const offset = (totalSamples - 1 - i) * 2;
    const sample = out.readInt16LE(offset);
    out.writeInt16LE(Math.round(sample * gain), offset);
  }
  return out;
}
