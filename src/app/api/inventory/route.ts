import { NextResponse } from "next/server";
import { requireRoleSession } from "@/lib/auth/guard";
import { databaseSetupRequired, databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The stores ledger belongs to the bursary and the head of school. A teacher may
// not add a desk to the register or write a figure off it, and a family has no
// reason to see what the school owns at all. TESTERS may read it, as every other
// screen, and never write.
const READ_INVENTORY = ["SUPER_ADMIN", "ACCOUNTANT", "TESTERS"] as const;
const WRITE_INVENTORY = ["SUPER_ADMIN", "ACCOUNTANT"] as const;

const SQL_FILE = "supabase/inventory.sql";

const CONDITIONS = ["New", "Good", "Fair", "Poor", "Damaged", "Unusable", "Lost", "Disposed"] as const;
const MAX_ITEMS = 2000;

interface StockRow {
  id: string;
  asset_ref: string | null;
  item_name: string;
  category: string;
  unit: string;
  opening_quantity: number;
  quantity_in: number;
  quantity_out: number;
  quantity_on_hand: number;
  location: string;
  custodian: string;
  condition: string;
  acquired_on: string | null;
  purchase_value: string | number | null;
  reorder_level: number | null;
  notes: string;
  created_by: string;
  updated_at: string;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** A whole number inside a range, or null when the caller did not send one. */
function wholeNumber(value: unknown, min: number, max: number): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return "invalid";
  return parsed;
}

function money(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999_999_999_999) return "invalid";
  return Math.round(parsed * 100) / 100;
}

/** A plain YYYY-MM-DD. Anything else is refused rather than reinterpreted. */
function fileDate(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "invalid";
  const stamp = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(stamp) || stamp > Date.now() + 86_400_000) return "invalid";
  return raw;
}

/**
 * One register line, validated. `opening_quantity` is the only quantity a person
 * types; every figure after that comes from the movement log, so nothing here
 * accepts a current stock number.
 */
function sanitizeItem(raw: Record<string, unknown>) {
  const name = text(raw.item_name, 200);
  if (name.length < 2) return { error: "Give the item a name of at least two letters." } as const;

  const condition = text(raw.condition, 40);
  if (condition && !CONDITIONS.includes(condition as (typeof CONDITIONS)[number])) {
    return { error: `Condition must be one of: ${CONDITIONS.join(", ")}.` } as const;
  }

  const opening = wholeNumber(raw.opening_quantity, 0, 10_000_000);
  if (opening === "invalid") return { error: "The opening quantity must be a whole number of 0 or more." } as const;

  const reorder = wholeNumber(raw.reorder_level, 0, 10_000_000);
  if (reorder === "invalid") return { error: "The reorder level must be a whole number of 0 or more." } as const;

  const value = money(raw.purchase_value);
  if (value === "invalid") return { error: "The recorded value must be a positive amount of money." } as const;

  const acquired = fileDate(raw.acquired_on);
  if (acquired === "invalid") {
    return { error: "The acquisition date must be a real date in the past, written as YYYY-MM-DD." } as const;
  }

  return {
    row: {
      asset_ref: text(raw.asset_ref, 60) || null,
      item_name: name,
      category: text(raw.category, 80) || "General Stores",
      unit: text(raw.unit, 40) || "piece",
      opening_quantity: opening ?? 0,
      location: text(raw.location, 120),
      custodian: text(raw.custodian, 120),
      condition: condition || "Good",
      acquired_on: acquired,
      purchase_value: value,
      reorder_level: reorder,
      notes: text(raw.notes, 2000),
    },
  } as const;
}

/**
 * The register, as the school's records hold it.
 *
 * Read from `inventory_stock`, never from the items table alone: a screen that
 * printed `opening_quantity` as "what we have" would be wrong the first time
 * anything was issued, and the number it got wrong is the one a procurement
 * decision is made from.
 */
export async function GET(request: Request) {
  const access = await requireRoleSession(READ_INVENTORY);
  if (access.denied) return access.denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const params = new URL(request.url).searchParams;
  let query = supabase.from("inventory_stock").select("*").order("item_name", { ascending: true }).limit(MAX_ITEMS);

  const category = text(params.get("category"), 80);
  if (category) query = query.eq("category", category);
  const location = text(params.get("location"), 120);
  if (location) query = query.eq("location", location);
  const search = text(params.get("q"), 200);
  if (search) query = query.ilike("item_name", `%${search}%`);

  const { data, error } = await query;
  if (error) return databaseSetupRequired(error, SQL_FILE) ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });

  // Re-mapped rather than passed through, so a column added to the view later
  // cannot silently arrive on the screen without being named here first.
  const rows: StockRow[] = (data ?? []).map((row) => {
    const item = row as StockRow;
    return {
      id: item.id,
      asset_ref: item.asset_ref,
      item_name: item.item_name,
      category: item.category,
      unit: item.unit,
      opening_quantity: item.opening_quantity,
      quantity_in: item.quantity_in,
      quantity_out: item.quantity_out,
      quantity_on_hand: item.quantity_on_hand,
      location: item.location,
      custodian: item.custodian,
      condition: item.condition,
      acquired_on: item.acquired_on,
      purchase_value: item.purchase_value,
      reorder_level: item.reorder_level,
      notes: item.notes,
      created_by: item.created_by,
      updated_at: item.updated_at,
    };
  });

  return NextResponse.json({ success: true, data: rows });
}

/** Adds an item, or corrects the description of one already on the register. */
export async function POST(request: Request) {
  const { session, denied } = await requireRoleSession(WRITE_INVENTORY);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sanitized = sanitizeItem(body);
  if ("error" in sanitized) return NextResponse.json({ success: false, error: sanitized.error }, { status: 400 });

  const id = text(body.id, 64);
  const row = { ...sanitized.row, updated_at: new Date().toISOString() };

  if (id) {
    const { data, error } = await supabase.from("inventory_items").update(row).eq("id", id).select("id").maybeSingle();
    if (error) {
      if (/duplicate key/i.test(error.message)) {
        return NextResponse.json(
          { success: false, error: `Another item is already filed under the label ${row.asset_ref}. Use a different label, or leave it blank.` },
          { status: 409 }
        );
      }
      return databaseSetupRequired(error, SQL_FILE) ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    if (!data) return NextResponse.json({ success: false, error: "No register line with that id, so nothing was changed." }, { status: 404 });
    return NextResponse.json({ success: true, data: { id } });
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({ ...row, created_by: session.username })
    .select("id")
    .single();
  if (error) {
    if (/duplicate key/i.test(error.message)) {
      return NextResponse.json(
        { success: false, error: `The label ${row.asset_ref} is already on the register. Find that line and correct it instead of adding a second one.` },
        { status: 409 }
      );
    }
    return databaseSetupRequired(error, SQL_FILE) ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: { id: data.id } });
}

/**
 * Removes a register line — but only while nothing has ever moved.
 *
 * Deleting an item with a movement log would delete the log with it (the foreign
 * key cascades), which is the one thing an audit trail must not permit: the
 * school would lose the record of what it issued and to whom, and be left with no
 * explanation for the gap. Refuse the delete and point at the honest route —
 * write the stock out, or mark the line Disposed.
 */
export async function DELETE(request: Request) {
  const { denied, session } = await requireRoleSession(WRITE_INVENTORY);
  if (denied) return denied;

  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = text(body.id, 64);
  if (!id) return NextResponse.json({ success: false, error: "Say which register line to remove." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { count, error: countError } = await supabase
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("item_id", id);
  if (countError) return databaseSetupRequired(countError, SQL_FILE) ?? NextResponse.json({ success: false, error: countError.message }, { status: 502 });

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `This line has ${count} movement${count === 1 ? "" : "s"} recorded against it, so removing it would erase that history too. Issue the stock out, or mark the item Disposed, and the record stays.`,
      },
      { status: 409 }
    );
  }

  const { error: deleteError } = await supabase.from("inventory_items").delete().eq("id", id);
  if (deleteError) return databaseSetupRequired(deleteError, SQL_FILE) ?? NextResponse.json({ success: false, error: deleteError.message }, { status: 502 });

  return NextResponse.json({ success: true, data: { id, removedBy: session.username } });
}
