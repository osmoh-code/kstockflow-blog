import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const TestComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const opacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0A0E1A 0%, #1a1f3a 50%, #FFD700 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 900,
            color: "#FFFFFF",
            fontFamily: "'Noto Sans KR', sans-serif",
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
            letterSpacing: -2,
          }}
        >
          K주식핫이슈
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 64,
            fontWeight: 700,
            color: "#FFD700",
            fontFamily: "'Noto Sans KR', sans-serif",
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}
        >
          Shorts Pipeline
        </div>
        <div
          style={{
            marginTop: 80,
            fontSize: 48,
            color: "rgba(255,255,255,0.8)",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          Phase 0 Smoke Test
        </div>
      </div>
    </AbsoluteFill>
  );
};
