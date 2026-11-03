import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { BLOG_POSTS } from "@/lib/landing/content";

export const metadata: Metadata = {
  title: "School Blog | Royal Crown Academy",
  description: "Announcements, academic updates and school life from Royal Crown Academy, Rayfield, Jos.",
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#060b19] text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <Link
          href="/welcome"
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">School Blog</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Announcements, academic updates and community news from {""}
          Royal Crown Academy.
        </p>

        <div className="mt-10 space-y-5">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col justify-between gap-3 rounded-2xl border border-blue-950 bg-[#0a1128]/80 p-6 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 md:flex-row md:items-center"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  {post.tag} ·{" "}
                  {new Date(post.date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <h2 className="mt-2 text-base font-extrabold text-white group-hover:text-cyan-200">{post.title}</h2>
                <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-slate-400">{post.excerpt}</p>
              </div>
              <ArrowRight className="hidden h-5 w-5 flex-shrink-0 text-cyan-400 transition-transform group-hover:translate-x-1 md:block" />
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
