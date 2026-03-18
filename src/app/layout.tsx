import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import {
  SITE_NAME,
  SITE_URL,
  SITE_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  ADSENSE_CLIENT_ID,
  GA_TRACKING_ID,
} from "@/lib/constants";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - 주식 시장 분석`,
    template: `%s | ${SITE_NAME} - 주식 시장 분석`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "한국 주식",
    "주식 분석",
    "주식 시장",
    "투자 전략",
    "경제 뉴스",
    "특징주",
    "시장 분석",
    "주식 투자",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - 한국 주식 시장 분석`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - 한국 주식 시장 분석`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - 한국 주식 시장 분석`,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  alternates: {
    canonical: SITE_URL,
    types: {
      "application/rss+xml": `${SITE_URL}/feed.xml`,
    },
  },
  verification: {
    google: "GOOGLE_SITE_VERIFICATION_CODE",
    other: {
      "naver-site-verification": "NAVER_SITE_VERIFICATION_CODE",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} ${plusJakarta.variable}`}>
      <head>
        {/* Google AdSense */}
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_TRACKING_ID}');
          `}
        </Script>
      </head>
      <body className={`${inter.className} flex min-h-screen flex-col bg-white`}>
        <a href="#main-content" className="skip-to-content">
          본문으로 건너뛰기
        </a>
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <CookieConsent />
      </body>
    </html>
  );
}
