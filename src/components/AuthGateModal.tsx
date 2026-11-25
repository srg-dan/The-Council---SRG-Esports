import React, { useState } from 'react';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { SIGN_IN_HALF_URL, SRG_LOGO_URL } from '../data/media.ts';
import { auth, googleProvider } from '../firebase.ts';
import { normalizePhone, sanitizeUsername } from '../services/councilFirebase.ts';
import { PhoneInputField } from './PhoneInputField.tsx';

export interface EmailRegistrationPayload {
  email: string;
  password: string;
  displayName: string;
  username: string;
  phoneNumber: string;
}

interface AuthGateModalProps {
  isOpen: boolean;
  embedded?: boolean;
  onClose: () => void;
  onGoogleSuccess?: (displayName: string | null) => void;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailRegister: (payload: EmailRegistrationPayload) => Promise<void>;
}

const GoogleMulticolorIcon: React.FC = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const AuthGateModal: React.FC<AuthGateModalProps> = ({
  isOpen,
  embedded = false,
  onClose,
  onGoogleSuccess,
  onEmailSignIn,
  onEmailRegister,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [dialCode, setDialCode] = useState('+60');
  const [nationalNumber, setNationalNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen && !embedded) return null;

  const switchMode = (nextMode: 'signin' | 'register') => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setPassword('');
    setShowPassword(false);
  };

  const handleGoogleSignIn = () => {
    setError(null);
    setNotice(null);
    setSubmitting(true);

    // Call signInWithPopup directly inside the click handler with no async delays before it
    signInWithPopup(auth, googleProvider)
      .then((result) => {
        onGoogleSuccess?.(result.user.displayName);
        setSubmitting(false);
        if (!embedded) onClose();
      })
      .catch((error: unknown) => {
        const errorCode =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';

        if (errorCode === 'auth/popup-blocked') {
          setNotice('Popup was blocked by your browser. Redirecting to Google Sign-In...');
          signInWithRedirect(auth, googleProvider).catch((redirectErr: unknown) => {
            setError(
              redirectErr instanceof Error
                ? redirectErr.message
                : 'Google Sign-In redirect failed. Please try again.'
            );
            setSubmitting(false);
          });
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : 'Google Sign-In did not complete. Please try again.'
        );
        setSubmitting(false);
      });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      if (mode === 'register') {
        const cleanName = displayName.trim();
        if (cleanName.length < 2) {
          throw new Error('Display name must be at least 2 characters.');
        }
        const cleanUser = sanitizeUsername(username, '');
        if (!cleanUser) {
          throw new Error('Please choose a username.');
        }
        const digits = nationalNumber.replace(/\D/g, '');
        if (digits.length < 6) {
          throw new Error('Phone number is required to prevent duplicate accounts.');
        }
        const { phoneNumber } = normalizePhone(dialCode, digits);

        await onEmailRegister({
          email: email.trim(),
          password,
          displayName: cleanName,
          username: cleanUser,
          phoneNumber,
        });
        setNotice(
          'Account created! Check your inbox for the verification email, then sign in.'
        );
        if (!embedded) onClose();
      } else {
        await onEmailSignIn(email.trim(), password);
        if (!embedded) onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const cardContent = (
    <div
      className={`w-full max-w-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-6 sm:p-7 shadow-2xl ${
        embedded
          ? 'rounded-3xl'
          : 'rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto'
      }`}
    >
      {!embedded && (
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-white/15 sm:hidden" />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={SRG_LOGO_URL}
            alt="SRG Esports"
            referrerPolicy="no-referrer"
            className="h-11 w-11 object-contain"
          />
          <div>
            <h2
              id="auth-modal-title"
              className="font-display text-xl font-bold text-zinc-900 dark:text-white"
            >
              {mode === 'register' ? 'Join The Council' : 'Enter The Council'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Selangor Red Giants Esports · Registered Members Only
            </p>
          </div>
        </div>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-[#121212] p-1">
        <button
          type="button"
          onClick={() => switchMode('signin')}
          className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            mode === 'signin'
              ? 'bg-[#E31E24] text-white'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            mode === 'register'
              ? 'bg-[#E31E24] text-white'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          Register
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-200">
          {notice}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="mt-4 space-y-3.5">
        {mode === 'register' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jason Duval"
                  className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-sm text-zinc-900 dark:text-white focus:border-[#E31E24] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Username
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 font-mono text-xs text-zinc-400">@</span>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.replace(/^@+/, '').toLowerCase())
                    }
                    placeholder="jasonduval123"
                    className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] pl-7 pr-3 font-mono text-xs text-zinc-900 dark:text-white lowercase focus:border-[#E31E24] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <PhoneInputField
              dialCode={dialCode}
              nationalNumber={nationalNumber}
              onDialCodeChange={setDialCode}
              onNationalNumberChange={setNationalNumber}
              label="Phone Number"
              helperText="One unique phone number per Council account. Used for verification & notifications."
            />
          </>
        )}

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Email Address
          </label>
          <div className="relative flex items-center">
            <Mail className="absolute left-3.5 h-4 w-4 text-zinc-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] pl-10 pr-3.5 text-sm text-zinc-900 dark:text-white focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Password
          </label>
          <div className="relative flex items-center">
            <Lock className="absolute left-3.5 h-4 w-4 text-zinc-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] pl-10 pr-11 text-sm text-zinc-900 dark:text-white focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[46px] rounded-xl bg-[#E31E24] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {mode === 'register' ? <UserPlus className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          <span>
            {submitting
              ? 'Authenticating...'
              : mode === 'register'
                ? 'Create Registered Account'
                : 'Sign In'}
          </span>
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-zinc-400">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
        <span>or</span>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={submitting}
        className="w-full min-h-[46px] rounded-xl border border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-[#121212] px-4 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white transition-colors hover:border-[#E31E24] dark:hover:border-[#F7D117] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2.5"
      >
        <GoogleMulticolorIcon />
        <span>{submitting ? 'Connecting Google...' : 'Continue with Google'}</span>
      </button>

      <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-[#121212] p-3.5 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#E31E24] dark:text-[#F7D117] mt-0.5" />
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Only verified Firebase accounts appear on Council standings and QR passes. Phone numbers are verified once per account to prevent duplicates.
        </p>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-dvh w-full bg-[#F6F6F8] dark:bg-[#121212]">
        {/* Left Half Visual (50% Desktop / Compact Banner Mobile) */}
        <div className="relative h-56 sm:h-72 lg:h-dvh lg:sticky lg:top-0 overflow-hidden bg-[#121212]">
          <img
            src={SIGN_IN_HALF_URL}
            alt="Selangor Red Giants Esports — The Council"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent lg:bg-gradient-to-t lg:from-black/75 lg:via-transparent lg:to-black/20" />
          <div className="absolute bottom-5 left-6 right-6 lg:bottom-8 lg:left-8 lg:right-8 flex items-center gap-3.5">
            <img
              src={SRG_LOGO_URL}
              alt="SRG Crest"
              referrerPolicy="no-referrer"
              className="h-11 w-11 sm:h-12 sm:w-12 object-contain shrink-0"
            />
            <div>
              <p className="font-display text-xs font-semibold text-[#F7D117]">
                Selangor Red Giants Esports · Official Fan Council
              </p>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                Every voice has a seat.
              </h1>
            </div>
          </div>
        </div>

        {/* Right Half Sign In / Register Panel */}
        <div className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          {cardContent}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {cardContent}
    </div>
  );
};
