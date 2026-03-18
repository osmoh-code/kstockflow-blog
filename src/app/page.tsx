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

  const featuredPost = allPosts.length > 0 ? allPosts[0] : null;
  const remainingPosts = allPosts.slice(1);

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

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {remainingPosts.map((post) => (
                <BlogCard
                  key={post.meta.slug}
                  post={post.meta}
                />
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
