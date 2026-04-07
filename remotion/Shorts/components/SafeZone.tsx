import React from "react";
import { AbsoluteFill } from "remotion";
import { SAFE_ZONE, SAFE_ZONE_CENTER } from "../theme";

/**
 * Development overlay showing the YouTube safe zone.
 * Render only when SHORTS_SAFE_ZONE_DEBUG=1 env var is set.
 */
export const SafeZoneDebug: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {/* Top bar (UI/title overlap) */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: SAFE_ZONE.top,
        background: "rgba(255, 0, 0, 0.15)",
        borderBottom: "2px dashed red",
      }}
    />
    {/* Bottom bar (description/likes/comments overlap) */}
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: "100%",
        height: SAFE_ZONE.bottom,
        background: "rgba(255, 0, 0, 0.15)",
        borderTop: "2px dashed red",
      }}
    />
    {/* Right bar (interaction icons) */}
    <div
      style={{
        position: "absolute",
        top: SAFE_ZONE.top,
        right: 0,
        width: SAFE_ZONE.right,
        height: SAFE_ZONE_CENTER.height,
        background: "rgba(255, 0, 0, 0.15)",
        borderLeft: "2px dashed red",
      }}
    />
    {/* Left bar (channel info) */}
    <div
      style={{
        position: "absolute",
        top: SAFE_ZONE.top,
        left: 0,
        width: SAFE_ZONE.left,
        height: SAFE_ZONE_CENTER.height,
        background: "rgba(255, 0, 0, 0.15)",
        borderRight: "2px dashed red",
      }}
    />
    {/* Center safe zone outline */}
    <div
      style={{
        position: "absolute",
        top: SAFE_ZONE_CENTER.y,
        left: SAFE_ZONE_CENTER.x,
        width: SAFE_ZONE_CENTER.width,
        height: SAFE_ZONE_CENTER.height,
        border: "2px dashed lime",
      }}
    />
  </AbsoluteFill>
);
