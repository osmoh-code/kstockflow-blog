import {
  BarChart3,
  Zap,
  Lightbulb,
} from "lucide-react";

const STATS = [
  { icon: BarChart3, label: "매일 분석", value: "Daily" },
  { icon: Zap, label: "실시간 키워드", value: "Real-time" },
  { icon: Lightbulb, label: "재료 인사이트", value: "Insights" },
] as const;

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(220,38,38,0.04),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(239,68,68,0.03),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            재료 기반{" "}
            <span className="text-gradient">주식 시장 분석</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-500 sm:text-lg">
            한국 주식 시장의 특징주, 핫이슈, 재료와 테마를 매일 분석합니다.
            종목의 핵심 재료를 파악하고 더 나은 투자 결정을 내리세요.
          </p>
          <div className="mt-8">
            <a
              href="#latest-posts"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-brand-accent-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              최신 분석 보기
              <span aria-hidden="true">&darr;</span>
            </a>
          </div>
        </div>

        {/* Feature Stats */}
        <div className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                  <Icon className="h-5 w-5 text-brand-accent" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-accent">
                  {stat.value}
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {stat.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
