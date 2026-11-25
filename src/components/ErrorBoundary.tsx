import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { FirestoreErrorInfo } from '../firebase.ts';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  details: FirestoreErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', details: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let parsed: FirestoreErrorInfo | null = null;
    try {
      const candidate = JSON.parse(error.message) as Partial<FirestoreErrorInfo>;
      if (candidate && typeof candidate.error === 'string' && 'operationType' in candidate) {
        parsed = candidate as FirestoreErrorInfo;
      }
    } catch {
      parsed = null;
    }

    return {
      hasError: true,
      message: parsed ? parsed.error : error.message || 'Unexpected Council client error.',
      details: parsed,
    };
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-dvh bg-[#F6F6F8] dark:bg-[#121212] text-zinc-900 dark:text-[#F4F3F6] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-[#E31E24]/40 bg-white dark:bg-[#18181E] p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E31E24]/15 text-[#E31E24]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-zinc-900 dark:text-white">
                Council Sync Interrupted
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                A Firestore connection or permission check halted this view.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-3.5 text-xs text-zinc-700 dark:text-zinc-300 break-words">
            {this.state.message}
          </div>

          {this.state.details && (
            <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              {this.state.details.operationType.toUpperCase()} · {this.state.details.path ?? 'root'}
            </p>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E31E24] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#C8102E] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reload The Council</span>
          </button>
        </div>
      </div>
    );
  }
}
