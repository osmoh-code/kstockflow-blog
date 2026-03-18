import { getPostsByCategory } from "@/lib/posts";
import BlogCard from "./BlogCard";

interface RelatedPostsProps {
  readonly currentSlug: string;
  readonly category: string;
}

export default function RelatedPosts({
  currentSlug,
  category,
}: RelatedPostsProps) {
  const posts = getPostsByCategory(category)
    .filter((p) => p.meta.slug !== currentSlug)
    .slice(0, 3);

  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-gray-100 pt-10">
      <h2 className="mb-6 text-xl font-bold text-gray-900">관련 글</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogCard key={post.meta.slug} post={post.meta} />
        ))}
      </div>
    </section>
  );
}
