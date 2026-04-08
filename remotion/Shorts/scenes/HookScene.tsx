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

  // Hot-issues mode: detected when onScreenText contains a newline (2-line title)
  // OR when narration is significantly longer than onScreenText.
  // In this mode we render BOTH the title (prominent) AND the narration text below.
  const narration = scene.narration ?? "";
  const onScreen = scene.onScreenText ?? "";
  const isHotIssues = onScreen.includes("\n") || narration.length > onScreen.length * 1.5;

  if (!isHotIssues) {
    // ─── Featured-stocks layout: short impact text only ────────────
    return (
      <AbsoluteFill>
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
            {onScreen}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // ─── Hot-issues layout: title (intro) + narration (detail) ────
  // Title is the 2-line "중동전쟁 종전 기대감 / 건설주 TOP 7"
  // Narration is the cleaned 핵심 요약 first sentence
  const titleLines = onScreen.split("\n").length;
  const titleFontSize = titleLines >= 2 ? 80 : 92;
  const narrationFontSize = narration.length > 75 ? 40 : 46;

  return (
    <AbsoluteFill>
      {/* Eyebrow chip */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + 40,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity,
          transform: `translateY(${slideY * 0.5}px)`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: "rgba(220, 38, 38, 0.15)",
            border: `1px solid ${COLORS.accent}`,
            borderRadius: RADIUS.pill,
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.accentLight,
            fontFamily: FONTS.body,
            letterSpacing: 0.5,
          }}
        >
          📰 핵심 요약
        </div>
      </div>

      {/* Big title (intro card) */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + 130,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity,
          transform: `translateY(${slideY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: titleFontSize,
            fontWeight: 900,
            color: COLORS.text,
            textShadow: SHADOWS.textHero,
            letterSpacing: -2.5,
            lineHeight: 1.1,
            whiteSpace: "pre-line",
          }}
        >
          {onScreen}
        </div>
      </div>

      {/* Narration / 핵심 요약 detail text below title */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + SAFE_ZONE_CENTER.height * 0.62,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity,
          transform: `translateY(${slideY * 0.7}px)`,
          padding: "0 40px",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: narrationFontSize,
            fontWeight: 500,
            color: COLORS.textSecondary,
            lineHeight: 1.4,
            letterSpacing: -0.5,
          }}
        >
          {narration}
        </div>
      </div>
    </AbsoluteFill>
  );
};
