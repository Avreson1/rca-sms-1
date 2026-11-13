"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import {
  HOLDER_WORDS,
  cardDateLabel,
  code39Bars,
  code39Modules,
  layoutSpec,
  themeSpec,
  type IdCardHolder,
  type IdCardInput,
  type IdCardLayout,
  type IdCardTheme,
  type IdCardThemeSpec,
} from "@/lib/id-cards";

export interface CardSchool {
  name: string;
  shortName: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

/**
 * The school's crown, drawn rather than photographed: a card printer reproduces
 * vector edges at 300 dpi where a scanned crest goes furry, and the mark has to
 * survive being shrunk to 4 mm on a lanyard card.
 */
function Crest({ mm, ink, accent }: { mm: number; ink: string; accent: string }) {
  return (
    <svg
      width={`${mm}mm`}
      height={`${mm}mm`}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      <path
        d="M16 1.6 28.4 6.1v9.2c0 7.2-5.1 12.4-12.4 15.1C8.7 27.7 3.6 22.5 3.6 15.3V6.1L16 1.6Z"
        fill={ink}
        fillOpacity="0.14"
        stroke={ink}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 18.4h14l-1.5-8.2-3.6 3.3L16 8.4l-1.9 5.1-3.6-3.3L9 18.4Z"
        fill={accent}
        stroke={accent}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <rect x="9" y="19.6" width="14" height="2.2" rx="1" fill={ink} />
      <circle cx="9.4" cy="9.6" r="1.3" fill={ink} />
      <circle cx="22.6" cy="9.6" r="1.3" fill={ink} />
      <circle cx="16" cy="7.2" r="1.3" fill={ink} />
    </svg>
  );
}

/** A scan-able Code 39 of the holder's own number, on the white the symbol needs. */
function Barcode({ value, heightMm }: { value: string; heightMm: number }) {
  const bars = code39Bars(value);
  const modules = code39Modules(value);
  if (bars.length === 0 || modules === 0) return null;
  return (
    <svg
      width="100%"
      height={`${heightMm}mm`}
      viewBox={`0 0 ${modules} 1`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Barcode of ${value}`}
      style={{ display: "block" }}
    >
      {bars.map((bar, index) => (
        <rect key={index} x={bar.x} y={0} width={bar.width} height={1} fill="#0a0e1c" />
      ))}
    </svg>
  );
}

/** The seal: a ring of the school's own name, printed as texture, not as a logo. */
function Seal({ mm, ink, label }: { mm: number; ink: string; label: string }) {
  const pathId = `seal${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const radius = mm * 0.36;
  const ring = `M ${mm / 2} ${mm / 2} m -${radius} 0 a ${radius} ${radius} 0 1 1 ${radius * 2} 0 a ${radius} ${radius} 0 1 1 -${radius * 2} 0`;
  return (
    <svg
      width={`${mm}mm`}
      height={`${mm}mm`}
      viewBox={`0 0 ${mm} ${mm}`}
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <path id={pathId} d={ring} />
      </defs>
      <circle cx={mm / 2} cy={mm / 2} r={mm * 0.46} fill="none" stroke={ink} strokeWidth={mm * 0.018} />
      <circle cx={mm / 2} cy={mm / 2} r={mm * 0.28} fill="none" stroke={ink} strokeWidth={mm * 0.012} />
      <text fill={ink} fontSize={mm * 0.1} fontFamily="Inter, sans-serif" fontWeight={700} letterSpacing={mm * 0.01}>
        <textPath href={`#${pathId}`} startOffset="0%">
          {`${label} • ${label} • `}
        </textPath>
      </text>
      <path
        d={`M ${mm * 0.36} ${mm * 0.58} h ${mm * 0.28} l -${mm * 0.03} -${mm * 0.16} l -${mm * 0.07} ${mm * 0.065} l -${mm * 0.04} -${mm * 0.1} l -${mm * 0.04} ${mm * 0.1} l -${mm * 0.07} -${mm * 0.065} Z`}
        fill={ink}
      />
    </svg>
  );
}

function Photograph({
  card,
  widthMm,
  colours,
}: {
  card: IdCardInput;
  widthMm: number;
  colours: IdCardThemeSpec;
}) {
  return (
    <div
      data-photo-frame=""
      style={{
        width: `${widthMm}mm`,
        height: "100%",
        minHeight: 0,
        borderRadius: "1.6mm",
        overflow: "hidden",
        background: colours.light ? "#e4ebfc" : "rgba(255,255,255,0.16)",
        border: `0.6mm solid ${colours.light ? "#ffffff" : "rgba(255,255,255,0.92)"}`,
        boxShadow: colours.light ? "0 0.3mm 1mm rgba(14,27,69,0.18)" : "0 0.4mm 1.4mm rgba(0,0,0,0.28)",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {card.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- the source is a data URL this browser shrank itself; there is no remote image for next/image to optimise, and its wrapper would break the millimetre frame.
        <img
          src={card.photo}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            transform: `scale(${card.photoZoom}) translate(${card.photoX}%, ${card.photoY}%)`,
            transformOrigin: "center center",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.8mm",
            color: colours.light ? "#4e5872" : "rgba(255,255,255,0.8)",
          }}
        >
          <svg width="7mm" height="7mm" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8.4" r="4.1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3.8 21c.7-4.3 4.1-6.6 8.2-6.6s7.5 2.3 8.2 6.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: "4pt", fontWeight: 700, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.2 }}>
            No photograph
            <br />
            filed
          </span>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  colours,
  mono = false,
  size = 5.4,
}: {
  label: string;
  value: string;
  colours: IdCardThemeSpec;
  mono?: boolean;
  size?: number;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: "4pt",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: colours.muted,
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: `${size}pt`,
          fontWeight: 700,
          color: colours.ink,
          lineHeight: 1.2,
          fontFamily: mono ? "'JetBrains Mono', ui-monospace, monospace" : undefined,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export interface IdCardArtworkProps {
  holder: IdCardHolder;
  card: IdCardInput;
  school: CardSchool;
  side: "front" | "back";
  layout?: IdCardLayout;
  theme?: IdCardTheme;
  section?: "PRIMARY" | "SECONDARY";
}

/**
 * One side of one card, at its true millimetre size.
 *
 * The same element draws the on-screen preview and the print sheet, so what the
 * clerk frames is what the laminator gets. Nothing is sized in pixels: a card is
 * 54 × 85.6 mm because that is the CR80 stock the school buys.
 *
 * Every layout is a grid whose photograph row is `minmax(0, 1fr)` and whose box
 * clips. A long name or a four-line address therefore takes space from the
 * photograph rather than pushing the barcode off the edge of the stock.
 */
export function IdCardArtwork({ holder, card, school, side, layout, theme, section }: IdCardArtworkProps) {
  const detectedSection: "PRIMARY" | "SECONDARY" =
    section ??
    holder.section ??
    (holder.firstValue?.toLowerCase().includes("jss") ||
    holder.firstValue?.toLowerCase().includes("sss") ||
    holder.firstValue?.toLowerCase().includes("secondary") ||
    holder.tag?.toLowerCase().includes("secondary")
      ? "SECONDARY"
      : "PRIMARY");

  const defaultThemeForSection: IdCardTheme =
    detectedSection === "SECONDARY" ? "secondary_crimson" : "primary_gold";

  const institutionName =
    detectedSection === "SECONDARY" ? "ROYAL CROWN HIGH SCHOOL" : (school.name || "ROYAL CROWN ACADEMY");

  const institutionMotto =
    detectedSection === "SECONDARY"
      ? "Excellence, Integrity & Leadership"
      : school.motto || "Excellence and Integrity";

  const spec = layoutSpec(layout ?? card.layout);
  const colours = themeSpec(theme ?? (card.theme === "royal" ? defaultThemeForSection : card.theme));
  const words = HOLDER_WORDS[holder.holderType];
  const landscape = spec.key === "landscape";
  const badge = spec.key === "badge";
  const pad = badge ? 4 : 3;
  const gap = 1.2;
  const expires = cardDateLabel(card.expiresOn);
  const issued = cardDateLabel(card.issuedOn);
  const sessionPair = holder.session.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  const sessionShort = sessionPair ? `${sessionPair[1]}/${sessionPair[2].slice(2)}` : holder.session;

  const shell: CSSProperties = {
    width: `${spec.widthMm}mm`,
    height: `${spec.heightMm}mm`,
    borderRadius: badge ? "2.6mm" : "2.2mm",
    overflow: "hidden",
    position: "relative",
    background: colours.field,
    color: colours.ink,
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    printColorAdjust: "exact",
    WebkitPrintColorAdjust: "exact",
    boxShadow: "0 0.2mm 0.8mm rgba(14,27,69,0.18)",
    flexShrink: 0,
  };

  const body = (rows: string, extra?: CSSProperties): CSSProperties => ({
    position: "relative",
    height: "100%",
    padding: `${pad}mm`,
    display: "grid",
    gridTemplateRows: rows,
    gap: `${gap}mm`,
    overflow: "hidden",
    ...extra,
  });

  const securityLayer = (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundImage:
          `radial-gradient(120% 80% at 12% 0%, rgba(255,255,255,${colours.light ? 0.9 : 0.22}) 0%, rgba(255,255,255,0) 58%),` +
          "repeating-linear-gradient(115deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 0.6px, rgba(0,0,0,0) 0.6px, rgba(0,0,0,0) 3.4px)",
      }}
    />
  );

  const ribbon = (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: badge ? "6.5mm" : "5mm",
        right: badge ? "-9mm" : "-8mm",
        width: "30mm",
        height: "4.4mm",
        transform: "rotate(45deg)",
        background: colours.accent,
        color: colours.accentInk,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "4.2pt",
        fontWeight: 800,
        letterSpacing: "0.08em",
        boxShadow: "0 0.2mm 0.6mm rgba(0,0,0,0.25)",
        zIndex: 2,
      }}
    >
      {sessionShort}
    </div>
  );

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: "1.6mm", minHeight: 0, overflow: "hidden" }}>
      <Crest mm={badge ? 6 : 4.2} ink={colours.ink} accent={colours.accent} />
      {/* The session ribbon cuts diagonally across this corner; at the name's
          height it reaches ~11.6mm in from the right edge, so the name stops
          short of it rather than being struck through. */}
      <div style={{ minWidth: 0, flex: 1, paddingRight: badge ? "10mm" : "10.5mm" }}>
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
            // The 54mm portrait stock leaves the name only ~25mm clear of the
            // ribbon; 6.4pt fits "Royal Crown Academy" whole where 7.2pt would
            // ellipsize it. The wider horizontal and gate stocks keep 7.2/9pt.
            fontSize: badge ? "9pt" : landscape ? "7.2pt" : "6.4pt",
            fontWeight: 800,
            letterSpacing: "0.01em",
            lineHeight: 1.06,
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {institutionName}
        </div>
        <div
          style={{
            fontSize: badge ? "4.6pt" : "4pt",
            fontWeight: 600,
            letterSpacing: "0.05em",
            color: colours.muted,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {institutionMotto}
        </div>
      </div>
    </div>
  );

  const rule = <div style={{ background: colours.rule, minHeight: 0 }} />;

  const typeLabel = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.2mm",
        fontSize: "4.2pt",
        fontWeight: 800,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: colours.muted,
        overflow: "hidden",
      }}
    >
      <span style={{ width: "4mm", height: "0.5mm", background: colours.accent, borderRadius: "0.3mm", flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{words.card}</span>
    </div>
  );

  const nameBlock = (sizePt: number, centred: boolean) => (
    <div style={{ minWidth: 0, overflow: "hidden", textAlign: centred ? "center" : "left" }}>
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
          fontSize: `${sizePt}pt`,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {holder.holderName || holder.holderRef}
      </div>
      {holder.tag && (
        <div
          style={{
            marginTop: "0.7mm",
            display: "inline-block",
            maxWidth: "100%",
            padding: "0.4mm 1.6mm",
            borderRadius: "999px",
            background: colours.accent,
            color: colours.accentInk,
            fontSize: "4.4pt",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "top",
          }}
        >
          {holder.tag}
        </div>
      )}
    </div>
  );

  const barcodeBlock = (heightMm: number) => (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "1.1mm",
        padding: "0.9mm 1.4mm 0.6mm",
        border: `0.2mm solid ${colours.rule}`,
        overflow: "hidden",
      }}
    >
      <Barcode value={holder.holderRef} heightMm={heightMm} />
      <div
        style={{
          marginTop: "0.4mm",
          textAlign: "center",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: "4.4pt",
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "#141a2e",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {holder.holderRef}
      </div>
    </div>
  );

  const validityLine = (stacked: boolean) => (
    <div
      style={{
        display: "flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "flex-end" : "center",
        justifyContent: stacked ? "flex-start" : "space-between",
        gap: stacked ? "0.5mm" : "2mm",
        fontSize: "4pt",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: colours.muted,
        lineHeight: 1.3,
        overflow: "hidden",
      }}
    >
      <span style={{ whiteSpace: "nowrap" }}>{issued ? `Issued ${issued}` : `Session ${holder.session}`}</span>
      <span style={{ color: expires ? colours.ink : colours.muted, whiteSpace: "nowrap" }}>
        {expires ? `Valid to ${expires}` : "No expiry filed"}
      </span>
    </div>
  );

  const detailsPanel = (sizePt: number) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1mm 2mm",
        padding: "1.2mm 1.6mm",
        borderRadius: "1.3mm",
        background: colours.panel,
        border: `0.2mm solid ${colours.panelRule}`,
        overflow: "hidden",
      }}
    >
      <Field label={holder.firstLabel} value={holder.firstValue} colours={colours} size={sizePt} />
      <Field label={words.number} value={holder.holderRef} colours={colours} mono size={sizePt} />
      {detectedSection === "PRIMARY" ? (
        <>
          <Field label="Blood Group" value={card.bloodGroup || "O+"} colours={colours} size={sizePt} />
          <Field label="Emergency Phone" value={card.emergencyPhone || holder.guardianPhone || "School Office"} colours={colours} size={sizePt} />
        </>
      ) : (
        <>
          <Field label={holder.secondLabel || "House"} value={holder.secondValue || "Senior"} colours={colours} size={sizePt} />
          <Field label="Expiry Date" value={expires || "End of Session"} colours={colours} size={sizePt} />
        </>
      )}
    </div>
  );

  const slot = (
    <div
      aria-hidden="true"
      style={{
        justifySelf: "center",
        width: "13mm",
        height: "3.2mm",
        borderRadius: "999px",
        background: "#ffffff",
        boxShadow: "inset 0 0.3mm 0.7mm rgba(14,27,69,0.45)",
        border: `0.2mm solid ${colours.rule}`,
      }}
    />
  );

  /* ------------------------------------------------------------------ front */
  if (side === "front" && landscape) {
    return (
      <div className="id-card-artwork" style={shell} data-side="front" data-layout="landscape">
        {securityLayer}
        {ribbon}
        <div style={body("5.4mm 0.3mm minmax(0, 1fr) auto")}>
          {header}
          {rule}
          <div style={{ display: "grid", gridTemplateColumns: "19mm minmax(0, 1fr)", gap: "2.4mm", minHeight: 0 }}>
            <div style={{ minHeight: 0, display: "flex", justifyContent: "center" }}>
              <Photograph card={card} widthMm={19} colours={colours} />
            </div>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "1mm", overflow: "hidden" }}>
              {typeLabel}
              {nameBlock(9.5, false)}
              <div style={{ marginTop: "auto" }}>{detailsPanel(5.2)}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 26mm", gap: "2.4mm", alignItems: "end" }}>
            {barcodeBlock(5)}
            {validityLine(true)}
          </div>
        </div>
      </div>
    );
  }

  if (side === "front") {
    return (
      <div className="id-card-artwork" style={shell} data-side="front" data-layout={spec.key}>
        {securityLayer}
        {ribbon}
        <div
          style={body(
            badge
              ? "3.2mm 6.4mm 0.3mm 2mm minmax(0, 1fr) auto auto auto"
              : "5.4mm 0.3mm 2mm minmax(0, 1fr) auto auto auto",
            { justifyItems: "stretch" },
          )}
        >
          {badge && slot}
          {header}
          {rule}
          {typeLabel}
          <div style={{ minHeight: 0, display: "flex", justifyContent: "center", overflow: "hidden" }}>
            <Photograph card={card} widthMm={badge ? 30 : 24} colours={colours} />
          </div>
          {nameBlock(badge ? 10 : 9, true)}
          {detailsPanel(badge ? 6 : 5.4)}
          <div style={{ display: "grid", gap: "1mm", minHeight: 0 }}>
            {barcodeBlock(badge ? 7 : 6)}
            {validityLine(false)}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- back */
  const contactRow = (label: string, value: string) => (
    <div style={{ display: "flex", gap: "1.4mm", fontSize: "4.8pt", lineHeight: 1.3 }}>
      <span
        style={{
          fontWeight: 800,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: colours.muted,
          width: "16mm",
          flexShrink: 0,
          fontSize: "4pt",
          paddingTop: "0.3mm",
        }}
      >
        {label}
      </span>
      <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{value || "—"}</span>
    </div>
  );

  const foundBand = (
    <div
      style={{
        background: colours.accent,
        color: colours.accentInk,
        padding: "1.1mm 1.6mm",
        borderRadius: "1.1mm",
        fontSize: "4.4pt",
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        textAlign: "center",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      }}
    >
      If found, return to the school office
    </div>
  );

  const schoolBlock = (
    <div style={{ display: "grid", gap: "0.7mm", alignContent: "start", overflow: "hidden" }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontSize: "6.4pt", fontWeight: 800, lineHeight: 1.15 }}>
        {school.name}
      </div>
      {contactRow("Address", school.address)}
      {contactRow("Telephone", school.phone)}
      {contactRow("Email", school.email)}
      {school.website && contactRow("Website", school.website)}
    </div>
  );

  const holderBlock = (
    <div style={{ display: "grid", gap: "0.7mm", alignContent: "start", overflow: "hidden" }}>
      {contactRow("Holder", `${holder.holderName || holder.holderRef} · ${holder.holderRef}`)}
      {contactRow(holder.holderType === "student" ? "Guardian" : "Next of kin", card.emergencyName)}
      {contactRow("Emergency", card.emergencyPhone)}
      {contactRow("Blood group", card.bloodGroup)}
    </div>
  );

  const filingPanel = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1mm 2mm",
        padding: "1.2mm 1.6mm",
        borderRadius: "1.1mm",
        background: colours.panel,
        border: `0.2mm solid ${colours.panelRule}`,
        overflow: "hidden",
      }}
    >
      <Field label="Issued" value={issued} colours={colours} size={5} />
      <Field label="Expires" value={expires} colours={colours} size={5} />
      <Field label="Session" value={holder.session} colours={colours} size={5} />
      <Field label="Card serial" value={card.cardNo} colours={colours} mono size={4.6} />
    </div>
  );

  const notes = (
    <p style={{ margin: 0, fontSize: "4.2pt", lineHeight: 1.4, color: colours.muted, overflow: "hidden", minHeight: 0 }}>
      {card.backNotes}
    </p>
  );

  const signature = (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2.4mm", minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: "0.3mm", background: colours.ink, opacity: 0.65 }} />
        <div
          style={{
            marginTop: "0.6mm",
            fontSize: "4pt",
            fontWeight: 800,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: colours.muted,
          }}
        >
          Authorised signature
        </div>
      </div>
      <Seal mm={landscape ? 6 : 7} ink={colours.seal} label={school.shortName} />
    </div>
  );

  const watermark = (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.07,
        pointerEvents: "none",
      }}
    >
      <Crest mm={landscape ? 30 : 40} ink={colours.ink} accent={colours.ink} />
    </div>
  );

  let backContent: ReactNode;
  let backRows: string;
  if (landscape) {
    backRows = "auto minmax(0, 1fr) auto";
    backContent = (
      <>
        {foundBand}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "1.2mm 3mm", minHeight: 0 }}>
          <div style={{ display: "grid", gap: "1.2mm", alignContent: "start", minHeight: 0, overflow: "hidden" }}>
            {schoolBlock}
            {holderBlock}
          </div>
          <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: "1.2mm", minHeight: 0 }}>
            {filingPanel}
            {notes}
          </div>
        </div>
        {signature}
      </>
    );
  } else {
    backRows = "auto auto 0.3mm auto auto minmax(0, 1fr) auto";
    backContent = (
      <>
        {foundBand}
        {schoolBlock}
        {rule}
        {holderBlock}
        {filingPanel}
        {notes}
        {signature}
      </>
    );
  }

  return (
    <div className="id-card-artwork" style={shell} data-side="back" data-layout={spec.key}>
      {securityLayer}
      {watermark}
      <div style={body(backRows)}>{backContent}</div>
    </div>
  );
}