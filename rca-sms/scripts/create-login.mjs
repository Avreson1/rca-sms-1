#!/usr/bin/env node
// Creates (or resets) a Supabase Auth login and links it to an existing staff or student record.
//
//   node scripts/create-login.mjs --email admin@school.ng --password '<strong password>' --staff-id RCA/PERS/025
//   node scripts/create-login.mjs --email parent@mail.com --password '<strong password>' --admission-no RCA/STD/2026/001
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
if (!args.email || !args.password || (!args["staff-id"] && !args["admission-no"])) {
  console.error("Usage: --email <email> --password <password> (--staff-id <id> | --admission-no <no>)");
  process.exit(1);
}
if (args.password.length < 10) {
  console.error("Use a password of at least 10 characters.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit || data.users.length < 200) return hit ?? null;
  }
  return null;
}

let user = await findUserByEmail(args.email);
if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: args.password });
  if (error) throw error;
  console.log(`Updated password for existing auth user ${args.email}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
  console.log(`Created auth user ${args.email}`);
}

if (args["staff-id"]) {
  const { data, error } = await admin
    .from("staff")
    .update({ auth_user_id: user.id, email: args.email })
    .eq("staff_id", args["staff-id"])
    .select("staff_id, full_name, role");
  if (error) throw error;
  if (!data.length) throw new Error(`No staff record with staff_id ${args["staff-id"]}`);
  console.log(`Linked to staff ${data[0].full_name} (${data[0].role})`);
} else {
  const { data, error } = await admin
    .from("students")
    .update({ portal_user_id: user.id })
    .eq("admission_no", args["admission-no"])
    .select("admission_no, full_name");
  if (error) throw error;
  if (!data.length) throw new Error(`No student with admission_no ${args["admission-no"]}`);
  console.log(`Linked to student ${data[0].full_name}`);
}
