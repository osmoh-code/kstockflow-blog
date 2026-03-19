import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "소개",
  description:
    "K-주식 핫이슈는 개인 투자자를 위한 재료 기반 한국 주식 시장 분석 블로그입니다. 주식특징주, 핫이슈, 신규 상장주, 재료와 테마 뉴스를 제공합니다.",
  openGraph: {
    title: `소개 | ${SITE_NAME}`,
    description:
      "K-주식 핫이슈는 개인 투자자를 위한 재료 기반 한국 주식 시장 분석 블로그입니다.",
    url: `${SITE_URL}/about`,
    type: "website",
  },
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-red-600 to-red-800 text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
            {SITE_NAME} 소개
          </h1>
          <p className="text-lg md:text-xl text-red-100 max-w-2xl mx-auto leading-relaxed">
            개인 투자자를 위한 재료 기반
            <br className="hidden md:block" />
            한국 주식 시장 분석 플랫폼
          </p>
        </div>
      </section>

      {/* Main Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="prose prose-lg max-w-none">
          {/* Mission */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-brand-dark border-b-2 border-red-500 pb-3 mb-6">
              K-주식 핫이슈의 미션
            </h2>
            <p>
              K-주식 핫이슈는 복잡하고 빠르게 변화하는 한국 주식 시장에서 개인
              투자자들이 더 나은 투자 결정을 내릴 수 있도록 돕기 위해
              탄생했습니다. 기관 투자자와 달리, 개인 투자자는 종목에 영향을 미치는
              핵심 재료와 테마 정보에 대한 접근성이 제한적인 경우가 많습니다.
            </p>
            <p>
              저희는 이러한 정보 비대칭을 해소하고, 모든 투자자가 공정하게 시장의
              재료와 테마를 파악할 수 있는 환경을 만들고자 합니다. 재료에 기반한
              객관적인 분석을 통해, 감정적 투자 결정이 아닌 합리적인 판단을
              지원하는 것이 K-주식 핫이슈의 핵심 미션입니다.
            </p>
            <p>
              주식 시장은 수많은 재료가 복합적으로 작용하는 시스템입니다.
              단순한 차트 분석이나 루머에 의존하는 것이 아니라, 기업의 실적 발표,
              정책 변화, 산업 트렌드, 신규 상장 등 종목에 직접 영향을 미치는
              핵심 재료를 빠르게 파악하고 분석하여 전달합니다. 이를 통해
              투자자분들이 시장의 본질적인 흐름을 이해하고, 단기적 변동에
              흔들리지 않는 투자 판단을 내릴 수 있도록 돕겠습니다.
            </p>
          </section>

          {/* What We Cover */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-brand-dark border-b-2 border-red-500 pb-3 mb-6">
              다루는 콘텐츠
            </h2>
            <p>
              K-주식 핫이슈는 한국 주식 시장과 관련된 핵심 주제를 심층적으로
              다룹니다. 매일 변화하는 시장 상황에 맞춰, 투자자분들이 가장
              필요로 하는 재료와 테마 정보를 시의적절하게 전달합니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8 not-prose">
              <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                <h3 className="text-lg font-bold text-red-700 mb-3">
                  주식특징주
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  당일 급등/급락 종목의 원인을 심층 분석합니다. 단순한 가격
                  변동을 넘어, 해당 종목이 움직인 근본적인 재료를 기업 실적,
                  산업 변화, 정책 변화, 수급 동향 등 다각도에서 파악하여
                  전달합니다. 테마주의 형성 배경과 지속 가능성에 대한 냉철한
                  분석도 함께 제공합니다.
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6">
                <h3 className="text-lg font-bold text-orange-700 mb-3">
                  핫이슈
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  시장을 움직이는 핫이슈를 빠르게 전달합니다. 정부 정책 발표,
                  글로벌 이벤트, 산업 트렌드 변화 등 주가에 즉각적인 영향을
                  미치는 이슈를 선별하고, 관련 수혜주와 리스크를 함께
                  분석합니다.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                <h3 className="text-lg font-bold text-blue-700 mb-3">
                  신규 상장주
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  신규 상장 종목(IPO)과 공모주를 분석합니다. 공모가 대비 적정
                  가치 평가, 사업 모델의 성장 가능성, 경쟁사 대비 포지셔닝,
                  상장 후 주가 흐름 전망 등을 종합적으로 살펴봅니다. 청약
                  전략과 상장일 대응 방법도 함께 안내합니다.
                </p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-6">
                <h3 className="text-lg font-bold text-green-700 mb-3">
                  재료와 테마 뉴스
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  주식 시장의 핵심 재료와 테마를 빠르게 분석합니다. 정부 정책,
                  기술 혁신, 계절적 테마, 글로벌 이벤트 등 종목에 직접 영향을
                  미치는 재료를 선별하고, 관련 종목군과 투자 포인트를
                  정리하여 전달합니다.
                </p>
              </div>
            </div>
          </section>

          {/* Author Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-brand-dark border-b-2 border-red-500 pb-3 mb-6">
              편집팀 소개
            </h2>
            <div className="bg-gray-50 rounded-xl p-6 md:p-8 border border-gray-100">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-2xl font-bold">K</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-dark mb-2">
                    K-주식 핫이슈 편집팀
                  </h3>
                  <p className="text-brand-muted mb-4">
                    재료 기반 주식 분석 전문 콘텐츠 팀
                  </p>
                  <p>
                    K-주식 핫이슈 편집팀은 금융, 경제, 산업 분석에 대한 깊은
                    이해를 바탕으로 콘텐츠를 제작합니다. 종목에 영향을 미치는
                    핵심 재료를 빠르게 파악하고, 누구나 이해할 수 있도록
                    명확하게 전달하는 것을 목표로 합니다.
                  </p>
                  <p>
                    팀원들은 금융공학, 경영학, 경제학 등 다양한 배경을 가지고
                    있으며, 지속적인 학습과 연구를 통해 변화하는 시장 환경에
                    발맞춰 나가고 있습니다. 재료 기반의 정량적 분석과 산업
                    전문가의 정성적 인사이트를 결합하여, 깊이 있으면서도 실용적인
                    콘텐츠를 제공하기 위해 노력합니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Values */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-brand-dark border-b-2 border-red-500 pb-3 mb-6">
              핵심 가치
            </h2>
            <p>
              K-주식 핫이슈는 세 가지 핵심 가치를 바탕으로 모든 콘텐츠를 제작하고
              운영합니다. 이 가치는 저희가 추구하는 방향이자, 독자분들과의
              약속입니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8 not-prose">
              <div className="text-center p-6 rounded-xl border border-gray-200 hover:border-red-400 hover:shadow-md transition-all">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-brand-dark mb-3">
                  신속성
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  시장에 영향을 미치는 재료와 뉴스를 가장 빠르게 분석하여
                  전달합니다. 장 시작 전 핵심 이슈를 정리하고, 장중 긴급
                  재료 발생 시 실시간으로 업데이트합니다. 투자자가 타이밍을
                  놓치지 않도록 돕습니다.
                </p>
              </div>
              <div className="text-center p-6 rounded-xl border border-gray-200 hover:border-red-400 hover:shadow-md transition-all">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-brand-dark mb-3">
                  객관성
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  특정 종목이나 투자 방법에 편향되지 않은 균형 잡힌 시각을
                  유지합니다. 긍정적 전망과 부정적 리스크를 모두 공정하게
                  다루며, 다양한 관점을 제시하여 투자자가 스스로 판단할 수
                  있도록 합니다.
                </p>
              </div>
              <div className="text-center p-6 rounded-xl border border-gray-200 hover:border-red-400 hover:shadow-md transition-all">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-brand-dark mb-3">
                  접근성
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  전문적인 금융 용어와 복잡한 재료 분석을 투자 초보자도
                  이해할 수 있도록 쉽게 풀어 설명합니다. 어려운 개념은 예시와
                  비유를 통해 설명하며, 시각적 자료를 활용하여 직관적인 이해를
                  돕습니다.
                </p>
              </div>
            </div>
          </section>

          {/* How We Work */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-brand-dark border-b-2 border-red-500 pb-3 mb-6">
              콘텐츠 제작 과정
            </h2>
            <p>
              K-주식 핫이슈의 모든 콘텐츠는 체계적인 제작 과정을 거칩니다. 신뢰할
              수 있는 재료 분석을 전달하기 위해, 다음과 같은 절차를 따릅니다.
            </p>
            <ol className="space-y-4 my-6">
              <li className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </span>
                <div>
                  <strong className="text-brand-dark">재료 수집:</strong>{" "}
                  공식 출처(KRX, DART, ECOS, 뉴스, 공시 등)에서 종목에 영향을
                  미치는 최신 재료를 수집합니다. 루머가 아닌 팩트 기반의
                  재료만 선별합니다.
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </span>
                <div>
                  <strong className="text-brand-dark">영향도 분석:</strong>{" "}
                  수집된 재료가 관련 종목과 테마에 미치는 영향을 정량적,
                  정성적으로 분석합니다. 과거 유사 재료의 시장 반응도
                  참고합니다.
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  3
                </span>
                <div>
                  <strong className="text-brand-dark">콘텐츠 작성:</strong>{" "}
                  분석 결과를 투자자가 바로 활용할 수 있는 형태로 가공합니다.
                  핵심 재료, 관련 종목, 투자 포인트, 리스크를 명확하게
                  전달합니다.
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  4
                </span>
                <div>
                  <strong className="text-brand-dark">검증 및 발행:</strong>{" "}
                  팩트체크, 논리적 일관성 확인을 거쳐 최종 발행합니다.
                  정보의 정확성과 콘텐츠의 품질을 보증합니다.
                </div>
              </li>
            </ol>
          </section>

          {/* Disclaimer */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-brand-dark border-b-2 border-red-500 pb-3 mb-6">
              면책 공지
            </h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <p className="text-amber-900 leading-relaxed mb-4">
                <strong>중요 안내:</strong> K-주식 핫이슈에서 제공하는 모든
                콘텐츠는 정보 제공 목적으로만 작성되며, 어떠한 경우에도 특정
                종목에 대한 매수, 매도, 보유를 권유하거나 추천하지 않습니다.
              </p>
              <p className="text-amber-900 leading-relaxed mb-4">
                주식 투자는 원금 손실의 위험이 있으며, 모든 투자의 최종 결정과
                책임은 투자자 본인에게 있습니다. 본 블로그의 분석과 의견은
                작성자의 개인적인 견해이며, 시장 상황에 따라 달라질 수 있습니다.
              </p>
              <p className="text-amber-900 leading-relaxed">
                투자에 앞서 반드시 다양한 정보를 참고하시고, 필요한 경우 공인된
                금융 전문가의 조언을 구하시기 바랍니다. 자세한 면책 사항은{" "}
                <Link
                  href="/disclaimer"
                  className="text-red-600 underline font-medium"
                >
                  투자 면책 고지
                </Link>{" "}
                페이지를 참고해 주세요.
              </p>
            </div>
          </section>

          {/* Contact CTA */}
          <section className="text-center py-8 border-t border-gray-200">
            <p className="text-lg text-gray-600 mb-4">
              K-주식 핫이슈에 대해 궁금한 점이 있으시거나, 제안사항이 있으신가요?
            </p>
            <Link
              href="/contact"
              className="inline-block bg-red-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors"
            >
              문의하기
            </Link>
          </section>
        </div>
      </article>
    </div>
  );
}
