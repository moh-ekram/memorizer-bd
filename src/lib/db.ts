import { db, auth, googleProvider } from './firebase';
import {
  doc,
  collection,
  getDoc as fsGetDoc,
  getDocs as fsGetDocs,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  onSnapshot as fsOnSnapshot,
  query,
  where,
  limit,
  writeBatch
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { normalizeCourseId, matchesCourseId, clearQuestionsCache } from './courseUtils';
import { safeSetLocalStorage } from './storage';

export {
  db,
  auth,
  googleProvider,
  doc,
  collection,
  query,
  where,
  limit,
  writeBatch,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  normalizeCourseId,
  matchesCourseId,
  clearQuestionsCache
};

export async function getDoc(docRef: any) {
  try {
    const snap = await fsGetDoc(docRef);
    if (snap.exists()) {
      return snap;
    }
  } catch (err) {
    console.warn('Firebase getDoc warning, falling back:', err);
  }

  // Fallback to server file API or localStorage
  try {
    const colName = docRef.parent?.id || docRef.path?.split('/')[0];
    const docId = docRef.id;
    if (colName && docId) {
      const res = await fetch(`/api/db/${encodeURIComponent(colName)}/doc/${encodeURIComponent(docId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.exists && json.data) {
          return {
            exists: () => true,
            data: () => json.data,
            id: docId
          };
        }
      }

      const cached = localStorage.getItem(`local_store_${colName}_${docId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          exists: () => true,
          data: () => ({ ...parsed, id: docId }),
          id: docId
        };
      }
    }
  } catch (_) {}

  return { exists: () => false, data: () => null, id: docRef?.id || '' };
}

export async function getDocs(queryOrCollectionRef: any) {
  try {
    const snap = await fsGetDocs(queryOrCollectionRef);
    if (snap && !snap.empty) {
      return snap;
    }
  } catch (err) {
    console.warn('Firebase getDocs warning, falling back:', err);
  }

  // Fallback to server file API / localStorage
  try {
    const colName = queryOrCollectionRef.id || queryOrCollectionRef.path?.split('/')[0] || queryOrCollectionRef.collectionName;
    if (colName) {
      const docsMap = new Map<string, any>();
      const res = await fetch(`/api/db/${encodeURIComponent(colName)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.docs)) {
          json.docs.forEach((docData: any) => {
            if (docData && docData.id) {
              docsMap.set(String(docData.id), docData);
            }
          });
        }
      }

      // Local storage check
      const prefix = `local_store_${colName}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const docId = key.replace(prefix, '');
          const rawVal = localStorage.getItem(key);
          if (rawVal) {
            try {
              const parsed = JSON.parse(rawVal);
              if (!docsMap.has(docId)) {
                docsMap.set(docId, { id: docId, ...parsed });
              }
            } catch (_) {}
          }
        }
      }

      const docs = Array.from(docsMap.entries()).map(([id, docData]) => ({
        id,
        data: () => docData,
        exists: () => true
      }));

      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (callback: (doc: any) => void) => docs.forEach(callback),
        exists: () => docs.length > 0
      };
    }
  } catch (_) {}

  return { docs: [], empty: true, size: 0, forEach: () => {}, exists: () => false };
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  // Sync to Firebase
  try {
    if (options) {
      await fsSetDoc(docRef, data, options);
    } else {
      await fsSetDoc(docRef, data);
    }
  } catch (err) {
    console.warn('Firebase setDoc error:', err);
  }

  // Local & Server File Backup
  try {
    const colName = docRef.parent?.id || docRef.path?.split('/')[0];
    const docId = docRef.id;
    if (colName && docId) {
      safeSetLocalStorage(`local_store_${colName}_${docId}`, JSON.stringify(data));
      fetch(`/api/db/${encodeURIComponent(colName)}/doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, data, merge: options?.merge })
      }).catch(() => {});
    }
  } catch (_) {}
}

export async function updateDoc(docRef: any, data: any) {
  try {
    await fsUpdateDoc(docRef, data);
  } catch (err) {
    console.warn('Firebase updateDoc error, attempting merge setDoc:', err);
    await setDoc(docRef, data, { merge: true });
  }
}

export async function deleteDoc(docRef: any) {
  try {
    await fsDeleteDoc(docRef);
  } catch (err) {
    console.warn('Firebase deleteDoc error:', err);
  }

  try {
    const colName = docRef.parent?.id || docRef.path?.split('/')[0];
    const docId = docRef.id;
    if (colName && docId) {
      localStorage.removeItem(`local_store_${colName}_${docId}`);
      fetch(`/api/db/${encodeURIComponent(colName)}/doc/${encodeURIComponent(docId)}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
  } catch (_) {}
}

export function onSnapshot(refOrQuery: any, callback: (snap: any) => void, onError?: (error: any) => void) {
  return fsOnSnapshot(
    refOrQuery,
    (snap) => {
      callback(snap);
    },
    (err) => {
      console.warn('onSnapshot Firebase error:', err);
      if (onError) onError(err);
      // Fallback one-shot
      if (refOrQuery.id || refOrQuery.path?.includes('/')) {
        getDoc(refOrQuery).then(callback).catch(() => {});
      } else {
        getDocs(refOrQuery).then(callback).catch(() => {});
      }
    }
  );
}

export async function incrementCourseClickCount(courseId: string) {
  if (!courseId) return;
  try {
    const docRef = doc(db, 'courses', courseId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const currentClicks = typeof data?.clickCount === 'number' ? data.clickCount : 0;
      await updateDoc(docRef, { clickCount: currentClicks + 1 });
    } else {
      await setDoc(docRef, { clickCount: 1, id: courseId }, { merge: true });
    }
  } catch (err) {
    console.warn('incrementCourseClickCount error:', err);
  }
}

export async function saveBulkDocs(collectionName: string, items: any[]) {
  if (!items || items.length === 0) return;
  try {
    const processedItems = items.map((item, index) => {
      const docId = item.id || `${collectionName}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        ...item,
        id: docId
      };
    });

    // Firestore Write Batch
    const BATCH_SIZE = 450;
    for (let i = 0; i < processedItems.length; i += BATCH_SIZE) {
      const chunk = processedItems.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        const docRef = doc(db, collectionName, item.id);
        batch.set(docRef, item, { merge: true });
      });
      await batch.commit().catch(err => console.warn('Batch commit warning:', err));
    }

    // Local & Server API backup
    for (const item of processedItems) {
      try {
        safeSetLocalStorage(`local_store_${collectionName}_${item.id}`, JSON.stringify(item));
      } catch (_) {}
    }

    fetch(`/api/db/${encodeURIComponent(collectionName)}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: processedItems })
    }).catch(() => {});
  } catch (err) {
    console.error(`saveBulkDocs exception for ${collectionName}:`, err);
  }
}

export async function deleteBulkDocs(collectionName: string, docIds: string[]) {
  if (!docIds || docIds.length === 0) return;
  try {
    const BATCH_SIZE = 450;
    for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
      const chunk = docIds.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        const docRef = doc(db, collectionName, id);
        batch.delete(docRef);
      });
      await batch.commit().catch(err => console.warn('Batch delete warning:', err));
    }

    for (const id of docIds) {
      try {
        localStorage.removeItem(`local_store_${collectionName}_${id}`);
      } catch (_) {}
    }

    fetch(`/api/db/${encodeURIComponent(collectionName)}/delete-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docIds })
    }).catch(() => {});
  } catch (err) {
    console.error(`deleteBulkDocs exception for ${collectionName}:`, err);
  }
}

export async function clearCollectionDocs(collectionName: string, courseId?: string) {
  try {
    const colRef = collection(db, collectionName);
    const q = courseId ? query(colRef, where('courseId', '==', courseId)) : colRef;
    const snap = await fsGetDocs(q);

    if (!snap.empty) {
      const docIds = snap.docs.map(d => d.id);
      await deleteBulkDocs(collectionName, docIds);
    }

    // Clear local storage prefix
    const prefix = `local_store_${collectionName}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(prefix) || key.includes(collectionName))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    fetch(`/api/db/${encodeURIComponent(collectionName)}/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId })
    }).catch(() => {});
  } catch (err) {
    console.error(`clearCollectionDocs error for ${collectionName}:`, err);
  }
}
