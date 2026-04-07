import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, FONTS, HEIGHT, LETTERBOX_HEIGHT, WIDTH } from "../theme";

interface Props {
  readonly headerTitle: string;
  readonly footerBrand: string;
  readonly footerHint?: string;
}

/**
 * Apple-style minimal letterbox.
 *  - Solid black bars
 *  - Clean typography, generous spacing
 *  - Subtle hairline accent borders (instead of heavy 4px lines)
 */
export const Letterbox: React.FC<Props> = ({ headerTitle, footerBrand, footerHint }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* ─── HEADER ─────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: WIDTH,
          height: LETTERBOX_HEIGHT,
          background: "#000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 18,
          padding: "0 60px 50px 60px",
          borderBottom: `1px solid ${COLORS.bgBorder}`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 30,
            color: COLORS.accentLight,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}>
          K STOCK · DAILY BRIEFING
        </div>
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 78,
            fontWeight: 900,
            color: COLORS.text,
            textAlign: "center",
            letterSpacing: -2,
            lineHeight: 1.05,
          }}
        >
          {headerTitle}
        </div>
      </div>

      {/* ─── FOOTER ─────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: WIDTH,
          height: LETTERBOX_HEIGHT,
          background: "#000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 22,
          padding: "50px 60px 0 60px",
          borderTop: `1px solid ${COLORS.bgBorder}`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 92,
            fontWeight: 900,
            color: COLORS.text,
            letterSpacing: -2,
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {footerBrand}
        </div>
        {footerHint && (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 36,
              color: COLORS.textSecondary,
              letterSpacing: 0.5,
              fontWeight: 500,
            }}
          >
            👆 {footerHint}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
