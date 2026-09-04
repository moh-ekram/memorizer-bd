import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { isOAuthPopupCallback } from './lib/supabaseAuth.ts';
import './index.css';

if (isOAuthPopupCallback()) {
  createRoot(document.getElementById('root')!).render(
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-center p-6 antialiased font-sans">
      <div className="w-10 h-10 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
      <h2 className="text-base font-bold text-slate-800 mb-1">গুগল সাইন-ইন সম্পন্ন হয়েছে</h2>
      <p className="text-xs text-slate-500">মূল উইন্ডোতে ফিরে যাওয়া হচ্ছে, দয়া করে অপেক্ষা করুন...</p>
    </div>
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

