import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import type { RenderScene, ShortsAssets } from "../../scripts/shorts/types";
import { COLORS } from "./theme";
import { Background } from "./components/Background";
import { Letterbox } from "./components/Letterbox";
import { SafeZoneDebug } from "./components/SafeZone";
import { HookScene } from "./scenes/HookScene";
import { StockCardScene } from "./scenes/StockCardScene";
import { ChartScene } from "./scenes/ChartScene";
import { CTAScene } from "./scenes/CTAScene";
import { LoopScene } from "./scenes/LoopScene";

/**
 * Main YouTube Shorts composition.
 * Receives ShortsAssets via inputProps from render.ts.
 *
 * Layer order (back to front):
 *  1. Background (gradient)
 *  2. Active scene (Hook/StockCard/CTA/Loop)
 *  3. Letterbox header + footer (always-visible fixed text)
 *  4. SafeZone debug overlay (dev only)
 */
export const Shorts: React.FC<ShortsAssets> = ({
  scenes,
  audioSrc,
  headerTitle,
  footerBrand,
  footerHint,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Background />

      {scenes.map((scene, i) => (
        <Sequence key={i} from={scene.startFrame} durationInFrames={scene.durationFrames}>
          {renderScene(scene)}
        </Sequence>
      ))}

      {/* Always-visible letterbox header + footer */}
      <Letterbox headerTitle={headerTitle} footerBrand={footerBrand} footerHint={footerHint} />

      {/* Main TTS narration (resolved via render.ts publicDir = pending/{slug}) */}
      {audioSrc && <Audio src={staticFile(audioSrc)} />}

      {/* Dev-only safe zone overlay */}
      {process.env.SHORTS_SAFE_ZONE_DEBUG === "1" && <SafeZoneDebug />}
    </AbsoluteFill>
  );
};

function renderScene(scene: RenderScene): React.ReactNode {
  switch (scene.type) {
    case "hook":
      return <HookScene scene={scene} />;
    case "stock_card":
      return <StockCardScene scene={scene} />;
    case "chart":
      return <ChartScene scene={scene} />;
    case "cta":
      return <CTAScene scene={scene} />;
    case "loop":
      return <LoopScene scene={scene} />;
    default:
      return null;
  }
}
