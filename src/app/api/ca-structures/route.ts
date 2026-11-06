import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/ca_structure_and_bulletin.sql";

// Only the two roles that may open Setup → CA Structure see this list, plus the
// QA login that reads every setup screen. A teacher marking a pupil works from
// the five columns the gradebook holds, not from this list, so widening it would
// show a family a configuration screen's data for no reason.
const READ_STRUCTURES = ["SUPER_ADMIN", "EXAM_OFFICER", "TESTERS"] as const;
const WRITE_STRUCTURES = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const TIER_KEYS = ["PLAY_PRESCHOOL", "NURSERY", "PRIMARY", "SECONDARY"] as const;

const TIER_LABELS: Record<string, string> = {
  PLAY_PRESCHOOL: "Play & Preschool",
  NURSERY: "Nursery 1 & 2",
  PRIMARY: "Basic Primary 1 – 5",
  SECONDARY: "Junior & Senior Secondary",
};

const COMPONENT_KEY = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const NAME_MAX = 120;
const COMPONENT_DESCRIPTION_MAX = 500;
const NOTE_MAX = 4000;
const MAX_COMPONENTS = 12;

type ComponentPayload = {
  key?: unknown;
  name?: unknown;
  maxScore?: unknown;
  max_score?: unknown;
  description?: unknown;
};

type StructurePayload = {
  tierKey?: unknown;
  tier_key?: unknown;
  components?: unknown;
  description?: unknown;
};

type StoredComponent = {
  key: string;
  name: string;
  max_score: number;
  description: string;
};

type StructureInput = {
  tier_key: string;
  components: StoredComponent[];
  description: string;
};

/** What one write may contain: the row's own columns, plus who and when. */
type StructureWrite = StructureInput & {
  created_at?: string;
  created_by?: string;
  updated_at: string;
  updated_by: string;
};

type StructureRow = StructureInput & {
  updated_at: string | null;
  updated_by: string;
};

/** Every structure the school has filed. A tier with no row has never been filed. */
export async function GET() {
  const denied = await requireRole(READ_STRUCTURES);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("ca_component_structures")
    .select("*")
    .order("tier_key", { ascending: true });
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: (data ?? []) as StructureRow[] });
}

/**
 * Files one tier's component list, or the starting outline for all four tiers.
 *
 * A tier's structure is saved as a whole, because that is how the screen edits
 * it: the components arrive in the order they are taught and a partial write
 * would leave a mark sheet half-renamed. Saving therefore means "this is what
 * this tier's assessment is made of now", and whoever files it second replaces
 * what the first person filed — the screen names the last author and when it was
 * written so that is visible rather than silent.
 *
 * What this does not do is change a computed mark. The gradebook and /api/ca add
 * their own five columns (10 + 10 + 10 + 10 + 60), so filing a different
 * distribution here says what the school's assessment is, not what a pupil's
 * total currently reads as. The CA screen prints that sentence.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_STRUCTURES);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) {
    return NextResponse.json({ success: false, error: "No CA structure was sent." }, { status: 400 });
  }
  if (list.length > TIER_KEYS.length) {
    return NextResponse.json(
      { success: false, error: `There are ${TIER_KEYS.length} tiers in the school, so ${list.length} structures in one submission is not a thing.` },
      { status: 400 }
    );
  }

  const rows: StructureInput[] = [];
  const seenTiers = new Set<string>();

  for (const item of list as StructurePayload[]) {
    const sent = item as Record<string, unknown>;
    const tierKey = String(sent.tierKey ?? sent.tier_key ?? "").trim();
    if (!(TIER_KEYS as readonly string[]).includes(tierKey)) {
      return NextResponse.json(
        { success: false, error: `“${tierKey || "(none)"}” is not a tier the school runs. Use ${TIER_KEYS.join(", ")}.` },
        { status: 400 }
      );
    }
    if (seenTiers.has(tierKey)) {
      return NextResponse.json(
        { success: false, error: `${TIER_LABELS[tierKey]} was sent twice in one submission.` },
        { status: 400 }
      );
    }
    seenTiers.add(tierKey);

    const where = TIER_LABELS[tierKey];
    if (!Array.isArray(item?.components)) {
      return NextResponse.json(
        { success: false, error: `${where}: no list of assessment components was sent, so nothing was filed.` },
        { status: 400 }
      );
    }
    if (item.components.length < 1 || item.components.length > MAX_COMPONENTS) {
      return NextResponse.json(
        { success: false, error: `${where} has ${item.components.length} components. A tier is assessed by between 1 and ${MAX_COMPONENTS}.` },
        { status: 400 }
      );
    }

    const note = typeof sent.description === "string" ? sent.description.trim() : "";
    if (note.length > NOTE_MAX) {
      return NextResponse.json(
        { success: false, error: `${where}: the note about this tier is ${note.length} characters and the school's records hold ${NOTE_MAX}.` },
        { status: 400 }
      );
    }

    const components: StoredComponent[] = [];
    const seenKeys = new Set<string>();
    for (const [index, raw] of (item.components as ComponentPayload[]).entries()) {
      const entry = (raw ?? {}) as Record<string, unknown>;
      const label = `${where}, component ${index + 1}`;

      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      if (name.length < 2) {
        return NextResponse.json(
          { success: false, error: `${label} has no name. A mark sheet column needs a heading a teacher recognises.` },
          { status: 400 }
        );
      }
      if (name.length > NAME_MAX) {
        return NextResponse.json(
          { success: false, error: `${label}: “${name.slice(0, 40)}” is ${name.length} characters long and the heading column holds ${NAME_MAX}.` },
          { status: 400 }
        );
      }

      const key = typeof entry.key === "string" ? entry.key.trim() : "";
      if (!COMPONENT_KEY.test(key)) {
        return NextResponse.json(
          { success: false, error: `${label} (“${name.slice(0, 40)}”) has the code “${key || "(none)"}”. A code starts with a letter and holds letters, numbers or underscores.` },
          { status: 400 }
        );
      }
      if (seenKeys.has(key.toLowerCase())) {
        return NextResponse.json(
          { success: false, error: `${label} (“${name.slice(0, 40)}”) repeats the code “${key}”, so the two columns could not be told apart.` },
          { status: 400 }
        );
      }
      seenKeys.add(key.toLowerCase());

      const maxScore = Number(entry.maxScore ?? entry.max_score);
      if (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 100) {
        return NextResponse.json(
          { success: false, error: `${label} (“${name.slice(0, 40)}”) is out of ${entry.maxScore ?? entry.max_score ?? "(nothing)"} marks. A component carries between 1 and 100 whole marks.` },
          { status: 400 }
        );
      }

      const description = typeof entry.description === "string" ? entry.description.trim() : "";
      if (description.length > COMPONENT_DESCRIPTION_MAX) {
        return NextResponse.json(
          { success: false, error: `${label} (“${name.slice(0, 40)}”) has a ${description.length}-character description and the school's records hold ${COMPONENT_DESCRIPTION_MAX}.` },
          { status: 400 }
        );
      }

      components.push({ key, name, max_score: maxScore, description });
    }

    rows.push({ tier_key: tierKey, components, description: note });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // Who filed the row is recorded only on the tier's first write, so correcting a
  // structure names the person who set it up while the last edit is still
  // visible beside it.
  const { data: existing, error: readError } = await supabase
    .from("ca_component_structures")
    .select("tier_key")
    .in("tier_key", rows.map((row) => row.tier_key));
  if (readError) {
    const setup = databaseSetupRequired(readError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: readError.message }, { status: 502 });
  }
  const alreadyFiled = new Set(((existing ?? []) as { tier_key: string }[]).map((row) => row.tier_key));

  const saved: StructureRow[] = [];
  for (const row of rows) {
    const at = new Date().toISOString();
    const who = access.session.username;
    const payload: StructureWrite = alreadyFiled.has(row.tier_key)
      ? {
          tier_key: row.tier_key,
          components: row.components,
          description: row.description,
          updated_at: at,
          updated_by: who,
        }
      : {
          tier_key: row.tier_key,
          components: row.components,
          description: row.description,
          created_at: at,
          created_by: who,
          updated_at: at,
          updated_by: who,
        };

    const { data, error } = await supabase
      .from("ca_component_structures")
      .upsert(payload, { onConflict: "tier_key" })
      .select("*");
    if (error) {
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    if (data) saved.push(...(data as StructureRow[]));
  }

  return NextResponse.json({ success: true, data: saved });
}
