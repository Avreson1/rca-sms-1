import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, UserRound } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { BLOG_POSTS } from "@/lib/landing/content";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((item) => item.slug === slug);
  if (!post) return { title: "Post Not Found | Royal Crown Academy" };
  return { title: `${post.title} | School Blog`, description: post.excerpt };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((item) => item.slug === slug);
  if (!post) notFound();

  const related = BLOG_POSTS.filter((item) => item.slug !== slug).slice(0, 2);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />

      <header className="texture-grid relative overflow-hidden border-b border-hairline bg-surface">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-brand-100/60 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-12">
          <Link
            href="/blog"
            className="inline-flex min-h-11 items-center gap-1.5 text-[12px] font-semibold text-slate-500 transition-colors duration-150 hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            All posts
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="rounded-md bg-accent-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent-700 ring-1 ring-inset ring-accent-100">
              {post.tag}
            </span>
            <span className="font-mono text-[11px] font-medium tabular-nums text-slate-400">
              {formatDate(post.date)}
            </span>
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-3xl font-extrabold leading-[1.12] tracking-tight text-ink sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">{post.excerpt}</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-8 lg:grid-cols-12">
          <article className="lg:col-span-8">
            <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-2xs sm:p-9">
              <div className="space-y-6">
                {post.paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className={
                      index === 0
                        ? "text-[16px] leading-[1.75] text-slate-600"
                        : "text-[15px] leading-[1.75] text-muted"
                    }
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="mt-9 flex items-center gap-3 border-t border-hairline pt-6">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                  <UserRound className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Written by
                  </p>
                  <p className="mt-0.5 font-display text-sm font-bold tracking-tight text-ink">
                    {post.author}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/blog"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-[13px] font-semibold text-slate-600 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Back to all posts
            </Link>
          </article>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-600">
                  Notice details
                </p>
                <dl className="mt-4 space-y-4 text-[13px]">
                  <div className="flex items-start gap-2.5">
                    <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" strokeWidth={1.75} />
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Published
                      </dt>
                      <dd className="mt-0.5 font-mono font-medium tabular-nums text-slate-600">
                        {formatDate(post.date)}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <UserRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" strokeWidth={1.75} />
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Directorate
                      </dt>
                      <dd className="mt-0.5 font-semibold text-slate-600">{post.author}</dd>
                    </div>
                  </div>
                </dl>
              </div>

              {related.length > 0 && (
                <div className="mt-5 rounded-2xl border border-hairline bg-surface p-6 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Keep reading
                  </p>
                  <ul className="mt-4 divide-y divide-hairline">
                    {related.map((item) => (
                      <li key={item.slug}>
                        <Link
                          href={`/blog/${item.slug}`}
                          className="group block py-3.5 first:pt-0 last:pb-0"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-600">
                            {item.tag}
                          </p>
                          <p className="mt-1.5 font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-brand-700">
                            {item.title}
                          </p>
                          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors duration-150 group-hover:text-brand-600">
                            Read
                            <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}