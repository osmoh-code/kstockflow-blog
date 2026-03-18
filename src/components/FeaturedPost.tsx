import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock, ArrowRight } from "lucide-react";
import type { PostMeta } from "@/lib/posts";
import CategoryBadge from "./CategoryBadge";

interface FeaturedPostProps {
  readonly post: PostMeta;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function FeaturedPost({ post }: FeaturedPostProps) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-gray-100 bg-slate-50 shadow-sm transition-all duration-200 hover:shadow-lg">
      <div className="flex flex-col lg:flex-row">
        {/* Image */}
        <div className="relative aspect-video lg:aspect-auto lg:w-3/5">
          <div className="h-full min-h-[240px] overflow-hidden bg-gradient-to-br from-red-50 to-slate-100 lg:min-h-[320px]">
            {post.thumbnail && post.thumbnail !== "/images/og-default.png" ? (
              <Image
                src={post.thumbnail}
                alt={post.title}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="text-6xl font-bold text-red-200/60">K</div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-center p-6 sm:p-8 lg:w-2/5">
          <div className="mb-3">
            <CategoryBadge category={post.category} size="md" />
          </div>

          <h2 className="text-xl font-bold leading-tight text-gray-900 sm:text-2xl lg:text-2xl">
            {post.title}
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-gray-500 sm:text-base">
            {post.description}
          </p>

          <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 sm:text-sm">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(post.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readingTime}
            </span>
          </div>

          <div className="mt-6">
            <Link
              href={`/posts/${post.slug}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-accent-hover hover:gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              자세히 읽기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
