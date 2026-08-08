import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { clearNonEssentialLocalStorageCache } from '../lib/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
    if (error?.name === 'QuotaExceededError' || error?.message?.includes('exceeded the quota')) {
      console.warn('QuotaExceededError detected in ErrorBoundary. Cleaning up non-essential caches...');
      clearNonEssentialLocalStorageCache();
    }
    (this as any).setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetState = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  public render() {
    const state = (this as any).state || {};
    const props = (this as any).props || {};

    if (state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">Application Notice</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                An unexpected error occurred while rendering the page. Don't worry, your progress is safe.
              </p>
            </div>

            {state.error && (
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-left overflow-auto max-h-32 text-[11px] font-mono text-rose-300">
                {state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload App</span>
              </button>

              <button
                onClick={this.handleResetState}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer border border-slate-600"
              >
                <Home className="w-4 h-4" />
                <span>Reset Local Session</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return props.children;
  }
}

export default ErrorBoundary;
