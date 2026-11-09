"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { IdCardArtwork, type CardSchool } from "@/components/id-cards/id-card-artwork";
import { IdCardDesigner } from "@/components/id-cards/id-card-designer";
import { IdCardPrintPortal, printCardSheet } from "@/components/id-cards/print-portal";
import { SCHOOL_INFO } from "@/lib/constants";
import { effectiveScope, useSchoolConfig } from "@/lib/school-config";
import { useRealtimeAuth, useRealtimeIdCards, useRealtimeStaff, useRealtimeStudents } from "@/lib/realtime-store";
import {
  HOLDER_WORDS,
  ID_CARD_LAYOUTS,
  blankCard,
  cardDateLabel,
  cardInput,
  holderKey,
  layoutSpec,
  themeSpec,
  type IdCardHolder,
  type IdCardHolderType,
  type IdCardInput,
  type IdCardRecord,
} from "@/lib/id-cards";
import {
  ArrowLeft,
  CreditCard,
  ImageOff,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";

const STAFF_ROLE_WORDS: Record<string, string> = {
  SUPER_ADMIN: "Superintendent",
  EXAM_OFFICER: "Examination Officer",
  TEACHER: "Teacher",
  ACCOUNTANT: "Bursary",
  ADMIN: "Administration",
};

type StatusFilter = "all" | "filed" | "unfiled" | "nophoto";
type SortKey = "name" | "number" | "class" | "recent";

interface PrintItem {
  holder: IdCardHolder;
  card: IdCardInput;
  filed: boolean;
}

const MAX_RUN = 60;

/**
 * Operations → ID Cards: the school's card desk.
 *
 * The register is the left-hand column and the school's filed cards are joined
 * onto it, so the screen answers the question the office actually asks — "who
 * still has no card?" — rather than listing only the people somebody remembered
 * to design one for.
 *
 * A card holds the photograph and what the office adds to it. The name, class,
 * house and designation are read from the register every time it is drawn, so a
 * promoted pupil's card is right without anybody re-filing it.
 */
export function IdCardDesk({ asked }: { asked: { type: IdCardHolderType; ref: string } | null }) {
  const { currentUser } = useRealtimeAuth();
  const { students } = useRealtimeStudents();
  const { staff } = useRealtimeStaff();
  const { config: schoolConfig } = useSchoolConfig();
  const { cards, cardsSource, cardsLoading, cardsReason, loadCards, withdrawCard, reloadIdCards } = useRealtimeIdCards();

  const canFile = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";
  const scope = effectiveScope(schoolConfig, { session: SCHOOL_INFO.currentSession, term: SCHOOL_INFO.currentTerm });

  const school: CardSchool = useMemo(
    () => ({
      name: schoolConfig?.school_name?.trim() || SCHOOL_INFO.name,
      shortName: schoolConfig?.short_name?.trim() || SCHOOL_INFO.shortName,
      motto: schoolConfig?.motto?.trim() || SCHOOL_INFO.motto,
      address: schoolConfig?.address?.trim() || SCHOOL_INFO.address,
      phone: schoolConfig?.phone?.trim() || SCHOOL_INFO.phone,
      email: schoolConfig?.email?.trim() || SCHOOL_INFO.email,
      website: schoolConfig?.website?.trim() || SCHOOL_INFO.website,
    }),
    [schoolConfig],
  );

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | IdCardHolderType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [classFilter, setClassFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [cutGuides, setCutGuides] = useState(true);
  const [printBacks, setPrintBacks] = useState(true);
  const [sheetOrder, setSheetOrder] = useState<"stock" | "name" | "class">("stock");

  const [designer, setDesigner] = useState<{ holder: IdCardHolder; initial: IdCardInput } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [printJob, setPrintJob] = useState<PrintItem[] | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const deepLinkTaken = useRef(false);

  const cardByKey = useMemo(() => {
    const map = new Map<string, IdCardRecord>();
    for (const card of cards) map.set(holderKey(card.holderType, card.holderRef), card);
    return map;
  }, [cards]);

  const holders = useMemo<IdCardHolder[]>(() => {
    const pupils: IdCardHolder[] = students.map((pupil) => ({
      holderType: "student",
      holderRef: pupil.admissionNo,
      holderName: pupil.fullName,
      firstLabel: "Class",
      firstValue: pupil.className,
      secondLabel: "Gender",
      secondValue: pupil.gender,
      tag: pupil.house ? `${pupil.house.split(" (")[0]} House` : "",
      guardianName: pupil.guardianName ?? "",
      guardianPhone: pupil.guardianPhone ?? "",
      session: scope.session,
      onRegister: true,
    }));
    const members: IdCardHolder[] = staff.map((member) => ({
      holderType: "staff",
      holderRef: member.staffId,
      holderName: member.fullName,
      firstLabel: "Designation",
      firstValue: member.designation?.trim() || STAFF_ROLE_WORDS[member.role] || member.role,
      secondLabel: "Assigned class",
      secondValue: member.assignedClass,
      tag: member.isFormMaster && member.assignedClass ? `Form Master · ${member.assignedClass}` : "",
      guardianName: "",
      guardianPhone: "",
      session: scope.session,
      onRegister: true,
    }));
    return [...pupils, ...members].filter((holder) => holder.holderRef.trim() !== "");
  }, [students, staff, scope.session]);

  const holderByKey = useMemo(() => {
    const map = new Map<string, IdCardHolder>();
    for (const holder of holders) map.set(holderKey(holder.holderType, holder.holderRef), holder);
    return map;
  }, [holders]);

  /** Cards on file for somebody the register no longer holds. */
  const orphaned = useMemo(
    () => cards.filter((card) => !holderByKey.has(holderKey(card.holderType, card.holderRef))),
    [cards, holderByKey],
  );

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((pupil) => pupil.className).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [students],
  );

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = holders.filter((holder) => {
      if (typeFilter !== "all" && holder.holderType !== typeFilter) return false;
      if (classFilter !== "all" && (holder.holderType !== "student" || holder.firstValue !== classFilter)) return false;
      const card = cardByKey.get(holderKey(holder.holderType, holder.holderRef));
      if (statusFilter === "filed" && !card) return false;
      if (statusFilter === "unfiled" && card) return false;
      if (statusFilter === "nophoto" && card?.hasPhoto) return false;
      if (!needle) return true;
      return [holder.holderName, holder.holderRef, holder.firstValue, holder.secondValue, holder.tag, card?.cardNo ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    const nameOf = (holder: IdCardHolder) => holder.holderName || holder.holderRef;
    return rows.sort((a, b) => {
      if (sort === "number") return a.holderRef.localeCompare(b.holderRef, undefined, { numeric: true });
      if (sort === "class") {
        return `${a.holderType} ${a.firstValue}`.localeCompare(`${b.holderType} ${b.firstValue}`, undefined, { numeric: true }) || nameOf(a).localeCompare(nameOf(b));
      }
      if (sort === "recent") {
        const at = cardByKey.get(holderKey(a.holderType, a.holderRef))?.updatedAt ?? "";
        const bt = cardByKey.get(holderKey(b.holderType, b.holderRef))?.updatedAt ?? "";
        return bt.localeCompare(at) || nameOf(a).localeCompare(nameOf(b));
      }
      return nameOf(a).localeCompare(nameOf(b));
    });
  }, [holders, search, typeFilter, classFilter, statusFilter, sort, cardByKey]);

  const stats = useMemo(() => {
    const filed = holders.filter((holder) => cardByKey.has(holderKey(holder.holderType, holder.holderRef)));
    const withPhoto = filed.filter((holder) => cardByKey.get(holderKey(holder.holderType, holder.holderRef))?.hasPhoto);
    return {
      people: holders.length,
      filed: filed.length,
      withPhoto: withPhoto.length,
      awaiting: holders.length - filed.length,
    };
  }, [holders, cardByKey]);

  const openDesigner = useCallback(
    async (holder: IdCardHolder) => {
      const key = holderKey(holder.holderType, holder.holderRef);
      setOpening(key);
      setNotice(null);
      const filed = cardByKey.get(key);
      let initial = blankCard(holder);
      if (filed) {
        initial = cardInput(filed);
        // The list travels without photographs. Ask for this one card whole.
        if (filed.hasPhoto && !filed.photo) {
          const whole = await loadCards(holder.holderType, [holder.holderRef]);
          const full = whole.cards.find((card) => holderKey(card.holderType, card.holderRef) === key);
          if (full) initial = cardInput(full);
          else if (whole.reason) setNotice({ tone: "warn", text: `The photograph on file could not be read: ${whole.reason}. The card opens without it.` });
        }
      }
      setOpening(null);
      setDesigner({ holder, initial });
    },
    [cardByKey, loadCards],
  );

  useEffect(() => {
    if (!asked || deepLinkTaken.current) return;
    const holder = holderByKey.get(holderKey(asked.type, asked.ref));
    if (!holder) return;
    deepLinkTaken.current = true;
    void openDesigner(holder);
  }, [asked, holderByKey, openDesigner]);

  const toggle = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allShownSelected = shown.length > 0 && shown.every((holder) => selected.has(holderKey(holder.holderType, holder.holderRef)));

  const preparePrint = async (keys: string[]) => {
    if (keys.length === 0 || preparing) return;
    if (keys.length > MAX_RUN) {
      setNotice({ tone: "warn", text: `${keys.length} cards were asked for at once. The school's records release ${MAX_RUN} photographs at a time — print them in smaller runs.` });
      return;
    }
    setPreparing(true);
    setNotice(null);

    const wanted = keys.map((key) => holderByKey.get(key)).filter((holder): holder is IdCardHolder => Boolean(holder));
    const items: PrintItem[] = [];
    let readProblem: string | null = null;

    for (const type of ["student", "staff"] as const) {
      const refs = wanted.filter((holder) => holder.holderType === type).map((holder) => holder.holderRef);
      if (refs.length === 0) continue;
      const whole = await loadCards(type, refs);
      if (whole.reason) readProblem = whole.reason;
      const byRef = new Map(whole.cards.map((card) => [card.holderRef, card]));
      for (const holder of wanted.filter((entry) => entry.holderType === type)) {
        const card = byRef.get(holder.holderRef) ?? cardByKey.get(holderKey(type, holder.holderRef));
        items.push({ holder, card: card ? cardInput(card) : blankCard(holder), filed: Boolean(card) });
      }
    }

    items.sort((a, b) => {
      if (sheetOrder === "name") return (a.holder.holderName || a.holder.holderRef).localeCompare(b.holder.holderName || b.holder.holderRef);
      if (sheetOrder === "class") return `${a.holder.holderType} ${a.holder.firstValue}`.localeCompare(`${b.holder.holderType} ${b.holder.firstValue}`, undefined, { numeric: true });
      const stock = ID_CARD_LAYOUTS.findIndex((option) => option.key === a.card.layout) - ID_CARD_LAYOUTS.findIndex((option) => option.key === b.card.layout);
      return stock || (a.holder.holderName || a.holder.holderRef).localeCompare(b.holder.holderName || b.holder.holderRef);
    });

    const unfiled = items.filter((item) => !item.filed).length;
    const noPhoto = items.filter((item) => !item.card.photo).length;
    setPreparing(false);
    setPrintJob(items);
    if (readProblem) {
      setNotice({ tone: "warn", text: `Some photographs could not be read (${readProblem}). Those cards print with the register's details and an empty photograph frame.` });
    } else if (unfiled > 0 || noPhoto > 0) {
      setNotice({
        tone: "warn",
        text: [
          unfiled > 0 ? `${unfiled} of ${items.length} have no card filed yet` : "",
          noPhoto > 0 ? `${noPhoto} print without a photograph` : "",
        ].filter(Boolean).join("; ") + ". Design those cards first if the run is meant to be finished.",
      });
    }
  };

  // The sheet is in the DOM before the paper is asked for, but a data-URL
  // photograph still has to decode and the card fonts have to be ready, or the
  // first sheet comes out with empty frames.
  useEffect(() => {
    if (!printJob) return;
    let cancelled = false;
    const run = async () => {
      await printCardSheet();
      if (cancelled) return;
      setPrintJob(null);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [printJob]);

  const withdraw = async (card: IdCardRecord) => {
    if (!canFile) return;
    if (!confirm(`Withdraw the card filed for ${card.holderName || card.holderRef}? The photograph goes with it.`)) return;
    const outcome = await withdrawCard(card.holderType, card.holderRef);
    setNotice(
      outcome.ok
        ? { tone: "good", text: outcome.removed > 0 ? `Card withdrawn; ${outcome.removed} record removed from the school's files.` : "No card for that holder was on the school's records." }
        : { tone: "warn", text: `The card was not withdrawn: ${outcome.reason ?? "the school's records refused it"}.` },
    );
  };

  const selectedKeys = Array.from(selected).filter((key) => holderByKey.has(key));
  const previewItems = selectedKeys.slice(0, 3).map((key) => {
    const holder = holderByKey.get(key) as IdCardHolder;
    const card = cardByKey.get(key);
    return { holder, card: card ? cardInput(card) : blankCard(holder) };
  });

  const selectClass = (className: string) => {
    const keys = holders
      .filter((holder) => holder.holderType === "student" && holder.firstValue === className)
      .map((holder) => holderKey(holder.holderType, holder.holderRef));
    setSelected((current) => new Set([...current, ...keys]));
  };

  return (
    <DashboardShell>
      <div className="space-y-5 pb-24 xl:pb-0">
        {/* head */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-600 to-night-800 text-white texture-grid-light">
          <div className="relative p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">
                  <Link href="/operations/students" className="hover:text-white inline-flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" />
                    Students
                  </Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/operations/staff" className="hover:text-white">Staff</Link>
                </div>
                <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
                  <CreditCard className="w-7 h-7 text-azure-300 flex-shrink-0" />
                  Identity Cards
                </h1>
                <p className="mt-1.5 text-sm text-white/80 max-w-2xl leading-relaxed">
                  Photograph, frame and print a card for every pupil and every member of staff. Cards are filed on the
                  school&apos;s own records, so the office and the gate print the same one.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void reloadIdCards()}
                className="px-3 py-2 rounded-lg bg-white/12 hover:bg-white/20 ring-1 ring-inset ring-white/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer print:hidden"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload cards
              </button>
            </div>

            <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: "On the register", value: stats.people, tone: "text-white" },
                { label: "Cards filed", value: stats.filed, tone: "text-azure-300" },
                { label: "With a photograph", value: stats.withPhoto, tone: "text-emerald-300" },
                { label: "Still awaiting a card", value: stats.awaiting, tone: "text-accent-300" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 px-3 py-2.5">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/65 leading-tight">{stat.label}</dt>
                  <dd className={`mt-0.5 text-2xl font-extrabold font-mono tabular-nums ${stat.tone}`}>{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {!cardsLoading && cardsSource === "none" && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-950 flex items-start gap-2 print:hidden">
            <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong>The card store is not readable here</strong> — {cardsReason ?? "the school's records could not be reached"}.
              You can still design and print a card for anybody on the register, but nothing designed on this machine
              will reach another until the store is reachable and the card is filed.
            </p>
          </div>
        )}

        {notice && (
          <div
            className={`rounded-xl border px-4 py-3 text-[12px] font-semibold leading-snug print:hidden ${
              notice.tone === "good" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-950"
            }`}
          >
            {notice.text}
          </div>
        )}

        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
          {/* register */}
          <div className="rounded-2xl border border-hairline bg-white shadow-xs overflow-hidden print:hidden">
            <div className="p-4 border-b border-hairline space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search a name, admission number, staff ID, class or card serial"
                  className="w-full rounded-xl border border-hairline bg-canvas pl-9 pr-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Whose</span>
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as "all" | IdCardHolderType)}
                    className="w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand-500"
                  >
                    <option value="all">Everyone</option>
                    <option value="student">Pupils</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Card</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    className="w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand-500"
                  >
                    <option value="all">Any state</option>
                    <option value="filed">Filed</option>
                    <option value="unfiled">Not filed yet</option>
                    <option value="nophoto">No photograph</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Class</span>
                  <select
                    value={classFilter}
                    onChange={(event) => setClassFilter(event.target.value)}
                    className="w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand-500"
                  >
                    <option value="all">All classes</option>
                    {classOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Order</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortKey)}
                    className="w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand-500"
                  >
                    <option value="name">Name A–Z</option>
                    <option value="number">Number</option>
                    <option value="class">Class then name</option>
                    <option value="recent">Recently filed</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    disabled={shown.length === 0}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        for (const holder of shown) {
                          const key = holderKey(holder.holderType, holder.holderRef);
                          if (allShownSelected) next.delete(key);
                          else next.add(key);
                        }
                        return next;
                      })
                    }
                    className="w-4 h-4 accent-brand-600 cursor-pointer"
                  />
                  Select all {shown.length} shown
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {classFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => selectClass(classFilter)}
                      className="px-2.5 py-1 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-[11px] font-bold cursor-pointer hover:bg-brand-100"
                    >
                      Select the whole of {classFilter}
                    </button>
                  )}
                  {selected.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="px-2.5 py-1 rounded-lg border border-hairline bg-white text-muted text-[11px] font-bold cursor-pointer hover:bg-slate-50"
                    >
                      Clear {selected.size} selected
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[820px]">
                <thead>
                  <tr className="bg-canvas text-[10px] uppercase tracking-wider text-muted">
                    <th className="py-2.5 px-3 text-left font-extrabold w-8" />
                    <th className="py-2.5 px-3 text-left font-extrabold">Person</th>
                    <th className="py-2.5 px-3 text-left font-extrabold">Class / designation</th>
                    <th className="py-2.5 px-3 text-left font-extrabold">Card on file</th>
                    <th className="py-2.5 px-3 text-left font-extrabold">Photograph</th>
                    <th className="py-2.5 px-3 text-right font-extrabold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {shown.map((holder) => {
                    const key = holderKey(holder.holderType, holder.holderRef);
                    const card = cardByKey.get(key);
                    return (
                      <tr key={key} className={`hover:bg-brand-50/50 transition-colors ${selected.has(key) ? "bg-brand-50" : ""}`}>
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onChange={() => toggle(key)}
                            aria-label={`Select ${holder.holderName || holder.holderRef}`}
                            className="w-4 h-4 accent-brand-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-extrabold text-ink leading-tight">{holder.holderName || "Name not on the register"}</p>
                          <p className="font-mono text-[10px] text-brand-700 font-bold">
                            {holder.holderRef}
                            <span className="ml-1.5 text-muted font-sans uppercase tracking-wider">{HOLDER_WORDS[holder.holderType].plural}</span>
                          </p>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-ink leading-tight">{holder.firstValue || "—"}</p>
                          {holder.tag && <p className="text-[10px] text-muted font-semibold">{holder.tag}</p>}
                        </td>
                        <td className="py-2.5 px-3">
                          {card ? (
                            <>
                              <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full ${card.id ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                                {card.id ? "Filed" : "This tab only"}
                              </span>
                              <p className="mt-0.5 text-[10px] text-muted font-semibold">
                                {layoutSpec(card.layout).label} · {themeSpec(card.theme).label}
                              </p>
                              {card.cardNo && <p className="font-mono text-[10px] text-brand-700">{card.cardNo}</p>}
                            </>
                          ) : (
                            <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-accent-100 text-accent-700">
                              No card yet
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {card?.hasPhoto ? (
                            <span className="text-[11px] font-bold text-emerald-700">
                              {card.photo ? "Loaded" : "On file"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted">
                              <ImageOff className="w-3.5 h-3.5" />
                              None
                            </span>
                          )}
                          {card?.updatedAt && (
                            <p className="text-[10px] text-muted">{cardDateLabel(card.updatedAt.slice(0, 10))}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void openDesigner(holder)}
                              disabled={opening !== null}
                              className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-extrabold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {opening === key && <Loader2 className="w-3 h-3 animate-spin" />}
                              {card ? "Correct card" : "Design card"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void preparePrint([key])}
                              disabled={preparing}
                              title={`Print the card for ${holder.holderName || holder.holderRef}`}
                              className="p-1.5 rounded-lg border border-hairline text-muted hover:text-brand-700 hover:border-brand-300 cursor-pointer disabled:opacity-50"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 px-4 text-center">
                        <Users className="w-8 h-8 mx-auto text-brand-200" />
                        <p className="mt-2 font-extrabold text-ink">
                          {holders.length === 0 ? "Nobody is on the register yet" : "Nobody matches these filters"}
                        </p>
                        <p className="mt-1 text-xs text-muted max-w-md mx-auto leading-relaxed">
                          {holders.length === 0 ? (
                            <>
                              Cards are drawn for people the school has already enrolled or employed. Add them under{" "}
                              <Link href="/operations/students" className="text-brand-700 font-bold underline">Students</Link> or{" "}
                              <Link href="/operations/staff" className="text-brand-700 font-bold underline">Staff</Link>, then come back.
                            </>
                          ) : (
                            "Clear the search or widen the filters to see the rest of the register."
                          )}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* print run */}
          <aside className="rounded-2xl border border-brand-600/25 bg-white shadow-xs overflow-hidden xl:sticky xl:top-24 print:hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-brand-700 to-brand-600 text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-azure-300" />
              <h2 className="font-extrabold text-sm">Print run</h2>
              <span className="ml-auto font-mono text-xs font-extrabold bg-white/15 rounded-full px-2 py-0.5 tabular-nums">
                {selectedKeys.length}
              </span>
            </div>
            <div className="p-4 space-y-3.5">
              {selectedKeys.length === 0 ? (
                <p className="text-[12px] text-muted leading-relaxed">
                  Tick the people whose cards you want. Cards are laid out front and reverse side by side on A4, ready
                  to cut and laminate — a run of CR80 vertical cards fits three to a sheet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 justify-center rounded-xl bg-canvas border border-hairline p-3">
                  {previewItems.map(({ holder, card }) => {
                    const spec = layoutSpec(card.layout);
                    const scale = 44 / spec.widthMm;
                    return (
                      <div key={holderKey(holder.holderType, holder.holderRef)} style={{ width: `${spec.widthMm * scale}px`, height: `${spec.heightMm * scale}px`, position: "relative" }}>
                        <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale / 3.7795})`, transformOrigin: "top left" }}>
                          <IdCardArtwork holder={holder} card={card} school={school} side="front" />
                        </div>
                      </div>
                    );
                  })}
                  {selectedKeys.length > previewItems.length && (
                    <span className="self-center text-[11px] font-bold text-muted">+{selectedKeys.length - previewItems.length} more</span>
                  )}
                </div>
              )}

              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[11px] font-bold text-ink">Print the reverses too</span>
                <input type="checkbox" checked={printBacks} onChange={(event) => setPrintBacks(event.target.checked)} className="w-4 h-4 accent-brand-600 cursor-pointer" />
              </label>
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[11px] font-bold text-ink">Dashed cut guides</span>
                <input type="checkbox" checked={cutGuides} onChange={(event) => setCutGuides(event.target.checked)} className="w-4 h-4 accent-brand-600 cursor-pointer" />
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Order on the sheet</span>
                <select
                  value={sheetOrder}
                  onChange={(event) => setSheetOrder(event.target.value as "stock" | "name" | "class")}
                  className="w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand-500"
                >
                  <option value="stock">Group by card stock</option>
                  <option value="name">Name A–Z</option>
                  <option value="class">Class then name</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => void preparePrint(selectedKeys)}
                disabled={selectedKeys.length === 0 || preparing}
                className="w-full px-3 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-extrabold cursor-pointer shadow-sm disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {preparing ? "Loading photographs…" : `Print ${selectedKeys.length || ""} ${selectedKeys.length === 1 ? "card" : "cards"}`}
              </button>
              <p className="text-[10px] text-muted leading-snug">
                Set the printer to A4, actual size (100%), and turn on background graphics — the colourway is part of
                the card. {MAX_RUN} cards is the most one run releases.
              </p>
            </div>
          </aside>
        </div>

        {/* cards whose holder has left */}
        {orphaned.length > 0 && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 print:hidden">
            <h2 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-amber-700" />
              {orphaned.length} card{orphaned.length === 1 ? "" : "s"} filed for somebody no longer on the register
            </h2>
            <p className="mt-1 text-[12px] text-amber-900 leading-relaxed">
              A card holds a photograph. When somebody leaves the school, withdraw theirs rather than leaving it on file.
            </p>
            <ul className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {orphaned.map((card) => (
                <li key={holderKey(card.holderType, card.holderRef)} className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-bold text-ink text-xs truncate">{card.holderName || card.holderRef}</p>
                    <p className="font-mono text-[10px] text-muted truncate">
                      {card.holderRef} · {HOLDER_WORDS[card.holderType].plural}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void withdraw(card)}
                    disabled={!canFile}
                    title={canFile ? "Withdraw this card" : "Only the superintendent or the exam office may withdraw a card"}
                    className="p-1.5 rounded-lg border border-accent-200 bg-accent-100 text-accent-700 hover:bg-accent-200 cursor-pointer disabled:opacity-40 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* the desk, when one person is being framed */}
      {designer && (
        <IdCardDesigner
          holder={designer.holder}
          initial={designer.initial}
          school={school}
          canFile={canFile}
          onClose={() => setDesigner(null)}
          onFiled={() => void reloadIdCards()}
        />
      )}

      {/* One sheet at a time: the designer owns the paper while it is open. */}
      {!designer && (
        <IdCardPrintPortal>
          <div className={`id-card-sheet ${cutGuides ? "id-card-cut" : ""}`}>
            {(printJob ?? []).map((item) => (
              <div className="id-card-pair" key={holderKey(item.holder.holderType, item.holder.holderRef)}>
                <IdCardArtwork holder={item.holder} card={item.card} school={school} side="front" />
                {printBacks && item.card.showBack && (
                  <IdCardArtwork holder={item.holder} card={item.card} school={school} side="back" />
                )}
              </div>
            ))}
          </div>
        </IdCardPrintPortal>
      )}

      {/* the primary action stays reachable on a phone */}
      {selectedKeys.length > 0 && !designer && (
        <div className="xl:hidden fixed bottom-0 inset-x-0 z-30 border-t border-brand-600/30 bg-white/95 backdrop-blur px-4 py-2.5 flex items-center gap-3 print:hidden">
          <span className="text-xs font-extrabold text-ink">
            {selectedKeys.length} selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[11px] font-bold text-muted cursor-pointer hover:text-ink"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void preparePrint(selectedKeys)}
            disabled={preparing}
            className="ml-auto px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Print
          </button>
        </div>
      )}
    </DashboardShell>
  );
}