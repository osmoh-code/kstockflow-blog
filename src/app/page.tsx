import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAllPosts } from "@/lib/posts";
import { generateWebSiteStructuredData } from "@/lib/seo";
import HeroSection from "@/components/HeroSection";
import FeaturedPost from "@/components/FeaturedPost";
import BlogCard from "@/components/BlogCard";
import Sidebar from "@/components/Sidebar";

export default function HomePage() {
  const allPosts = getAllPosts();
  const websiteStructuredData = generateWebSiteStructuredData();

  // Featured: 핫이슈 최신글 고정
  const featuredPost = allPosts.find((p) => p.meta.category === "hot-issues") ?? null;

  // 카테고리별 최신글 그룹핑 (왼쪽: 주식특징주, 중간: 핫이슈, 오른쪽: 신규주분석)
  const columnCategories = ["featured-stocks", "hot-issues", "new-stocks"] as const;
  const postsByCategory = columnCategories.map((cat) =>
    allPosts
      .filter((p) => p.meta.category === cat && p.meta.slug !== featuredPost?.meta.slug)
      .slice(0, 2)
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: websiteStructuredData }}
      />

      <HeroSection />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Featured Post */}
        {featuredPost && (
          <div className="mb-10">
            <FeaturedPost post={featuredPost.meta} />
          </div>
        )}

        {/* Main Content + Sidebar */}
        <div className="flex flex-col gap-10 lg:flex-row" id="latest-posts">
          {/* Posts Grid */}
          <div className="flex-1 min-w-0">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">최신 분석</h2>
              <Link
                href="/category/hot-issues"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent transition-colors duration-150 hover:text-brand-accent-hover"
              >
                전체 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 items-start">
              {postsByCategory.map((posts, colIdx) => (
                <div key={columnCategories[colIdx]} className="flex flex-col gap-6">
                  {posts.map((post) => (
                    <BlogCard
                      key={post.meta.slug}
                      post={post.meta}
                    />
                  ))}
                </div>
              ))}
            </div>

            {allPosts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                <p className="text-gray-400">
                  아직 게시된 글이 없습니다. 곧 새로운 분석이 업데이트됩니다.
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
    </>
  );
}
