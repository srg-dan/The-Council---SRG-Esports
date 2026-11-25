import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lock, X } from 'lucide-react';
import { AVATAR_PRESETS, CLASSES, HOUSES, getClassById, getHouseById } from '../data/aethermere.ts';
import { ADMIN_EMAIL } from '../firebase.ts';
import { normalizePhone, sanitizeUsername } from '../services/councilFirebase.ts';
import type { ClassId, HouseId, UserProfile } from '../types/council.ts';
import { AvatarSigil, ClassInsignia, HouseCrest } from './CouncilIcons.tsx';
import { PhoneInputField, splitE164Phone } from './PhoneInputField.tsx';

interface OathOnboardingWizardProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onComplete: (payload: {
    displayName: string;
    username: string;
    phoneNumber: string;
    avatarId: string;
    bio: string;
    houseId: HouseId;
    classId: ClassId;
  }) => Promise<void>;
}

export const OathOnboardingWizard: React.FC<OathOnboardingWizardProps> = ({
  isOpen,
  user,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [dialCode, setDialCode] = useState('+60');
  const [nationalNumber, setNationalNumber] = useState('');
  const [avatarId, setAvatarId] = useState(user?.avatarId || 'crest');
  const [houseId, setHouseId] = useState<HouseId>(user?.houseId || 'circuit');
  const [classId, setClassId] = useState<ClassId>(user?.classId || 'vanguard');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHouseSealed = Boolean(user?.houseId && user?.classId);
  const isSuperadmin = Boolean(
    user && (user.role === 'superadmin' || user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())
  );

  useEffect(() => {
    if (isOpen && user) {
      setStep(1);
      setError(null);
      setDisplayName(user.displayName || '');
      setUsername(user.username || '');
      const defaultPhone =
        user.phoneNumber ||
        (user.email.toLowerCase() === ADMIN_EMAIL ||
        user.displayName.trim().toLowerCase() === 'danial danish'
          ? '+60197684608'
          : '');
      const split = splitE164Phone(defaultPhone);
      setDialCode(split.dialCode);
      setNationalNumber(split.nationalNumber);
      setAvatarId(user.avatarId || 'crest');
      setHouseId(user.houseId || 'circuit');
      setClassId(user.classId || 'vanguard');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const validateStep1 = (): { cleanUser: string; phoneNumber: string } | null => {
    if (displayName.trim().length < 2) {
      setError('Please enter a display name of at least 2 characters.');
      return null;
    }
    const cleanUser = sanitizeUsername(username, '');
    if (!cleanUser) {
      setError('Please set a username.');
      return null;
    }
    const digits = nationalNumber.replace(/\D/g, '');
    if (digits.length < 6) {
      setError('A valid phone number with country code is required to complete registration.');
      return null;
    }
    const { phoneNumber } = normalizePhone(dialCode, digits);
    return { cleanUser, phoneNumber };
  };

  const handleFinish = async () => {
    setError(null);
    const valid = validateStep1();
    if (!valid) return;

    setSubmitting(true);
    try {
      await onComplete({
        displayName: displayName.trim(),
        username: valid.cleanUser,
        phoneNumber: valid.phoneNumber,
        avatarId: isSuperadmin ? 'crest' : avatarId,
        bio: user?.bio || 'Sworn to the Red Giant in Aethermere.',
        houseId,
        classId,
      });
      setStep(1);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete your Oath.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="oath-wizard-title"
    >
      <div
        className={`w-full ${
          step >= 2 && !isHouseSealed ? 'max-w-4xl' : 'max-w-2xl'
        } rounded-t-3xl sm:rounded-3xl border border-[#D4AF37]/30 bg-white dark:bg-[#18181E] p-5 sm:p-7 shadow-2xl max-h-[92dvh] overflow-y-auto transition-all`}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-white/15 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#E31E24] dark:text-[#D4AF37]">
              Oath of the Red Giant · Step {step} of {isHouseSealed ? 1 : 3}
            </p>
            <h2
              id="oath-wizard-title"
              className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mt-0.5"
            >
              {isHouseSealed
                ? 'Update Your Council Identity'
                : step === 1
                  ? 'Forge Your Council Identity'
                  : step === 2
                    ? 'Pledge to One of the Five Houses'
                    : 'Choose Your Aethermere Class'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Oath wizard"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress Track */}
        {!isHouseSealed && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-colors ${
                  idx <= step ? 'bg-[#E31E24]' : 'bg-zinc-200 dark:bg-white/10'
                }`}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Step 1: Profile + Required Username & Phone */}
        {step === 1 && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Council Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jason Duval"
                  maxLength={32}
                  className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-4 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Username
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 font-mono text-sm text-zinc-400 select-none">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.replace(/^@+/, '').toLowerCase())
                    }
                    placeholder="jasonduval123"
                    maxLength={40}
                    className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] pl-8 pr-4 font-mono text-sm text-zinc-900 dark:text-white lowercase focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
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
              helperText="Used for account security & event notifications."
            />

            {!isSuperadmin && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Select Sigil Emblem
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {AVATAR_PRESETS.map((preset) => {
                    const selected = avatarId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setAvatarId(preset.id)}
                        className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#E31E24] dark:border-[#F7D117] bg-[#E31E24]/10'
                            : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] hover:border-zinc-400 dark:hover:border-white/25'
                        }`}
                      >
                        <AvatarSigil avatarId={preset.id} size="md" />
                        <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 text-center leading-tight">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isHouseSealed && (
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-3.5 flex items-center justify-between gap-3">
                <div className="text-xs text-zinc-700 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    Sealed Oath: {getHouseById(user?.houseId)?.name} ·{' '}
                    {getClassById(user?.classId)?.name}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    House allegiance & Class remain locked for the 2027 Crown Banner season.
                  </p>
                </div>
                <Lock className="h-4 w-4 shrink-0 text-[#D4AF37]" />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Choose House (3x2 grid on desktop) */}
        {step === 2 && !isHouseSealed && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            {HOUSES.map((house) => {
              const selected = houseId === house.houseId;
              return (
                <button
                  key={house.houseId}
                  type="button"
                  onClick={() => setHouseId(house.houseId)}
                  className={`flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#E31E24] dark:border-[#F7D117] bg-zinc-100 dark:bg-[#202028]'
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] hover:border-zinc-400 dark:hover:border-white/25'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <HouseCrest houseId={house.houseId} size="md" />
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-[#E31E24] dark:text-[#F7D117]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                      {house.name}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Domain: {house.domain} · Warden {house.wardenName}
                    </p>
                    <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-3">
                      {house.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 3: Choose Class */}
        {step === 3 && !isHouseSealed && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CLASSES.map((cls) => {
              const selected = classId === cls.classId;
              return (
                <button
                  key={cls.classId}
                  type="button"
                  onClick={() => setClassId(cls.classId)}
                  className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#E31E24] dark:border-[#F7D117] bg-zinc-100 dark:bg-[#202028]'
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] hover:border-zinc-400 dark:hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <ClassInsignia classId={cls.classId} size="sm" />
                        <div>
                          <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                            {cls.name}
                          </h3>
                          <p className="text-xs text-amber-700 dark:text-[#D4AF37]">
                            {cls.archetype}
                          </p>
                        </div>
                      </div>
                      {selected && (
                        <Check className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
                      )}
                    </div>
                    <p className="mt-2.5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {cls.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer Controls */}
        <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-zinc-200 dark:border-white/10">
          {step > 1 && !isHouseSealed ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-300 dark:border-white/12 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {!isHouseSealed && step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !validateStep1()) return;
                setError(null);
                setStep((prev) => (prev === 1 ? 2 : 3));
              }}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#E31E24] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#C8102E] cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleFinish()}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#F7D117] px-6 py-2.5 text-sm font-bold text-[#121212] hover:bg-[#FCE205] disabled:opacity-50 cursor-pointer"
            >
              <span>
                {submitting
                  ? 'Saving...'
                  : isHouseSealed
                    ? 'Save Profile'
                    : 'Swear the Oath (+100 pts)'}
              </span>
              <Check className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
