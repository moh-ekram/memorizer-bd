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
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
  runTransaction,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  normalizeCourseId,
  matchesCourseId,
  clearQuestionsCache
};

export async function getDoc(docRef: any) {
  try {
    const snap = await fsGetDoc(docRef);
    return {
      ...snap,
      id: snap.id,
      exists: () => snap.exists(),
      data: () => (snap.exists() ? (snap.data() as any) : null)
    };
  } catch (err) {
    console.warn('Firebase getDoc error:', err);
    throw err;
  }
}

export async function getDocs(queryOrCollectionRef: any) {
  try {
    const snap = await fsGetDocs(queryOrCollectionRef);
    const docs = snap.docs.map(d => ({
      ...d,
      id: d.id,
      exists: () => d.exists(),
      data: () => d.data() as any
    }));
    return {
      ...snap,
      docs,
      empty: snap.empty,
      size: snap.size,
      forEach: (callback: (doc: any) => void) => docs.forEach(callback)
    };
  } catch (err) {
    console.warn('Firebase getDocs error:', err);
    throw err;
  }
}

function cleanFirestoreData(data: any): any {
  if (data === undefined || data === null) return null;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    return data;
  }
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  try {
    const cleanData = cleanFirestoreData(data);
    if (options) {
      await fsSetDoc(docRef, cleanData, options);
    } else {
      await fsSetDoc(docRef, cleanData);
    }
  } catch (err) {
    console.warn('Firebase setDoc error:', err);
    throw err;
  }
}

export async function updateDoc(docRef: any, data: any) {
  try {
    const cleanData = cleanFirestoreData(data);
    await fsUpdateDoc(docRef, cleanData);
  } catch (err) {
    console.warn('Firebase updateDoc error, falling back to merge setDoc:', err);
    const cleanData = cleanFirestoreData(data);
    await fsSetDoc(docRef, cleanData, { merge: true });
  }
}

export async function deleteDoc(docRef: any) {
  try {
    await fsDeleteDoc(docRef);
  } catch (err) {
    console.warn('Firebase deleteDoc error:', err);
    throw err;
  }
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
    }
  );
}

export async function incrementCourseClickCount(courseId: string) {
  if (!courseId) return;
  try {
    const docRef = doc(db, 'courses', courseId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as any;
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
      return cleanFirestoreData({
        ...item,
        id: docId
      });
    });

    // Firestore Write Batch with smaller chunks (100) for fast committing
    const BATCH_SIZE = 100;
    for (let i = 0; i < processedItems.length; i += BATCH_SIZE) {
      const chunk = processedItems.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        const docRef = doc(db, collectionName, item.id);
        batch.set(docRef, item, { merge: true });
      });
      
      // Batch commit with timeout race
      await Promise.race([
        batch.commit(),
        new Promise((resolve) => setTimeout(resolve, 6000))
      ]);
    }
  } catch (err) {
    console.warn(`saveBulkDocs notice for ${collectionName}:`, err);
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
      await batch.commit();
    }
  } catch (err) {
    console.error(`deleteBulkDocs exception for ${collectionName}:`, err);
    throw err;
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
  } catch (err) {
    console.error(`clearCollectionDocs error for ${collectionName}:`, err);
    throw err;
  }
}
