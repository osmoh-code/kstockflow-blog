import React from "react";
import { COLORS, FONT_SIZES, FONTS, SHADOWS } from "../theme";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  readonly stockName: string;
  readonly changePercent: number;
  readonly tradeAmount?: string;
  readonly sector?: string;
}

/**
 * Big stock card: 종목명 + 등락률 + 부가 정보.
 * Used in HookScene and StockCardScene.
 */
export const StockTicker: React.FC<Props> = ({ stockName, changePercent, tradeAmount, sector }) => {
  const isUp = changePercent >= 0;
  const color = isUp ? COLORS.accent : COLORS.greenDark;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      {sector && (
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 38,
            color: COLORS.textMuted,
            fontWeight: 600,
            letterSpacing: 2,
          }}
        >
          # {sector}
        </div>
      )}
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: FONT_SIZES.stockName,
          fontWeight: 900,
          color: COLORS.text,
          textShadow: SHADOWS.textHero,
          letterSpacing: -2,
        }}
      >
        {stockName}
      </div>
      <AnimatedNumber value={Math.abs(changePercent)} prefix={isUp ? "+" : "-"} suffix="%" color={color} />
      {tradeAmount && (
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 36,
            color: COLORS.textMuted,
            marginTop: 8,
          }}
        >
          거래대금 {tradeAmount}
        </div>
      )}
    </div>
  );
};
