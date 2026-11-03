import { createHash, timingSafeEqual } from "node:crypto";
import type { SessionRole, SessionUser } from "./session";

interface AccountRecord extends SessionUser {
  password: string;
}

interface RoleEnvConfig {
  role: SessionRole;
  prefix: string;
}

const ROLE_ENV: RoleEnvConfig[] = [
  { role: "SUPER_ADMIN", prefix: "AUTH_SUPER_ADMIN" },
  { role: "EXAM_OFFICER", prefix: "AUTH_EXAM_OFFICER" },
  { role: "TEACHER", prefix: "AUTH_TEACHER" },
  { role: "ACCOUNTANT", prefix: "AUTH_ACCOUNTANT" },
  { role: "STUDENT_PARENT", prefix: "AUTH_STUDENT_PARENT" },
];

// Local development only. Production credentials must come from AUTH_<ROLE>_* env vars.
const DEV_ACCOUNTS: AccountRecord[] = [
  {
    username: "dominic370",
    password: "admin123",
    role: "SUPER_ADMIN",
    fullName: "Dr. Dominic Mark",
    staffId: "RCA/PERS/025",
    email: "dominic370@royalcrownacademy.edu.ng",
  },
  {
    username: "exam_officer",
    password: "exam123",
    role: "EXAM_OFFICER",
    fullName: "Prof. Jeremiah Alabi",
    staffId: "RCA/PERS/012",
    email: "exam_officer@royalcrownacademy.edu.ng",
  },
  {
    username: "teacher_grace",
    password: "teach123",
    role: "TEACHER",
    fullName: "Mrs. Grace Adams",
    staffId: "RCA/PERS/048",
    email: "teacher_grace@royalcrownacademy.edu.ng",
  },
  {
    username: "bursar_accounts",
    password: "bursar123",
    role: "ACCOUNTANT",
    fullName: "Mr. Samuel Danladi",
    staffId: "RCA/PERS/008",
    email: "bursar_accounts@royalcrownacademy.edu.ng",
  },
  {
    username: "parent_rca",
    password: "parent123",
    role: "STUDENT_PARENT",
    fullName: "Chief & Mrs. A. Oladipo (Guardian)",
    staffId: "RCA/PAR/104",
    email: "parent_rca@royalcrownacademy.edu.ng",
  },
];

function readAccounts(): AccountRecord[] {
  const accounts: AccountRecord[] = [];

  for (const { role, prefix } of ROLE_ENV) {
    const username = process.env[`${prefix}_USERNAME`];
    const password = process.env[`${prefix}_PASSWORD`];
    if (!username || !password) continue;

    accounts.push({
      username,
      password,
      role,
      fullName: process.env[`${prefix}_NAME`] || username,
      staffId: process.env[`${prefix}_STAFF_ID`] || "",
      email: process.env[`${prefix}_EMAIL`] || "",
    });
  }

  if (process.env.NODE_ENV !== "production") {
    accounts.push(...DEV_ACCOUNTS);
  }

  return accounts;
}

function passwordMatches(expected: string, provided: string): boolean {
  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

export function verifyCredentials(username: string, password: string): SessionUser | null {
  const normalized = username.trim().toLowerCase();

  for (const account of readAccounts()) {
    if (account.username.toLowerCase() !== normalized) continue;
    if (!passwordMatches(account.password, password)) return null;

    const { password: _password, ...user } = account;
    return user;
  }

  return null;
}
