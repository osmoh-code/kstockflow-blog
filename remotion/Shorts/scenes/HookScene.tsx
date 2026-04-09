import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderScene } from "../../../scripts/shorts/types";
import { COLORS, FONT_SIZES, FONTS, RADIUS, SAFE_ZONE_CENTER, SHADOWS } from "../theme";

interface Props {
  readonly scene: RenderScene;
}

/**
 * Apple-style minimal hook.
 * Big bold heading on a clean dark background — no flashy glows.
 */
export const HookScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ⚠️ NO opacity fade-in: frame 0 must show the title at full opacity so
  // YouTube Shorts mobile feed picks it as the auto-thumbnail. Mobile Shorts
  // ignores the API custom thumbnail (thumbnails.set) and uses the video's
  // very first visible frame instead. The slide animation is kept (slideY
  // 50→0) for a subtle entrance, but opacity stays at 1 throughout.
  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 100 },
    durationInFrames: 18,
  });
  const slideY = interpolate(enter, [0, 1], [20, 0]); // smaller offset since no fade
  const opacity = 1;

  // Category branch is explicit via scene.category (set in assets.ts).
  // Both featured-stocks AND hot-issues now use multi-line onScreenText, so
  // we cannot infer category from "\n" presence anymore.
  const narration = scene.narration ?? "";
  const onScreen = scene.onScreenText ?? "";
  const isHotIssues = scene.category === "hot-issues";

  if (!isHotIssues) {
    // ─── Featured-stocks layout: short impact text only ────────────
    return (
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: SAFE_ZONE_CENTER.x,
            top: SAFE_ZONE_CENTER.y + SAFE_ZONE_CENTER.height * 0.28,
            width: SAFE_ZONE_CENTER.width,
            textAlign: "center",
            opacity,
            transform: `translateY(${slideY * 0.5}px)`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "14px 32px",
              background: "rgba(220, 38, 38, 0.15)",
              border: `1px solid ${COLORS.accent}`,
              borderRadius: RADIUS.pill,
              fontSize: 34,
              fontWeight: 700,
              color: COLORS.accentLight,
              fontFamily: FONTS.body,
              letterSpacing: 0.5,
            }}
          >
            🔥 TODAY'S TOP MOVERS
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: SAFE_ZONE_CENTER.x,
            top: SAFE_ZONE_CENTER.y + SAFE_ZONE_CENTER.height * 0.40,
            width: SAFE_ZONE_CENTER.width,
            textAlign: "center",
            opacity,
            transform: `translateY(${slideY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: FONT_SIZES.hookHero,
              fontWeight: 900,
              color: COLORS.text,
              textShadow: SHADOWS.textHero,
              letterSpacing: -3.5,
              lineHeight: 1.1,
              whiteSpace: "pre-line", // honor "\n" for "4월 8일\n오늘의 주도주?"
              wordBreak: "keep-all",
            }}
          >
            {onScreen}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // ─── Hot-issues layout: title (intro) + narration (detail) ────
  // Title is the 2-line "중동전쟁 종전 기대감 / 건설주 TOP 7"
  // Narration is the cleaned 핵심 요약 first sentence
  const titleLines = onScreen.split("\n").length;
  // Auto-fit title font size to the longest line so titles like
  // "스테이블코인 에이전틱 AI 이슈" (15자) don't wrap awkwardly inside the 960px
  // safe zone. Korean character width ≈ font size, so we cap at ~width/longest.
  const longestLineLength = Math.max(
    ...onScreen.split("\n").map((l) => l.length),
  );
  let titleFontSize: number;
  if (longestLineLength <= 8) {
    titleFontSize = titleLines >= 2 ? 88 : 100;
  } else if (longestLineLength <= 11) {
    titleFontSize = 80;
  } else if (longestLineLength <= 14) {
    titleFontSize = 66;
  } else {
    titleFontSize = 56;
  }
  const narrationFontSize = narration.length > 75 ? 40 : 46;

  return (
    <AbsoluteFill>
      {/* Eyebrow chip */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + 40,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity,
          transform: `translateY(${slideY * 0.5}px)`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: "rgba(220, 38, 38, 0.15)",
            border: `1px solid ${COLORS.accent}`,
            borderRadius: RADIUS.pill,
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.accentLight,
            fontFamily: FONTS.body,
            letterSpacing: 0.5,
          }}
        >
          📰 핵심 요약
        </div>
      </div>

      {/* Big title (intro card) */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + 130,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity,
          transform: `translateY(${slideY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: titleFontSize,
            fontWeight: 900,
            color: COLORS.text,
            textShadow: SHADOWS.textHero,
            letterSpacing: -2.5,
            lineHeight: 1.1,
            whiteSpace: "pre-line",
            wordBreak: "keep-all", // 한국어 단어 중간 끊김 방지 (이/슈 → 이슈)
          }}
        >
          {onScreen}
        </div>
      </div>

      {/* Narration / 핵심 요약 detail text below title */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE_CENTER.x,
          top: SAFE_ZONE_CENTER.y + SAFE_ZONE_CENTER.height * 0.62,
          width: SAFE_ZONE_CENTER.width,
          textAlign: "center",
          opacity,
          transform: `translateY(${slideY * 0.7}px)`,
          padding: "0 40px",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: narrationFontSize,
            fontWeight: 500,
            color: COLORS.textSecondary,
            lineHeight: 1.4,
            letterSpacing: -0.5,
          }}
        >
          {narration}
        </div>
      </div>
    </AbsoluteFill>
  );
};
