export const SITE_NAME = "K-주식 핫이슈";
export const SITE_URL = "https://kstockflow.com";
export const SITE_DESCRIPTION =
  "한국 주식 시장의 특징주, 핫이슈, 신규주 분석, 재료와 테마 뉴스를 한눈에. 재료 기반의 깊이 있는 시장 인사이트를 제공합니다.";
export const AUTHOR_NAME = "K-주식 핫이슈 편집팀";
export const DEFAULT_OG_IMAGE = "/images/og-default.png";

export const ADSENSE_CLIENT_ID = "ca-pub-XXXXXXXXXX";
export const GA_TRACKING_ID = "G-XXXXXXXXXX";

export interface Category {
  readonly name: string;
  readonly slug: string;
  readonly emoji: string;
  readonly color: string;
}

export const CATEGORIES: readonly Category[] = [
  {
    name: "주식특징주",
    slug: "featured-stocks",
    emoji: "📈",
    color: "#ef4444",
  },
  {
    name: "핫이슈",
    slug: "hot-issues",
    emoji: "🔥",
    color: "#f97316",
  },
  {
    name: "신규주 분석",
    slug: "new-stocks",
    emoji: "🆕",
    color: "#2563eb",
  },
  {
    name: "재료와 테마 뉴스",
    slug: "theme-news",
    emoji: "📰",
    color: "#10b981",
  },
] as const;

export const NAV_LINKS = [
  { label: "홈", href: "/" },
  { label: "주식특징주", href: "/category/featured-stocks" },
  { label: "핫이슈", href: "/category/hot-issues" },
  { label: "신규주 분석", href: "/category/new-stocks" },
  { label: "재료와 테마 뉴스", href: "/category/theme-news" },
] as const;
