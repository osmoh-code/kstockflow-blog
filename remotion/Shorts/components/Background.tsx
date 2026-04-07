import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, CONTENT_AREA, WIDTH } from "../theme";

/**
 * Apple-inspired minimal background.
 * Almost pure black with a subtle radial vignette and very faint accent glow.
 * No flashy gradients — restraint is the point.
 */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const driftX = Math.sin(frame / 120) * 4;
  const driftY = Math.cos(frame / 130) * 6;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Content area: solid near-black with very subtle radial */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: CONTENT_AREA.top,
          width: WIDTH,
          height: CONTENT_AREA.height,
          background: COLORS.bgDark,
        }}
      />
      {/* Very subtle center vignette to lift content */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: CONTENT_AREA.top,
          width: WIDTH,
          height: CONTENT_AREA.height,
          background: `radial-gradient(ellipse 70% 60% at ${50 + driftX}% ${45 + driftY}%, rgba(255,255,255,0.04) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Faint red accent in lower-right corner (very subtle) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: CONTENT_AREA.top,
          width: WIDTH,
          height: CONTENT_AREA.height,
          background: `radial-gradient(ellipse 60% 50% at 90% 95%, rgba(220, 38, 38, 0.10) 0%, transparent 60%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
