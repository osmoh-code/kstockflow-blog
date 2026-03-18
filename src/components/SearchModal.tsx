"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, X, CalendarDays, Clock } from "lucide-react";
import CategoryBadge from "./CategoryBadge";

interface SearchEntry {
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly category: string;
  readonly slug: string;
  readonly thumbnail: string;
  readonly tags: readonly string[];
  readonly readingTime: string;
}

interface SearchModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function matchesQuery(entry: SearchEntry, query: string): boolean {
  const q = query.toLowerCase();
  return (
    entry.title.toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(q)) ||
    entry.category.toLowerCase().includes(q)
  );
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<readonly SearchEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search index on first open
  useEffect(() => {
    if (!isOpen || entries.length > 0) return;
    setIsLoading(true);
    fetch("/search-index.json")
      .then((res) => res.json())
      .then((data: SearchEntry[]) => {
        setEntries(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [isOpen, entries.length]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const results = query.trim().length > 0
    ? entries.filter((e) => matchesQuery(e, query.trim()))
    : [];

  const handleLinkClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 태그, 종목명으로 검색..."
            className="flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 outline-none"
            aria-label="블로그 글 검색"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              검색 데이터 로딩 중...
            </div>
          )}

          {!isLoading && query.trim().length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              검색어를 입력하세요
            </div>
          )}

          {!isLoading && query.trim().length > 0 && results.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              &ldquo;{query}&rdquo;에 대한 검색 결과가 없습니다
            </div>
          )}

          {results.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {results.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/posts/${entry.slug}`}
                    onClick={handleLinkClick}
                    className="flex gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
                  >
                    {/* Thumbnail */}
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-red-50 to-slate-100">
                      {entry.thumbnail && entry.thumbnail !== "/images/og-default.png" ? (
                        <img
                          src={entry.thumbnail}
                          alt={entry.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-bold text-red-200/60">
                          K
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <CategoryBadge category={entry.category} size="sm" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {entry.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                        {entry.description}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(entry.date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {entry.readingTime}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-400 flex items-center justify-between">
          <span>
            {query.trim().length > 0
              ? `${results.length}개 결과`
              : `총 ${entries.length}개 글`}
          </span>
          <span>
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono">ESC</kbd>
            {" "}닫기
          </span>
        </div>
      </div>
    </div>
  );
}
