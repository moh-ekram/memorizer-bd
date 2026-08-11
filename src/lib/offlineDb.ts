// src/lib/offlineDb.ts
import { UserProgress } from '../types';

const DB_NAME = 'VocabOfflineCache';
const DB_VERSION = 1;

export interface QueuedSyncItem {
  id?: number;
  wordId: string;
  status: string;
  progressData: UserProgress;
  timestamp: string;
}

export function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveProgressToIndexedDB(progress: Record<string, UserProgress>): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['progress'], 'readwrite');
      const store = transaction.objectStore('progress');
      
      const request = store.put({ id: 'current_progress', data: progress, updatedAt: new Date().toISOString() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB saveProgress error:', error);
  }
}

export async function getProgressFromIndexedDB(): Promise<Record<string, UserProgress> | null> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['progress'], 'readonly');
      const store = transaction.objectStore('progress');
      const request = store.get('current_progress');
      
      request.onsuccess = () => {
        if (request.result && request.result.data) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB getProgress error:', error);
    return null;
  }
}

export async function addUpdateToSyncQueue(item: Omit<QueuedSyncItem, 'id'>): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.add(item);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB addUpdateToSyncQueue error:', error);
  }
}

export async function getQueuedSyncItems(): Promise<QueuedSyncItem[]> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB getQueuedSyncItems error:', error);
    return [];
  }
}

export async function clearSyncQueue(): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB clearSyncQueue error:', error);
  }
}

export async function clearIndexedDBCache(): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['progress', 'syncQueue', 'meta'], 'readwrite');
      transaction.objectStore('progress').clear();
      transaction.objectStore('syncQueue').clear();
      transaction.objectStore('meta').clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('IndexedDB clearIndexedDBCache error:', error);
  }
}

export async function saveMetaValue(key: string, value: any): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['meta'], 'readwrite');
      const store = transaction.objectStore('meta');
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB saveMetaValue error:', error);
  }
}

export async function getMetaValue(key: string): Promise<any> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['meta'], 'readonly');
      const store = transaction.objectStore('meta');
      const request = store.get(key);
      
      request.onsuccess = () => {
        resolve(request.result ? request.result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB getMetaValue error:', error);
    return null;
  }
}

export interface WordDiscrepancy {
  wordId: string;
  localStatus?: string;
  localUpdatedAt?: string;
  cloudStatus?: string;
  cloudUpdatedAt?: string;
  issue: 'local_only' | 'cloud_only' | 'status_mismatch' | 'timestamp_mismatch';
}

export interface SyncDiagnosticResult {
  hasDiscrepancy: boolean;
  localTotalWords: number;
  cloudTotalWords: number;
  localRatedCount: number;
  cloudRatedCount: number;
  localKnowCount: number;
  cloudKnowCount: number;
  localOnlyCount: number;
  cloudOnlyCount: number;
  statusMismatchCount: number;
  timestampMismatchCount: number;
  queuedSyncCount: number;
  discrepancies: WordDiscrepancy[];
  summaryMessage: string;
}

export async function verifySyncIntegrity(
  localProgress: Record<string, UserProgress> = {},
  cloudProgress: Record<string, UserProgress> = {}
): Promise<SyncDiagnosticResult> {
  const queuedItems = await getQueuedSyncItems();
  const queuedSyncCount = queuedItems.length;

  const localKeys = Object.keys(localProgress || {});
  const cloudKeys = Object.keys(cloudProgress || {});
  const allWordIds = Array.from(new Set([...localKeys, ...cloudKeys]));

  const discrepancies: WordDiscrepancy[] = [];
  let localRatedCount = 0;
  let cloudRatedCount = 0;
  let localKnowCount = 0;
  let cloudKnowCount = 0;

  let localOnlyCount = 0;
  let cloudOnlyCount = 0;
  let statusMismatchCount = 0;
  let timestampMismatchCount = 0;

  for (const wordId of allWordIds) {
    const local = localProgress[wordId];
    const cloud = cloudProgress[wordId];

    const localIsRated = !!(local && local.status && local.status !== 'unrated');
    const cloudIsRated = !!(cloud && cloud.status && cloud.status !== 'unrated');

    if (localIsRated) {
      localRatedCount++;
      if (local.status === 'know') localKnowCount++;
    }
    if (cloudIsRated) {
      cloudRatedCount++;
      if (cloud.status === 'know') cloudKnowCount++;
    }

    if (localIsRated && !cloudIsRated) {
      localOnlyCount++;
      discrepancies.push({
        wordId,
        localStatus: local.status,
        localUpdatedAt: local.updatedAt,
        cloudStatus: cloud?.status || 'unrated',
        cloudUpdatedAt: cloud?.updatedAt,
        issue: 'local_only'
      });
    } else if (!localIsRated && cloudIsRated) {
      cloudOnlyCount++;
      discrepancies.push({
        wordId,
        localStatus: local?.status || 'unrated',
        localUpdatedAt: local?.updatedAt,
        cloudStatus: cloud.status,
        cloudUpdatedAt: cloud.updatedAt,
        issue: 'cloud_only'
      });
    } else if (localIsRated && cloudIsRated) {
      if (local.status !== cloud.status) {
        statusMismatchCount++;
        discrepancies.push({
          wordId,
          localStatus: local.status,
          localUpdatedAt: local.updatedAt,
          cloudStatus: cloud.status,
          cloudUpdatedAt: cloud.updatedAt,
          issue: 'status_mismatch'
        });
      } else if (local.updatedAt && cloud.updatedAt && local.updatedAt !== cloud.updatedAt) {
        timestampMismatchCount++;
        discrepancies.push({
          wordId,
          localStatus: local.status,
          localUpdatedAt: local.updatedAt,
          cloudStatus: cloud.status,
          cloudUpdatedAt: cloud.updatedAt,
          issue: 'timestamp_mismatch'
        });
      }
    }
  }

  const hasDiscrepancy = discrepancies.length > 0 || queuedSyncCount > 0;

  let summaryMessage = '';
  if (!hasDiscrepancy) {
    summaryMessage = `Sync Verification Passed: Local (${localRatedCount} rated) and Cloud (${cloudRatedCount} rated) are 100% in sync.`;
  } else {
    const parts = [];
    if (localOnlyCount > 0) parts.push(`${localOnlyCount} local-only item(s)`);
    if (cloudOnlyCount > 0) parts.push(`${cloudOnlyCount} cloud-only item(s)`);
    if (statusMismatchCount > 0) parts.push(`${statusMismatchCount} status mismatch(es)`);
    if (timestampMismatchCount > 0) parts.push(`${timestampMismatchCount} timestamp diff(s)`);
    if (queuedSyncCount > 0) parts.push(`${queuedSyncCount} pending queued offline update(s)`);
    summaryMessage = `Sync Diagnostic Notice: ${parts.join(', ')}. Local Know: ${localKnowCount}, Cloud Know: ${cloudKnowCount}.`;
  }

  return {
    hasDiscrepancy,
    localTotalWords: localKeys.length,
    cloudTotalWords: cloudKeys.length,
    localRatedCount,
    cloudRatedCount,
    localKnowCount,
    cloudKnowCount,
    localOnlyCount,
    cloudOnlyCount,
    statusMismatchCount,
    timestampMismatchCount,
    queuedSyncCount,
    discrepancies,
    summaryMessage
  };
}


