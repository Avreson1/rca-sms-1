"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, LogIn, Menu, X } from "lucide-react";
import { SCHOOL_INFO } from "@/lib/constants";

const NAV_LINKS = [
  { label: "About", href: "/welcome#about" },
  { label: "Blog", href: "/blog" },
  { label: "Gallery", href: "/gallery" },
  { label: "Visit Us", href: "/welcome#visit" },
  { label: "Contact", href: "/welcome#contact" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-surface/94 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Link href="/welcome" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 ring-1 ring-inset ring-white/20">
            <Crown className="h-5 w-5 text-white" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block font-display text-sm font-extrabold uppercase tracking-[0.14em] text-ink">
              {SCHOOL_INFO.shortName}
              <span className="ml-1.5 text-accent-600">Portal</span>
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-medium text-muted">
              {SCHOOL_INFO.name}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-500 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="group inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-600 px-3.5 font-display text-[13px] font-bold tracking-tight text-white transition-colors duration-150 hover:bg-accent-700 sm:px-4"
          >
            <LogIn className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
            <span className="hidden sm:inline">Portal login</span>
            <span className="sm:hidden">Login</span>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-hairline text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-brand-700 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="animate-in fade-in border-t border-hairline bg-surface px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block min-h-11 rounded-xl px-3 py-3 text-[13px] font-semibold text-slate-600 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}