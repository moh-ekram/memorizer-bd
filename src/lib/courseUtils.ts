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
 * If either ID is empty, 'all', or 'general', matches true so questions are accessible.
 */
export function matchesCourseId(qCourseId?: string | null, targetCourseId?: string | null): boolean {
  if (!targetCourseId || targetCourseId.trim() === '' || targetCourseId === 'all') return true;
  if (!qCourseId || qCourseId.trim() === '' || qCourseId === 'all' || qCourseId === 'general') return true;
  
  const cleanTarget = targetCourseId.trim().toLowerCase();
  const cleanQ = qCourseId.trim().toLowerCase();
  if (cleanQ === cleanTarget || cleanTarget.includes(cleanQ) || cleanQ.includes(cleanTarget)) return true;

  const normTarget = cleanTarget.replace(/[^a-z0-9]/g, '');
  const normQ = cleanQ.replace(/[^a-z0-9]/g, '');
  if (normQ === normTarget || normTarget.includes(normQ) || normQ.includes(normTarget)) return true;
  
  return false;
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
