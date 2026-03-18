"use client";

import AdSense from "./AdSense";

type PlacementType =
  | "header-below"
  | "sidebar-top"
  | "sidebar-sticky"
  | "in-article"
  | "post-bottom"
  | "between-cards";

interface AdPlacementProps {
  readonly type: PlacementType;
  readonly className?: string;
}

interface PlacementConfig {
  readonly slot: string;
  readonly format: "auto" | "rectangle" | "horizontal" | "vertical" | "article";
  readonly label: string;
  readonly wrapperClass: string;
}

const PLACEMENT_CONFIGS: Record<PlacementType, PlacementConfig> = {
  "header-below": {
    slot: "HEADER_BELOW_SLOT",
    format: "horizontal",
    label: "광고",
    wrapperClass: "w-full max-w-4xl mx-auto py-3",
  },
  "sidebar-top": {
    slot: "SIDEBAR_TOP_SLOT",
    format: "rectangle",
    label: "광고",
    wrapperClass: "w-full",
  },
  "sidebar-sticky": {
    slot: "SIDEBAR_STICKY_SLOT",
    format: "vertical",
    label: "광고",
    wrapperClass: "sticky top-4",
  },
  "in-article": {
    slot: "IN_ARTICLE_SLOT",
    format: "article",
    label: "광고",
    wrapperClass: "my-8 w-full",
  },
  "post-bottom": {
    slot: "POST_BOTTOM_SLOT",
    format: "horizontal",
    label: "광고",
    wrapperClass: "w-full mt-8 pt-6 border-t border-gray-200",
  },
  "between-cards": {
    slot: "BETWEEN_CARDS_SLOT",
    format: "auto",
    label: "광고",
    wrapperClass: "w-full py-4",
  },
};

export default function AdPlacement({ type, className = "" }: AdPlacementProps) {
  const config = PLACEMENT_CONFIGS[type];

  return (
    <aside
      className={`${config.wrapperClass} ${className}`}
      aria-label="광고 영역"
    >
      <p className="text-xs text-gray-400 mb-1 text-center">{config.label}</p>
      <AdSense slot={config.slot} format={config.format} />
    </aside>
  );
}
