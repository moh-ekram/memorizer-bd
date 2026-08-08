import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCYIkpASqZD6R2bOOi9F3hvQMl_iTLsjBI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "myvocab-13ebc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "myvocab-13ebc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "myvocab-13ebc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "531149838847",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:531149838847:web:a4577c60628b9c4c6b2fca",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9H02B1YN1D"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
