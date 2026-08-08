import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBA3n-QRziYy8TekhV37yp81mpHvco3BC4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "memorizerbd-75fc8.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "memorizerbd-75fc8",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "memorizerbd-75fc8.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "216799445245",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:216799445245:web:75c35914c156d1610f7e94",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-M39JTWRE78"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
