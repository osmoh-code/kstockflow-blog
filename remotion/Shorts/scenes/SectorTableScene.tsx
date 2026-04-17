import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { RenderScene } from "../../../scripts/shorts/types";
import { COLORS, FONTS, SAFE_ZONE_CENTER, SHADOWS } from "../theme";

interface Props {
  readonly scene: RenderScene;
}

/**
 * SectorTableScene — sector-leaders category only.
 *
 * Layout (top→bottom inside the 960×960 safe zone):
 *   1. Sector title (e.g. "🔐 양자암호/양자컴퓨팅 관련주")
 *   2. Reason subtitle (narration text — 1~2 sentences)
 *   3. Stock rows: name + change% (2 columns, all stocks in one table image)
 *
 * Font sizes auto-fit by row count so even 12-stock sectors fit without
 * vertical scroll.
 */
export const SectorTableScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const tableSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
    durationInFrames: 16,
  });

  const rows = scene.tableRows ?? [];
  const rowCount = rows.length;
  const heading = scene.onScreenText ?? "";
  const subtitle = scene.reason ?? "";

  // Auto-fit table typography to row count.
  const { rowHeight, nameSize, pctSize, rowGap, rowPadX } = pickTableSizing(rowCount);
  const titleFontSize = heading.length > 18 ? 54 : heading.length > 12 ? 62 : 72;
  const subtitleFontSize = subtitle.length > 60 ? 28 : subtitle.length > 40 ? 32 : 36;

  return (
    <AbsoluteFill>
      {/* Sector title (top) */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + 10,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity: fadeIn,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: titleFontSize,
            fontWeight: 900,
            color: COLORS.text,
            textShadow: SHADOWS.textHero,
            letterSpacing: -1.5,
            lineHeight: 1.1,
            wordBreak: "keep-all",
          }}
        >
          {heading}
        </div>
      </div>

      {/* Reason subtitle */}
      {subtitle.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: SAFE_ZONE_CENTER.x + 30,
            top: SAFE_ZONE_CENTER.y + 110,
            width: SAFE_ZONE_CENTER.width - 60,
            textAlign: "center",
            opacity: fadeIn,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: subtitleFontSize,
              fontWeight: 500,
              color: COLORS.textSecondary,
              lineHeight: 1.4,
              letterSpacing: -0.5,
              wordBreak: "keep-all",
            }}
          >
            {subtitle}
          </div>
        </div>
      )}

      {/* Stock table */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x + 20,
          top: SAFE_ZONE_CENTER.y + 230,
          width: SAFE_ZONE_CENTER.width - 40,
          transform: `scale(${tableSpring}) translateY(${interpolate(
            tableSpring,
            [0, 1],
            [40, 0],
          )}px)`,
          transformOrigin: "top center",
          opacity: fadeIn,
          display: "flex",
          flexDirection: "column",
          gap: rowGap,
        }}
      >
        {rows.map((row, i) => {
          const staggered = interpolate(frame, [6 + i * 2, 14 + i * 2], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const isUp = row.changePercent > 0;
          const hasData = row.changePercent !== 0;
          const changeColor = !hasData
            ? COLORS.textMuted
            : isUp
              ? COLORS.accent
              : COLORS.green;
          return (
            <div
              key={row.name + i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: rowHeight,
                padding: `0 ${rowPadX}px`,
                background: "rgba(17, 24, 39, 0.85)",
                borderLeft: `6px solid ${changeColor}`,
                borderRadius: 10,
                opacity: staggered,
                transform: `translateX(${interpolate(staggered, [0, 1], [-24, 0])}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.heading,
                  fontSize: nameSize,
                  fontWeight: 900,
                  color: COLORS.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  letterSpacing: -0.8,
                  lineHeight: 1,
                  maxWidth: "60%",
                }}
              >
                {row.name}
              </div>
              <div
                style={{
                  fontFamily: FONTS.number,
                  fontSize: pctSize,
                  fontWeight: 900,
                  color: changeColor,
                  textShadow: hasData ? `0 0 12px ${changeColor}50` : "none",
                  letterSpacing: -1,
                }}
              >
                {!hasData
                  ? "-"
                  : `${isUp ? "+" : ""}${row.changePercent.toFixed(2)}%`}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Auto-fit sizing based on row count so every sector's full 주요 종목 list
 * renders inside the 960px-tall table area without scroll.
 *
 * Budget: top 230 reserved for title+subtitle, ~700 usable for rows.
 * rowHeight × N + gap × (N-1) ≤ 700
 */
function pickTableSizing(n: number): {
  rowHeight: number;
  nameSize: number;
  pctSize: number;
  rowGap: number;
  rowPadX: number;
} {
  if (n <= 4) {
    return { rowHeight: 120, nameSize: 60, pctSize: 72, rowGap: 14, rowPadX: 32 };
  }
  if (n <= 6) {
    return { rowHeight: 92, nameSize: 50, pctSize: 60, rowGap: 12, rowPadX: 28 };
  }
  if (n <= 8) {
    return { rowHeight: 72, nameSize: 42, pctSize: 50, rowGap: 10, rowPadX: 26 };
  }
  if (n <= 10) {
    return { rowHeight: 58, nameSize: 36, pctSize: 42, rowGap: 8, rowPadX: 22 };
  }
  if (n <= 12) {
    return { rowHeight: 48, nameSize: 32, pctSize: 36, rowGap: 7, rowPadX: 20 };
  }
  // 13+ stocks: shrink further (rare case)
  return { rowHeight: 42, nameSize: 28, pctSize: 32, rowGap: 6, rowPadX: 18 };
}
