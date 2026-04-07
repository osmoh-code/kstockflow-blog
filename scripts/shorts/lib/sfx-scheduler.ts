import type { RenderScene, SFXCue, SFXName } from "../types";

/**
 * Build SFX cues from rendered scenes.
 *
 * Each scene that has an explicit sfxCue triggers an SFX file at the
 * scene's start frame. CTA scenes always get a "notification" cue.
 */
export function buildSFXCues(scenes: readonly RenderScene[]): SFXCue[] {
  const cues: SFXCue[] = [];

  for (const scene of scenes) {
    // CTA always notifies
    if (scene.type === "cta") {
      cues.push({ file: "notification", atFrame: scene.startFrame, volume: 0.4 });
      continue;
    }

    // Scenes carry their own optional cue (extracted from script.ts BodyScene.sfxCue)
    // We don't have a direct field on RenderScene, so callers should attach it
    // via a sceneSfxMap. For now, body scenes default to a soft "swoosh" on enter.
    if (scene.type === "stock_card" || scene.type === "chart") {
      cues.push({ file: "swoosh", atFrame: scene.startFrame, volume: 0.35 });
    }

    // Hook gets an impact at frame 0
    if (scene.type === "hook") {
      cues.push({ file: "impact", atFrame: scene.startFrame, volume: 0.5 });
    }
  }

  return cues;
}

export function buildSFXCuesFromBody(
  scenes: readonly RenderScene[],
  bodySfxMap: ReadonlyMap<number, SFXName | null>,
): SFXCue[] {
  const cues = buildSFXCues(scenes);
  // Override body cues from explicit sfxCue field
  for (const scene of scenes) {
    if (scene.type !== "stock_card" && scene.type !== "chart") continue;
    const idx = scenes.indexOf(scene);
    const explicit = bodySfxMap.get(idx);
    if (explicit && explicit !== null) {
      // Replace any auto cue at this scene's startFrame
      const existing = cues.findIndex((c) => c.atFrame === scene.startFrame);
      if (existing >= 0) {
        cues[existing] = { file: explicit, atFrame: scene.startFrame, volume: 0.35 };
      } else {
        cues.push({ file: explicit, atFrame: scene.startFrame, volume: 0.35 });
      }
    }
  }
  return cues;
}
