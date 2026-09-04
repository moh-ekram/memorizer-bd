/**
 * Completely purges all heavy offline/local dataset caches from browser storage
 * to keep memory and CPU usage minimal and eliminate browser lag.
 */
export function clearNonEssentialLocalStorageCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('local_store_') ||
        k.startsWith('questions_cache_') ||
        k.startsWith('vocab_memorizer_cached_') ||
        k.startsWith('cache_seats_') ||
        k.startsWith('cache_config_') ||
        k.startsWith('local_question_bank') ||
        k.startsWith('local_exams') ||
        k.includes('activity_logs') ||
        k.includes('sync_logs') ||
        k.includes('deleted_question_ids')
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch (_) {}
    });
  } catch (e) {
    console.warn('Error cleaning up non-essential localStorage cache:', e);
  }
}

/**
 * Purges IndexedDB completely to free up all browser disk space and RAM.
 */
export function purgeIndexedDBCache(): void {
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      window.indexedDB.deleteDatabase('MemorizerAppDB');
    }
  } catch (e) {
    console.warn('Error purging IndexedDB database:', e);
  }
}

// Only clean up non-essential temporary caches on module load, preserve IndexedDB and user study data
if (typeof window !== 'undefined') {
  clearNonEssentialLocalStorageCache();
}

/**
 * Safe local storage setter - ignores large heavy dataset keys
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  // Allow essential user progress & core study state keys without artificial size throttling
  const isEssentialUserStateKey = 
    key === 'vocab_memorizer_progress_v2' || 
    key === 'vocab_memorizer_folders' ||
    key === 'vocab_memorizer_goals' ||
    key === 'vocab_memorizer_settings' ||
    key === 'vocab_memorizer_synonym_progress' ||
    key === 'vocab_memorizer_blank_progress' ||
    key === 'vocab_memorizer_ooo_progress' ||
    key === 'vocab_memorizer_analogy_progress' ||
    key === 'vocab_memorizer_flashcard_positions' ||
    key === 'vocab_memorizer_enrolled_courses' ||
    key === 'vocab_memorizer_active_course_id' ||
    key === 'vocab_memorizer_quiz_score' ||
    key === 'vocab_memorizer_quiz_taken';

  // Disallow caching heavy dataset keys (e.g. bulk question banks or large server response dumps)
  if (!isEssentialUserStateKey) {
    if (
      key.startsWith('local_store_') ||
      key.startsWith('questions_cache_') ||
      key.startsWith('vocab_memorizer_cached_') ||
      key.startsWith('local_question_bank') ||
      key.startsWith('local_exams') ||
      key.startsWith('cache_seats_') ||
      key.length > 50000 || // Prevent large string dumps
      (value && value.length > 50000)
    ) {
      return false;
    }
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    clearNonEssentialLocalStorageCache();
    // Retry once after clearing transient non-essential caches
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }
}

export function safeGetLocalStorage(key: string, defaultValue: string | null = null): string | null {
  // If requesting a large dataset cache key, return null so app uses fresh cloud state directly
  if (
    key.startsWith('local_store_') ||
    key.startsWith('questions_cache_') ||
    key.startsWith('vocab_memorizer_cached_') ||
    key.startsWith('local_question_bank') ||
    key.startsWith('local_exams') ||
    key.startsWith('cache_seats_')
  ) {
    return defaultValue;
  }

  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

export function safeRemoveLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`localStorage.removeItem error for key "${key}":`, err);
  }
}

/**
 * In-memory temporary fallback store (zero browser disk writing)
 */
const inMemoryCache = new Map<string, any>();

/**
 * setLargeStorage now operates as a lightweight in-memory reference only,
 * completely bypassing IndexedDB and localStorage to eliminate browser load.
 */
export async function setLargeStorage(key: string, data: any): Promise<boolean> {
  try {
    inMemoryCache.set(key, data);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * getLargeStorage retrieves in-memory data if available or falls back to defaultValue.
 */
export async function getLargeStorage<T = any>(key: string, defaultValue: T | null = null): Promise<T | null> {
  if (inMemoryCache.has(key)) {
    return inMemoryCache.get(key) as T;
  }
  return defaultValue;
}
