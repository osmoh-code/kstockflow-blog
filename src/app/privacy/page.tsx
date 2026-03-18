import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: `${SITE_NAME}의 개인정보처리방침입니다. 개인정보의 수집, 이용, 보유, 파기에 관한 사항을 안내합니다.`,
  openGraph: {
    title: `개인정보처리방침 | ${SITE_NAME}`,
    description: `${SITE_NAME}의 개인정보처리방침입니다.`,
    url: `${SITE_URL}/privacy`,
    type: "website",
  },
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
};

interface SectionProps {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly children: React.ReactNode;
}

function Section({ id, number, title, children }: SectionProps) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <h2 className="text-xl font-bold text-brand-dark mb-4 pb-2 border-b border-gray-200">
        {number}. {title}
      </h2>
      <div className="text-gray-700 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

const TOC_ITEMS = [
  { id: "purpose", label: "개인정보의 수집 및 이용 목적" },
  { id: "items", label: "수집하는 개인정보 항목" },
  { id: "retention", label: "개인정보의 보유 및 이용 기간" },
  { id: "third-party", label: "개인정보의 제3자 제공" },
  { id: "destruction", label: "개인정보의 파기 절차 및 방법" },
  { id: "cookies", label: "쿠키(Cookie) 사용 안내" },
  { id: "rights", label: "이용자의 권리와 행사 방법" },
  { id: "security", label: "개인정보의 안전성 확보 조치" },
  { id: "officer", label: "개인정보 보호책임자" },
  { id: "remedy", label: "권익침해 구제방법" },
  { id: "changes", label: "개인정보처리방침 변경에 관한 사항" },
] as const;

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-gray-50 border-b border-gray-200 py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-brand-dark mb-4">
            개인정보처리방침
          </h1>
          <p className="text-brand-muted">
            {SITE_NAME}(이하 &quot;본 사이트&quot;)는 이용자의 개인정보를
            중요시하며, 「개인정보 보호법」 및 관련 법령을 준수하고 있습니다.
          </p>
          <p className="text-sm text-brand-muted mt-2">
            시행일: 2026년 3월 18일
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Table of Contents */}
        <nav className="bg-gray-50 rounded-xl border border-gray-200 p-6 mb-10">
          <h2 className="text-lg font-bold text-brand-dark mb-4">목차</h2>
          <ol className="space-y-2">
            {TOC_ITEMS.map((item, index) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-brand-accent hover:text-brand-accent-hover hover:underline"
                >
                  {index + 1}. {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <Section id="purpose" number={1} title="개인정보의 수집 및 이용 목적">
          <p>
            본 사이트는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고
            있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용
            목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의
            동의를 받는 등 필요한 조치를 이행할 예정입니다.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li>
              <strong>서비스 제공 및 운영:</strong> 블로그 콘텐츠 제공, 웹사이트
              이용 통계 분석, 서비스 개선을 위한 기초 자료로 활용합니다.
            </li>
            <li>
              <strong>문의 대응:</strong> 이용자의 문의사항 접수 및 회신,
              불만사항 처리를 위해 활용합니다.
            </li>
            <li>
              <strong>광고 서비스:</strong> Google AdSense를 통한 맞춤형 광고
              제공을 위해 활용합니다. 이는 본 사이트의 무료 콘텐츠 제공을
              지원하기 위한 것입니다.
            </li>
            <li>
              <strong>웹사이트 분석:</strong> Google Analytics를 통해 방문자
              행동 패턴을 분석하여 사용자 경험을 개선합니다.
            </li>
            <li>
              <strong>부정 이용 방지:</strong> 비정상적인 접근이나 부정 이용을
              방지하고, 서비스의 안정적 운영을 보장합니다.
            </li>
          </ul>
        </Section>

        <Section id="items" number={2} title="수집하는 개인정보 항목">
          <p>본 사이트는 다음과 같은 개인정보 항목을 수집할 수 있습니다.</p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full border-collapse border border-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    수집 구분
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    수집 항목
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    수집 방법
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-4 py-3">
                    자동 수집 정보
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    IP 주소, 브라우저 종류 및 버전, 운영체제 정보, 방문 일시,
                    방문 페이지, 서비스 이용 기록, 쿠키 정보
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    웹사이트 방문 시 자동 생성/수집
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3">
                    문의 시 수집
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    이름, 이메일 주소, 문의 내용
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    이용자 직접 입력
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3">
                    광고 관련 정보
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    광고 식별자, 광고 클릭 및 노출 정보, 관심 기반 프로필
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    Google AdSense를 통한 자동 수집
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          id="retention"
          number={3}
          title="개인정보의 보유 및 이용 기간"
        >
          <p>
            본 사이트는 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를
            지체 없이 파기합니다. 단, 관련 법령에 의해 보존이 필요한 경우에는
            해당 기간 동안 보관합니다.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li>
              <strong>문의 기록:</strong> 문의 접수일로부터 3년 (전자상거래
              등에서의 소비자보호에 관한 법률)
            </li>
            <li>
              <strong>웹사이트 방문 기록:</strong> Google Analytics 데이터 보존
              정책에 따라 최대 26개월
            </li>
            <li>
              <strong>쿠키 정보:</strong> 브라우저 종료 시 또는 쿠키 만료일까지
              (영구 쿠키의 경우 최대 2년)
            </li>
            <li>
              <strong>통신비밀보호법에 따른 보존:</strong> 웹사이트 방문 기록
              3개월
            </li>
          </ul>
        </Section>

        <Section id="third-party" number={4} title="개인정보의 제3자 제공">
          <p>
            본 사이트는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지
            않습니다. 다만, 다음의 경우에는 예외로 합니다.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li>이용자가 사전에 동의한 경우</li>
            <li>
              법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와
              방법에 따라 수사기관의 요구가 있는 경우
            </li>
          </ul>
          <p className="mt-4">
            본 사이트는 다음의 제3자 서비스를 이용하고 있으며, 이를 통해
            이용자의 일부 정보가 처리될 수 있습니다.
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full border-collapse border border-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    서비스명
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    제공 업체
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    목적
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    수집 항목
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-4 py-3">
                    Google AdSense
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    Google LLC
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    맞춤형 광고 제공
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    쿠키, 광고 식별자, IP 주소, 브라우저 정보, 사이트 이용 기록
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3">
                    Google Analytics
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    Google LLC
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    웹사이트 이용 통계 분석
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    쿠키, IP 주소(익명 처리), 방문 페이지, 이용 시간, 브라우저
                    정보
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-brand-muted">
            Google의 개인정보처리방침은{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-accent underline"
            >
              https://policies.google.com/privacy
            </a>
            에서 확인하실 수 있습니다.
          </p>
        </Section>

        <Section
          id="destruction"
          number={5}
          title="개인정보의 파기 절차 및 방법"
        >
          <p>
            본 사이트는 개인정보 보유 기간의 경과, 처리 목적 달성 등
            개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를
            파기합니다.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li>
              <strong>파기 절차:</strong> 불필요한 개인정보는 개인정보의 처리가
              불필요한 것으로 인정되는 날로부터 5일 이내에 해당 개인정보를
              파기합니다.
            </li>
            <li>
              <strong>파기 방법:</strong> 전자적 파일 형태로 기록/저장된
              개인정보는 기록을 재생할 수 없도록 파기하며, 종이 문서에
              기록/저장된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.
            </li>
          </ul>
        </Section>

        <Section id="cookies" number={6} title="쿠키(Cookie) 사용 안내">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
            <p className="text-blue-900 font-medium">
              본 사이트는 이용자에게 보다 나은 서비스를 제공하기 위해
              쿠키(Cookie)를 사용합니다. 이 섹션은 Google AdSense 및 Google
              Analytics와 관련된 쿠키 사용에 대한 중요한 안내를 포함하고
              있습니다.
            </p>
          </div>

          <h3 className="text-lg font-semibold text-brand-dark mt-6 mb-3">
            쿠키란?
          </h3>
          <p>
            쿠키(Cookie)는 웹사이트가 이용자의 브라우저에 전송하는 소량의
            텍스트 파일로, 이용자의 하드디스크에 저장됩니다. 이후 이용자가
            웹사이트를 재방문할 때 웹사이트 서버는 이용자 하드디스크에 저장된
            쿠키의 내용을 읽어 이용자의 환경설정을 유지하고 맞춤화된 서비스를
            제공하기 위해 활용합니다.
          </p>

          <h3 className="text-lg font-semibold text-brand-dark mt-6 mb-3">
            본 사이트에서 사용하는 쿠키의 종류
          </h3>
          <div className="overflow-x-auto mt-3">
            <table className="w-full border-collapse border border-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    쿠키 유형
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    용도
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                    만료 기간
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-4 py-3">
                    필수 쿠키
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    웹사이트 기본 기능 제공, 쿠키 동의 상태 저장
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    세션 또는 1년
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3">
                    분석 쿠키 (Google Analytics)
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    방문자 수, 페이지뷰, 이용 시간 등 웹사이트 이용 통계 수집
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    최대 2년
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3">
                    광고 쿠키 (Google AdSense)
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    이용자의 관심사에 기반한 맞춤형 광고 제공, 광고 노출 횟수
                    제한, 광고 효과 측정
                  </td>
                  <td className="border border-gray-200 px-4 py-3">
                    최대 2년
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-semibold text-brand-dark mt-6 mb-3">
            쿠키 관리 방법
          </h3>
          <p>
            이용자는 쿠키 설치에 대한 선택권을 가지고 있습니다. 웹 브라우저
            설정을 통해 쿠키를 허용하거나, 매번 쿠키 수신 여부를 확인하거나,
            모든 쿠키의 수신을 거부할 수 있습니다.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li>
              <strong>Chrome:</strong> 설정 &gt; 개인정보 및 보안 &gt; 쿠키 및
              기타 사이트 데이터
            </li>
            <li>
              <strong>Firefox:</strong> 설정 &gt; 개인정보 및 보안 &gt; 쿠키 및
              사이트 데이터
            </li>
            <li>
              <strong>Safari:</strong> 환경설정 &gt; 개인정보 보호
            </li>
            <li>
              <strong>Edge:</strong> 설정 &gt; 쿠키 및 사이트 권한 &gt; 쿠키 및
              사이트 데이터 관리 및 삭제
            </li>
          </ul>
          <p className="mt-3">
            다만, 쿠키 수신을 거부하는 경우 일부 서비스의 이용이 제한될 수
            있습니다. Google의 광고 쿠키에 대한 설정은{" "}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-accent underline"
            >
              Google 광고 설정
            </a>
            에서 관리할 수 있습니다.
          </p>
        </Section>

        <Section
          id="rights"
          number={7}
          title="이용자의 권리와 행사 방법"
        >
          <p>
            이용자는 개인정보 주체로서 다음과 같은 권리를 행사할 수 있습니다.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리정지 요구</li>
          </ul>
          <p className="mt-3">
            위 권리 행사는 본 사이트의{" "}
            <Link href="/contact" className="text-brand-accent underline">
              문의 페이지
            </Link>
            를 통해 요청하실 수 있으며, 본 사이트는 이에 대해 지체 없이
            조치하겠습니다.
          </p>
        </Section>

        <Section
          id="security"
          number={8}
          title="개인정보의 안전성 확보 조치"
        >
          <p>
            본 사이트는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고
            있습니다.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li>
              <strong>SSL/TLS 암호화:</strong> 개인정보가 전송되는 구간에
              SSL/TLS를 적용하여 데이터를 암호화합니다.
            </li>
            <li>
              <strong>접근 권한 관리:</strong> 개인정보에 대한 접근 권한을
              최소한으로 제한합니다.
            </li>
            <li>
              <strong>보안 프로그램 설치:</strong> 해킹이나 컴퓨터 바이러스에
              의한 개인정보 유출 방지를 위해 보안 프로그램을 설치하고 주기적으로
              갱신합니다.
            </li>
          </ul>
        </Section>

        <Section id="officer" number={9} title="개인정보 보호책임자">
          <p>
            본 사이트는 개인정보 처리에 관한 업무를 총괄해서 책임지고,
            개인정보 처리와 관련한 이용자의 불만처리 및 피해구제 등을 위하여
            아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <div className="bg-gray-50 rounded-lg p-5 mt-4 border border-gray-200">
            <p>
              <strong>개인정보 보호책임자</strong>
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>성명: [담당자명]</li>
              <li>직위: 운영자</li>
              <li>이메일: [contact@kstockflow.com]</li>
            </ul>
          </div>
          <p className="mt-4 text-sm text-brand-muted">
            개인정보 처리에 관한 문의, 불만, 피해구제 등은 위 개인정보
            보호책임자에게 연락하여 주시기 바랍니다.
          </p>
        </Section>

        <Section id="remedy" number={10} title="권익침해 구제방법">
          <p>
            이용자는 개인정보침해로 인한 구제를 받기 위하여 아래의 기관에
            분쟁해결이나 상담 등을 신청할 수 있습니다.
          </p>
          <div className="space-y-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
              <p className="font-semibold mb-2">
                개인정보분쟁조정위원회
              </p>
              <ul className="text-sm space-y-1">
                <li>소관업무: 개인정보 분쟁조정신청, 집단분쟁조정</li>
                <li>
                  홈페이지:{" "}
                  <a
                    href="https://www.kopico.go.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent underline"
                  >
                    www.kopico.go.kr
                  </a>
                </li>
                <li>전화: (국번없이) 1833-6972</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
              <p className="font-semibold mb-2">
                개인정보침해신고센터 (한국인터넷진흥원)
              </p>
              <ul className="text-sm space-y-1">
                <li>소관업무: 개인정보 침해사실 신고, 상담 신청</li>
                <li>
                  홈페이지:{" "}
                  <a
                    href="https://privacy.kisa.or.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent underline"
                  >
                    privacy.kisa.or.kr
                  </a>
                </li>
                <li>전화: (국번없이) 118</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
              <p className="font-semibold mb-2">대검찰청 사이버수사과</p>
              <ul className="text-sm space-y-1">
                <li>
                  홈페이지:{" "}
                  <a
                    href="https://www.spo.go.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent underline"
                  >
                    www.spo.go.kr
                  </a>
                </li>
                <li>전화: (국번없이) 1301</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
              <p className="font-semibold mb-2">경찰청 사이버수사국</p>
              <ul className="text-sm space-y-1">
                <li>
                  홈페이지:{" "}
                  <a
                    href="https://ecrm.police.go.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent underline"
                  >
                    ecrm.police.go.kr
                  </a>
                </li>
                <li>전화: (국번없이) 182</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          id="changes"
          number={11}
          title="개인정보처리방침 변경에 관한 사항"
        >
          <p>
            이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른
            변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일
            전부터 본 사이트를 통하여 공지할 것입니다.
          </p>
          <p className="mt-3">
            이용자분들께서는 정기적으로 본 페이지를 방문하시어 변경사항을
            확인하시기 바랍니다.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mt-4 border border-gray-200 text-sm">
            <p>
              <strong>현행 개인정보처리방침</strong>
            </p>
            <p>공고일자: 2026년 3월 18일</p>
            <p>시행일자: 2026년 3월 18일</p>
          </div>
        </Section>
      </div>
    </div>
  );
}
