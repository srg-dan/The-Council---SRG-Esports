import React from 'react';
import { ArrowLeft, FileText, Lock, ShieldCheck } from 'lucide-react';
import { SRG_LOGO_URL } from '../data/media.ts';

interface LegalPageProps {
  onBack: () => void;
  onNavigateLegal: (page: 'terms' | 'privacy') => void;
  onOpenAuth?: () => void;
}

export const TermsView: React.FC<LegalPageProps> = ({
  onBack,
  onNavigateLegal,
  onOpenAuth,
}) => {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-zinc-200 dark:border-white/12 bg-white dark:bg-[#18181E] px-4 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:border-[#E31E24] hover:text-[#E31E24] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to The Council</span>
        </button>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="text-[#E31E24] dark:text-[#F7D117] underline underline-offset-4">
            Terms of Service
          </span>
          <span className="text-zinc-400">·</span>
          <a
            href="#/privacy"
            onClick={(e) => {
              e.preventDefault();
              onNavigateLegal('privacy');
            }}
            className="text-zinc-600 dark:text-zinc-300 hover:text-[#E31E24] dark:hover:text-[#F7D117] underline underline-offset-4"
          >
            Privacy Policy
          </a>
        </div>
      </div>

      <article className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-6 sm:p-9 space-y-6 shadow-sm dark:shadow-none">
        <header className="flex items-start gap-4 border-b border-zinc-200 dark:border-white/10 pb-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E31E24]/10 text-[#E31E24] dark:text-[#F7D117]">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wider text-[#E31E24] dark:text-[#F7D117]">
              Selangor Red Giants Esports · The Council
            </p>
            <h1 className="font-display mt-1 text-2xl sm:text-3xl font-bold text-[#E31E24]">
              Terms of Service
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Effective Season 2027 · Last updated November 2026
            </p>
          </div>
        </header>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            1. Membership & Account Integrity
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            By registering an account on The Council, you confirm that all registration details provided—including your email address, lowercase @username, and unique phone number—belong accurately to you. One unique phone number is strictly permitted per verified Council account to prevent duplicate accounts, point farming, and leaderboard manipulation.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            2. House Allegiance, Points & QR Passes
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Points earned through the Oath of the Red Giant, official SRG live events, and QR check-in passes contribute toward your personal Council Rank and your pledged House’s Crown Banner standing. Points carry no monetary cash value and are non-transferable between member accounts. Any attempt to forge QR tokens, automate scans, or abuse event check-ins may result in point revocation or suspension by Council Superadmins.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            3. Live Chat & Community Conduct
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Guests may view live community chat streams in read-only mode, while posting messages, replying, and reacting is reserved for verified registered members. Members must keep chat respectful across all five Houses—harassment, hate speech, spam, impersonation of SRG players or House Wardens, and sharing unauthorized links are prohibited. Council Wardens and Superadmins reserve the right to remove offending messages.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            4. Profile Avatars & Uploaded Content
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            You retain ownership of profile images you upload, while granting Selangor Red Giants Esports a limited license to display your username, avatar, House affiliation, rank, and public leaderboard or live chat activity within The Council web app. Offensive, explicit, or infringing profile imagery will be removed.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            5. Changes to These Terms
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            We may revise these Terms of Service as new seasons, Klang Valley activations, and fan club features launch. Continued use of The Council after updates take effect constitutes acceptance of the revised terms.
          </p>
        </section>

        {onOpenAuth && (
          <div className="pt-4 border-t border-zinc-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <img src={SRG_LOGO_URL} alt="SRG" referrerPolicy="no-referrer" className="h-6 w-6 object-contain" />
              <span>Ready to claim your seat in Aethermere?</span>
            </div>
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[42px] rounded-xl bg-[#E31E24] px-5 text-xs font-semibold text-white hover:bg-[#C8102E] cursor-pointer"
            >
              Sign Up / Log In
            </button>
          </div>
        )}
      </article>
    </div>
  );
};

export const PrivacyView: React.FC<LegalPageProps> = ({
  onBack,
  onNavigateLegal,
  onOpenAuth,
}) => {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-zinc-200 dark:border-white/12 bg-white dark:bg-[#18181E] px-4 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:border-[#E31E24] hover:text-[#E31E24] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to The Council</span>
        </button>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <a
            href="#/terms"
            onClick={(e) => {
              e.preventDefault();
              onNavigateLegal('terms');
            }}
            className="text-zinc-600 dark:text-zinc-300 hover:text-[#E31E24] dark:hover:text-[#F7D117] underline underline-offset-4"
          >
            Terms of Service
          </a>
          <span className="text-zinc-400">·</span>
          <span className="text-[#E31E24] dark:text-[#F7D117] underline underline-offset-4">
            Privacy Policy
          </span>
        </div>
      </div>

      <article className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-6 sm:p-9 space-y-6 shadow-sm dark:shadow-none">
        <header className="flex items-start gap-4 border-b border-zinc-200 dark:border-white/10 pb-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E31E24]/10 text-[#E31E24] dark:text-[#F7D117]">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wider text-[#E31E24] dark:text-[#F7D117]">
              Selangor Red Giants Esports · The Council
            </p>
            <h1 className="font-display mt-1 text-2xl sm:text-3xl font-bold text-[#E31E24]">
              Privacy Policy
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Effective Season 2027 · Last updated November 2026
            </p>
          </div>
        </header>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            1. Information We Collect
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            When you create a Council account via Email/Password or Google Sign-In, we collect your display name, lowercase @username, verified email address, and phone number (including country dial code). We also store your pledged House, earned points, event check-in records, live chat messages, and uploaded profile picture.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            2. How Your Data & Phone Number Are Used
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Your email address and phone number are stored strictly in private account records protected by Firebase security rules and are never displayed publicly to guests or other members on leaderboards or live chat. Phone numbers are used exclusively to prevent duplicate account fraud and to deliver event check-in or matchday notifications.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            3. Profile Photo EXIF & Metadata Stripping
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            For your privacy and security, profile pictures selected for upload are center-cropped, resized to 512×512 pixels, and re-encoded into WebP format on our server with all EXIF metadata (such as GPS coordinates, timestamps, and camera serial data) permanently stripped before storage.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            4. Public Standing & Live Chat Visibility
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Your display name, lowercase @username, avatar, pledged House, Council Rank, points total, and messages sent in the public Live Chat are visible to other members and guests viewing The Council. Never post private contact details inside public live chat messages.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
            5. Your Controls & Account Updates
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            You can update your display name, username, profile picture, phone number, and theme preference anytime from your Profile page, and you can delete your own messages in Live Chat at any time. For account deletion inquiries, contact the Council team via Selangor Red Giants Esports official channels.
          </p>
        </section>

        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#E31E24] dark:text-[#F7D117] mt-0.5" />
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Data persistence and authentication are secured via Firebase Authentication and strict Firestore Security Rules isolating PII from public reads.
          </p>
        </div>

        {onOpenAuth && (
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Have questions? Review our{' '}
              <a
                href="#/terms"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateLegal('terms');
                }}
                className="font-semibold text-[#E31E24] dark:text-[#F7D117] underline"
              >
                Terms of Service
              </a>
              .
            </span>
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[42px] rounded-xl bg-[#E31E24] px-5 text-xs font-semibold text-white hover:bg-[#C8102E] cursor-pointer"
            >
              Sign Up / Log In
            </button>
          </div>
        )}
      </article>
    </div>
  );
};
