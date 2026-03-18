"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "kstockflow-cookie-consent";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg"
      role="dialog"
      aria-label="쿠키 동의"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-700 leading-relaxed">
              본 웹사이트는 사용자 경험 향상, 웹사이트 분석(Google Analytics),
              맞춤형 광고 제공(Google AdSense)을 위해 쿠키를 사용합니다. 사이트를
              계속 이용하시면 쿠키 사용에 동의하는 것으로 간주됩니다.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/privacy#cookies"
              className="text-sm text-brand-accent hover:text-brand-accent-hover hover:underline whitespace-nowrap"
            >
              자세히 보기
            </Link>
            <button
              type="button"
              onClick={handleAccept}
              className="px-6 py-2 bg-brand-accent text-white text-sm font-semibold rounded-lg hover:bg-brand-accent-hover transition-colors focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 outline-none whitespace-nowrap"
            >
              동의
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
