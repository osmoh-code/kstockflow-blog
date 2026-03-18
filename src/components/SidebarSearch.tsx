"use client";

import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import SearchModal from "./SearchModal";

export default function SidebarSearch() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  return (
    <>
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="relative cursor-pointer" onClick={openSearch}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="글 검색..."
            className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-700 placeholder:text-gray-400 transition-colors duration-150 focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
            aria-label="블로그 글 검색"
            readOnly
            onFocus={openSearch}
          />
        </div>
      </div>

      <SearchModal isOpen={isSearchOpen} onClose={closeSearch} />
    </>
  );
}
