"use client";

import { useState } from "react";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "My Reed Beds", href: "/reed-beds" },
  { label: "Browse \u25BE", href: "/browse" },
  { label: "Community \u25BE", href: "/community" },
];

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-[#FAF8F6] sticky top-0 z-50" style={{ boxShadow: "rgba(0,0,0,0.15) 0px 1px 2px 0px" }}>
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[70px]">
          {/* Logo */}
          <a href="/" className="flex items-baseline gap-1 group flex-shrink-0">
            <span className="font-serif text-2xl sm:text-[28px] font-bold text-[#1E1915] tracking-tight group-hover:text-[#382110] transition-colors">
              good reeds
            </span>
            <span className="text-xl ml-0.5" role="img" aria-label="reed">
              🌾
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 ml-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-2 text-[15px] text-[#1E1915] hover:text-[#382110] font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Search + Sign In */}
          <div className="flex items-center gap-4 ml-auto">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reeds"
                className="w-36 sm:w-56 lg:w-72 px-3 py-2 pl-10 text-sm rounded-md bg-white text-[#1E1915] placeholder-[#707070] border border-[#CFCCC9] focus:outline-none focus:ring-2 focus:ring-[#3F8363] focus:border-transparent transition-all"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707070]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            <a
              href="/signin"
              className="hidden sm:inline-block text-[15px] font-medium text-[#1E1915] hover:text-[#382110] transition-colors"
            >
              Sign in
            </a>

            {/* Mobile menu */}
            <button
              className="md:hidden p-2 rounded text-[#1E1915] hover:bg-[#F2F2F2] transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-3 border-t border-[#CFCCC9]">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block px-3 py-2 text-sm font-medium text-[#1E1915] hover:bg-[#F2F2F2] transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a href="/signin" className="block px-3 py-2 text-sm font-medium text-[#3F8363]">
              Sign in
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
