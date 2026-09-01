import {
  doc,
  collection,
  query,
  where,
  limit,
  writeBatch,
  runTransaction,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  incrementCourseClickCount,
  saveBulkDocs,
  deleteBulkDocs,
  clearCollectionDocs
} from './supabaseDb';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithGoogle,
  normalizeSupabaseUser
} from './supabaseAuth';

import type { AppUser } from './supabaseAuth';
import { normalizeCourseId, matchesCourseId, clearQuestionsCache } from './courseUtils';

// Compatible database & auth object reference
const db: any = { _isSupabase: true };
const auth = {
  currentUser: null as AppUser | null,
};
const googleProvider = new GoogleAuthProvider();

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
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithGoogle,
  normalizeSupabaseUser,
  normalizeCourseId,
  matchesCourseId,
  clearQuestionsCache,
  incrementCourseClickCount,
  saveBulkDocs,
  deleteBulkDocs,
  clearCollectionDocs
};

export type { AppUser };
