// The browser does not speak to Supabase. Every read and write goes through an
// authenticated API route, which holds the service-role key server-side and
// decides what the signed-in role may see.
//
// What is left here is one question the screens ask: does this build point at a
// database at all? A portal deployed without those two public variables cannot
// file anything, and the screens say so instead of pretending a write landed.
//
// A Supabase client built from the anon key used to live in this file. It could
// read nothing — the tables are protected by row-level security with no policy
// for the anon key — so every use of it was either refused or a silent empty
// result, and its presence invited the next screen to bypass the API routes.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("placeholder") &&
  !supabaseAnonKey.includes("placeholder")
);
