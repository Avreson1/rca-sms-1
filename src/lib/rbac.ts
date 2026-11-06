export type UserRole = "SUPER_ADMIN" | "EXAM_OFFICER" | "TEACHER" | "ACCOUNTANT" | "STUDENT_PARENT" | "TESTERS";

export interface RoleAccessRule {
  allowedPrefixes: string[];
  exactRoutes: string[];
  deniedPrefixes: string[];
}

export const ROLE_ROUTE_ACCESS: Record<UserRole, RoleAccessRule> = {
  SUPER_ADMIN: {
    allowedPrefixes: ["/"],
    exactRoutes: ["/", "/login"],
    deniedPrefixes: [],
  },
  EXAM_OFFICER: {
    allowedPrefixes: [
      "/setup/calendar",
      "/setup/sections",
      "/setup/classes",
      "/setup/subjects",
      "/setup/subject-templates",
      "/setup/ca-structure",
      "/setup/grading",
      "/setup/pass-scores",
      "/setup/traits",
      "/setup/houses",
      "/setup/report-templates",
      "/operations",
      "/cbt",
      "/inmail",
      "/reports",
      "/video-guides",
    ],
    exactRoutes: ["/", "/login"],
    deniedPrefixes: ["/setup/fees", "/accounts", "/settings"],
  },
  TEACHER: {
    allowedPrefixes: [
      "/operations/students",
      "/operations/academics",
      "/operations/update-ca",
      "/operations/traits-assessments",
      "/operations/score-card",
      "/operations/duties",
      "/cbt",
      "/inmail",
    ],
    exactRoutes: ["/", "/login"],
    deniedPrefixes: [
      "/setup",
      "/operations/staff",
      "/operations/publish-results",
      "/operations/promotion",
      "/operations/end-term",
      "/operations/send-sms",
      "/operations/send-email",
      "/accounts",
      "/reports",
      "/settings",
      "/video-guides",
    ],
  },
  ACCOUNTANT: {
    allowedPrefixes: [
      "/setup/fees",
      "/accounts",
      "/operations/students",
      "/operations/duties",
      "/inmail",
      "/reports",
    ],
    exactRoutes: ["/", "/login"],
    deniedPrefixes: [
      "/setup/calendar",
      "/setup/sections",
      "/setup/classes",
      "/setup/subjects",
      "/setup/subject-templates",
      "/setup/ca-structure",
      "/setup/grading",
      "/setup/pass-scores",
      "/setup/traits",
      "/setup/houses",
      "/setup/report-templates",
      "/operations/staff",
      "/operations/academics",
      "/operations/update-ca",
      "/operations/traits-assessments",
      "/operations/publish-results",
      "/operations/promotion",
      "/operations/end-term",
      "/operations/send-sms",
      "/operations/send-email",
      "/cbt",
      "/settings",
      "/video-guides",
    ],
  },
  STUDENT_PARENT: {
    allowedPrefixes: [
      "/operations/score-card",
      "/cbt",
      "/accounts/invoicing",
      "/inmail",
    ],
    exactRoutes: ["/", "/login"],
    deniedPrefixes: [
      "/setup",
      "/operations/students",
      "/operations/staff",
      "/operations/academics",
      "/operations/update-ca",
      "/operations/traits-assessments",
      "/operations/publish-results",
      "/operations/promotion",
      "/operations/end-term",
      "/operations/send-sms",
      "/operations/send-email",
      "/accounts/payment",
      "/accounts/transactions",
      "/accounts/inventory",
      "/reports",
      "/settings",
      "/video-guides",
    ],
  },
  TESTERS: {
    // QA role: can navigate and exercise every module, but never reaches the
    // settings/purge screens or passes any write authorization check.
    allowedPrefixes: ["/"],
    exactRoutes: ["/", "/login"],
    deniedPrefixes: ["/settings"],
  },
};

/**
 * Checks if a specific route is accessible for a given role.
 */
export function isRouteAllowed(role: UserRole | string | undefined, pathname: string): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (pathname === "/" || pathname === "/login" || pathname === "/_not-found") return true;
  if (!role) return false;

  const normalizedRole = role as UserRole;
  const config = ROLE_ROUTE_ACCESS[normalizedRole];
  if (!config) return false;

  // If explicitly denied
  if (config.deniedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    return false;
  }

  // If in allowed exact routes
  if (config.exactRoutes.includes(pathname)) {
    return true;
  }

  // If in allowed prefixes
  return config.allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

/**
 * The roles that may open a path. A refused screen names them so the visitor
 * knows whose login to ask for, instead of the "Tier 1 / Tier 2 governance
 * staff" clearance level it used to invent.
 */
export function rolesAllowedForPath(pathname: string): UserRole[] {
  return (Object.keys(ROLE_ROUTE_ACCESS) as UserRole[]).filter((role) => isRouteAllowed(role, pathname));
}

/**
 * Checks if a specific action (e.g. DELETE_STUDENT, PUBLISH_RESULTS) is authorized.
 */export function isActionAuthorized(
  role: UserRole | string | undefined,
  action:
    | "EDIT_SETUP"
    | "EDIT_FEES"
    | "PUBLISH_RESULTS"
    | "ENTER_CA"
    | "SYSTEM_PURGE"
    | "EDIT_STAFF"
    | "ASSIGN_DUTIES"
): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (!role) return false;

  switch (action) {
    case "SYSTEM_PURGE":
      return role === "SUPER_ADMIN";
    case "EDIT_SETUP":
      return role === "SUPER_ADMIN" || role === "EXAM_OFFICER";
    case "EDIT_FEES":
      return role === "SUPER_ADMIN" || role === "ACCOUNTANT";
    case "PUBLISH_RESULTS":
      return role === "SUPER_ADMIN" || role === "EXAM_OFFICER";
    case "ENTER_CA":
      return role === "SUPER_ADMIN" || role === "EXAM_OFFICER" || role === "TEACHER";
    case "EDIT_STAFF":
      return role === "SUPER_ADMIN";
    // Same pair that files the timetable: naming who is at the gate is an act of
    // the office, and it is not open to a teacher, so a colleague cannot move a
    // duty off somebody without that person seeing it happen.
    case "ASSIGN_DUTIES":
      return role === "SUPER_ADMIN" || role === "EXAM_OFFICER";
    default:
      return false;
  }
}
