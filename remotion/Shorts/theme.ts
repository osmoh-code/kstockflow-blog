/**
 * Theme constants for the kstockflow YouTube Shorts.
 * Colors mirror the blog (tailwind.config.ts brand palette).
 */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

// True letterbox: 9:16 canvas with 1:1 (1080x1080) content area
// (1920 - 1080) / 2 = 420px black bars on top + bottom
export const LETTERBOX_HEIGHT = 420;
export const CONTENT_AREA = {
  top: LETTERBOX_HEIGHT,                          // 420
  bottom: HEIGHT - LETTERBOX_HEIGHT,              // 1500
  height: HEIGHT - LETTERBOX_HEIGHT * 2,          // 1080 (square 1:1)
  width: WIDTH,                                    // 1080
} as const;

// Inside the 1080x1080 content area, leave 60px padding for safety
export const SAFE_ZONE = {
  top: CONTENT_AREA.top + 60,        // 480
  bottom: CONTENT_AREA.bottom - 60,  // 1440
  left: 60,
  right: 60,
} as const;

// Scene/subtitle/visual elements live inside this box (960x960 effective)
export const SAFE_ZONE_CENTER = {
  x: SAFE_ZONE.left,                                          // 60
  y: SAFE_ZONE.top,                                           // 480
  width: WIDTH - SAFE_ZONE.left - SAFE_ZONE.right,            // 960
  height: SAFE_ZONE.bottom - SAFE_ZONE.top,                   // 960
  centerX: (SAFE_ZONE.left + (WIDTH - SAFE_ZONE.right)) / 2,  // 540
  centerY: (SAFE_ZONE.top + SAFE_ZONE.bottom) / 2,            // 960
} as const;

/**
 * Apple/Scappa-inspired clean dark palette.
 * Minimal gradients, restrained accent, large rounded cards.
 */
export const COLORS = {
  // Background (almost pure black, very subtle warmth)
  bgDark: "#0A0A0B",         // Page background
  bgCard: "#16161A",         // Card surface (slightly lighter)
  bgCardElevated: "#1F1F24", // Elevated card / hover state
  bgBorder: "#2A2A30",       // Subtle border for cards
  // Text
  text: "#FFFFFF",
  textSecondary: "#A1A1A6",  // Apple-style muted gray
  textMuted: "#6E6E73",
  // Accent (kstockflow brand red)
  accent: "#DC2626",
  accentLight: "#F87171",
  accentDark: "#991B1B",
  accentGlow: "rgba(220, 38, 38, 0.35)",
  // Gold (CTA highlight)
  gold: "#FFD700",
  goldMuted: "#D4A82E",
  // Up/Down
  green: "#10B981",
  greenDark: "#047857",
  // Legacy aliases (don't break older components)
  bgMid: "#16161A",
  bgLight: "#1F1F24",
} as const;

export const FONTS = {
  heading: "'Noto Sans KR', 'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  body: "'Noto Sans KR', 'Pretendard', sans-serif",
  number: "'Inter', 'SF Pro Display', sans-serif",
} as const;

// Apple-style sizing — generous, restrained
export const FONT_SIZES = {
  hookHero: 130,        // Hook 큰 텍스트
  sceneTitle: 84,       // Scene 카드 메인 텍스트
  sceneSubtitle: 44,    // 부제 / 이유
  stockName: 84,        // 종목명
  stockChange: 168,     // 등락률 거대한 숫자 (Apple style hero number)
  ctaBrand: 92,         // K주식핫이슈
  ctaUrl: 38,           // kstockflow.com
  subtitle: 62,         // 자막
} as const;

export const SHADOWS = {
  textHero: "0 4px 24px rgba(0,0,0,0.5)",
  text: "0 2px 12px rgba(0,0,0,0.5)",
  card: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
  cardElevated: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
} as const;

// Apple-style large rounded corners
export const RADIUS = {
  card: 32,
  cardLarge: 44,
  pill: 999,
} as const;
