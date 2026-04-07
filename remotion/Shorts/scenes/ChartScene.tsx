import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderScene } from "../../../scripts/shorts/types";
import { COLORS, FONTS, FONT_SIZES, RADIUS, SAFE_ZONE_CENTER, SHADOWS } from "../theme";
import { AnimatedNumber } from "../components/AnimatedNumber";

interface Props {
  readonly scene: RenderScene;
}

const CHART_WIDTH = 740;
const CHART_HEIGHT = 220;
const CHART_PADDING = 12;

/**
 * Apple-style stock card with embedded daily chart.
 * Replaces StockCardScene for body scenes when priceHistory is available.
 */
export const ChartScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.7 },
    durationInFrames: 14,
  });
  const slideY = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  // Chart line draw animation (clip-path reveal)
  const drawProgress = interpolate(frame, [10, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const stockName = scene.stockData?.name ?? scene.onScreenText;
  const changePercent = scene.stockData?.changePercent ?? 0;
  const isUp = changePercent >= 0;
  const lineColor = isUp ? COLORS.accent : COLORS.green;
  // MDX 테이블 "상승이유" 컬럼이 있으면 그것을, 없으면 짧은 onScreenText로 fallback
  const reason = scene.reason ?? scene.onScreenText;

  // Build candles from priceHistory
  const points = scene.priceHistory ?? [];
  const candles = buildCandles(points, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING);

  return (
    <AbsoluteFill>
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
          padding: "44px 50px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          transform: `translateY(${slideY}px)`,
          opacity,
        }}
      >
        {/* Top: pill chip + stock name */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          <div
            style={{
              display: "inline-block",
              padding: "10px 22px",
              background: "rgba(220, 38, 38, 0.15)",
              border: `1px solid ${COLORS.accent}`,
              borderRadius: RADIUS.pill,
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.accentLight,
              fontFamily: FONTS.body,
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
                fontSize: 30,
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

        {/* Center: HUGE change percentage */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: -8,
            marginBottom: -8,
          }}
        >
          <AnimatedNumber
            value={Math.abs(changePercent)}
            prefix={isUp ? "+" : "-"}
            suffix="%"
            color={lineColor}
            fontSize={120}
          />
        </div>

        {/* Candlestick chart with label */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 4,
            gap: 8,
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              fontFamily: FONTS.body,
              fontSize: 24,
              fontWeight: 600,
              color: COLORS.textMuted,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            📊 20영업일 일봉
          </div>
          <svg
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            style={{ overflow: "visible" }}
          >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((y) => (
              <line
                key={y}
                x1={CHART_PADDING}
                x2={CHART_WIDTH - CHART_PADDING}
                y1={CHART_PADDING + (CHART_HEIGHT - CHART_PADDING * 2) * y}
                y2={CHART_PADDING + (CHART_HEIGHT - CHART_PADDING * 2) * y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            ))}
            <defs>
              <clipPath id="revealClip">
                <rect x={0} y={0} width={CHART_WIDTH * drawProgress} height={CHART_HEIGHT} />
              </clipPath>
            </defs>
            <g clipPath="url(#revealClip)">
              {candles.map((c, i) => (
                <g key={i}>
                  {/* Wick (high-low line) */}
                  <line
                    x1={c.x}
                    x2={c.x}
                    y1={c.yHigh}
                    y2={c.yLow}
                    stroke={c.color}
                    strokeWidth={2}
                  />
                  {/* Body (open-close rect) */}
                  <rect
                    x={c.x - c.bodyWidth / 2}
                    y={c.bodyTop}
                    width={c.bodyWidth}
                    height={Math.max(2, c.bodyHeight)}
                    fill={c.color}
                  />
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Bottom: reason */}
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

interface Candle {
  readonly x: number;
  readonly yHigh: number;
  readonly yLow: number;
  readonly bodyTop: number;
  readonly bodyHeight: number;
  readonly bodyWidth: number;
  readonly color: string;
  readonly isUp: boolean;
}

// Korean stock market convention: 양봉 = 빨강, 음봉 = 파랑
const COLOR_UP = "#DC2626"; // 양봉 (close >= open)
const COLOR_DOWN = "#3B82F6"; // 음봉 (close < open)

function buildCandles(
  points: ReadonlyArray<{
    readonly date: string;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
  }>,
  width: number,
  height: number,
  padding: number,
): Candle[] {
  if (points.length < 1) return [];

  const highs = points.map((p) => p.high);
  const lows = points.map((p) => p.low);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const xStep = innerW / points.length;
  const bodyWidth = Math.max(4, xStep * 0.7);

  const yMap = (price: number) => padding + (1 - (price - min) / range) * innerH;

  return points.map((p, i) => {
    const x = padding + i * xStep + xStep / 2;
    const yHigh = yMap(p.high);
    const yLow = yMap(p.low);
    const yOpen = yMap(p.open);
    const yClose = yMap(p.close);
    const bodyTop = Math.min(yOpen, yClose);
    const bodyBottom = Math.max(yOpen, yClose);
    const isUp = p.close >= p.open;
    return {
      x,
      yHigh,
      yLow,
      bodyTop,
      bodyHeight: bodyBottom - bodyTop,
      bodyWidth,
      color: isUp ? COLOR_UP : COLOR_DOWN,
      isUp,
    };
  });
}
