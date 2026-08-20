// src/lib/offlineDb.ts
import { UserProgress } from '../types';

export interface QueuedSyncItem {
  id?: number;
  wordId: string;
  status: string;
  progressData: UserProgress;
  timestamp: string;
}

// In-memory sync queue (zero browser disk storage footprint)
let inMemorySyncQueue: QueuedSyncItem[] = [];
let inMemoryMeta = new Map<string, any>();

// Automatically purge VocabOfflineCache from browser if it exists
if (typeof window !== 'undefined' && window.indexedDB) {
  try {
    window.indexedDB.deleteDatabase('VocabOfflineCache');
  } catch (e) {
    console.warn('Could not purge VocabOfflineCache database:', e);
  }
}

export async function initIndexedDB(): Promise<any> {
  return null;
}

export async function saveProgressToIndexedDB(_progress: Record<string, UserProgress>): Promise<void> {
  // Disabled: offline cache turned off to prevent browser memory/CPU overload
  return;
}

export async function getProgressFromIndexedDB(): Promise<Record<string, UserProgress> | null> {
  // Disabled: return null to always use clean cloud data directly
  return null;
}

export async function addUpdateToSyncQueue(item: Omit<QueuedSyncItem, 'id'>): Promise<void> {
  inMemorySyncQueue.push({
    ...item,
    id: Date.now() + Math.random()
  });
}

export async function getQueuedSyncItems(): Promise<QueuedSyncItem[]> {
  return [...inMemorySyncQueue];
}

export async function clearSyncQueue(): Promise<void> {
  inMemorySyncQueue = [];
}

export async function clearIndexedDBCache(): Promise<void> {
  inMemorySyncQueue = [];
  inMemoryMeta.clear();
  if (typeof window !== 'undefined' && window.indexedDB) {
    try {
      window.indexedDB.deleteDatabase('VocabOfflineCache');
    } catch (_) {}
  }
}

export async function saveMetaValue(key: string, value: any): Promise<void> {
  inMemoryMeta.set(key, value);
}

export async function getMetaValue(key: string): Promise<any> {
  return inMemoryMeta.get(key) || null;
}


