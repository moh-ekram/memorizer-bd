import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  setPersistence, 
  browserLocalPersistence,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyBA3n-QRziYy8TekhV37yp81mpHvco3BC4",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "memorizerbd-75fc8.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "memorizerbd-75fc8",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "memorizerbd-75fc8.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "216799445245",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:216799445245:web:75c35914c156d1610f7e94",
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || "G-M39JTWRE78"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Explicitly ensure persistence is set to browserLocalPersistence so users stay logged in across app closes & browser restarts
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Failed to set Firebase Auth browserLocalPersistence:", err);
});

export const googleProvider = new GoogleAuthProvider();
export { signInWithRedirect, getRedirectResult };
export default app;
