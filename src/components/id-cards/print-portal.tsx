"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Puts the print sheet directly on <body>, out of sight until the paper asks.
 *
 * The portal matters: the print rule places .printable-region at the top-left of
 * the page, and a sheet left inside a fixed modal would be positioned against
 * that modal instead — the cards would print half off the sheet. Rendering into
 * body also keeps them out of the scroll container the screen is drawn in.
 */
export function IdCardPrintPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="id-card-print-root printable-region hidden print:block">{children}</div>,
    document.body,
  );
}

/**
 * Asks for the paper once the sheet is actually drawable.
 *
 * The sheet is hidden on screen, so the browser has not decoded its photographs
 * nor fetched the three card faces — printing straight away produces a first
 * sheet of empty frames in a fallback font.
 */
export async function printCardSheet(): Promise<void> {
  const root = document.querySelector(".id-card-print-root");
  const images = root ? Array.from(root.querySelectorAll("img")) : [];
  await Promise.all([
    ...images.map((image) => image.decode().catch(() => undefined)),
    document.fonts.load("800 10pt 'Plus Jakarta Sans'").catch(() => undefined),
    document.fonts.load("700 6pt 'Inter'").catch(() => undefined),
    document.fonts.load("700 5pt 'JetBrains Mono'").catch(() => undefined),
  ]);
  window.print();
}