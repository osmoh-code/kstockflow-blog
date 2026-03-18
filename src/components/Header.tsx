"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { TrendingUp, Search, Menu, X } from "lucide-react";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";
import SearchModal from "./SearchModal";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity duration-150 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          aria-label={`${SITE_NAME} 홈`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600">
            <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            {SITE_NAME}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="메인 내비게이션">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSearch}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            aria-label="검색"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-16 z-30 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />

          {/* Drawer */}
          <nav
            className="fixed right-0 top-16 z-40 h-[calc(100vh-4rem)] w-72 border-l border-gray-100 bg-white shadow-xl md:hidden"
            aria-label="모바일 내비게이션"
          >
            <div className="flex flex-col gap-1 p-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="rounded-xl px-4 py-3 text-base font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={closeSearch} />
    </header>
  );
}
