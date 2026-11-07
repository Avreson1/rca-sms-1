import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, LogIn } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { BLOG_POSTS } from "@/lib/landing/content";

export const metadata: Metadata = {
  title: "School Blog | Royal Crown Academy",
  description: "Announcements, academic updates and school life from Royal Crown Academy, Rayfield, Jos.",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BlogPage() {
  const lead = BLOG_POSTS[0];
  const rest = BLOG_POSTS.slice(1);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />

      <header className="texture-grid relative overflow-hidden border-b border-hairline">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-14">
          <Link
            href="/welcome"
            className="inline-flex min-h-11 items-center gap-1.5 text-[12px] font-semibold text-slate-500 transition-colors duration-150 hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Back to home
          </Link>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-600">
            Notices &amp; announcements
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            School blog
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
            Term dates, assessment changes, examination rollouts and house news — written by the
            directorates that run them, for the whole Royal Crown Academy family.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-14">
        {/* Lead story */}
        <article className="grid overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm lg:grid-cols-12">
          <div className="texture-grid-light relative flex min-h-[220px] flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-800 to-night-900 p-7 lg:col-span-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-12 h-52 w-52 rounded-full bg-accent-600/25 blur-3xl"
            />
            <p className="relative inline-flex w-fit items-center rounded-full bg-white/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-inset ring-white/20">
              Latest notice
            </p>
            <div className="relative">
              <p className="font-mono text-[11px] font-medium tabular-nums text-white/65">
                {formatDate(lead.date)}
              </p>
              <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-accent-300">
                {lead.tag}
              </p>
              <p className="mt-1 text-[12px] font-medium text-white/60">{lead.author}</p>
            </div>
          </div>
          <div className="flex flex-col justify-center p-7 lg:col-span-7 lg:p-9">
            <h2 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
              {lead.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{lead.excerpt}</p>
            <Link
              href={`/blog/${lead.slug}`}
              className="group mt-7 inline-flex min-h-12 w-fit items-center gap-2.5 rounded-xl bg-brand-600 px-6 font-display text-sm font-bold tracking-tight text-white transition-colors duration-150 hover:bg-brand-700"
            >
              Read the notice
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
          </div>
        </article>

        {/* Archive */}
        <div className="mt-14 flex items-baseline gap-4">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
            Earlier from the school
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
          <span className="font-mono text-[11px] font-medium tabular-nums text-slate-400">
            {String(rest.length).padStart(2, "0")} posts
          </span>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {rest.map((post, index) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-hairline bg-surface p-6 shadow-2xs transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/40"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-md bg-brand-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-700 ring-1 ring-inset ring-brand-100">
                  {post.tag}
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums text-slate-400">
                  {String(index + 2).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 font-display text-base font-extrabold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-brand-700">
                {post.title}
              </h3>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-muted">{post.excerpt}</p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline pt-4">
                <span className="font-mono text-[10px] font-medium tabular-nums text-slate-400">
                  {formatDate(post.date)}
                </span>
                <ArrowUpRight className="h-4 w-4 text-brand-600 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} />
              </div>
            </Link>
          ))}
        </div>

        {/* Portal note */}
        <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-2xl border border-hairline bg-surface p-6 sm:flex-row sm:items-center sm:p-7">
          <div>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
              These notices become records in the portal
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
              Term calendars, CA structures, grading tiers and published report cards are filed on the
              school&apos;s record — not just announced. Sign in to see the ones that affect your child.
            </p>
          </div>
          <Link
            href="/login"
            className="group inline-flex min-h-12 flex-shrink-0 items-center gap-2.5 rounded-xl bg-accent-600 px-6 font-display text-sm font-bold tracking-tight text-white transition-colors duration-150 hover:bg-accent-700"
          >
            <LogIn className="h-4 w-4" strokeWidth={2} />
            Portal login
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}