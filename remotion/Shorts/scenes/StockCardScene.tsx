import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderScene } from "../../../scripts/shorts/types";
import { COLORS, FONTS, FONT_SIZES, RADIUS, SAFE_ZONE_CENTER, SHADOWS } from "../theme";
import { AnimatedNumber } from "../components/AnimatedNumber";

interface Props {
  readonly scene: RenderScene;
}

/**
 * Apple/Scappa-inspired stock card.
 *
 * Layout:
 *   ┌─ rounded card ──────────┐
 *   │                         │
 *   │      종목명             │  ← large, white
 *   │   섹터 chip             │  ← muted gray pill
 *   │                         │
 *   │     +30.00%             │  ← HUGE accent number
 *   │                         │
 *   │   상승이유               │  ← bottom subtitle
 *   └─────────────────────────┘
 */
export const StockCardScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring entrance — card slides up + fades in
  const enter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.7 },
    durationInFrames: 14,
  });
  const slideY = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  const stockName = scene.stockData?.name ?? scene.onScreenText;
  const sector = scene.stockData?.tradeAmount ? null : null; // sector display TBD
  const changePercent = scene.stockData?.changePercent ?? 0;
  const isUp = changePercent >= 0;
  const reason = scene.onScreenText;

  return (
    <AbsoluteFill>
      {/* Large rounded card */}
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
          padding: 70,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `translateY(${slideY}px)`,
          opacity,
        }}
      >
        {/* Top section: stock name + sector chip */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}>
          <div
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "rgba(220, 38, 38, 0.15)",
              border: `1px solid ${COLORS.accent}`,
              borderRadius: RADIUS.pill,
              fontSize: 30,
              fontWeight: 700,
              color: COLORS.accentLight,
              fontFamily: FONTS.body,
              letterSpacing: 0,
            }}
          >
            ● 오늘의 강세주
          </div>
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: FONT_SIZES.stockName,
              fontWeight: 900,
              color: COLORS.text,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            {stockName}
          </div>
          {(scene.mainBusiness || scene.stockData?.sector) && (
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 32,
                color: COLORS.textSecondary,
                fontWeight: 500,
                letterSpacing: 0,
                marginTop: 0,
              }}
            >
              <span style={{ color: COLORS.textMuted, fontWeight: 600 }}>주요사업: </span>
              {scene.mainBusiness ?? scene.stockData?.sector ?? ""}
            </div>
          )}
        </div>

        {/* Center section: HUGE animated change percentage */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: 0,
          }}
        >
          <AnimatedNumber
            value={Math.abs(changePercent)}
            prefix={isUp ? "+" : "-"}
            suffix="%"
            color={isUp ? COLORS.accent : COLORS.green}
            fontSize={FONT_SIZES.stockChange}
          />
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 32,
              color: COLORS.textSecondary,
              fontWeight: 600,
              marginTop: 12,
              letterSpacing: 1,
            }}
          >
            {isUp ? "▲ 상승" : "▼ 하락"}
          </div>
        </div>

        {/* Bottom section: reason / 이유 */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZES.sceneSubtitle,
            color: COLORS.text,
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.3,
            letterSpacing: -0.5,
            opacity: 0.95,
          }}
        >
          {reason}
        </div>
      </div>
    </AbsoluteFill>
  );
};
