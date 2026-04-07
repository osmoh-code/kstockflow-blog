import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SAFE_ZONE_CENTER } from "../theme";

interface Props {
  readonly direction?: "to_profile_top_left" | "to_profile_top_right" | "to_description";
}

/**
 * Animated arrow pointing toward the YouTube channel profile.
 * For Shorts, the profile icon is bottom-left of the screen — but we point
 * UP-LEFT from the safe zone center to indicate "tap profile".
 *
 * Uses sin wiggle for attention-grabbing motion.
 */
export const ProfileArrow: React.FC<Props> = ({ direction = "to_profile_top_left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Wiggle motion
  const wiggle = Math.sin(frame / 4) * 12;
  // Pulse scale
  const pulse = 1 + Math.sin(frame / 6) * 0.08;
  // Fade in
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  // Direction → rotation
  const rotation =
    direction === "to_profile_top_left"
      ? -135
      : direction === "to_profile_top_right"
      ? -45
      : 90;

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_ZONE_CENTER.centerX - 100,
        top: SAFE_ZONE_CENTER.y + SAFE_ZONE_CENTER.height * 0.18 + wiggle,
        width: 200,
        height: 200,
        opacity,
        transform: `scale(${pulse})`,
        pointerEvents: "none",
      }}
    >
      <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%", filter: `drop-shadow(0 4px 16px ${COLORS.accent})` }}>
        <g transform={`rotate(${rotation} 100 100)`}>
          <path
            d="M 100 30 L 100 170 M 100 30 L 60 70 M 100 30 L 140 70"
            stroke={COLORS.accent}
            strokeWidth="20"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
};
