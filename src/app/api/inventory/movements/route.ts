import { NextResponse } from "next/server";
import { requireRoleSession } from "@/lib/auth/guard";
import { databaseSetupRequired, databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The same two doors as the register: the bursary and the head of school move
// stock, and QA reads. A movement is not a note in the margin — it changes what
// the school says it has, so the list is as short as the register's.
const READ_INVENTORY = ["SUPER_ADMIN", "ACCOUNTANT", "TESTERS"] as const;
const WRITE_INVENTORY = ["SUPER_ADMIN", "ACCOUNTANT"] as const;

const SQL_FILE = "supabase/inventory.sql";
const MAX_LOG_ROWS = 500;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** The date the goods actually moved. Never later than today. */
function movementDate(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "invalid";
  const stamp = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(stamp) || stamp > Date.now() + 86_400_000) return "invalid";
  return raw;
}

/**
 * The log, newest first — for one item, or for the store as a whole.
 *
 * Returned even when empty, because "nothing has moved yet" is a fact the screen
 * prints; it is not a reason to show a row of zeroes or a figure from elsewhere.
 */
export async function GET(request: Request) {
  const access = await requireRoleSession(READ_INVENTORY);
  if (access.denied) return access.denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const params = new URL(request.url).searchParams;
  const itemId = text(params.get("item_id"), 64);

  let query = supabase
    .from("inventory_movements")
    .select("id, item_id, direction, quantity, party, purpose, moved_on, recorded_by, created_at, inventory_items(item_name)")
    .order("moved_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_LOG_ROWS);

  if (itemId) query = query.eq("item_id", itemId);

  const { data, error } = await query;
  if (error) return databaseSetupRequired(error, SQL_FILE) ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });

  return NextResponse.json({ success: true, data: data ?? [] });
}

/**
 * Records one movement, and only one.
 *
 * An issue larger than the shelf is refused with the figure the school actually
 * holds. Before this, a hand-written store card could say the school issued six
 * calculators out of four, and nothing anywhere would have said so — the log
 * would simply have added a line and the register would have gone quietly
 * negative.
 */
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

  const itemId = text(body.item_id, 64);
  if (!itemId) return NextResponse.json({ success: false, error: "Say which register line this movement is against." }, { status: 400 });

  const direction = text(body.direction, 4);
  if (direction !== "in" && direction !== "out") {
    return NextResponse.json({ success: false, error: "A movement is either 'in' (received) or 'out' (issued)." }, { status: 400 });
  }

  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000_000) {
    return NextResponse.json({ success: false, error: "The quantity must be a whole number above zero." }, { status: 400 });
  }

  const movedOn = movementDate(body.moved_on);
  if (movedOn === "invalid") {
    return NextResponse.json({ success: false, error: "The date must be a real date, today or earlier, written as YYYY-MM-DD." }, { status: 400 });
  }

  // The item has to exist on the school's records before anything can be issued
  // from it, and its name is what the answer quotes back.
  const { data: item, error: lookupError } = await supabase
    .from("inventory_stock")
    .select("id, item_name, unit, quantity_on_hand")
    .eq("id", itemId)
    .maybeSingle<{ id: string; item_name: string; unit: string; quantity_on_hand: number }>();

  if (lookupError) return databaseSetupRequired(lookupError, SQL_FILE) ?? NextResponse.json({ success: false, error: lookupError.message }, { status: 502 });
  if (!item) return NextResponse.json({ success: false, error: "No register line with that id, so nothing was recorded." }, { status: 404 });

  if (direction === "out" && quantity > item.quantity_on_hand) {
    return NextResponse.json(
      {
        success: false,
        error: `${item.item_name} has ${item.quantity_on_hand} ${item.unit}${item.quantity_on_hand === 1 ? "" : "s"} on the shelf. It cannot issue ${quantity}. Correct the opening figure or receive more stock first.`,
      },
      { status: 409 }
    );
  }

  const { data: filed, error: insertError } = await supabase
    .from("inventory_movements")
    .insert({
      item_id: itemId,
      direction,
      quantity,
      party: text(body.party, 160),
      purpose: text(body.purpose, 200),
      recorded_by: session.username,
      ...(movedOn ? { moved_on: movedOn } : {}),
    })
    .select("id")
    .single();

  if (insertError) return databaseSetupRequired(insertError, SQL_FILE) ?? NextResponse.json({ success: false, error: insertError.message }, { status: 502 });

  // The new figure is sent back so the screen can show the shelf as the log now
  // adds it up, instead of the browser doing the arithmetic a second, different
  // way.
  const nextOnHand = direction === "in" ? item.quantity_on_hand + quantity : item.quantity_on_hand - quantity;

  return NextResponse.json({
    success: true,
    data: { id: filed.id, itemName: item.item_name, direction, quantity, quantityOnHand: nextOnHand, recordedBy: session.username },
  });
}
