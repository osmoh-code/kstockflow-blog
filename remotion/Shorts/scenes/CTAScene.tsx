import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderScene } from "../../../scripts/shorts/types";
import { COLORS, FONT_SIZES, FONTS, RADIUS, SAFE_ZONE_CENTER, SHADOWS } from "../theme";

interface Props {
  readonly scene: RenderScene;
}

/**
 * Apple-style CTA scene.
 * Centered brand title + pill-shaped CTA button + small URL.
 */
export const CTAScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cta = scene.ctaProps;
  const brandName = cta?.brandName ?? "K주식핫이슈";
  const siteUrl = cta?.siteUrl ?? "kstockflow.com";

  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
    durationInFrames: 16,
  });
  const slideY = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  // Pulse on the pill button
  const pulse = 1 + Math.sin(frame / 10) * 0.025;

  return (
    <AbsoluteFill>
      {/* Card container */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + 30,
          width: SAFE_ZONE_CENTER.width,
          height: SAFE_ZONE_CENTER.height - 60,
          background: COLORS.bgCard,
          borderRadius: RADIUS.cardLarge,
          border: `1px solid ${COLORS.bgBorder}`,
          boxShadow: SHADOWS.cardElevated,
          padding: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          opacity,
          transform: `translateY(${slideY}px)`,
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 32,
            color: COLORS.textSecondary,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          더 자세한 내용
        </div>

        {/* Big brand */}
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: FONT_SIZES.ctaBrand,
            fontWeight: 900,
            color: COLORS.text,
            letterSpacing: -2.5,
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {brandName}
        </div>

        {/* Pill CTA button */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            padding: "26px 56px",
            background: COLORS.accent,
            borderRadius: RADIUS.pill,
            fontSize: 44,
            fontWeight: 800,
            color: COLORS.text,
            fontFamily: FONTS.heading,
            transform: `scale(${pulse})`,
            boxShadow: `0 8px 32px ${COLORS.accentGlow}`,
            letterSpacing: -0.5,
          }}
        >
          👆 프로필 링크 클릭
        </div>

        {/* Small URL */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZES.ctaUrl,
            color: COLORS.textMuted,
            letterSpacing: 1,
            marginTop: 8,
          }}
        >
          {siteUrl}
        </div>
      </div>
    </AbsoluteFill>
  );
};
