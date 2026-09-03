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
  increment
} from 'firebase/firestore';

import {
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithPopup as firebaseSignInWithPopup,
  signInWithRedirect as firebaseSignInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider
} from 'firebase/auth';

import { db, auth, googleProvider } from './firebase';
import { normalizeCourseId, matchesCourseId, clearQuestionsCache } from './courseUtils';

export interface AppUser {
  uid: string;
  id?: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  providerData?: any[];
}

export async function signInWithEmailAndPassword(authObj: any, email: string, password: string) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const targetAuth = (authObj && typeof authObj.signOut === 'function') ? authObj : auth;
  return await firebaseSignInWithEmailAndPassword(targetAuth, cleanEmail, password);
}

export async function createUserWithEmailAndPassword(authObj: any, email: string, password: string) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const targetAuth = (authObj && typeof authObj.signOut === 'function') ? authObj : auth;
  return await firebaseCreateUserWithEmailAndPassword(targetAuth, cleanEmail, password);
}

export async function signOut(authObj?: any) {
  const targetAuth = (authObj && typeof authObj.signOut === 'function') ? authObj : auth;
  try {
    localStorage.removeItem('vocab_memorizer_cached_user');
  } catch (e) {}
  return await firebaseSignOut(targetAuth);
}

export function onAuthStateChanged(
  authObj: any,
  callback: (user: any) => void | Promise<void>
) {
  const targetAuth = (authObj && typeof authObj.onAuthStateChanged === 'function') ? authObj : auth;
  return firebaseOnAuthStateChanged(targetAuth, callback);
}

export async function signInWithGoogle() {
  try {
    const result = await firebaseSignInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    console.warn('Google Sign-In notice:', err);
    if (err.code === 'auth/popup-blocked') {
      try {
        await firebaseSignInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectErr) {
        throw new Error('ব্রাউজারের পপ-আপ ব্লকার বন্ধ করে পুনরায় গুগল সাইন-ইন করুন।');
      }
    }
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('গুগল সাইন-ইন উইন্ডো বন্ধ করা হয়েছে। পুনরায় চেষ্টা করুন।');
    }
    if (err.code === 'auth/cancelled-popup-request') {
      return null;
    }
    throw err;
  }
}

export function normalizeSupabaseUser(user: any): AppUser | null {
  if (!user) return null;
  const email = user.email || null;
  const displayName = user.displayName || user.name || (email ? email.split('@')[0] : 'User');
  const photoURL = user.photoURL || null;
  const id = user.uid || user.id || email || 'anonymous';
  return {
    uid: id,
    id,
    email: email ? email.trim().toLowerCase() : null,
    displayName,
    photoURL,
    user_metadata: user.user_metadata || {},
    app_metadata: user.app_metadata || {},
    providerData: user.providerData || []
  };
}

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

export async function saveBulkDocs(collectionName: string, items: any[]): Promise<void> {
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

export {
  db,
  auth,
  googleProvider,
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
  firebaseSignInWithPopup as signInWithPopup,
  firebaseSignInWithRedirect as signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  normalizeCourseId,
  matchesCourseId,
  clearQuestionsCache
};

export type { AppUser };
