import Link from "next/link";
import { Crown, LogIn } from "lucide-react";
import { SCHOOL_INFO } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-blue-950/80 bg-[#0a1128]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/welcome" className="flex items-center gap-2.5">
          <span className="rounded-xl bg-[#0000FF] p-2 shadow-lg shadow-blue-800/40 ring-1 ring-cyan-400/50">
            <Crown className="h-5 w-5 text-cyan-200" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-black uppercase tracking-widest text-white">
              {SCHOOL_INFO.shortName}
              <span className="text-cyan-400">Portal</span>
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {SCHOOL_INFO.name}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-xs font-bold uppercase tracking-wider text-slate-300 md:flex">
          <a href="/welcome#about" className="transition-colors hover:text-cyan-300">About</a>
          <Link href="/blog" className="transition-colors hover:text-cyan-300">Blog</Link>
          <Link href="/gallery" className="transition-colors hover:text-cyan-300">Gallery</Link>
          <a href="/welcome#visit" className="transition-colors hover:text-cyan-300">Visit Us</a>
          <a href="/welcome#contact" className="transition-colors hover:text-cyan-300">Contact</a>
        </nav>

        <Link
          href="/login"
          className="group inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-[#0000FF] px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-blue-800/40 transition-all hover:bg-blue-600 hover:shadow-cyan-500/20"
        >
          <LogIn className="h-4 w-4 text-cyan-300 transition-transform group-hover:translate-x-0.5" />
          Portal Login
        </Link>
      </div>
    </header>
  );
}
