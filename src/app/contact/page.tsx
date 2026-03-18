import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "문의하기",
  description: `${SITE_NAME}에 대한 문의, 제안, 피드백을 보내주세요. 빠른 시일 내에 답변드리겠습니다.`,
  openGraph: {
    title: `문의하기 | ${SITE_NAME}`,
    description: `${SITE_NAME}에 대한 문의, 제안, 피드백을 보내주세요.`,
    url: `${SITE_URL}/contact`,
    type: "website",
  },
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
};

const FAQ_ITEMS = [
  {
    question: "KStockFlow는 어떤 블로그인가요?",
    answer:
      "KStockFlow는 한국 주식 시장에 대한 객관적이고 신뢰할 수 있는 분석을 제공하는 블로그입니다. 주식특징주, 시장분석, 투자전략, 경제뉴스 등을 다루고 있습니다.",
  },
  {
    question: "콘텐츠 업데이트 주기는 어떻게 되나요?",
    answer:
      "시장 상황에 따라 매일 새로운 분석 콘텐츠를 제공하고 있으며, 주요 시장 이벤트 발생 시 신속하게 관련 분석을 업데이트합니다.",
  },
  {
    question: "투자 종목을 추천해 주시나요?",
    answer:
      "아닙니다. KStockFlow는 특정 종목의 매수나 매도를 추천하지 않습니다. 객관적인 시장 분석과 정보를 제공할 뿐이며, 투자 결정은 투자자 본인의 판단에 따라 이루어져야 합니다.",
  },
  {
    question: "RSS 피드를 지원하나요?",
    answer:
      "네, RSS 피드를 지원합니다. 브라우저의 RSS 리더 또는 Feedly 같은 도구에서 구독하실 수 있습니다.",
  },
  {
    question: "콘텐츠를 외부에서 인용해도 되나요?",
    answer:
      "출처(KStockFlow, kstockflow.com)를 명시하고, 원문 링크를 포함하는 경우에 한하여 부분 인용이 가능합니다. 전체 복제 및 무단 전재는 금지됩니다.",
  },
] as const;

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-gradient-to-br from-brand-dark to-gray-800 text-white py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
            문의하기
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            KStockFlow에 대한 문의, 제안, 피드백을 보내주세요.
            <br />
            빠른 시일 내에 답변드리겠습니다.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-brand-dark mb-6">
              메시지 보내기
            </h2>
            <form className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    placeholder="홍길동"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-colors text-gray-900 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="example@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-colors text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  required
                  placeholder="문의 제목을 입력해 주세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-colors text-gray-900 placeholder-gray-400"
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  placeholder="문의 내용을 상세하게 입력해 주세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-colors text-gray-900 placeholder-gray-400 resize-vertical"
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-accent-hover transition-colors focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 outline-none"
              >
                보내기
              </button>
            </form>
          </div>

          {/* Contact Info Sidebar */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-brand-dark mb-6">
                연락처 정보
              </h2>
              <div className="space-y-5">
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-brand-accent"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-brand-dark">이메일</p>
                    <a
                      href="mailto:contact@kstockflow.com"
                      className="text-brand-accent hover:underline text-sm"
                    >
                      contact@kstockflow.com
                    </a>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-brand-accent"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-brand-dark">응답 시간</p>
                    <p className="text-sm text-brand-muted">
                      영업일 기준 1~2일 이내
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media */}
            <div>
              <h3 className="text-lg font-bold text-brand-dark mb-4">
                소셜 미디어
              </h3>
              <div className="space-y-3">
                <a
                  href="#"
                  className="flex items-center gap-3 text-gray-600 hover:text-brand-accent transition-colors group"
                >
                  <div className="w-10 h-10 bg-gray-100 group-hover:bg-blue-100 rounded-lg flex items-center justify-center transition-colors">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <span className="text-sm">X (Twitter)</span>
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 text-gray-600 hover:text-brand-accent transition-colors group"
                >
                  <div className="w-10 h-10 bg-gray-100 group-hover:bg-blue-100 rounded-lg flex items-center justify-center transition-colors">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </div>
                  <span className="text-sm">LinkedIn</span>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <h3 className="text-lg font-bold text-brand-dark mb-3">
                바로가기
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/about"
                    className="text-brand-accent hover:underline"
                  >
                    KStockFlow 소개
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-brand-accent hover:underline"
                  >
                    개인정보처리방침
                  </Link>
                </li>
                <li>
                  <Link
                    href="/disclaimer"
                    className="text-brand-accent hover:underline"
                  >
                    투자 면책 고지
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <section className="mt-16 border-t border-gray-200 pt-12">
          <h2 className="text-2xl font-bold text-brand-dark mb-8 text-center">
            자주 묻는 질문 (FAQ)
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group border border-gray-200 rounded-lg overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors font-medium text-brand-dark">
                  {item.question}
                  <svg
                    className="w-5 h-5 text-brand-muted group-open:rotate-180 transition-transform flex-shrink-0 ml-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="px-6 py-4 text-gray-700 leading-relaxed">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
