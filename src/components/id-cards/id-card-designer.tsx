"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Camera,
  Check,
  CreditCard,
  Crosshair,
  ImagePlus,
  Loader2,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { IdCardArtwork, type CardSchool } from "./id-card-artwork";
import { IdCardPrintPortal, printCardSheet } from "./print-portal";
import { useRealtimeIdCards } from "@/lib/realtime-store";
import {
  BLOOD_GROUPS,
  DEFAULT_BACK_NOTES,
  HOLDER_WORDS,
  ID_CARD_LAYOUTS,
  ID_CARD_THEMES,
  PHOTO_ACCEPT,
  isDateValue,
  layoutSpec,
  plusOneYear,
  readPhotoFile,
  suggestCardNo,
  type IdCardHolder,
  type IdCardInput,
} from "@/lib/id-cards";

/** Reserves the scaled size so a preview at 1.6× pushes the layout, not overlaps it. */
function ScaledCard({ scale, widthMm, heightMm, children }: { scale: number; widthMm: number; heightMm: number; children: ReactNode }) {
  return (
    <div style={{ width: `${widthMm * scale}mm`, height: `${heightMm * scale}mm`, position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

function RailSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-hairline pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-800">{title}</h4>
        {hint && <span className="text-[10px] font-semibold text-muted">{hint}</span>}
      </div>
      <div className="mt-2 space-y-2.5">{children}</div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
        <span className="font-mono text-[11px] font-extrabold text-brand-700 tabular-nums">
          {value.toFixed(step < 1 ? 2 : 0)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-brand-600 cursor-pointer"
      />
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";
const labelClass = "block text-[10px] font-bold uppercase tracking-wider text-muted mb-1";
const smallButton =
  "px-2.5 py-1 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-[11px] font-bold cursor-pointer hover:bg-brand-100 transition-colors";

export interface IdCardDesignerProps {
  holder: IdCardHolder;
  initial: IdCardInput;
  school: CardSchool;
  /** The QA login may design and print, but the server refuses its filing. */
  canFile: boolean;
  onClose: () => void;
  onFiled: (card: IdCardInput, saved: "server" | "session") => void;
}

/**
 * The card desk: the person on the left, every adjustment on the right.
 *
 * Nothing here is a settings dialog behind a gear — the photograph, its framing,
 * the stock, the colourway and the wording are all on the rail and all applied to
 * the card the moment they move, because the clerk is looking at the thing they
 * are about to hand a child.
 */
export function IdCardDesigner({ holder, initial, school, canFile, onClose, onFiled }: IdCardDesignerProps) {
  const { fileCard } = useRealtimeIdCards();
  const [draft, setDraft] = useState<IdCardInput>(initial);
  const [side, setSide] = useState<"front" | "back">("front");
  const [scale, setScale] = useState(initial.layout === "badge" ? 1 : 1.25);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoInfo, setPhotoInfo] = useState<string | null>(
    initial.photo ? `${Math.round(initial.photo.length / 1024)} kB already on file` : null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const words = HOLDER_WORDS[holder.holderType];
  const spec = layoutSpec(draft.layout);

  const set = useCallback(<K extends keyof IdCardInput>(key: K, value: IdCardInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const problem = useMemo(() => {
    if (draft.issuedOn && !isDateValue(draft.issuedOn)) return "The issue date is not a real calendar date.";
    if (draft.expiresOn && !isDateValue(draft.expiresOn)) return "The expiry date is not a real calendar date.";
    if (draft.issuedOn && draft.expiresOn && draft.expiresOn <= draft.issuedOn) {
      return "The card cannot expire on or before the day it was issued. Move the expiry date, or clear it.";
    }
    return null;
  }, [draft.issuedOn, draft.expiresOn]);

  const takePhoto = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setPhotoBusy(true);
      setPhotoError(null);
      setNotice(null);
      try {
        const photo = await readPhotoFile(file);
        setDraft((current) => ({ ...current, photo: photo.dataUrl, photoZoom: 1, photoX: 0, photoY: 0 }));
        setPhotoInfo(`${photo.width} × ${photo.height} px · ${Math.round(photo.dataUrl.length / 1024)} kB`);
        setSide("front");
      } catch (error) {
        setPhotoError(error instanceof Error ? error.message : "That photograph could not be opened.");
      } finally {
        setPhotoBusy(false);
        if (galleryRef.current) galleryRef.current.value = "";
        if (cameraRef.current) cameraRef.current.value = "";
      }
    },
    [],
  );

  const save = async () => {
    if (problem || saving) return;
    setSaving(true);
    setNotice(null);
    const outcome = await fileCard({ ...draft, holderName: holder.holderName });
    setSaving(false);
    if (outcome.saved === "server") {
      setNotice({ tone: "good", text: `Filed on the school's records. Every machine now prints this card for ${holder.holderName || holder.holderRef}.` });
    } else {
      setNotice({
        tone: "warn",
        text: `Not filed: ${outcome.reason ?? "the school's records refused it"}. The card is held in this tab so you can still print it, but leaving this screen loses it.`,
      });
    }
    onFiled(draft, outcome.saved);
  };

  const otherSide = side === "front" ? "back" : "front";
  const showOther = otherSide === "front" || draft.showBack;

  return (
    <div className="fixed inset-0 z-50 bg-scrim/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in print:hidden">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="id-card-designer-title"
        className="bg-canvas rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col border border-brand-600/25 shadow-2xl outline-none overflow-hidden zoom-in-95"
      >
        {/* head */}
        <div className="flex-shrink-0 flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 bg-gradient-to-r from-brand-800 via-brand-600 to-night-800 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-white/12 ring-1 ring-inset ring-white/25 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-azure-300" />
            </span>
            <div className="min-w-0">
              <h3 id="id-card-designer-title" className="font-extrabold text-sm sm:text-base truncate">
                {holder.holderName || holder.holderRef}
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70 truncate">
                {words.card} · {words.number} {holder.holderRef} · {spec.widthMm} × {spec.heightMm} mm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the card designer"
            className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* preview */}
          <div className="relative texture-grid bg-gradient-to-br from-slate-100 via-canvas to-brand-50 p-4 sm:p-6 lg:overflow-y-auto lg:min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="inline-flex rounded-lg border border-hairline bg-white p-0.5 shadow-xs">
                {(["front", "back"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSide(value)}
                    disabled={value === "back" && !draft.showBack}
                    className={`px-3 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      side === value ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:text-brand-700"
                    }`}
                  >
                    {value === "front" ? "Front" : "Reverse"}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                Preview
                <input
                  type="range"
                  min={0.6}
                  max={2}
                  step={0.05}
                  value={scale}
                  onChange={(event) => setScale(Number(event.target.value))}
                  className="w-24 sm:w-32 accent-brand-600 cursor-pointer"
                />
                <span className="font-mono text-brand-700 tabular-nums">{Math.round(scale * 100)}%</span>
              </label>
            </div>

            <div className="flex flex-wrap items-start justify-center gap-5 sm:gap-8">
              <figure className="m-0">
                <ScaledCard scale={scale} widthMm={spec.widthMm} heightMm={spec.heightMm}>
                  <IdCardArtwork holder={holder} card={draft} school={school} side={side} section={holder.section} />
                </ScaledCard>
                <figcaption className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  {side === "front" ? "Front" : "Reverse"} · actual size × {scale.toFixed(2)}
                </figcaption>
              </figure>

              {showOther && (
                <figure className="m-0">
                  <button
                    type="button"
                    onClick={() => setSide(otherSide)}
                    title={`Show the ${otherSide === "front" ? "front" : "reverse"} full size`}
                    className="block cursor-pointer rounded-[3mm] ring-1 ring-brand-600/20 hover:ring-4 hover:ring-brand-500/35 transition-all"
                  >
                    <ScaledCard scale={scale * 0.5} widthMm={spec.widthMm} heightMm={spec.heightMm}>
                      <IdCardArtwork holder={holder} card={draft} school={school} side={otherSide} section={holder.section} />
                    </ScaledCard>
                  </button>
                  <figcaption className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    {otherSide === "front" ? "Front" : "Reverse"} · click to flip
                  </figcaption>
                </figure>
              )}
            </div>

            <p className="mt-5 text-[11px] leading-relaxed text-muted max-w-xl mx-auto text-center">
              Drawn at its true millimetre size, so what you frame here is what the printer puts on the card. The name,
              the {holder.holderType === "student" ? "class and house" : "designation and class"} are read from the register
              every time — a promoted pupil&apos;s card is correct without re-filing it.
            </p>
          </div>

          {/* control rail */}
          <div className="bg-white border-t lg:border-t-0 lg:border-l border-hairline p-4 space-y-3.5 lg:overflow-y-auto lg:min-h-0">
            <RailSection title="Photograph" hint={photoInfo ?? "none filed"}>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  void takePhoto(event.dataTransfer.files?.[0]);
                }}
                className={`rounded-xl border-2 border-dashed p-3 text-center transition-colors ${
                  dragOver ? "border-brand-500 bg-brand-50" : "border-brand-200 bg-brand-50/40"
                }`}
              >
                <input
                  ref={galleryRef}
                  type="file"
                  accept={PHOTO_ACCEPT}
                  className="sr-only"
                  onChange={(event) => void takePhoto(event.target.files?.[0])}
                />
                <input
                  ref={cameraRef}
                  type="file"
                  accept={PHOTO_ACCEPT}
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => void takePhoto(event.target.files?.[0])}
                />
                {photoBusy ? (
                  <p className="flex items-center justify-center gap-2 text-[11px] font-bold text-brand-700 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Shrinking the photograph…
                  </p>
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5 mx-auto text-brand-500" />
                    <p className="mt-1 text-[11px] font-semibold text-muted leading-snug">
                      Drop a photograph here, or
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                      <button type="button" onClick={() => galleryRef.current?.click()} className={smallButton}>
                        <Upload className="w-3 h-3 inline -mt-0.5 mr-1" />
                        Choose file
                      </button>
                      <button type="button" onClick={() => cameraRef.current?.click()} className={smallButton}>
                        <Camera className="w-3 h-3 inline -mt-0.5 mr-1" />
                        Take one
                      </button>
                      {draft.photo && (
                        <button
                          type="button"
                          onClick={() => {
                            set("photo", "");
                            setPhotoInfo(null);
                            setPhotoError(null);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-accent-200 bg-accent-100 text-accent-700 text-[11px] font-bold cursor-pointer hover:bg-accent-200 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 inline -mt-0.5 mr-1" />
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-muted leading-snug">
                      JPEG, PNG or WebP. Shrunk to 720 px and kept on the school&apos;s own records — never a public link.
                    </p>
                  </>
                )}
              </div>
              {photoError && (
                <p className="rounded-lg bg-accent-100 border border-accent-200 px-2.5 py-2 text-[11px] font-semibold text-accent-700 leading-snug">
                  {photoError}
                </p>
              )}
            </RailSection>

            <RailSection title="Framing" hint={draft.photo ? "live" : "needs a photograph"}>
              <div className={draft.photo ? "" : "opacity-45 pointer-events-none"}>
                <div className="space-y-2.5">
                  <Slider label="Zoom" value={draft.photoZoom} min={1} max={3} step={0.05} suffix="×" onChange={(value) => set("photoZoom", value)} />
                  <Slider label="Move left / right" value={draft.photoX} min={-50} max={50} step={1} suffix="%" onChange={(value) => set("photoX", value)} />
                  <Slider label="Move up / down" value={draft.photoY} min={-50} max={50} step={1} suffix="%" onChange={(value) => set("photoY", value)} />
                </div>
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, photoZoom: 1, photoX: 0, photoY: 0 }))}
                  className={`${smallButton} mt-2`}
                >
                  <Crosshair className="w-3 h-3 inline -mt-0.5 mr-1" />
                  Centre the face
                </button>
              </div>
            </RailSection>

            <RailSection title="Card stock">
              <div className="grid grid-cols-3 gap-1.5">
                {ID_CARD_LAYOUTS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      set("layout", option.key);
                      setScale(option.key === "badge" ? 1 : 1.25);
                    }}
                    title={option.note}
                    className={`rounded-lg border px-1.5 py-2 text-center cursor-pointer transition-colors ${
                      draft.layout === option.key
                        ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                        : "border-hairline bg-white text-muted hover:border-brand-300 hover:text-brand-700"
                    }`}
                  >
                    <span
                      className={`mx-auto block rounded-[2px] border-2 ${draft.layout === option.key ? "border-white/80" : "border-current"}`}
                      style={{
                        width: option.key === "landscape" ? "26px" : "17px",
                        height: option.key === "landscape" ? "17px" : option.key === "badge" ? "26px" : "24px",
                      }}
                    />
                    <span className="mt-1 block text-[10px] font-extrabold leading-tight">{option.label}</span>
                    <span className="block text-[9px] font-mono opacity-75 leading-tight">
                      {option.widthMm}×{option.heightMm}
                    </span>
                  </button>
                ))}
              </div>
            </RailSection>

            <RailSection title="Colourway">
              <div className="grid grid-cols-2 gap-1.5">
                {ID_CARD_THEMES.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => set("theme", option.key)}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer transition-colors ${
                      draft.theme === option.key ? "border-brand-600 ring-2 ring-brand-500/25" : "border-hairline hover:border-brand-300"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-md ring-1 ring-inset ring-black/10 flex-shrink-0" style={{ background: option.swatch }} />
                    <span className="text-[10px] font-bold text-ink leading-tight text-left">{option.label}</span>
                    {draft.theme === option.key && <Check className="w-3.5 h-3.5 text-brand-600 ml-auto flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </RailSection>

            <RailSection title="Identity">
              <div>
                <span className={labelClass}>Card serial</span>
                <div className="flex gap-1.5">
                  <input
                    value={draft.cardNo}
                    maxLength={60}
                    onChange={(event) => set("cardNo", event.target.value)}
                    placeholder="Not yet numbered"
                    className={`${inputClass} font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => set("cardNo", suggestCardNo(holder.holderType, holder.holderRef, holder.session))}
                    className={`${smallButton} whitespace-nowrap`}
                  >
                    Suggest
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className={labelClass}>Blood group</span>
                  <select value={draft.bloodGroup} onChange={(event) => set("bloodGroup", event.target.value)} className={inputClass}>
                    {BLOOD_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group || "Not stated"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>{words.number}</span>
                  <input value={holder.holderRef} readOnly className={`${inputClass} font-mono bg-slate-50 text-muted`} />
                </label>
              </div>
              <p className="text-[10px] text-muted leading-snug">
                Leave the blood group blank rather than guess — the gate reads this in an emergency.
              </p>
            </RailSection>

            <RailSection title="Validity">
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className={labelClass}>Issued on</span>
                  <input type="date" value={draft.issuedOn} onChange={(event) => set("issuedOn", event.target.value)} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Expires on</span>
                  <input type="date" value={draft.expiresOn} onChange={(event) => set("expiresOn", event.target.value)} className={inputClass} />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => set("expiresOn", plusOneYear(draft.issuedOn))} className={smallButton}>
                  One year from issue
                </button>
                <button type="button" onClick={() => set("expiresOn", "")} className={smallButton}>
                  No expiry
                </button>
              </div>
            </RailSection>

            <RailSection title="In an emergency">
              <label className="block">
                <span className={labelClass}>{holder.holderType === "student" ? "Guardian" : "Next of kin"}</span>
                <input
                  value={draft.emergencyName}
                  maxLength={160}
                  onChange={(event) => set("emergencyName", event.target.value)}
                  placeholder="Who to call"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Telephone</span>
                <input
                  value={draft.emergencyPhone}
                  maxLength={40}
                  inputMode="tel"
                  onChange={(event) => set("emergencyPhone", event.target.value)}
                  placeholder="Number the gate can ring"
                  className={`${inputClass} font-mono`}
                />
              </label>
              {holder.guardianPhone && draft.emergencyPhone !== holder.guardianPhone && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({ ...current, emergencyName: holder.guardianName, emergencyPhone: holder.guardianPhone }))
                  }
                  className={smallButton}
                >
                  Use the register&apos;s {holder.holderType === "student" ? "guardian" : "contact"}: {holder.guardianPhone}
                </button>
              )}
            </RailSection>

            <RailSection title="Reverse of the card">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[11px] font-bold text-ink">Print the reverse</span>
                <input
                  type="checkbox"
                  checked={draft.showBack}
                  onChange={(event) => {
                    set("showBack", event.target.checked);
                    if (!event.target.checked) setSide("front");
                  }}
                  className="w-4 h-4 accent-brand-600 cursor-pointer"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Conditions printed on the back</span>
                <textarea
                  value={draft.backNotes}
                  rows={4}
                  maxLength={1200}
                  onChange={(event) => set("backNotes", event.target.value)}
                  className={`${inputClass} leading-relaxed font-medium resize-y`}
                />
              </label>
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => set("backNotes", DEFAULT_BACK_NOTES)} className={smallButton}>
                  Standard wording
                </button>
                <span className="text-[10px] font-mono text-muted tabular-nums">{draft.backNotes.length}/1200</span>
              </div>
            </RailSection>
          </div>
        </div>

        {/* foot */}
        <div className="flex-shrink-0 border-t border-hairline bg-white px-4 sm:px-5 py-3 space-y-2.5">
          {problem && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-[11px] font-semibold text-amber-950 leading-snug">
              <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-px" />
              {problem}
            </p>
          )}
          {notice && (
            <p
              className={`rounded-lg border px-3 py-2 text-[11px] font-semibold leading-snug ${
                notice.tone === "good"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-amber-50 border-amber-300 text-amber-950"
              }`}
            >
              {notice.text}
            </p>
          )}
          {!canFile && (
            <p className="rounded-lg bg-slate-100 border border-hairline px-3 py-2 text-[11px] font-semibold text-muted leading-snug">
              This login may design and print a card, but the school&apos;s records only accept one filed by the
              superintendent or the exam office.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(initial);
                setPhotoError(null);
                setNotice(null);
                setPhotoInfo(initial.photo ? `${Math.round(initial.photo.length / 1024)} kB already on file` : null);
              }}
              className="px-3 py-2 rounded-lg border border-hairline bg-white text-muted text-xs font-bold cursor-pointer hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5 inline -mt-0.5 mr-1.5" />
              Reset changes
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void printCardSheet()}
                disabled={Boolean(problem)}
                className="px-3 py-2 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-xs font-bold cursor-pointer hover:bg-brand-100 disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print this card
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={Boolean(problem) || saving || !canFile}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-extrabold cursor-pointer shadow-sm disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? "Filing…" : "File on the school's records"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <IdCardPrintPortal>
        <div className="id-card-sheet">
          <div className="id-card-pair">
            <IdCardArtwork holder={holder} card={draft} school={school} side="front" section={holder.section} />
            {draft.showBack && <IdCardArtwork holder={holder} card={draft} school={school} side="back" section={holder.section} />}
          </div>
        </div>
      </IdCardPrintPortal>
    </div>
  );
}