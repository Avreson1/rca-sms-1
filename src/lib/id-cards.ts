/**
 * The identity card the office prints for a pupil or a member of staff.
 *
 * Everything here is pure: the sizes, the colourways, the photograph shrinking
 * and the barcode. The card itself is drawn by components/id-cards, and what the
 * office adds to it — photograph, framing, serial, dates, emergency contact —
 * is filed on the school's records by /api/id-cards.
 */

export type IdCardHolderType = "student" | "staff";
export type IdCardLayout = "portrait" | "landscape" | "badge";
export type IdCardTheme = "royal" | "scarlet" | "midnight" | "paper";

/** CR80 is the bank-card size every card printer and laminator takes. */
export const ID_CARD_LAYOUTS: {
  key: IdCardLayout;
  label: string;
  widthMm: number;
  heightMm: number;
  note: string;
}[] = [
  { key: "portrait", label: "Vertical", widthMm: 54, heightMm: 85.6, note: "CR80 portrait — the lanyard card" },
  { key: "landscape", label: "Horizontal", widthMm: 85.6, heightMm: 54, note: "CR80 landscape — the wallet card" },
  { key: "badge", label: "Gate badge", widthMm: 70, heightMm: 100, note: "70 × 100 mm — slot-punched event badge" },
];

export interface IdCardThemeSpec {
  key: IdCardTheme;
  label: string;
  /** The card field. A gradient across two real hues, not one flat colour. */
  field: string;
  /** Body text on that field. */
  ink: string;
  muted: string;
  rule: string;
  /** The stripe, the seal and the session ribbon. */
  accent: string;
  accentInk: string;
  /** The recessed panel the photograph and the details sit in. */
  panel: string;
  panelRule: string;
  seal: string;
  /** The colourway button on the control rail. */
  swatch: string;
  light: boolean;
}

export const ID_CARD_THEMES: IdCardThemeSpec[] = [
  {
    key: "royal",
    label: "Royal Blue",
    field: "linear-gradient(155deg, #4169e1 0%, #3059d0 44%, #182e70 100%)",
    ink: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    rule: "rgba(255,255,255,0.26)",
    accent: "#ff2400",
    accentInk: "#ffffff",
    panel: "rgba(255,255,255,0.10)",
    panelRule: "rgba(255,255,255,0.20)",
    seal: "rgba(255,255,255,0.16)",
    swatch: "linear-gradient(140deg, #4169e1, #182e70)",
    light: false,
  },
  {
    key: "scarlet",
    label: "Scarlet",
    field: "linear-gradient(155deg, #ff5a33 0%, #e01b00 46%, #7a1400 100%)",
    ink: "#ffffff",
    muted: "rgba(255,255,255,0.82)",
    rule: "rgba(255,255,255,0.28)",
    accent: "#0e1b45",
    accentInk: "#ffffff",
    panel: "rgba(255,255,255,0.12)",
    panelRule: "rgba(255,255,255,0.22)",
    seal: "rgba(255,255,255,0.18)",
    swatch: "linear-gradient(140deg, #ff5a33, #7a1400)",
    light: false,
  },
  {
    key: "midnight",
    label: "Midnight",
    field: "linear-gradient(155deg, #14265e 0%, #0d1a44 48%, #070f2b 100%)",
    ink: "#ffffff",
    muted: "rgba(255,255,255,0.74)",
    rule: "rgba(255,255,255,0.22)",
    accent: "#ff2400",
    accentInk: "#ffffff",
    panel: "rgba(255,255,255,0.07)",
    panelRule: "rgba(255,255,255,0.16)",
    seal: "rgba(143,192,249,0.20)",
    swatch: "linear-gradient(140deg, #14265e, #070f2b)",
    light: false,
  },
  {
    key: "paper",
    label: "Paper (ink-saving)",
    field: "linear-gradient(160deg, #ffffff 0%, #f4f7fe 58%, #e4ebfc 100%)",
    ink: "#141a2e",
    muted: "#4e5872",
    rule: "#c8d7f9",
    accent: "#3059d0",
    accentInk: "#ffffff",
    panel: "#ffffff",
    panelRule: "#c8d7f9",
    seal: "rgba(48,89,208,0.12)",
    swatch: "linear-gradient(140deg, #ffffff, #c8d7f9)",
    light: true,
  },
];

export function layoutSpec(key: IdCardLayout) {
  return ID_CARD_LAYOUTS.find((layout) => layout.key === key) ?? ID_CARD_LAYOUTS[0];
}

export function themeSpec(key: IdCardTheme): IdCardThemeSpec {
  return ID_CARD_THEMES.find((theme) => theme.key === key) ?? ID_CARD_THEMES[0];
}

export const BLOOD_GROUPS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** The photograph the school's records will hold: a data URL, never a link out. */
export const PHOTO_MAX_CHARS = 300_000;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const PHOTO_LONG_EDGE = 720;

export interface PhotoReadResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Shrinks a photograph in the browser before it is filed.
 *
 * A phone camera hands over 4–12 MB. Sent as it is, one class of cards would be
 * hundreds of megabytes of base64 in a table the office reads on every visit, so
 * the long edge comes down to 720 px — twice what a 26 mm frame needs at 300 dpi
 * — and the result is a JPEG of roughly 60–120 kB. Nothing is uploaded to a
 * public bucket: the string goes to a table only the server's service role can
 * read, because a child's photograph is not a public asset.
 */
export async function readPhotoFile(file: File): Promise<PhotoReadResult> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error(
      file.type === "image/heic" || file.type === "image/heif" || /\.heic$/i.test(file.name)
        ? "This is an iPhone HEIC photograph, which a browser cannot draw. Export it as JPEG first (Photos → Share → Options → Most Compatible), then choose it again."
        : `“${file.name}” is ${file.type || "an unknown kind of file"}. Choose a JPEG, PNG or WebP photograph.`
    );
  }
  if (file.size > 16 * 1024 * 1024) {
    throw new Error(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. Choose a photograph under 16 MB.`);
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();

    const scale = Math.min(1, PHOTO_LONG_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser would not draw the photograph onto a canvas. Try Chrome or Edge.");
    // A PNG with transparency would print its see-through parts as black on a
    // card, so the frame is filled with the white the photograph sits on.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > PHOTO_MAX_CHARS) {
      throw new Error(
        `Even shrunk, this photograph is ${Math.round(dataUrl.length / 1024)} kB of text and the school's records hold ${Math.round(PHOTO_MAX_CHARS / 1024)} kB. Crop it tighter or choose a smaller one.`
      );
    }
    return { dataUrl, width, height };
  } catch (error) {
    if (error instanceof Error && error.message && !/decode|source image/i.test(error.message)) throw error;
    throw new Error(`“${file.name}” could not be opened as a photograph. It may be damaged — try exporting it again.`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Code 39, the barcode a handheld scanner reads without a licence.
 *
 * Each character is nine elements — bar, space, bar … — three of them wide.
 * The strings below are those nine elements written as twelve modules, a wide
 * element taking two, so drawing every "1" as one module reproduces the symbol
 * exactly. One narrow space separates characters.
 */
const CODE39: Record<string, string> = {
  "0": "101001101101", "1": "110100101011", "2": "101100101011", "3": "110110010101",
  "4": "101001101011", "5": "110100110101", "6": "101100110101", "7": "101001011011",
  "8": "110100101101", "9": "101100101101",
  A: "110101001011", B: "101101001011", C: "110110100101", D: "101011001011",
  E: "110101100101", F: "101101100101", G: "101010011011", H: "110101001101",
  I: "101101001101", J: "101011001101", K: "110101010011", L: "101101010011",
  M: "110110101001", N: "101011010011", O: "110101101001", P: "101101101001",
  Q: "101010110011", R: "110101011001", S: "101101011001", T: "101011011001",
  U: "110010101011", V: "100110101011", W: "110011010101", X: "100101101011",
  Y: "110010110101", Z: "100110110101",
  "-": "100101011011", ".": "110010101101", " ": "100110101101",
  $: "100100100101", "/": "100100101001", "+": "100101001001", "%": "101001001001",
  "*": "100101101101",
};

/** The characters Code 39 can carry, so a scanner is not handed a silent gap. */
export function barcodeText(value: string): string {
  return value
    .toUpperCase()
    .split("")
    .filter((char) => char in CODE39 && char !== "*")
    .join("")
    .slice(0, 24);
}

/**
 * The bars of a Code 39 symbol, start and stop included, in module units.
 * Returns an empty list when the reference has no character the symbol can
 * carry — the card then prints the number alone rather than a barcode that
 * scans as nothing.
 */
export function code39Bars(value: string): { x: number; width: number }[] {
  const text = barcodeText(value);
  if (!text) return [];
  const bars: { x: number; width: number }[] = [];
  let cursor = 0;
  for (const char of `*${text}*`) {
    const pattern = CODE39[char];
    for (let element = 0; element < pattern.length; element += 1) {
      if (pattern[element] === "1") bars.push({ x: cursor + element, width: 1 });
    }
    cursor += pattern.length + 1;
  }
  return bars;
}

export function code39Modules(value: string): number {
  const text = barcodeText(value);
  return text ? (text.length + 2) * 13 - 1 : 0;
}

/** YYYY-MM-DD, the shape a date column and an <input type="date"> both take. */
export function isoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function cardDateLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function isDateValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** One year on, the validity a school usually gives a card. */
export function plusOneYear(value: string): string {
  const base = isDateValue(value) ? new Date(`${value}T00:00:00`) : new Date();
  base.setFullYear(base.getFullYear() + 1);
  return isoDate(base);
}

/**
 * A serial the office can accept or overwrite. Built from the session and the
 * holder's own number, so it invents nothing: two cards for the same person in
 * the same session suggest the same serial.
 *
 * The digits are taken whole rather than sliced off the end of the reference, so
 * "RCA/2025/001" suggests S0001 and not "S25/001" — a serial the gate can read
 * down a telephone, with no punctuation for the barcode to carry.
 */
export function suggestCardNo(holderType: IdCardHolderType, holderRef: string, session: string): string {
  const year = session.match(/^(\d{4})/)?.[1] ?? `${new Date().getFullYear()}`;
  const digits = holderRef.replace(/\D/g, "");
  // The session year is already in the prefix; repeating it inside the body
  // would make every serial longer without making it any more distinct.
  const own = (digits.startsWith(year) ? digits.slice(year.length) : digits) || digits;
  const tail = own.slice(-8);
  const body = tail
    ? tail.padStart(4, "0")
    : barcodeText(holderRef).replace(/[^A-Z0-9]/g, "").slice(-6) || "0000";
  return `RCA-ID-${year}-${holderType === "student" ? "S" : "T"}${body}`;
}

/** The words a card calls its holder, so a staff card never says "Class". */
export const HOLDER_WORDS: Record<IdCardHolderType, { card: string; number: string; plural: string }> = {
  student: { card: "Student Identity Card", number: "Admission No", plural: "Pupils" },
  staff: { card: "Staff Identity Card", number: "Staff ID", plural: "Staff" },
};

export const DEFAULT_BACK_NOTES =
  "This card remains the property of the school. It must be worn on the campus at all times and produced on request. " +
  "If found, please return it to the school office at the address overleaf. A lost card must be reported immediately; " +
  "a replacement is issued on payment of the replacement fee.";

/**
 * What the office adds to a person, as the school's records hold it. `photo` is
 * empty on a row read from the card index — the list travels without the
 * photographs — and `hasPhoto` is what the list says about it instead.
 */
export interface IdCardRecord {
  id: string;
  holderType: IdCardHolderType;
  holderRef: string;
  holderName: string;
  photo: string;
  photoZoom: number;
  photoX: number;
  photoY: number;
  layout: IdCardLayout;
  theme: IdCardTheme;
  cardNo: string;
  bloodGroup: string;
  issuedOn: string;
  expiresOn: string;
  emergencyName: string;
  emergencyPhone: string;
  backNotes: string;
  showBack: boolean;
  hasPhoto: boolean;
  updatedBy: string;
  updatedAt: string | null;
}

export type IdCardInput = Omit<IdCardRecord, "id" | "hasPhoto" | "updatedBy" | "updatedAt">;

/** What the designer edits: the card without the parts only the server writes. */
export function cardInput(record: IdCardRecord): IdCardInput {
  return {
    holderType: record.holderType,
    holderRef: record.holderRef,
    holderName: record.holderName,
    photo: record.photo,
    photoZoom: record.photoZoom,
    photoX: record.photoX,
    photoY: record.photoY,
    layout: record.layout,
    theme: record.theme,
    cardNo: record.cardNo,
    bloodGroup: record.bloodGroup,
    issuedOn: record.issuedOn,
    expiresOn: record.expiresOn,
    emergencyName: record.emergencyName,
    emergencyPhone: record.emergencyPhone,
    backNotes: record.backNotes,
    showBack: record.showBack,
  };
}

/**
 * The person as the register holds them, read fresh every time a card is drawn.
 * Kept apart from IdCardRecord on purpose: a card filed in Primary 3 must print
 * Primary 4 after promotion, and it can only do that if the class is not a copy
 * stored beside the photograph.
 */
export interface IdCardHolder {
  holderType: IdCardHolderType;
  holderRef: string;
  holderName: string;
  firstLabel: string;
  firstValue: string;
  secondLabel: string;
  secondValue: string;
  /** A line under the name — form master, assigned class, sports house colour. */
  tag: string;
  guardianName: string;
  guardianPhone: string;
  session: string;
  onRegister: boolean;
}

export function holderKey(holderType: IdCardHolderType, holderRef: string): string {
  return `${holderType}:${holderRef}`;
}

/** The starting card for a person who has never had one. Nothing is invented. */
export function blankCard(holder: IdCardHolder): IdCardInput {
  return {
    holderType: holder.holderType,
    holderRef: holder.holderRef,
    holderName: holder.holderName,
    photo: "",
    photoZoom: 1,
    photoX: 0,
    photoY: 0,
    layout: "portrait",
    theme: "royal",
    cardNo: "",
    bloodGroup: "",
    issuedOn: isoDate(new Date()),
    expiresOn: "",
    emergencyName: holder.guardianName,
    emergencyPhone: holder.guardianPhone,
    backNotes: DEFAULT_BACK_NOTES,
    showBack: true,
  };
}