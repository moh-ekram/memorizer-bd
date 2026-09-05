import {
  doc,
  collection,
  query,
  where,
  limit,
  orderBy,
  writeBatch,
  runTransaction,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  increment,
  db
} from './supabaseDb';

import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithGoogle,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  normalizeSupabaseUser,
  isRememberMeEnabled,
  setRememberMeEnabled,
  getSavedEmail,
  saveCachedUser,
  getCachedUser,
  continueWithBrowserSession,
  REMEMBER_ME_STORAGE_KEY,
  CACHED_USER_STORAGE_KEY,
  SAVED_EMAIL_STORAGE_KEY
} from './supabaseAuth';
import type { AppUser } from './supabaseAuth';

import { normalizeCourseId, matchesCourseId, clearQuestionsCache } from './courseUtils';

export const googleProvider = new GoogleAuthProvider();

export {
  // Database operations
  db,
  doc,
  collection,
  query,
  where,
  limit,
  orderBy,
  writeBatch,
  runTransaction,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  increment,

  // Authentication
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithGoogle,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  normalizeSupabaseUser,
  isRememberMeEnabled,
  setRememberMeEnabled,
  getSavedEmail,
  saveCachedUser,
  getCachedUser,
  continueWithBrowserSession,
  REMEMBER_ME_STORAGE_KEY,
  CACHED_USER_STORAGE_KEY,
  SAVED_EMAIL_STORAGE_KEY,

  // Course & question utilities
  normalizeCourseId,
  matchesCourseId,
  clearQuestionsCache
};

export type { AppUser };

export async function incrementCourseClickCount(courseId: string): Promise<void> {
  try {
    const courseRef = doc(db, 'courses', courseId);
    await updateDoc(courseRef, {
      clickCount: increment(1)
    });
  } catch (e) {
    console.warn('incrementCourseClickCount notice:', e);
  }
}

export async function saveBulkDocs(
  collectionName: string, 
  items: any[], 
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!items || items.length === 0) return;
  const batchSize = 450;
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      if (!item.id) continue;
      const ref = doc(db, collectionName, String(item.id));
      batch.set(ref, item, { merge: true });
    }
    await batch.commit();
    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length);
    }
  }
}

export async function deleteBulkDocs(collectionName: string, docIds: string[]): Promise<void> {
  if (!docIds || docIds.length === 0) return;
  const batchSize = 450;
  for (let i = 0; i < docIds.length; i += batchSize) {
    const chunk = docIds.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      if (!id) continue;
      const ref = doc(db, collectionName, String(id));
      batch.delete(ref);
    }
    await batch.commit();
  }
}

export async function clearCollectionDocs(collectionName: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    const ids = snap.docs.map(d => d.id);
    await deleteBulkDocs(collectionName, ids);
  } catch (e) {
    console.warn(`clearCollectionDocs error on ${collectionName}:`, e);
  }
}
