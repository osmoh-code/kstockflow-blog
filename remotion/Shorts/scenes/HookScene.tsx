import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderScene } from "../../../scripts/shorts/types";
import { COLORS, FONT_SIZES, FONTS, RADIUS, SAFE_ZONE_CENTER, SHADOWS } from "../theme";

interface Props {
  readonly scene: RenderScene;
}

/**
 * Apple-style minimal hook.
 * Big bold heading on a clean dark background — no flashy glows.
 */
export const HookScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Smooth spring entrance
  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 100 },
    durationInFrames: 18,
  });
  const slideY = interpolate(enter, [0, 1], [50, 0]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      {/* Eyebrow tag */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + SAFE_ZONE_CENTER.height * 0.28,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity,
          transform: `translateY(${slideY * 0.5}px)`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "14px 32px",
            background: "rgba(220, 38, 38, 0.15)",
            border: `1px solid ${COLORS.accent}`,
            borderRadius: RADIUS.pill,
            fontSize: 34,
            fontWeight: 700,
            color: COLORS.accentLight,
            fontFamily: FONTS.body,
            letterSpacing: 0.5,
          }}
        >
          🔥 TODAY'S TOP MOVERS
        </div>
      </div>

      {/* Hero text */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + SAFE_ZONE_CENTER.height * 0.40,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity,
          transform: `translateY(${slideY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: FONT_SIZES.hookHero,
            fontWeight: 900,
            color: COLORS.text,
            textShadow: SHADOWS.textHero,
            letterSpacing: -3.5,
            lineHeight: 1.05,
          }}
        >
          {scene.onScreenText}
        </div>
      </div>
    </AbsoluteFill>
  );
};
