/**
 * Resilient Class Arm & Stream Matcher
 *
 * Reconciles variations between canonical class arms in `class_arms` (e.g. "SS 2"),
 * student records in `students` (which may be enrolled as "SS 2A", "SS 2 A", or "SS 2"),
 * and UUID class_id references.
 */

export function normalizeClassName(str: string | undefined | null): string {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface ClassArmLookupItem {
  id: string;
  name: string;
  section?: string;
}

/**
 * Determines whether a student's class matches the selected class arm identifier.
 *
 * Supports:
 * - "all" selector matching all students
 * - Direct equality ("Primary 1" === "Primary 1")
 * - Case-insensitive & whitespace trimmed ("primary 1" === "Primary 1")
 * - Alphanumeric normalized ("SS 2 A" === "SS 2A" === "SS2A")
 * - Stream-to-arm hierarchy fallback ("SS 2" matches "SS 2A", "SS 2B")
 * - Arm-to-stream hierarchy fallback ("SS 2A" matches "SS 2")
 * - Catalog UUID cross-referencing (matching student.classId or arm.id)
 */
export function matchesClassArm(
  studentClass: string | undefined | null,
  selectedClass: string | undefined | null,
  catalog?: ClassArmLookupItem[],
  studentClassId?: string | null
): boolean {
  if (!selectedClass || selectedClass === "all") return true;
  if (!studentClass && !studentClassId) return false;

  const sName = (studentClass || "").trim();
  const sel = (selectedClass || "").trim();

  // 1. Direct equality
  if (sName === sel) return true;
  if (sName.toLowerCase() === sel.toLowerCase()) return true;

  // 2. Normalized alphanumeric equality
  const sNorm = normalizeClassName(sName);
  const selNorm = normalizeClassName(sel);
  if (sNorm && selNorm && sNorm === selNorm) return true;

  // 3. Catalog cross-referencing (UUID <-> Name)
  if (catalog && catalog.length > 0) {
    const matchedArm = catalog.find(
      (c) =>
        c.id === sel ||
        c.name.toLowerCase() === sel.toLowerCase() ||
        normalizeClassName(c.name) === selNorm
    );

    if (matchedArm) {
      if (studentClassId && matchedArm.id === studentClassId) return true;
      const armNorm = normalizeClassName(matchedArm.name);
      if (sNorm && armNorm && sNorm === armNorm) return true;
      // Stream fallback
      if (sNorm && armNorm) {
        if (sNorm.startsWith(armNorm) || armNorm.startsWith(sNorm)) {
          const diff =
            sNorm.length > armNorm.length
              ? sNorm.slice(armNorm.length)
              : armNorm.slice(sNorm.length);
          if (/^[a-z]?$/i.test(diff) || /^arm[a-z]?$/i.test(diff)) return true;
        }
      }
    }
  }

  // 4. Stream / Arm fallback without catalog (e.g. "SS 2" vs "SS 2A" or "SS 2A" vs "SS 2")
  if (sNorm && selNorm) {
    if (sNorm.startsWith(selNorm) || selNorm.startsWith(sNorm)) {
      const diff =
        sNorm.length > selNorm.length
          ? sNorm.slice(selNorm.length)
          : selNorm.slice(sNorm.length);
      if (/^[a-z]?$/i.test(diff) || /^arm[a-z]?$/i.test(diff)) {
        return true;
      }
    }
  }

  return false;
}
