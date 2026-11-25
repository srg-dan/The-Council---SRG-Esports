import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-zinc-900/90 dark:bg-[#18181E] px-3.5 py-2 text-xs font-semibold text-[#F3E5AB] transition-colors hover:border-[#F7D117] hover:bg-[#1E1E2A] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-4 w-4 text-[#F7D117]" />
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-zinc-900/90 dark:bg-[#18181E] px-3.5 py-2 text-xs font-semibold text-[#F3E5AB] transition-colors hover:border-[#F7D117] hover:bg-[#1E1E2A] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="h-4 w-4 text-[#F7D117]" />
          <span>{compact ? 'Install' : 'Install on iOS'}</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                    Install The Council
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Access your QR tickets offline on iPhone or iPad.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close install instructions"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-200">
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E31E24]/20 font-mono text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                    1
                  </span>
                  <span>
                    Tap the <Share className="inline h-4 w-4 text-[#E31E24] dark:text-[#F7D117] mx-0.5" />{' '}
                    <strong className="text-zinc-900 dark:text-white">Share</strong> button in Safari.
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E31E24]/20 font-mono text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                    2
                  </span>
                  <span>
                    Scroll down and select{' '}
                    <strong className="text-zinc-900 dark:text-white">Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-[#E31E24] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C8102E] cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
