/**
 * Normalizes a course ID to a clean, lowercase, alphanumeric string.
 * Examples:
 *  - "gre-1110" -> "gre1110"
 *  - "GRE-1110" -> "gre1110"
 *  - "gre_1110" -> "gre1110"
 *  - "GRE 1110" -> "gre1110"
 */
export function normalizeCourseId(id?: string | null): string {
  if (!id) return '';
  return id.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Flexible Course ID matching:
 * Checks if two course IDs point to the same course after normalization.
 */
export function matchesCourseId(qCourseId?: string | null, targetCourseId?: string | null): boolean {
  if (!qCourseId || !targetCourseId) return false;
  const n1 = normalizeCourseId(qCourseId);
  const n2 = normalizeCourseId(targetCourseId);
  
  if (!n1 || !n2) return false;
  if (n1 === 'all' || n2 === 'all') return true;
  
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

/**
 * Clears local cached questions for a given collection and course to prevent stale state.
 */
export function clearQuestionsCache(collectionName: string, courseId?: string) {
  try {
    const norm = normalizeCourseId(courseId);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(collectionName)) {
        if (!norm || key.toLowerCase().includes(norm)) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Failed to clear questions cache:', e);
  }
}
