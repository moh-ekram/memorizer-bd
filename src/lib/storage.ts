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
