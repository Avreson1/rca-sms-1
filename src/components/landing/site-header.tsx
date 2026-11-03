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
    <header className="sticky top-0 z-50 border-b border-blue-950/80 bg-[#0a1128]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <Link href="/welcome" className="flex min-w-0 items-center gap-2.5">
          <span className="flex-shrink-0 rounded-xl bg-[#0000FF] p-2 shadow-lg shadow-blue-800/40 ring-1 ring-cyan-400/50">
            <Crown className="h-5 w-5 text-cyan-200" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-black uppercase tracking-widest text-white">
              {SCHOOL_INFO.shortName}
              <span className="text-cyan-400">Portal</span>
            </span>
            <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {SCHOOL_INFO.name}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-xs font-bold uppercase tracking-wider text-slate-300 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-cyan-300">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-[#0000FF] px-3 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-blue-800/40 transition-all hover:bg-blue-600 hover:shadow-cyan-500/20 sm:px-4"
          >
            <LogIn className="h-4 w-4 text-cyan-300 transition-transform group-hover:translate-x-0.5" />
            <span className="hidden sm:inline">Portal Login</span>
            <span className="sm:hidden">Login</span>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="rounded-xl border border-blue-900/60 bg-blue-950/50 p-2 text-slate-300 transition-colors hover:text-cyan-300 cursor-pointer md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-blue-950/80 bg-[#0a1128] px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-blue-950/70 hover:text-cyan-300"
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
