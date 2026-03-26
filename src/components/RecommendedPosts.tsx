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
  const posts = getPostsByCategory("hot-issues")
    .filter((p) => p.meta.slug !== currentSlug)
    .slice(0, 3);

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
