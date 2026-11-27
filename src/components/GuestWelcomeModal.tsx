import React from 'react';
import { CheckCircle2, Star, TrendingUp, X } from 'lucide-react';
import { SRG_LOGO_URL } from '../data/media.ts';

interface GuestWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: () => void;
  onLogin: () => void;
}

export const GuestWelcomeModal: React.FC<GuestWelcomeModalProps> = ({
  isOpen,
  onClose,
  onSignUp,
  onLogin,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-welcome-title"
    >
      <div className="relative w-full max-w-4xl min-h-[100dvh] sm:min-h-0 sm:rounded-2xl overflow-hidden border-0 sm:border border-[#E31E24]/35 bg-[#0D0D10] text-white shadow-2xl flex flex-col justify-between">
        {/* Atmospheric Watermark Emblem Backdrop */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_35%,rgba(227,30,36,0.24),transparent_68%)]" />
          <img
            src={SRG_LOGO_URL}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-none opacity-[0.14] grayscale contrast-125 select-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/80" />
        </div>

        {/* Top-Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close welcome dialog and continue as guest"
          className="absolute right-4 top-4 sm:right-6 sm:top-6 z-20 flex h-11 w-11 items-center justify-center border border-[#E31E24]/55 bg-black/50 text-white hover:bg-[#E31E24] hover:border-[#E31E24] transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Main Content */}
        <div className="relative z-10 px-6 pt-16 pb-8 sm:px-12 sm:pt-14 sm:pb-10 space-y-7">
          {/* Brand Lockup */}
          <div className="flex items-center gap-4 pr-12">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center border border-[#E31E24]/60 bg-black/60 p-2">
              <img
                src={SRG_LOGO_URL}
                alt="Selangor Red Giants Esports"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1
                id="guest-welcome-title"
                className="font-display text-2xl sm:text-4xl font-bold uppercase tracking-wide leading-[1.05] text-white"
              >
                THIS IS THE COUNCIL.
                <span className="block text-[#E31E24]">YOU&apos;RE PART OF IT.</span>
              </h1>
            </div>
          </div>

          <p className="text-sm sm:text-base text-zinc-200 max-w-2xl leading-relaxed">
            The home of Selangor Red Giants Esports fans. Sign up free to pledge a House, earn event points, and unlock rewards across Aethermere.
          </p>

          {/* 3 Feature Rows */}
          <div className="border-y border-white/15 divide-y divide-white/15">
            <div className="py-4 flex items-start gap-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#E31E24] mt-0.5" />
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-wide text-white">
                  Pledge Your House
                </h2>
                <p className="text-xs sm:text-sm text-zinc-300 mt-0.5">
                  Take the Oath of the Red Giant and rally with your Warden.
                </p>
              </div>
            </div>

            <div className="py-4 flex items-start gap-4">
              <TrendingUp className="h-5 w-5 shrink-0 text-[#E31E24] mt-0.5" />
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-wide text-white">
                  Earn Points
                </h2>
                <p className="text-xs sm:text-sm text-zinc-300 mt-0.5">
                  Every event check-in counts. Climb the live Crown Banner leaderboard.
                </p>
              </div>
            </div>

            <div className="py-4 flex items-start gap-4">
              <Star className="h-5 w-5 shrink-0 text-[#E31E24] mt-0.5" />
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-wide text-white">
                  Unlock Ranks &amp; Perks
                </h2>
                <p className="text-xs sm:text-sm text-zinc-300 mt-0.5">
                  Exclusive fan activations, QR passes, and real SRG prizes.
                </p>
              </div>
            </div>
          </div>

          {/* Action CTAs: Sign Up, Log In, or Explore First (Guest View) */}
          <div className="pt-1 space-y-4">
            <button
              type="button"
              onClick={onSignUp}
              className="w-full min-h-[52px] bg-[#E31E24] hover:bg-[#C8102E] px-6 py-3.5 font-display text-base sm:text-lg font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
            >
              Sign Up Free
            </button>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold">
              <button
                type="button"
                onClick={onLogin}
                className="min-h-[40px] px-2 text-white hover:text-[#F7D117] underline underline-offset-4 transition-colors cursor-pointer"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-2 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                Explore first
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
