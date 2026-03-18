"use client";

import { useEffect, useRef } from "react";

type AdFormat = "auto" | "rectangle" | "horizontal" | "vertical" | "article";

interface AdSenseProps {
  readonly slot: string;
  readonly format?: AdFormat;
  readonly className?: string;
}

const FORMAT_STYLES: Record<AdFormat, string> = {
  auto: "min-h-[100px]",
  rectangle: "min-h-[250px] max-w-[336px]",
  horizontal: "min-h-[90px] w-full",
  vertical: "min-h-[600px] max-w-[160px]",
  article: "min-h-[250px] w-full",
};

const FORMAT_TO_ADSENSE: Record<AdFormat, string> = {
  auto: "auto",
  rectangle: "rectangle",
  horizontal: "horizontal",
  vertical: "vertical",
  article: "fluid",
};

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export default function AdSense({
  slot,
  format = "auto",
  className = "",
}: AdSenseProps) {
  const adRef = useRef<HTMLModElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    if (isInitialized.current) {
      return;
    }

    try {
      const adsbygoogle = window.adsbygoogle ?? [];
      adsbygoogle.push({});
      window.adsbygoogle = adsbygoogle;
      isInitialized.current = true;
    } catch (error) {
      console.error("AdSense error:", error);
    }
  }, []);

  const clientId =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "ca-pub-XXXXXXXXXX";

  if (process.env.NODE_ENV !== "production") {
    return (
      <div
        className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-sm ${FORMAT_STYLES[format]} ${className}`}
      >
        <span>Ad Placeholder ({format})</span>
      </div>
    );
  }

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle block ${FORMAT_STYLES[format]} ${className}`}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format={FORMAT_TO_ADSENSE[format]}
      data-full-width-responsive={format === "auto" ? "true" : undefined}
    />
  );
}
