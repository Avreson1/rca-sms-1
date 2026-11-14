"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchSchoolConfigFromSupabase, saveSchoolConfigToSupabase, type SchoolConfigRow } from "./supabase/db";

export { saveSchoolConfigToSupabase, type SchoolConfigRow };

// One read for the whole browser session, shared by every screen that needs to
// know what school this is and which term it is in. Each page fetching on its
// own meant a phone loading the same row four times, and — worse — pages
// disagreeing about the current term while one of them was still in flight.
let cached: SchoolConfigRow | null = null;
let loaded = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function loadOnce(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = fetchSchoolConfigFromSupabase()
    .then((row) => {
      // null means the read was refused or the table is not set up; the sync
      // notice says so. A failed read is not cached as a value, so the next
      // screen that mounts tries again instead of freezing the failure in.
      if (row) {
        cached = row;
        loaded = true;
      }
      emit();
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * The school's own identity, session and term, as stored on its records.
 *
 * Until now these were a constant compiled into the portal (`SCHOOL_INFO`), so
 * Settings could not change them, End of Term had no term to move on to, and a
 * school cloned for a second campus would print the first campus's name. The
 * compiled values stay as the fallback: a device that cannot reach the database
 * still has to render a card, and it must not invent a different term from the
 * one the office is working in — that is what `usingDefaults` reports.
 */
export function useSchoolConfig(): {
  config: SchoolConfigRow | null;
  loaded: boolean;
  usingDefaults: boolean;
  reload: () => void;
} {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((value) => value + 1);
    listeners.add(listener);
    if (!loaded) void loadOnce();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const reload = useCallback(() => {
    cached = null;
    loaded = false;
    void loadOnce();
  }, []);

  return { config: cached, loaded, usingDefaults: !loaded, reload };
}

/** The school's session as the cache holds it, for the few callers that are not components. */
export function cachedSchoolSession(): string | null {
  return cached?.current_session?.trim() || null;
}

/** The school's term as the cache holds it, for the few callers that are not components. */
export function cachedSchoolTerm(): string | null {
  return cached?.current_term?.trim() || null;
}

/** The values every header and filter falls back to when the read has not landed. */
export function effectiveScope(config: SchoolConfigRow | null, fallbacks: { session: string; term: string }) {
  return {
    session: config?.current_session?.trim() || fallbacks.session,
    term: config?.current_term?.trim() || fallbacks.term,
  };
}

/**
 * The sessions a screen can pull work for: the one the school says it is in,
 * plus the year before and the year after.
 *
 * Pages used to carry three dates typed into their own source, so a school that
 * moved into the next session in Settings still found itself offered last year
 * here — and any card filed under the year it was never offered looked empty.
 */
export function sessionOptions(current: string): string[] {
  const match = current.trim().match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (!match) return [current];
  const start = Number(match[1]);
  return [start - 1, start, start + 1].map((year) => `${year}/${year + 1}`);
}

/** The three terms, in order, as every filter and report head expects them spelled. */
export const REPORT_TERMS = ["First Term", "Second Term", "Third Term"] as const;
export type ReportTerm = (typeof REPORT_TERMS)[number];
