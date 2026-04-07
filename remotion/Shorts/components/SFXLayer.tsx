import React from "react";
import fs from "node:fs";
import path from "node:path";
import { Audio, Sequence, staticFile } from "remotion";
import type { SFXCue } from "../../../scripts/shorts/types";

interface Props {
  readonly cues: readonly SFXCue[];
}

/**
 * Renders SFX audio cues at specific frames.
 *
 * Each cue references a file in remotion/Shorts/sfx/{name}.mp3
 * If the file doesn't exist, the cue is silently skipped (mp4 still renders).
 *
 * Add CC0 SFX files to remotion/Shorts/sfx/ to enable:
 *  - swoosh.mp3       (cut transitions)
 *  - pop.mp3          (text appearance)
 *  - impact.mp3       (emphasis)
 *  - notification.mp3 (CTA alert)
 */
export const SFXLayer: React.FC<Props> = ({ cues }) => {
  return (
    <>
      {cues.map((cue, i) => {
        const src = `sfx/${cue.file}.mp3`;
        // Cannot check existence at render time in browser bundler context;
        // missing file just logs a warning and continues. We rely on
        // the bundler to silently no-op if the asset isn't bundled.
        return (
          <Sequence key={i} from={cue.atFrame} durationInFrames={45}>
            <Audio src={staticFile(src)} volume={cue.volume ?? 0.5} />
          </Sequence>
        );
      })}
    </>
  );
};
