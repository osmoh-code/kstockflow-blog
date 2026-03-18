import Link from "next/link";
import {
  BarChart3,
  Flame,
  TrendingUp,
  Globe,
  CalendarDays,
} from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import { getAllPosts } from "@/lib/posts";
import type { PostMeta } from "@/lib/posts";
import AdPlacement from "./AdPlacement";
import SidebarSearch from "./SidebarSearch";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "featured-stocks": BarChart3,
  "hot-issues": Flame,
  "new-stocks": TrendingUp,
  "theme-news": Globe,
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

function getCategoryCounts(posts: readonly { readonly meta: PostMeta }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const post of posts) {
    const cat = post.meta.category;
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return counts;
}

export default function Sidebar() {
  const allPosts = getAllPosts();
  const categoryCounts = getCategoryCounts(allPosts);
  const popularPosts = allPosts.slice(0, 3);

  return (
    <aside className="sticky top-24 space-y-6">
      {/* Search */}
      <SidebarSearch />

      {/* Categories */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900">
          카테고리
        </h2>
        <ul className="space-y-1">
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.slug] ?? BarChart3;
            const count = categoryCounts[cat.slug] ?? 0;
            return (
              <li key={cat.slug}>
                <Link
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-600 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                >
                  <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span className="flex-1">{cat.name}</span>
                  <span className="text-xs font-medium text-gray-400">
                    {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Popular Posts */}
      {popularPosts.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900">
            인기 글
          </h2>
          <ul className="space-y-4">
            {popularPosts.map((post) => (
              <li key={post.meta.slug}>
                <Link
                  href={`/posts/${post.meta.slug}`}
                  className="group flex gap-3 rounded-lg transition-colors duration-150"
                >
                  {/* Small thumbnail */}
                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-red-50 to-slate-100">
                    {post.meta.thumbnail ? (
                      <img
                        src={post.meta.thumbnail}
                        alt={post.meta.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-red-200/60">
                        K
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium leading-snug text-gray-700 line-clamp-2 group-hover:text-brand-accent transition-colors duration-150">
                      {post.meta.title}
                    </h3>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(post.meta.date)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ad Placement */}
      <AdPlacement type="sidebar-top" />
    </aside>
  );
}
