import { saveMetaValue, getMetaValue } from './offlineDb';

/**
 * Clean up only truly transient diagnostic logs or sync logs if needed,
 * NEVER wiping user courses, exams, or question bank.
 */
export function clearNonEssentialLocalStorageCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.includes('temp_debug_') ||
        k.startsWith('temp_preview_')
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
      window.indexedDB.deleteDatabase('VocabMemorizerDB');
    }
  } catch (e) {
    console.warn('Error purging IndexedDB database:', e);
  }
}

/**
 * Safe local storage setter
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    // If quota exceeded, clean truly non-essential logs and try once more
    clearNonEssentialLocalStorageCache();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }
}

export function safeGetLocalStorage(key: string, defaultValue: string | null = null): string | null {
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
 * In-memory ultra-fast cache
 */
const inMemoryCache = new Map<string, any>();

/**
 * setLargeStorage persists data in memory AND IndexedDB (and localStorage if within size limit)
 */
export async function setLargeStorage(key: string, data: any): Promise<boolean> {
  try {
    inMemoryCache.set(key, data);
    
    // Save to IndexedDB asynchronously
    saveMetaValue(key, data).catch(() => {});

    // For moderately sized data, also store in localStorage as immediate fallback
    try {
      const jsonStr = JSON.stringify(data);
      if (jsonStr.length < 2000000) { // < 2MB
        localStorage.setItem(`idb_backup_${key}`, jsonStr);
      }
    } catch (_) {}

    return true;
  } catch (_) {
    return false;
  }
}

/**
 * getLargeStorage retrieves from in-memory cache, then IndexedDB, then localStorage backup
 */
export async function getLargeStorage<T = any>(key: string, defaultValue: T | null = null): Promise<T | null> {
  // 1. Fast in-memory check
  if (inMemoryCache.has(key)) {
    return inMemoryCache.get(key) as T;
  }

  // 2. Check IndexedDB
  try {
    const idbVal = await getMetaValue(key);
    if (idbVal !== null && idbVal !== undefined) {
      inMemoryCache.set(key, idbVal);
      return idbVal as T;
    }
  } catch (_) {}

  // 3. Check localStorage backup
  try {
    const raw = localStorage.getItem(`idb_backup_${key}`) || localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      inMemoryCache.set(key, parsed);
      return parsed as T;
    }
  } catch (_) {}

  return defaultValue;
}

