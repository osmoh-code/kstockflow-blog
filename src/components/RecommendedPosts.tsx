import { getPostsByCategory } from "@/lib/posts";
import BlogCard from "./BlogCard";

interface RecommendedPostsProps {
  readonly currentSlug: string;
  readonly currentCategory: string;
}

/** 간단한 시드 기반 난수 생성기 (Mulberry32) */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** slug → 시드 숫자 */
function slugToSeed(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = Math.imul(h ^ slug.charCodeAt(i), 2654435761);
  }
  return h >>> 0;
}

export default function RecommendedPosts({
  currentSlug,
  currentCategory,
}: RecommendedPostsProps) {
  const candidates = getPostsByCategory("hot-issues")
    .filter((p) => p.meta.slug !== currentSlug);

  if (candidates.length <= 3) {
    return candidates.length === 0 ? null : (
      <section className="mt-12 border-t border-gray-100 pt-10">
        <h2 className="mb-6 text-xl font-bold text-gray-900">함께 보면 좋은 분석 글</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((post) => <BlogCard key={post.meta.slug} post={post.meta} />)}
        </div>
      </section>
    );
  }

  // Mulberry32 PRNG으로 글마다 다른 3개 선택
  const rand = mulberry32(slugToSeed(currentSlug));
  const copy = [...candidates];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  const posts = copy.slice(0, 3);

  return (
    <section className="mt-12 border-t border-gray-100 pt-10">
      <h2 className="mb-6 text-xl font-bold text-gray-900">함께 보면 좋은 분석 글</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => <BlogCard key={post.meta.slug} post={post.meta} />)}
      </div>
    </section>
  );
}
