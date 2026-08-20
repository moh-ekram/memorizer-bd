// src/lib/offlineDb.ts
// Offline database and persistent background syncing have been disabled.
// App now operates in direct online mode to minimize browser memory and CPU load.

import { UserProgress } from '../types';

export interface QueuedSyncItem {
  id?: number;
  wordId: string;
  status: string;
  progressData: UserProgress;
  timestamp: string;
}

// Purge any legacy IndexedDB caches from browser
if (typeof window !== 'undefined' && window.indexedDB) {
  try {
    window.indexedDB.deleteDatabase('VocabOfflineCache');
    window.indexedDB.deleteDatabase('MemorizerAppDB');
  } catch (_) {}
}

export async function initIndexedDB(): Promise<any> {
  return null;
}

export async function saveProgressToIndexedDB(_progress: Record<string, UserProgress>): Promise<void> {
  return;
}

export async function getProgressFromIndexedDB(): Promise<Record<string, UserProgress> | null> {
  return null;
}

export async function addUpdateToSyncQueue(_item: Omit<QueuedSyncItem, 'id'>): Promise<void> {
  return;
}

export async function getQueuedSyncItems(): Promise<QueuedSyncItem[]> {
  return [];
}

export async function clearSyncQueue(): Promise<void> {
  return;
}

export async function clearIndexedDBCache(): Promise<void> {
  if (typeof window !== 'undefined' && window.indexedDB) {
    try {
      window.indexedDB.deleteDatabase('VocabOfflineCache');
      window.indexedDB.deleteDatabase('MemorizerAppDB');
    } catch (_) {}
  }
}

export async function saveMetaValue(_key: string, _value: any): Promise<void> {
  return;
}

export async function getMetaValue(_key: string): Promise<any> {
  return null;
}
