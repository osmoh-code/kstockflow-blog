import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT_SIZES, FONTS, SHADOWS } from "../theme";

interface Props {
  readonly value: number;          // Final number (e.g., 30 for +30%)
  readonly prefix?: string;        // "+", "-"
  readonly suffix?: string;        // "%"
  readonly durationFrames?: number; // Roll-up duration (default 18 frames = 0.6s)
  readonly fontSize?: number;
  readonly color?: string;
}

/**
 * Animated number that rolls up from 0 → target on mount.
 * Eye-catching for stock change percentages.
 */
export const AnimatedNumber: React.FC<Props> = ({
  value,
  prefix = "",
  suffix = "",
  durationFrames = 18,
  fontSize = FONT_SIZES.stockChange,
  color = COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const animated = interpolate(frame, [0, durationFrames], [0, value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const display = animated.toFixed(animated >= 100 ? 0 : value % 1 === 0 ? 0 : 2);

  return (
    <div
      style={{
        fontFamily: FONTS.number,
        fontSize,
        fontWeight: 900,
        color,
        textShadow: SHADOWS.textHero,
        letterSpacing: -3,
        lineHeight: 1,
      }}
    >
      {prefix}
      {display}
      {suffix}
    </div>
  );
};
