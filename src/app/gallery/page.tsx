import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { GALLERY_ITEMS } from "@/lib/landing/content";

export const metadata: Metadata = {
  title: "Gallery | Royal Crown Academy",
  description: "Campus, classrooms, events and inter-house sports at Royal Crown Academy, Rayfield, Jos.",
};

const CATEGORIES = ["Campus", "Academics", "Events", "Sports & Clubs"] as const;

export default function GalleryPage() {
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
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Gallery</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Life at Royal Crown Academy — the campus, the classrooms, the events and the houses.
        </p>

        {CATEGORIES.map((category) => {
          const items = GALLERY_ITEMS.filter((item) => item.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} className="mt-10">
              <h2 className="text-xs font-black uppercase tracking-widest text-cyan-400">{category}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <figure
                    key={item.id}
                    className={`overflow-hidden rounded-2xl border border-blue-950 bg-gradient-to-br ${item.gradient}`}
                  >
                    <div className="flex aspect-[4/3] items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-white/25" />
                    </div>
                    <figcaption className="border-t border-white/10 bg-black/30 px-4 py-3">
                      <p className="text-sm font-extrabold text-white">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-300">{item.caption}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          );
        })}

        <p className="mt-10 rounded-xl border border-blue-950 bg-[#0a1128] px-5 py-4 text-xs leading-relaxed text-slate-400">
          These tiles are styled placeholders. Drop real photographs into the <code>public/</code>{" "}
          folder and swap each tile for a <code>&lt;next/image&gt;</code> to finish the gallery.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
