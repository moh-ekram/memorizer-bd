// src/lib/offlineDb.ts
// Robust, high-performance IndexedDB persistence for offline study progress,
// timestamp tracking, and orphaned word recovery.

import { UserProgress } from '../types';
import { mergeProgressRecords } from '../utils/syncUtils';

export interface QueuedSyncItem {
  id?: number;
  wordId: string;
  status: string;
  progressData: UserProgress;
  timestamp: string;
}

const DB_NAME = 'VocabMemorizerDB';
const DB_VERSION = 2;
const STORE_PROGRESS = 'progress';
const STORE_SYNC_QUEUE = 'syncQueue';
const STORE_META = 'meta';

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase | null> | null = null;

export async function initIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }
  if (dbInstance) {
    return dbInstance;
  }
  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
          const store = db.createObjectStore(STORE_PROGRESS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
          const qStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
          qStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        dbInstance.onclose = () => {
          dbInstance = null;
          dbInitPromise = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (err) => {
        console.warn('[IndexedDB] Failed to open database:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('[IndexedDB] Exception opening database:', e);
      resolve(null);
    }
  });

  return dbInitPromise;
}

/**
 * Persists all word progress items into IndexedDB with their respective updatedAt timestamps.
 */
export async function saveProgressToIndexedDB(progress: Record<string, UserProgress>): Promise<void> {
  if (!progress || typeof progress !== 'object') return;
  const db = await initIndexedDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_PROGRESS, 'readwrite');
      const store = tx.objectStore(STORE_PROGRESS);

      const keys = Object.keys(progress);
      for (const wordId of keys) {
        const item = progress[wordId];
        if (!item) continue;
        const record = {
          id: wordId,
          status: item.status || 'unrated',
          notes: item.notes || '',
          bookmarks: Array.isArray(item.bookmarks) ? item.bookmarks : [],
          updatedAt: item.updatedAt || new Date().toISOString(),
          lastReviewed: item.lastReviewed || item.updatedAt || undefined
        };
        store.put(record);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (e) {
      console.warn('[IndexedDB] saveProgress error:', e);
      resolve();
    }
  });
}

/**
 * Saves or updates a single word's progress in IndexedDB.
 */
export async function saveSingleWordProgressToIndexedDB(item: UserProgress): Promise<void> {
  if (!item || !item.id) return;
  const db = await initIndexedDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_PROGRESS, 'readwrite');
      const store = tx.objectStore(STORE_PROGRESS);
      const record = {
        id: item.id,
        status: item.status || 'unrated',
        notes: item.notes || '',
        bookmarks: Array.isArray(item.bookmarks) ? item.bookmarks : [],
        updatedAt: item.updatedAt || new Date().toISOString(),
        lastReviewed: item.lastReviewed || item.updatedAt || undefined
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (_) {
      resolve();
    }
  });
}

/**
 * Reads all word progress items from IndexedDB.
 */
export async function getProgressFromIndexedDB(): Promise<Record<string, UserProgress> | null> {
  const db = await initIndexedDB();
  if (!db) return null;

  return new Promise<Record<string, UserProgress> | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_PROGRESS, 'readonly');
      const store = tx.objectStore(STORE_PROGRESS);
      const request = store.getAll();

      request.onsuccess = () => {
        const results: UserProgress[] = request.result || [];
        if (!results || results.length === 0) {
          resolve(null);
          return;
        }

        const map: Record<string, UserProgress> = {};
        for (const item of results) {
          if (item && item.id) {
            map[item.id] = {
              id: item.id,
              status: item.status || 'unrated',
              notes: item.notes || '',
              bookmarks: Array.isArray(item.bookmarks) ? item.bookmarks : [],
              updatedAt: item.updatedAt,
              lastReviewed: item.lastReviewed
            };
          }
        }
        resolve(map);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch (e) {
      console.warn('[IndexedDB] getProgress error:', e);
      resolve(null);
    }
  });
}

/**
 * Queue an offline update item for resilient background sync.
 */
export async function addUpdateToSyncQueue(item: Omit<QueuedSyncItem, 'id'>): Promise<void> {
  const db = await initIndexedDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      store.add({
        ...item,
        timestamp: item.timestamp || new Date().toISOString()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (_) {
      resolve();
    }
  });
}

export async function getQueuedSyncItems(): Promise<QueuedSyncItem[]> {
  const db = await initIndexedDB();
  if (!db) return [];

  return new Promise<QueuedSyncItem[]>((resolve) => {
    try {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (_) {
      resolve([]);
    }
  });
}

export async function clearSyncQueue(): Promise<void> {
  const db = await initIndexedDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (_) {
      resolve();
    }
  });
}

export async function clearIndexedDBCache(): Promise<void> {
  const db = await initIndexedDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([STORE_PROGRESS, STORE_SYNC_QUEUE], 'readwrite');
      tx.objectStore(STORE_PROGRESS).clear();
      tx.objectStore(STORE_SYNC_QUEUE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (_) {
      resolve();
    }
  });
}

export async function saveMetaValue(key: string, value: any): Promise<void> {
  const db = await initIndexedDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      store.put({ key, value, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (_) {
      resolve();
    }
  });
}

export async function getMetaValue(key: string): Promise<any> {
  const db = await initIndexedDB();
  if (!db) return null;

  return new Promise<any>((resolve) => {
    try {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Cross-references all local progress records (in-memory, localStorage, IndexedDB)
 * against a cloud document to identify and recover any orphaned or unsynced words.
 */
export function crossReferenceOrphanedWords(
  localSources: Array<Record<string, UserProgress> | null | undefined>,
  cloudProgress: Record<string, UserProgress> = {}
): {
  unifiedLocal: Record<string, UserProgress>;
  orphanedWords: Array<{ wordId: string; local: UserProgress; cloud?: UserProgress; reason: string }>;
  mergedUnified: Record<string, UserProgress>;
} {
  // 1. Unify all local sources (in-memory, localStorage, IndexedDB) by timestamp & rating
  let unifiedLocal: Record<string, UserProgress> = {};
  for (const src of localSources) {
    if (src && typeof src === 'object') {
      unifiedLocal = mergeProgressRecords(unifiedLocal, src);
    }
  }

  // 2. Identify orphaned items (exist locally with rated status or newer timestamp, missing or unrated in cloud)
  const orphanedWords: Array<{ wordId: string; local: UserProgress; cloud?: UserProgress; reason: string }> = [];

  Object.keys(unifiedLocal).forEach((wordId) => {
    const loc = unifiedLocal[wordId];
    if (!loc) return;
    const cld = cloudProgress[wordId];

    const locStatus = loc.status || 'unrated';
    const cldStatus = cld?.status || 'unrated';
    const locTime = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
    const cldTime = cld?.updatedAt ? new Date(cld.updatedAt).getTime() : 0;

    if (!cld && locStatus !== 'unrated') {
      orphanedWords.push({ wordId, local: loc, cloud: undefined, reason: 'missing_in_cloud' });
    } else if (cld && locStatus !== 'unrated' && cldStatus === 'unrated') {
      orphanedWords.push({ wordId, local: loc, cloud: cld, reason: 'rated_locally_unrated_in_cloud' });
    } else if (cld && locTime > cldTime + 2000 && locStatus !== cldStatus) {
      orphanedWords.push({ wordId, local: loc, cloud: cld, reason: 'local_timestamp_lead' });
    }
  });

  // 3. Complete reconciliation: Cloud merged with Unified Local
  const mergedUnified = mergeProgressRecords(cloudProgress, unifiedLocal);

  return {
    unifiedLocal,
    orphanedWords,
    mergedUnified
  };
}
