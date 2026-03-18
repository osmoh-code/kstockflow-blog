import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock } from "lucide-react";
import type { PostMeta } from "@/lib/posts";
import CategoryBadge from "./CategoryBadge";

interface BlogCardProps {
  readonly post: PostMeta;
  readonly featured?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogCard({ post, featured = false }: BlogCardProps) {
  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
        featured ? "sm:col-span-2" : ""
      }`}
    >
      <Link
        href={`/posts/${post.slug}`}
        className="absolute inset-0 z-10"
        aria-label={post.title}
      >
        <span className="sr-only">{post.title} 읽기</span>
      </Link>

      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-red-50 to-slate-100">
        {post.thumbnail && post.thumbnail !== "/images/og-default.png" ? (
          <Image
            src={post.thumbnail}
            alt={post.title}
            fill
            sizes={featured ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-4xl font-bold text-red-200/60">K</div>
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute left-3 top-3 z-[5]">
          <CategoryBadge category={post.category} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3
          className={`font-bold leading-snug text-gray-900 line-clamp-2 ${
            featured ? "text-lg sm:text-xl" : "text-base"
          }`}
        >
          {post.title}
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-gray-500 line-clamp-2">
          {post.description}
        </p>

        {/* Meta */}
        <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(post.date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {post.readingTime}
          </span>
        </div>
      </div>
    </article>
  );
}
