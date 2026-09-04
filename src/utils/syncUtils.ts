import { UserProgress, StudyGoal, CustomFolder, AppSettings } from '../types';

/**
 * Produce a deterministic, key-sorted JSON snapshot of a value so two
 * semantically-equal maps (even with different insertion orders) compare equal.
 * Used to detect *real* content changes so we never drop remote updates and
 * never write pointless no-op cloud documents (which caused ping-pong sync
 * loops and clobbered other devices' progress).
 */
export function canonicalJson(value: any): string {
  if (value === null || value === undefined) return 'null';
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return String(value);
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalJson(v)).join(',') + ']';
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson((value as any)[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

/** Compare two records/objects deeply but ignoring key insertion order. */
export function deepContentEqual(a: any, b: any): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/**
 * Pick only the user-data fields that are synced to the cloud (everything
 * except bookkeeping like email/updatedAt/createdAt).
 */
export function pickSyncFields(docData: any): Record<string, any> {
  if (!docData || typeof docData !== 'object') return {};
  const picked: Record<string, any> = {};
  const fields = [
    'progress',
    'folders',
    'goal',
    'synonymProgress',
    'blankProgress',
    'oooProgress',
    'analogyProgress',
    'flashcardPositions',
    'settings',
    'enrolledCourseIds',
    'activeCourseId',
    'quizScore',
    'quizTaken'
  ];
  for (const f of fields) {
    if (docData[f] !== undefined) picked[f] = docData[f];
  }
  return picked;
}

/** Humanly-merge two full cloud payloads into a single "cloud truth" object. */
export function mergeCloudPayloads(base: any = {}, incoming: any = {}): Record<string, any> {
  const out: Record<string, any> = { ...base };
  const src = incoming && typeof incoming === 'object' ? incoming : {};
  if (src.progress && typeof src.progress === 'object') {
    out.progress = mergeProgressRecords(out.progress || {}, src.progress);
  }
  if (src.synonymProgress && typeof src.synonymProgress === 'object') {
    out.synonymProgress = mergeGameProgressRecords(out.synonymProgress || {}, src.synonymProgress);
  }
  if (src.blankProgress && typeof src.blankProgress === 'object') {
    out.blankProgress = mergeGameProgressRecords(out.blankProgress || {}, src.blankProgress);
  }
  if (src.oooProgress && typeof src.oooProgress === 'object') {
    out.oooProgress = mergeGameProgressRecords(out.oooProgress || {}, src.oooProgress);
  }
  if (src.analogyProgress && typeof src.analogyProgress === 'object') {
    out.analogyProgress = mergeGameProgressRecords(out.analogyProgress || {}, src.analogyProgress);
  }
  if (src.flashcardPositions && typeof src.flashcardPositions === 'object') {
    out.flashcardPositions = mergeGameProgressRecords(out.flashcardPositions || {}, src.flashcardPositions);
  }
  if (src.goal && typeof src.goal === 'object') {
    out.goal = mergeStudyGoal(out.goal || {}, src.goal);
  }
  if (Array.isArray(src.folders) && src.folders.length > 0) {
    out.folders = src.folders;
  }
  if (src.settings && typeof src.settings === 'object') {
    out.settings = { ...(out.settings || {}), ...src.settings };
  }
  if (Array.isArray(src.enrolledCourseIds)) {
    out.enrolledCourseIds = Array.from(new Set([
      ...(Array.isArray(out.enrolledCourseIds) ? out.enrolledCourseIds : []),
      ...src.enrolledCourseIds.map((id: any) => (typeof id === 'string' ? id.trim().toLowerCase() : ''))
    ])).filter(Boolean);
  }
  if (typeof src.activeCourseId === 'string' && src.activeCourseId.trim()) {
    out.activeCourseId = src.activeCourseId.trim().toLowerCase();
  }
  if (typeof src.quizScore === 'number') {
    out.quizScore = Math.max(typeof out.quizScore === 'number' ? out.quizScore : 0, src.quizScore);
  }
  if (typeof src.quizTaken === 'number') {
    out.quizTaken = Math.max(typeof out.quizTaken === 'number' ? out.quizTaken : 0, src.quizTaken);
  }
  return out;
}

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
 * Merge game progress records (synonyms, blank, ooo, analogy, flashcard
 * positions) by timestamp. Only requires `updatedAt` — callers whose records
 * also carry a `correct` field (the quiz-style game progress types) satisfy
 * this just as well, since TypeScript's structural typing allows passing
 * objects with extra properties.
 */
export function mergeGameProgressRecords<T extends { updatedAt?: string }>(
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
