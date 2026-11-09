import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  BLOOD_GROUPS,
  ID_CARD_LAYOUTS,
  ID_CARD_THEMES,
  PHOTO_MAX_CHARS,
  isDateValue,
} from "@/lib/id-cards";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/id_cards.sql";

// Issuing an identity card is an admissions act, and a card carries a child's
// photograph. The two roles that may open Operations → ID Cards read it, plus
// the QA login; a teacher, a bursar and a family are refused the whole route, so
// nobody can pull the school's photographs through it.
const READ_CARDS = ["SUPER_ADMIN", "EXAM_OFFICER", "TESTERS"] as const;
const WRITE_CARDS = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const HOLDER_TYPES = ["student", "staff"] as const;
const MAX_REFS = 60;
const MAX_BATCH = 60;

type HolderType = (typeof HOLDER_TYPES)[number];

/** The columns the card list travels with — never the photograph itself. */
const INDEX_COLUMNS =
  "id, holder_type, holder_ref, holder_name, photo_zoom, photo_x, photo_y, layout, theme, card_no, blood_group, issued_on, expires_on, emergency_name, emergency_phone, back_notes, show_back, created_at, updated_at, updated_by, has_photo, photo_chars";

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function holderType(value: unknown): HolderType | null {
  return (HOLDER_TYPES as readonly string[]).includes(value as string) ? (value as HolderType) : null;
}

/**
 * GET without parameters is the index: every card the school has filed, with the
 * fact of a photograph but not the photograph. GET with a holder type and one or
 * more holder references returns those cards whole, which is what the designer
 * and a print run ask for.
 */
export async function GET(request: Request) {
  const denied = await requireRole(READ_CARDS);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const params = new URL(request.url).searchParams;
  const type = params.get("holderType");
  const refs = params.getAll("holderRef").map((ref) => ref.trim()).filter(Boolean);

  if (type === null && refs.length === 0) {
    const { data, error } = await supabase
      .from("id_card_index")
      .select(INDEX_COLUMNS)
      .order("updated_at", { ascending: false });
    if (error) {
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    return NextResponse.json({ success: true, data: data ?? [] });
  }

  const asked = holderType(type);
  if (!asked) {
    return NextResponse.json(
      { success: false, error: `Say whose cards these are: holderType must be student or staff, not "${type ?? ""}".` },
      { status: 400 }
    );
  }
  if (refs.length === 0) {
    return NextResponse.json(
      { success: false, error: "Name the cards to read with holderRef. The whole school's photographs are never sent in one response." },
      { status: 400 }
    );
  }
  if (refs.length > MAX_REFS) {
    return NextResponse.json(
      { success: false, error: `${refs.length} cards were asked for at once; the limit is ${MAX_REFS}. Print them in smaller runs.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("id_cards")
    .select("*")
    .eq("holder_type", asked)
    .in("holder_ref", refs);
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ success: true, data: data ?? [] });
}

interface CardPayload {
  holderType?: unknown;
  holderRef?: unknown;
  holderName?: unknown;
  photo?: unknown;
  photoZoom?: unknown;
  photoX?: unknown;
  photoY?: unknown;
  layout?: unknown;
  theme?: unknown;
  cardNo?: unknown;
  bloodGroup?: unknown;
  issuedOn?: unknown;
  expiresOn?: unknown;
  emergencyName?: unknown;
  emergencyPhone?: unknown;
  backNotes?: unknown;
  showBack?: unknown;
}

/**
 * Files a card against the person the register already holds.
 *
 * The name, class, house and designation are NOT written here: they are read
 * from students/staff every time a card is drawn, so a promoted child's card
 * shows the new class without anybody re-filing it. holder_name is kept only so
 * a card whose holder has left can still be found and withdrawn.
 *
 * Filing the same holder twice corrects the card already on file — one person,
 * one identity — rather than issuing a second card for the same child.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_CARDS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) {
    return NextResponse.json({ success: false, error: "No card was sent." }, { status: 400 });
  }
  if (list.length > MAX_BATCH) {
    return NextResponse.json(
      { success: false, error: `Too many cards in one submission (max ${MAX_BATCH}).` },
      { status: 400 }
    );
  }

  const rows: {
    id: string;
    holder_type: HolderType;
    holder_ref: string;
    holder_name: string;
    photo: string;
    photo_zoom: number;
    photo_x: number;
    photo_y: number;
    layout: string;
    theme: string;
    card_no: string;
    blood_group: string;
    issued_on: string | null;
    expires_on: string | null;
    emergency_name: string;
    emergency_phone: string;
    back_notes: string;
    show_back: boolean;
  }[] = [];

  for (const [index, item] of (list as CardPayload[]).entries()) {
    const where = list.length > 1 ? `Card ${index + 1}` : "This card";
    const sent = (item ?? {}) as CardPayload;

    const type = holderType(sent.holderType);
    if (!type) {
      return NextResponse.json(
        { success: false, error: `${where} does not say whose it is. holderType must be student or staff.` },
        { status: 400 }
      );
    }

    const ref = text(sent.holderRef, 60);
    if (!ref) {
      return NextResponse.json(
        { success: false, error: `${where} has no ${type === "student" ? "admission number" : "staff id"}, so it cannot be filed against anybody.` },
        { status: 400 }
      );
    }

    const photo = typeof sent.photo === "string" ? sent.photo.trim() : "";
    if (photo && !PHOTO_PATTERN.test(photo)) {
      return NextResponse.json(
        { success: false, error: `${where}: the photograph must be a JPEG, PNG or WebP chosen in the card designer. A link to an image elsewhere is not accepted.` },
        { status: 400 }
      );
    }
    if (photo.length > PHOTO_MAX_CHARS) {
      return NextResponse.json(
        { success: false, error: `${where}: the photograph is ${Math.round(photo.length / 1024)} kB of text and the school's records hold ${Math.round(PHOTO_MAX_CHARS / 1024)} kB. Choose a smaller one.` },
        { status: 400 }
      );
    }

    const zoom = Number(sent.photoZoom ?? 1);
    const x = Number(sent.photoX ?? 0);
    const y = Number(sent.photoY ?? 0);
    if (!Number.isFinite(zoom) || zoom < 1 || zoom > 3) {
      return NextResponse.json(
        { success: false, error: `${where}: the photograph zoom must be between 1 and 3.` },
        { status: 400 }
      );
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 50 || Math.abs(y) > 50) {
      return NextResponse.json(
        { success: false, error: `${where}: the photograph must stay inside its frame — the offset is a percentage between -50 and 50.` },
        { status: 400 }
      );
    }

    const layout = text(sent.layout, 12) || "portrait";
    if (!ID_CARD_LAYOUTS.some((option) => option.key === layout)) {
      return NextResponse.json(
        { success: false, error: `${where} asks for a "${layout}" card. The shapes the portal prints are ${ID_CARD_LAYOUTS.map((option) => option.key).join(", ")}.` },
        { status: 400 }
      );
    }
    const theme = text(sent.theme, 12) || "royal";
    if (!ID_CARD_THEMES.some((option) => option.key === theme)) {
      return NextResponse.json(
        { success: false, error: `${where} asks for a "${theme}" colourway. The portal prints ${ID_CARD_THEMES.map((option) => option.key).join(", ")}.` },
        { status: 400 }
      );
    }

    const bloodGroup = text(sent.bloodGroup, 4);
    if (!(BLOOD_GROUPS as readonly string[]).includes(bloodGroup)) {
      return NextResponse.json(
        { success: false, error: `${where}: "${bloodGroup}" is not a blood group the card offers. Leave it blank rather than guess — the gate reads this in an emergency.` },
        { status: 400 }
      );
    }

    const issuedOn = text(sent.issuedOn, 10);
    const expiresOn = text(sent.expiresOn, 10);
    for (const [label, value] of [["issued on", issuedOn], ["expires on", expiresOn]] as const) {
      if (value && !isDateValue(value)) {
        return NextResponse.json(
          { success: false, error: `${where}: the "${label}" date is not a real calendar date (${value}).` },
          { status: 400 }
        );
      }
    }
    if (issuedOn && expiresOn && expiresOn <= issuedOn) {
      return NextResponse.json(
        { success: false, error: `${where} expires on ${expiresOn}, which is not after it was issued (${issuedOn}). A card cannot expire before it exists.` },
        { status: 400 }
      );
    }

    rows.push({
      id: "",
      holder_type: type,
      holder_ref: ref,
      holder_name: text(sent.holderName, 200),
      photo,
      photo_zoom: Math.round(zoom * 100) / 100,
      photo_x: Math.round(x * 10) / 10,
      photo_y: Math.round(y * 10) / 10,
      layout,
      theme,
      card_no: text(sent.cardNo, 60),
      blood_group: bloodGroup,
      issued_on: issuedOn || null,
      expires_on: expiresOn || null,
      emergency_name: text(sent.emergencyName, 160),
      emergency_phone: text(sent.emergencyPhone, 40),
      back_notes: text(sent.backNotes, 1200),
      show_back: sent.showBack !== false,
    });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // A card already on file keeps its row id, so re-filing corrects that card
  // instead of inserting a second identity for the same person. The browser is
  // not trusted to supply the id.
  const { data: existing, error: lookupError } = await supabase
    .from("id_cards")
    .select("id, holder_type, holder_ref");
  if (lookupError) {
    const setup = databaseSetupRequired(lookupError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: lookupError.message }, { status: 502 });
  }
  const idByHolder = new Map<string, string>();
  for (const row of existing ?? []) {
    if (typeof row.id === "string" && UUID_PATTERN.test(row.id)) {
      idByHolder.set(`${row.holder_type}:${row.holder_ref}`, row.id);
    }
  }

  const at = new Date().toISOString();
  const who = access.session.username;
  const stamped = rows.map((row) => ({
    ...row,
    id: idByHolder.get(`${row.holder_type}:${row.holder_ref}`) ?? randomUUID(),
    updated_at: at,
    updated_by: who,
  }));

  const { error } = await supabase.from("id_cards").upsert(stamped, { onConflict: "holder_type,holder_ref" });
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  const { data: saved, error: readError } = await supabase
    .from("id_card_index")
    .select(INDEX_COLUMNS)
    .in("id", stamped.map((row) => row.id));
  if (readError) {
    const setup = databaseSetupRequired(readError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: readError.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: saved ?? [] });
}

/**
 * Withdraws cards. Addressed by the holder, not by a row id, because the office
 * withdraws "the card for this pupil" — and a card designed on a machine that
 * never reached the school's records has no row id to send.
 */
export async function DELETE(request: Request) {
  const denied = await requireRole(WRITE_CARDS);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as { refs?: unknown };
  const list = Array.isArray(sent.refs) ? sent.refs : [];
  const pairs: { holder_type: HolderType; holder_ref: string }[] = [];
  for (const entry of list) {
    const item = (entry ?? {}) as { holderType?: unknown; holderRef?: unknown };
    const type = holderType(item.holderType);
    const ref = text(item.holderRef, 60);
    if (type && ref) pairs.push({ holder_type: type, holder_ref: ref });
  }
  if (pairs.length === 0) {
    return NextResponse.json(
      { success: false, error: "No card was named. Send refs: [{ holderType, holderRef }] for the cards to withdraw." },
      { status: 400 }
    );
  }
  if (pairs.length > 200) {
    return NextResponse.json({ success: false, error: "Too many cards in one withdrawal (max 200)." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // One statement per holder type: PostgREST cannot OR two column pairs in a
  // single delete, and a filter that matched only the reference would withdraw
  // a staff card and a pupil card that happen to share a number.
  let removed = 0;
  for (const type of HOLDER_TYPES) {
    const refs = pairs.filter((pair) => pair.holder_type === type).map((pair) => pair.holder_ref);
    if (refs.length === 0) continue;
    const { data, error } = await supabase
      .from("id_cards")
      .delete()
      .eq("holder_type", type)
      .in("holder_ref", refs)
      .select("id");
    if (error) {
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    removed += data?.length ?? 0;
  }

  return NextResponse.json({ success: true, data: { removed } });
}