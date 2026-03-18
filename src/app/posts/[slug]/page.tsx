import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDays,
  Clock,
  ChevronRight,
  Twitter,
  Facebook,
  Linkedin,
  User,
} from "lucide-react";
import {
  getPostBySlug,
  getAllSlugs,
} from "@/lib/posts";
import {
  generateArticleStructuredData,
  generateBreadcrumbStructuredData,
  generateFAQStructuredData,
  extractFAQFromContent,
} from "@/lib/seo";
import {
  SITE_URL,
  SITE_NAME,
  AUTHOR_NAME,
  CATEGORIES,
} from "@/lib/constants";
import CategoryBadge from "@/components/CategoryBadge";
import PostContent from "@/components/PostContent";
import RelatedPosts from "@/components/RelatedPosts";
import AdPlacement from "@/components/AdPlacement";

interface PageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "글을 찾을 수 없습니다" };
  }

  const { meta } = post;

  return {
    title: meta.title,
    description: meta.description,
    keywords: [...meta.tags],
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "article",
      publishedTime: meta.date,
      authors: [AUTHOR_NAME],
      images: [
        {
          url: meta.thumbnail.startsWith("http")
            ? meta.thumbnail
            : `${SITE_URL}${meta.thumbnail}`,
          width: 1200,
          height: 630,
          alt: meta.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [
        meta.thumbnail.startsWith("http")
          ? meta.thumbnail
          : `${SITE_URL}${meta.thumbnail}`,
      ],
    },
    alternates: {
      canonical: `${SITE_URL}/posts/${slug}`,
    },
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const { meta, content } = post;

  const categoryData = CATEGORIES.find((c) => c.slug === meta.category);
  const categoryName = categoryData?.name ?? meta.category;

  const breadcrumbs = [
    { name: "홈", url: "/" },
    { name: categoryName, url: `/category/${meta.category}` },
    { name: meta.title, url: `/posts/${slug}` },
  ];

  const breadcrumbStructuredData = generateBreadcrumbStructuredData(breadcrumbs);
  const articleStructuredData = generateArticleStructuredData(meta);
  const faqs = extractFAQFromContent(content);
  const faqStructuredData = faqs.length > 0 ? generateFAQStructuredData(faqs) : null;

  const shareUrl = `${SITE_URL}/posts/${slug}`;
  const shareText = encodeURIComponent(meta.title);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbStructuredData }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: articleStructuredData }}
      />
      {faqStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqStructuredData }}
        />
      )}

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav
          className="mb-6 flex items-center gap-1 text-sm text-gray-400"
          aria-label="빵 부스러기 탐색"
        >
          <Link
            href="/"
            className="transition-colors duration-150 hover:text-gray-700"
          >
            홈
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href={`/category/${meta.category}`}
            className="transition-colors duration-150 hover:text-gray-700"
          >
            {categoryName}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate text-gray-600">{meta.title}</span>
        </nav>

        {/* Ad Top */}
        <AdPlacement type="header-below" className="mb-6" />

        {/* Article Header */}
        <header className="mb-8">
          <div className="mb-3">
            <CategoryBadge category={meta.category} size="md" />
          </div>
          <h1 className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl lg:text-4xl">
            {meta.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-gray-500 sm:text-lg">
            {meta.description}
          </p>

          {/* Author Bar */}
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
              <User className="h-5 w-5 text-brand-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {AUTHOR_NAME}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(meta.date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {meta.readingTime}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Article Content */}
        <article>
          <PostContent content={content} meta={meta} />
        </article>

        {/* Share Buttons */}
        <div className="mt-10 border-t border-gray-100 pt-6">
          <p className="mb-3 text-sm font-semibold text-gray-700">공유하기</p>
          <div className="flex gap-2">
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors duration-150 hover:border-red-300 hover:bg-red-50 hover:text-blue-500"
              aria-label="Twitter에 공유"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors duration-150 hover:border-red-300 hover:bg-red-50 hover:text-blue-600"
              aria-label="Facebook에 공유"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors duration-150 hover:border-red-300 hover:bg-red-50 hover:text-blue-700"
              aria-label="LinkedIn에 공유"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Related Posts */}
        <RelatedPosts currentSlug={slug} category={meta.category} />
      </div>
    </>
  );
}
