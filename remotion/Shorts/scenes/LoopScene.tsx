import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderScene } from "../../../scripts/shorts/types";
import { COLORS, FONT_SIZES, FONTS, SAFE_ZONE_CENTER, SHADOWS } from "../theme";

interface Props {
  readonly scene: RenderScene;
}

/**
 * Closing scene — displays a table of remaining market stocks + blog CTA.
 * (Previously a "seamless loop" ending; user requested full-CTA instead.)
 */
export const LoopScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const tableSpring = spring({ frame, fps, config: { damping: 14, stiffness: 120 }, durationInFrames: 16 });

  const rows = scene.tableRows ?? [];
  const title = "그 외 오늘의 특징주";

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + 20,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity: fadeIn,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 72,
            fontWeight: 900,
            color: COLORS.text,
            textShadow: SHADOWS.textHero,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
      </div>

      {/* Stock table */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x + 20,
          top: SAFE_ZONE_CENTER.y + 140,
          width: SAFE_ZONE_CENTER.width - 40,
          transform: `scale(${tableSpring}) translateY(${interpolate(tableSpring, [0, 1], [40, 0])}px)`,
          opacity: fadeIn,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {rows.map((row, i) => {
          const staggered = interpolate(
            frame,
            [8 + i * 2, 16 + i * 2],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const isUp = row.changePercent >= 0;
          return (
            <div
              key={row.name + i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 28px",
                background: "rgba(17, 24, 39, 0.85)",
                borderLeft: `6px solid ${isUp ? COLORS.accent : COLORS.green}`,
                borderRadius: 12,
                opacity: staggered,
                transform: `translateX(${interpolate(staggered, [0, 1], [-30, 0])}px)`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FONTS.heading,
                    fontSize: 48,
                    fontWeight: 900,
                    color: COLORS.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    letterSpacing: -1,
                  }}
                >
                  {row.name}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 26,
                    color: COLORS.textMuted,
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.sector}
                </div>
              </div>
              <div
                style={{
                  fontFamily: FONTS.number,
                  fontSize: 56,
                  fontWeight: 900,
                  color: isUp ? COLORS.accent : COLORS.green,
                  textShadow: `0 0 16px ${isUp ? COLORS.accent : COLORS.green}50`,
                  letterSpacing: -1,
                  marginLeft: 16,
                }}
              >
                {isUp ? "+" : ""}
                {row.changePercent.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom CTA hint */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + SAFE_ZONE_CENTER.height - 120,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity: fadeIn,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 44,
            fontWeight: 700,
            color: COLORS.gold,
            textShadow: `0 0 20px ${COLORS.gold}80`,
            letterSpacing: 0,
          }}
        >
          자세한 내용은 👆 K주식핫이슈에서
        </div>
      </div>
    </AbsoluteFill>
  );
};
