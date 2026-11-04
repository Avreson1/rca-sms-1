import { NextResponse } from "next/server";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// A free Supabase project is paused after seven quiet days, and a school is quiet
// for longer than that over every holiday. The portal then fails on the first
// morning back with an error that does not mention the word "paused". A scheduled
// visit to this route is what keeps it awake, so the route deliberately answers
// reachability and nothing else: the query is a count with no rows returned, and
// the number is not sent back, because this URL is open to anyone.
export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { error } = await supabase.from("staff").select("id", { count: "exact", head: true });
  if (error) {
    return NextResponse.json({ success: false, database: "unreachable" }, { status: 503 });
  }

  return NextResponse.json({ success: true, database: "reachable" });
}
