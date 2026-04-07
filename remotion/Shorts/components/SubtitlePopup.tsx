import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT_SIZES, FONTS, SAFE_ZONE_CENTER, SHADOWS } from "../theme";

interface Props {
  readonly text: string;
  readonly emphasisWords?: readonly string[];
  readonly fontSize?: number;
  readonly color?: string;
  readonly y?: number;
}

/**
 * Burned-in popup subtitle for the current scene.
 * Pulses in with spring animation, stays visible for the scene duration.
 *
 * Positioned in the center safe zone (avoiding YouTube UI overlap).
 * Emphasis words are colored in brand red (#DC2626) for visual impact.
 */
export const SubtitlePopup: React.FC<Props> = ({
  text,
  emphasisWords = [],
  fontSize = FONT_SIZES.subtitle,
  color = COLORS.text,
  y,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring pop-in
  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
    durationInFrames: 12,
  });
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });

  const positionY = y ?? SAFE_ZONE_CENTER.y + SAFE_ZONE_CENTER.height * 0.62;

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_ZONE_CENTER.x,
        top: positionY,
        width: SAFE_ZONE_CENTER.width,
        textAlign: "center",
        transform: `scale(${scale})`,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "20px 36px",
          background: "rgba(0, 0, 0, 0.65)",
          borderRadius: 20,
          backdropFilter: "blur(8px)",
          border: `3px solid rgba(255, 255, 255, 0.12)`,
          boxShadow: SHADOWS.card,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize,
            fontWeight: 900,
            color,
            textShadow: SHADOWS.text,
            lineHeight: 1.2,
            letterSpacing: -1,
          }}
        >
          {renderWithEmphasis(text, emphasisWords)}
        </div>
      </div>
    </div>
  );
};

function renderWithEmphasis(text: string, emphasis: readonly string[]): React.ReactNode {
  if (emphasis.length === 0) return text;

  // Build a regex matching any emphasis word/phrase, longest first to avoid partial overlaps
  const sorted = [...emphasis].sort((a, b) => b.length - a.length);
  const pattern = sorted.map(escapeRegex).join("|");
  const regex = new RegExp(`(${pattern})`, "g");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isEmphasis = sorted.some((e) => e === part);
    return isEmphasis ? (
      <span key={i} style={{ color: COLORS.accent, textShadow: `0 0 16px ${COLORS.accent}` }}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
