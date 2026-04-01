import { getPostsByCategory } from "@/lib/posts";
import BlogCard from "./BlogCard";

interface RecommendedPostsProps {
  readonly currentSlug: string;
  readonly currentCategory: string;
}

export default function RecommendedPosts({
  currentSlug,
  currentCategory,
}: RecommendedPostsProps) {
  const allHotIssues = getPostsByCategory("hot-issues")
    .filter((p) => p.meta.slug !== currentSlug);

  // 랜덤 3개 선택 (빌드 시 고정, 배포마다 변경)
  const shuffled = [...allHotIssues].sort(() => Math.random() - 0.5);
  const posts = shuffled.slice(0, 3);

  if (posts.length === 0) return null;

  return (
    <section className="mt-12 border-t border-gray-100 pt-10">
      <h2 className="mb-6 text-xl font-bold text-gray-900">
        함께 보면 좋은 분석 글
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogCard key={post.meta.slug} post={post.meta} />
        ))}
      </div>
    </section>
  );
}
