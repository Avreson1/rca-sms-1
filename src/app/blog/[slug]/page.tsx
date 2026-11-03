import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((item) => item.slug === slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-[#060b19] text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Posts
        </Link>
        <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-cyan-400">
          {post.tag} ·{" "}
          {new Date(post.date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} ·{" "}
          {post.author}
        </p>
        <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white">{post.title}</h1>
        <div className="mt-6 space-y-5 border-t border-blue-950 pt-6">
          {post.paragraphs.map((paragraph, index) => (
            <p key={index} className="text-sm leading-relaxed text-slate-300">
              {paragraph}
            </p>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
