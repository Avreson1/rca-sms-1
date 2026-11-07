import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ImageIcon, Info } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { GALLERY_ITEMS } from "@/lib/landing/content";

export const metadata: Metadata = {
  title: "Gallery | Royal Crown Academy",
  description: "Campus, classrooms, events and inter-house sports at Royal Crown Academy, Rayfield, Jos.",
};

const CATEGORIES = ["Campus", "Academics", "Events", "Sports & Clubs"] as const;

const CATEGORY_IDS: Record<string, string> = {
  Campus: "campus",
  Academics: "academics",
  Events: "events",
  "Sports & Clubs": "sports",
};

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />

      <header className="texture-grid relative overflow-hidden border-b border-hairline">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl"
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
            School life
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Gallery
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
            The campus on Resort Road, the classrooms, prize-giving and inter-house sports — four
            houses, one crown.
          </p>

          <nav aria-label="Gallery sections" className="mt-8 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <a
                key={category}
                href={`#${CATEGORY_IDS[category]}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-hairline bg-surface px-4 text-[13px] font-semibold text-slate-600 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                {category}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-14">
        {CATEGORIES.map((category, categoryIndex) => {
          const items = GALLERY_ITEMS.filter((item) => item.category === category);
          if (items.length === 0) return null;

          const hasArtwork = items.some((item) => item.image);
          const spans =
            items.length === 1
              ? ["lg:col-span-12"]
              : hasArtwork
                ? ["lg:col-span-7", "lg:col-span-5"]
                : ["lg:col-span-6", "lg:col-span-6"];
          const plateAspect = items.length === 1 ? "aspect-[21/9]" : "aspect-[4/3]";

          return (
            <section key={category} id={CATEGORY_IDS[category]} className="mt-14 first:mt-0">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-xs font-bold tabular-nums text-accent-600">
                  {String(categoryIndex + 1).padStart(2, "0")}
                </span>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
                  {category}
                </h2>
                <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
                <span className="font-mono text-[11px] font-medium tabular-nums text-slate-400">
                  {items.length} {items.length === 1 ? "plate" : "plates"}
                </span>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-12">
                {items.map((item, index) => (
                  <figure
                    key={item.id}
                    className={`group overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xs transition-colors duration-150 hover:border-brand-200 ${spans[index] ?? "lg:col-span-6"}`}
                  >
                    <div
                      className={`texture-grid-light relative w-full overflow-hidden bg-gradient-to-br ${plateAspect} ${item.gradient}`}
                    >
                      {item.image ? (
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
                          style={{ backgroundImage: `url("${item.image}")` }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/20">
                            <ImageIcon className="h-6 w-6 text-white/55" strokeWidth={1.5} />
                          </span>
                        </div>
                      )}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-night-900/55 via-transparent to-transparent"
                      />
                      <span className="absolute left-4 top-4 rounded-md bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
                        {item.category}
                      </span>
                    </div>
                    <figcaption className="p-5">
                      <p className="font-display text-base font-extrabold tracking-tight text-ink">
                        {item.title}
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.caption}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-14 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 sm:p-6">
          <Info className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-brand-600" strokeWidth={1.75} />
          <p className="text-[13px] leading-relaxed text-slate-600">
            The campus plate is original artwork drawn for this portal. The other tiles are labelled
            colour plates, not photographs — the school has not supplied them yet. Drop real images
            into <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-brand-700 ring-1 ring-inset ring-brand-200">public/</code>{" "}
            and set each tile&apos;s <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-brand-700 ring-1 ring-inset ring-brand-200">image</code>{" "}
            field to finish the gallery.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}