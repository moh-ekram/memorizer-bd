/**
 * Unified database & auth facade — 100% Supabase-backed.
 *
 * The application used to talk to Firebase Firestore/Firebase Auth through
 * this module. It is now a thin re-export layer over the native Supabase
 * implementation:
 *   - `./supabaseDb`   → Firestore-shaped database interface translated to
 *                        native Supabase (PostgREST) calls.
 *   - `./supabaseAuth` → Firebase-Auth-shaped functions mapped onto
 *                        Supabase Auth (email/password + Google OAuth).
 *
 * All Firebase code was removed from the project; nothing imports
 * `firebase/*` or `./firebase` anymore.
 */

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
  incrementCourseClickCount,
  saveBulkDocs,
  deleteBulkDocs,
  clearCollectionDocs
} from './supabaseDb';

import {
  auth,
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

// Compatible database object reference (opaque marker — the Supabase
// implementations accept it for backward compatibility and ignore it).
const db: any = { _isSupabase: true };
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
  orderBy,
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
