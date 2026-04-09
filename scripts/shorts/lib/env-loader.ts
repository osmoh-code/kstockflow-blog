/**
 * Loads .env.local into process.env when a shorts script is run standalone.
 *
 * Why this exists:
 *   shorts-pipeline.ts loads .env.local before delegating to sub-scripts, but
 *   when extract.ts/script.ts/tts.ts/render.ts are invoked directly the env
 *   vars are missing — causing GOOGLE_AI_API_KEY/ANTHROPIC_API_KEY lookups to
 *   fail silently and degrade quality (e.g. Gemini summarization fallback to
 *   raw descriptions). Import this module at the top of any standalone-runnable
 *   shorts script to keep behavior consistent with the pipeline.
 */

import fs from "node:fs";
import path from "node:path";

let loaded = false;

export function loadDotEnvLocal(): void {
  if (loaded) return;
  loaded = true;
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
      if (!m) continue;
      const [, key, rawValue] = m;
      if (process.env[key]) continue;
      // Strip surrounding quotes if present
      const value = rawValue.replace(/^["'](.*)["']$/, "$1");
      process.env[key] = value;
    }
  }
}

// Auto-load on import — keeps callers ergonomic.
loadDotEnvLocal();
