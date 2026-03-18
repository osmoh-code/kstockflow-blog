import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BarChart3,
  Flame,
  TrendingUp,
  Globe,
} from "lucide-react";
import { CATEGORIES, SITE_NAME, SITE_URL } from "@/lib/constants";
import { getPostsByCategory } from "@/lib/posts";
import { generateBreadcrumbStructuredData } from "@/lib/seo";
import BlogCard from "@/components/BlogCard";
import Sidebar from "@/components/Sidebar";
import AdPlacement from "@/components/AdPlacement";

interface PageProps {
  readonly params: Promise<{ slug: string }>;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "featured-stocks": BarChart3,
  "hot-issues": Flame,
  "new-stocks": TrendingUp,
  "theme-news": Globe,
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "featured-stocks":
    "오늘의 주식 특징주를 분석합니다. 급등주, 테마주, 거래량 상위 종목의 원인과 전망을 살펴보세요.",
  "hot-issues":
    "시장을 움직이는 핫이슈를 빠르게 전달합니다. 정책 변화, 글로벌 이슈, 산업 트렌드를 분석합니다.",
  "new-stocks":
    "신규 상장 종목과 IPO를 분석합니다. 공모가 대비 전망, 사업 모델, 성장 가능성을 살펴보세요.",
  "theme-news":
    "주식 시장의 핵심 재료와 테마 뉴스를 분석합니다. 종목에 영향을 미치는 재료를 빠르게 파악하세요.",
};

export function generateStaticParams() {
  return CATEGORIES.map((cat) => ({ slug: cat.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = CATEGORIES.find((c) => c.slug === slug);

  if (!category) {
    return { title: "카테고리를 찾을 수 없습니다" };
  }

  const description =
    CATEGORY_DESCRIPTIONS[slug] ??
    `${category.name} 관련 최신 분석 글을 확인하세요.`;

  return {
    title: `${category.name} - 최신 분석`,
    description,
    openGraph: {
      title: `${category.name} | ${SITE_NAME}`,
      description,
      type: "website",
      url: `${SITE_URL}/category/${slug}`,
    },
    alternates: {
      canonical: `${SITE_URL}/category/${slug}`,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = CATEGORIES.find((c) => c.slug === slug);

  if (!category) {
    notFound();
  }

  const posts = getPostsByCategory(slug);
  const Icon = CATEGORY_ICONS[slug] ?? BarChart3;
  const description =
    CATEGORY_DESCRIPTIONS[slug] ??
    `${category.name} 관련 최신 분석 글을 확인하세요.`;

  const breadcrumbs = [
    { name: "홈", url: "/" },
    { name: category.name, url: `/category/${slug}` },
  ];
  const breadcrumbStructuredData = generateBreadcrumbStructuredData(breadcrumbs);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbStructuredData }}
      />
      {/* Category Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${category.color}15` }}
          >
            <Icon
              className="h-6 w-6"
              style={{ color: category.color }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              {category.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {posts.length}개의 글
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-500">
          {description}
        </p>
      </header>

      {/* Content + Sidebar */}
      <div className="flex flex-col gap-10 lg:flex-row">
        {/* Posts Grid */}
        <div className="min-w-0 flex-1">
          {posts.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => (
                <BlogCard key={post.meta.slug} post={post.meta} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
              <Icon className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="text-gray-400">
                아직 이 카테고리에 게시된 글이 없습니다.
              </p>
              <p className="mt-1 text-sm text-gray-400">
                곧 새로운 분석이 업데이트됩니다.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full shrink-0 lg:w-80">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
