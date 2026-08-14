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
        k.includes('activity_logs') ||
        k.includes('sync_logs')
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

export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`localStorage.setItem error for key "${key}":`, err);
    clearNonEssentialLocalStorageCache();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      console.warn(`Failed to set "${key}" in localStorage after cache purge:`, retryErr);
      return false;
    }
  }
}

export function safeGetLocalStorage(key: string, defaultValue: string | null = null): string | null {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : defaultValue;
  } catch (err) {
    console.warn(`localStorage.getItem error for key "${key}":`, err);
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

// --- IndexedDB Async Storage for Large Data Collections ---
const DB_NAME = 'MemorizerAppDB';
const DB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject('IndexedDB not supported');
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('keyvalue')) {
        db.createObjectStore('keyvalue');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setLargeStorage(key: string, data: any): Promise<boolean> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keyvalue', 'readwrite');
      const store = tx.objectStore('keyvalue');
      const req = store.put(data, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    // Also mirror to localStorage if small enough
    try {
      safeSetLocalStorage(key, typeof data === 'string' ? data : JSON.stringify(data));
    } catch (_) {}
    return true;
  } catch (err) {
    console.warn(`IndexedDB save fallback for ${key}:`, err);
    return safeSetLocalStorage(key, typeof data === 'string' ? data : JSON.stringify(data));
  }
}

export async function getLargeStorage<T = any>(key: string, defaultValue: T | null = null): Promise<T | null> {
  try {
    const db = await openIDB();
    const val = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction('keyvalue', 'readonly');
      const store = tx.objectStore('keyvalue');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
    if (val !== null && val !== undefined) {
      return val as T;
    }
  } catch (_) {}

  try {
    const lsVal = safeGetLocalStorage(key, null);
    if (lsVal) {
      return typeof defaultValue === 'object' ? JSON.parse(lsVal) : (lsVal as any);
    }
  } catch (_) {}

  return defaultValue;
}
