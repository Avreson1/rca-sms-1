import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import { databaseSetupRequired, databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The trait list is the rubric every behaviour rating is written against, so it
// belongs to the office that sets up the school, not to whichever teacher has the
// screen open. Matches isActionAuthorized("EDIT_SETUP") in src/lib/rbac.ts.
const EDIT_SETUP = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

// Anyone with a login reads it, because a parent's card has to name the traits it
// prints a rating for. It is a list of school subjects of behaviour, not a child's
// record, so nothing personal moves with it.
const READ_SETUP = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;

const SQL_FILE = "supabase/traits_assessments.sql";
const MAX_TRAITS = 60;

interface TraitRow {
  id: string;
  name: string;
  category: string;
  scale: string;
  description: string;
}

/**
 * The school's own list of rated traits.
 *
 * This lived in each browser's localStorage, so Setup → Traits could add a trait
 * on the staff-room machine and no other screen in the school would ever offer it —
 * while the card that printed the ratings still had to name them from a list the
 * reader had never seen.
 */
export async function GET() {
  const denied = await requireRole(READ_SETUP);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase.from("traits_config").select("traits, updated_at, updated_by").eq("id", 1).maybeSingle();
  if (error) {
    return databaseSetupRequired(error, SQL_FILE) ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  const traits = Array.isArray(data?.traits) ? (data.traits as TraitRow[]) : [];
  return NextResponse.json({
    success: true,
    data: {
      traits,
      // The table existing and the school having a rubric are different facts. A
      // migration that created the table but lost its seed row would otherwise
      // answer `[]`, and every machine would then empty its trait grid — the
      // opposite of what "the school's list" means. `configured: false` says the
      // school simply has no list yet, and the device keeps the one it has.
      configured: Boolean(data),
      updatedAt: data?.updated_at ?? null,
      updatedBy: data?.updated_by ?? "",
    },
  });
}

/** Replaces the whole rubric, so removing a trait is just omitting it. */
export async function POST(request: Request) {
  const access = await requireRoleSession(EDIT_SETUP);
  if (access.denied) return access.denied;

  let body: { traits?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.traits)) {
    return NextResponse.json({ success: false, error: "Send the list of traits." }, { status: 400 });
  }
  if (body.traits.length > MAX_TRAITS) {
    return NextResponse.json({ success: false, error: `No more than ${MAX_TRAITS} traits in one rubric.` }, { status: 400 });
  }

  const seen = new Set<string>();
  const rows: TraitRow[] = [];
  for (const raw of body.traits) {
    const item = raw as Partial<TraitRow> | null;
    const id = typeof item?.id === "string" ? item.id.trim().slice(0, 100) : "";
    const name = typeof item?.name === "string" ? item.name.trim().slice(0, 255) : "";
    if (!id || !name) {
      return NextResponse.json({ success: false, error: "Every trait needs an id and a name." }, { status: 400 });
    }
    if (seen.has(id.toLowerCase())) {
      return NextResponse.json({ success: false, error: `${name} appears twice in the list.` }, { status: 400 });
    }
    seen.add(id.toLowerCase());
    rows.push({
      id,
      name,
      category: typeof item?.category === "string" ? item.category.trim().slice(0, 100) : "Affective (Behavioral)",
      scale: typeof item?.scale === "string" ? item.scale.trim().slice(0, 50) : "1 - 5 Scale",
      description: typeof item?.description === "string" ? item.description.trim().slice(0, 500) : "",
    });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { error } = await supabase.from("traits_config").upsert(
    { id: 1, traits: rows, updated_at: new Date().toISOString(), updated_by: access.session.username },
    { onConflict: "id" }
  );
  if (error) {
    return databaseSetupRequired(error, SQL_FILE) ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: { traits: rows } });
}
