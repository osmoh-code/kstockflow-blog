import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "투자 면책 고지",
  description: `${SITE_NAME}의 투자 면책 고지입니다. 본 사이트의 모든 콘텐츠는 정보 제공 목적이며 투자 권유가 아닙니다.`,
  openGraph: {
    title: `투자 면책 고지 | ${SITE_NAME}`,
    description: `${SITE_NAME}의 투자 면책 고지입니다.`,
    url: `${SITE_URL}/disclaimer`,
    type: "website",
  },
  alternates: {
    canonical: `${SITE_URL}/disclaimer`,
  },
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-amber-50 border-b border-amber-200 py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-200 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-brand-dark">
              투자 면책 고지
            </h1>
          </div>
          <p className="text-amber-800 text-lg">
            본 페이지는 {SITE_NAME}의 콘텐츠 이용에 관한 중요한 법적 고지사항을
            포함하고 있습니다. 사이트 이용 전 반드시 읽어 주시기 바랍니다.
          </p>
          <p className="text-sm text-amber-700 mt-2">
            최종 수정일: 2026년 3월 18일
          </p>
        </div>
      </section>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="space-y-10">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-brand-dark mb-4 pb-2 border-b border-gray-200">
              1. 정보 제공 목적
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                {SITE_NAME}(이하 &quot;본 사이트&quot;)에 게시된 모든 콘텐츠는
                오직 <strong>정보 제공 및 교육 목적</strong>으로만 작성된
                것입니다. 본 사이트에서 제공하는 주식 시장 분석, 종목 분석,
                투자 전략, 경제 뉴스 등의 모든 콘텐츠는 특정 금융 상품이나
                종목에 대한 매수, 매도, 보유를 권유하거나 추천하는 것이
                아닙니다.
              </p>
              <p>
                본 사이트의 콘텐츠는 「자본시장과 금융투자업에 관한 법률」에
                의한 투자 자문 또는 투자 일임 서비스가 아니며, 본 사이트는 금융
                투자업 인가를 받은 기관이 아닙니다. 따라서 본 사이트의 콘텐츠를
                투자 자문으로 해석해서는 안 됩니다.
              </p>
              <p>
                본 사이트에 게시된 분석, 의견, 전망은 작성 시점의 정보에
                기반한 작성자의 개인적인 견해이며, 어떠한 경우에도 특정 투자
                행위를 유도하거나 보장하지 않습니다.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-brand-dark mb-4 pb-2 border-b border-gray-200">
              2. 투자 판단의 책임
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <p className="text-red-900 font-semibold text-lg mb-3">
                  모든 투자의 최종 결정과 그에 따른 손익의 책임은 전적으로
                  투자자 본인에게 있습니다.
                </p>
                <p className="text-red-800">
                  본 사이트는 이용자의 투자 결과에 대해 어떠한 법적 책임도
                  지지 않습니다.
                </p>
              </div>
              <p>
                투자자는 본 사이트의 정보를 참고하되, 투자 결정을 내리기 전
                반드시 자신의 재무 상황, 투자 목적, 위험 감수 능력 등을
                종합적으로 고려해야 합니다. 필요한 경우 공인된 금융 투자 전문가
                또는 투자 자문사의 조언을 구하시기 바랍니다.
              </p>
              <p>
                본 사이트에서 언급된 종목이나 전략을 따라 투자하여 발생하는
                어떠한 손실에 대해서도 본 사이트, 운영자, 작성자는 책임을 지지
                않습니다. 투자에는 원금 손실의 위험이 항상 존재하며, 투자자는
                이를 충분히 인지하고 투자에 임해야 합니다.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold text-brand-dark mb-4 pb-2 border-b border-gray-200">
              3. 과거 수익률과 미래 성과
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-400 p-5">
                <p className="text-amber-900 font-medium">
                  과거의 수익률이나 성과가 미래의 수익률이나 성과를 보장하지
                  않습니다.
                </p>
              </div>
              <p>
                주식 시장은 경제 상황, 정치적 변화, 기업 실적, 글로벌 이벤트
                등 수많은 변수에 의해 영향을 받으며, 과거에 특정 패턴이나
                전략이 유효했다고 해서 미래에도 동일한 결과를 보장하지
                않습니다.
              </p>
              <p>
                본 사이트에서 과거 데이터나 실적을 인용하는 경우, 이는 분석의
                맥락을 제공하기 위한 것이지, 미래 성과에 대한 예측이나 보증이
                아닙니다. 모든 투자에는 원금 손실 가능성이 있으며, 투자
                원금보다 큰 손실이 발생할 수도 있습니다.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold text-brand-dark mb-4 pb-2 border-b border-gray-200">
              4. 특정 종목 추천이 아님
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                본 사이트에서 특정 기업이나 종목을 분석하거나 언급하는 것은
                해당 종목에 대한 투자를 추천하거나 권유하는 것이 아닙니다. 종목
                분석은 시장 동향 파악과 교육적 목적을 위한 것이며, 다음의
                사항을 포함합니다.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  특징주 분석은 당일 시장에서 주목받는 종목의 움직임과 그
                  배경을 설명하기 위한 것입니다.
                </li>
                <li>
                  특정 종목의 언급이 해당 종목의 매수, 매도, 보유를 권유하는
                  것이 아닙니다.
                </li>
                <li>
                  분석 시점과 독자의 열람 시점 사이에 시장 상황이 크게 변할
                  수 있습니다.
                </li>
                <li>
                  본 사이트의 작성자가 언급된 종목을 보유하고 있을 수도 있고,
                  보유하고 있지 않을 수도 있습니다.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-bold text-brand-dark mb-4 pb-2 border-b border-gray-200">
              5. 정보의 정확성
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                본 사이트는 제공하는 정보의 정확성과 신뢰성을 위해 최선의
                노력을 기울이고 있습니다. 그러나 다음의 사항을 양해하여 주시기
                바랍니다.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  모든 정보의 완전성, 정확성, 적시성을 보증하지 않습니다.
                </li>
                <li>
                  데이터 출처의 오류나 시간 지연으로 인해 정보가 부정확할 수
                  있습니다.
                </li>
                <li>
                  시장 상황의 급변으로 인해 분석 내용이 빠르게 무효화될 수
                  있습니다.
                </li>
                <li>
                  오타, 기술적 오류 등으로 인한 부정확한 정보가 포함될 수
                  있습니다.
                </li>
              </ul>
              <p>
                본 사이트의 정보에 오류가 있음을 발견하신 경우,{" "}
                <Link
                  href="/contact"
                  className="text-brand-accent underline"
                >
                  문의 페이지
                </Link>
                를 통해 알려주시면 신속히 확인 및 수정하겠습니다.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-bold text-brand-dark mb-4 pb-2 border-b border-gray-200">
              6. 외부 링크
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                본 사이트에는 외부 웹사이트로의 링크가 포함될 수 있습니다. 이러한
                외부 사이트의 콘텐츠, 개인정보보호 관행, 서비스에 대해 본
                사이트는 어떠한 통제권이나 책임도 가지지 않습니다. 외부 링크의
                포함이 해당 사이트나 그 운영자를 보증하거나 추천하는 것은
                아닙니다.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-bold text-brand-dark mb-4 pb-2 border-b border-gray-200">
              7. 지적 재산권
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                본 사이트에 게시된 모든 콘텐츠(텍스트, 이미지, 그래프, 데이터
                분석 등)는 저작권법의 보호를 받습니다. 출처를 명시한 부분적
                인용을 제외하고, 본 사이트의 콘텐츠를 무단으로 복제, 배포,
                전송, 수정, 재출판하는 행위는 저작권법에 의해 금지됩니다.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-bold text-brand-dark mb-4 pb-2 border-b border-gray-200">
              8. 면책 고지의 변경
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                본 면책 고지는 사전 예고 없이 변경될 수 있습니다. 변경된 면책
                고지는 본 페이지에 게시되는 즉시 효력이 발생합니다. 이용자는
                정기적으로 본 페이지를 확인하여 변경 사항을 확인하시기 바랍니다.
              </p>
            </div>
          </section>

          {/* Summary Box */}
          <section className="bg-gray-50 border border-gray-200 rounded-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-brand-dark mb-4">요약</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex gap-3 items-start">
                <span className="text-brand-accent font-bold mt-0.5">1</span>
                <span>
                  본 사이트의 모든 콘텐츠는 정보 제공 및 교육 목적으로만
                  작성되었습니다.
                </span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-brand-accent font-bold mt-0.5">2</span>
                <span>
                  특정 종목이나 금융 상품의 매수/매도를 추천하거나 권유하지
                  않습니다.
                </span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-brand-accent font-bold mt-0.5">3</span>
                <span>
                  투자의 최종 결정과 그에 따른 책임은 투자자 본인에게
                  있습니다.
                </span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-brand-accent font-bold mt-0.5">4</span>
                <span>
                  과거 수익률이 미래 수익률을 보장하지 않습니다.
                </span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-brand-accent font-bold mt-0.5">5</span>
                <span>
                  투자 전 반드시 전문가 상담을 권장합니다.
                </span>
              </li>
            </ul>
          </section>

          {/* Back Link */}
          <div className="text-center pt-4">
            <Link
              href="/"
              className="inline-block text-brand-accent hover:text-brand-accent-hover font-medium hover:underline"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
