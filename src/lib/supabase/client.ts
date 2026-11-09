// The browser does not speak to Supabase. Every read and write goes through an
// authenticated API route, which holds the service-role key server-side and
// decides what the signed-in role may see.
//
// What is left here is one question the screens ask: does this build point at a
// database at all? A portal deployed without the address cannot file anything,
// and the screens say so instead of pretending a write landed.
//
// Only the address is asked for. The anon/publishable key used to be part of
// this check, but nothing in the browser reads it any more — the server routes
// hold their own secret key — so demanding it refused enrolments on deployments
// whose database was perfectly reachable.
//
// A Supabase client built from the anon key used to live in this file. It could
// read nothing — the tables are protected by row-level security with no policy
// for the anon key — so every use of it was either refused or a silent empty
// result, and its presence invited the next screen to bypass the API routes.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

// Next inlines NEXT_PUBLIC_ addresses from .env files at build time, but a host
// like Render supplies them in the runtime environment only, so the built
// bundle can carry no address at all. The proxy stamps what the server actually
// holds onto every document response; this cookie is that answer. It carries a
// boolean, never a key or an address.
export const DATABASE_FLAG_COOKIE = "rca_db_configured";

const runtimeSaysConfigured =
  typeof document !== "undefined" &&
  document.cookie.split("; ").includes(`${DATABASE_FLAG_COOKIE}=1`);

export const isSupabaseConfigured =
  Boolean(supabaseUrl && !supabaseUrl.includes("placeholder")) || runtimeSaysConfigured;
