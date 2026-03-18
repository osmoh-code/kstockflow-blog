import Link from "next/link";
import { TrendingUp, Github, Twitter, Mail } from "lucide-react";
import { SITE_NAME, CATEGORIES } from "@/lib/constants";

const LEGAL_LINKS = [
  { label: "소개", href: "/about" },
  { label: "개인정보처리방침", href: "/privacy" },
  { label: "면책조항", href: "/disclaimer" },
  { label: "문의", href: "/contact" },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-800 bg-[#1E293B] text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Site Info */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
                <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold text-white">{SITE_NAME}</span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-400">
              데이터 기반의 깊이 있는 한국 주식 시장 분석과 투자 인사이트를
              제공합니다. 매일 업데이트되는 시장 동향을 확인하세요.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              카테고리
            </h3>
            <ul className="space-y-2">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="text-sm text-gray-400 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              법적 고지
            </h3>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              소셜 미디어
            </h3>
            <div className="flex gap-3">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700 text-gray-400 transition-colors duration-150 hover:bg-gray-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700 text-gray-400 transition-colors duration-150 hover:bg-gray-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="mailto:contact@kstockflow.com"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700 text-gray-400 transition-colors duration-150 hover:bg-gray-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                aria-label="이메일"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 border-t border-gray-700 pt-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-gray-400">
              &copy; {currentYear} {SITE_NAME}. All rights reserved.
            </p>
            <p className="max-w-2xl text-xs leading-relaxed text-gray-500">
              투자 면책: 본 사이트의 모든 콘텐츠는 정보 제공 목적이며, 투자
              권유나 자문이 아닙니다. 투자 결정은 본인의 판단과 책임 하에
              이루어져야 합니다.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
