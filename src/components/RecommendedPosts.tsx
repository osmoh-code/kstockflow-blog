import { getPostsByCategory } from "@/lib/posts";
import BlogCard from "./BlogCard";

interface RecommendedPostsProps {
  readonly currentSlug: string;
  readonly currentCategory: string;
}

/**
 * 현재 글의 slug를 시드로 사용하여 결정적 랜덤 선택
 * → 같은 글에서는 항상 같은 추천 (캐시 친화적)
 * → 다른 글에서는 다른 추천 조합
 */
function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  const copy = [...arr];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }

  for (let i = copy.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash + i) | 0;
    const j = ((hash < 0 ? -hash : hash) % (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export default function RecommendedPosts({
  currentSlug,
  currentCategory,
}: RecommendedPostsProps) {
  const allHotIssues = getPostsByCategory("hot-issues")
    .filter((p) => p.meta.slug !== currentSlug);

  // slug 기반 시드로 셔플 → 글마다 다른 추천 조합
  const shuffled = seededShuffle(allHotIssues, currentSlug);
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
