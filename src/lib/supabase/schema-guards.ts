/**
 * Canonical Database Schema Column Whitelist & Guard Filters
 *
 * PostgREST returns a PGRST204 ("Could not find the column '...' of relation
 * '...' in the schema cache") or PostgreSQL throws a 42703 error if an API
 * mutation (.insert, .upsert, .update) submits unknown, deprecated, or UI-only
 * keys (such as `permissions`, `caScores`, camelCase properties, etc.).
 *
 * These guards:
 * 1. Ensure only strictly valid database column keys are forwarded.
 * 2. Cross-reference against the live table columns retrieved from `SELECT *`
 *    (when an existing record is available), so if a migration hasn't been executed
 *    yet in a given environment, unmigrated optional columns are safely stripped
 *    rather than failing the user's write.
 */

export const KNOWN_STAFF_COLUMNS = new Set<string>([
  "id",
  "staff_id",
  "full_name",
  "username",
  "email",
  "phone",
  "role",
  "gender",
  "assigned_subjects",
  "assigned_class",
  "class_id",
  "section_id",
  "is_form_master",
  "email_verified",
  "status",
  "designation",
  "standing_duties",
  "school_brand",
  "staff_type",
  "date_of_birth",
  "employment_date",
  "qualifications",
  "bank_name",
  "account_number",
  "account_name",
  "salary_grade",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "nationality",
  "state_of_origin",
  "photo",
  "created_at",
  "updated_at",
]);

export const KNOWN_STUDENT_COLUMNS = new Set<string>([
  "id",
  "admission_no",
  "full_name",
  "gender",
  "class_name",
  "house",
  "guardian_name",
  "guardian_phone",
  "guardian_email",
  "guardian_address",
  "guardian_relationship",
  "fee_status",
  "status",
  "school_brand",
  "section",
  "date_of_birth",
  "blood_group",
  "medical_notes",
  "allergies",
  "admission_date",
  "nationality",
  "state_of_origin",
  "lga",
  "religion",
  "photo",
  "created_at",
  "updated_at",
]);

/**
 * Strips unknown keys from staff payload.
 * When `existingRecord` from a `SELECT *` query is provided, it verifies whether the
 * column is actually present in the live database schema, preventing PGRST204 errors.
 */
export function filterStaffColumns(
  data: Record<string, unknown>,
  existingRecord?: Record<string, unknown> | null
): Record<string, unknown> {
  const existingKeys =
    existingRecord && typeof existingRecord === "object"
      ? new Set(Object.keys(existingRecord))
      : null;

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (!KNOWN_STAFF_COLUMNS.has(key)) continue;

    // If an existing row was retrieved from `SELECT *`, only send columns that exist in the live schema
    if (existingKeys && existingKeys.size > 0 && !existingKeys.has(key)) {
      continue;
    }

    result[key] = val;
  }
  return result;
}

/**
 * Strips unknown keys from student payload.
 * When `existingRecord` from a `SELECT *` query is provided, it verifies whether the
 * column is actually present in the live database schema, preventing PGRST204 errors.
 */
export function filterStudentColumns(
  data: Record<string, unknown>,
  existingRecord?: Record<string, unknown> | null
): Record<string, unknown> {
  const existingKeys =
    existingRecord && typeof existingRecord === "object"
      ? new Set(Object.keys(existingRecord))
      : null;

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (!KNOWN_STUDENT_COLUMNS.has(key)) continue;

    // If an existing row was retrieved from `SELECT *`, only send columns that exist in the live schema
    if (existingKeys && existingKeys.size > 0 && !existingKeys.has(key)) {
      continue;
    }

    result[key] = val;
  }
  return result;
}
