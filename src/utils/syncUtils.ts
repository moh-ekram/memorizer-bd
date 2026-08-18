import { UserProgress, StudyGoal, CustomFolder, AppSettings } from '../types';

/**
 * Merge two progress dictionaries comparing updatedAt timestamps per word.
 * If incoming has newer timestamp, it wins.
 * If timestamps are equal or missing, rated words take precedence over unrated words.
 */
export function mergeProgressRecords(
  base: Record<string, UserProgress> = {},
  incoming: Record<string, UserProgress> = {}
): Record<string, UserProgress> {
  const result: Record<string, UserProgress> = { ...base };

  Object.keys(incoming).forEach((wordId) => {
    const incItem = incoming[wordId];
    if (!incItem) return;

    const existing = result[wordId];
    if (!existing) {
      result[wordId] = { ...incItem };
      return;
    }

    const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    const incomingTime = incItem.updatedAt ? new Date(incItem.updatedAt).getTime() : 0;

    const existStatus = existing.status || 'unrated';
    const incStatus = incItem.status || 'unrated';

    // Priority 1: If one is rated ('known', 'confused', 'dont_know') and the other is 'unrated', always preserve rated status
    if (existStatus === 'unrated' && incStatus !== 'unrated') {
      result[wordId] = {
        ...existing,
        ...incItem,
        notes: incItem.notes !== undefined ? incItem.notes : (existing.notes || ''),
        bookmarks: Array.from(new Set([...(existing.bookmarks || []), ...(incItem.bookmarks || [])]))
      };
      return;
    }
    if (existStatus !== 'unrated' && incStatus === 'unrated') {
      result[wordId] = {
        ...existing,
        notes: incItem.notes || existing.notes || '',
        bookmarks: Array.from(new Set([...(existing.bookmarks || []), ...(incItem.bookmarks || [])]))
      };
      return;
    }

    // Priority 2: Both are rated (or both unrated) - compare timestamps
    if (incomingTime > existingTime) {
      result[wordId] = {
        ...existing,
        ...incItem,
        notes: incItem.notes !== undefined ? incItem.notes : (existing.notes || ''),
        bookmarks: Array.from(new Set([...(existing.bookmarks || []), ...(incItem.bookmarks || [])]))
      };
    } else {
      result[wordId] = {
        ...existing,
        notes: existing.notes || incItem.notes || '',
        bookmarks: Array.from(new Set([...(existing.bookmarks || []), ...(incItem.bookmarks || [])]))
      };
    }
  });

  return result;
}

/**
 * Merge game progress records (synonyms, blank, ooo, analogy) by timestamp
 */
export function mergeGameProgressRecords<T extends { correct: boolean; updatedAt?: string }>(
  base: Record<string, T> = {},
  incoming: Record<string, T> = {}
): Record<string, T> {
  const result: Record<string, T> = { ...base };
  Object.keys(incoming).forEach((key) => {
    const inc = incoming[key];
    if (!inc) return;
    const exist = result[key];
    if (!exist) {
      result[key] = { ...inc };
      return;
    }
    const existTime = exist.updatedAt ? new Date(exist.updatedAt).getTime() : 0;
    const incTime = inc.updatedAt ? new Date(inc.updatedAt).getTime() : 0;
    if (incTime >= existTime) {
      result[key] = { ...inc };
    }
  });
  return result;
}

/**
 * Merge StudyGoal history taking the max study count per day so history is never lost
 */
export function mergeStudyGoal(
  base: StudyGoal = { dailyTarget: 15, streak: 1, lastStudyDate: new Date().toISOString().split('T')[0], history: {} },
  incoming: Partial<StudyGoal> = {}
): StudyGoal {
  const baseHistory = base.history || {};
  const incHistory = incoming.history || {};
  const allDates = Array.from(new Set([...Object.keys(baseHistory), ...Object.keys(incHistory)]));
  const mergedHistory: Record<string, number> = {};

  allDates.forEach((d) => {
    mergedHistory[d] = Math.max(baseHistory[d] || 0, incHistory[d] || 0);
  });

  return {
    dailyTarget: incoming.dailyTarget || base.dailyTarget || 15,
    streak: Math.max(base.streak || 0, incoming.streak || 0),
    lastStudyDate: incoming.lastStudyDate || base.lastStudyDate || new Date().toISOString().split('T')[0],
    history: mergedHistory
  };
}
