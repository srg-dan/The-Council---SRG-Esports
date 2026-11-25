import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar,
  Camera,
  Check,
  Copy,
  Crown,
  Loader2,
  LogOut,
  Mail,
  Moon,
  Phone,
  QrCode,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react';
import {
  AVATAR_PRESETS,
  getClassById,
  getHouseById,
  getNextRankProgress,
} from '../data/aethermere.ts';
import { auth } from '../firebase.ts';
import {
  normalizePhone,
  sanitizeUsername,
  updateUserAvatarUrl,
} from '../services/councilFirebase.ts';
import type { ThemePreference, UserProfile } from '../types/council.ts';
import { processAvatarImage } from '../utils/imageCompression.ts';
import { AvatarSigil, ClassInsignia, HouseCrest } from './CouncilIcons.tsx';
import { PhoneInputField, splitE164Phone } from './PhoneInputField.tsx';

interface ProfileViewProps {
  user: UserProfile;
  theme: ThemePreference;
  isAdmin: boolean;
  onToggleTheme: (theme: ThemePreference) => void;
  onSaveProfile: (payload: {
    displayName: string;
    username: string;
    phoneNumber: string;
    photoDataUrl: string;
    avatarId: string;
    bio: string;
    themePreference: ThemePreference;
  }) => Promise<void>;
  onOpenAdmin: () => void;
  onSignOut: () => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  theme,
  isAdmin,
  onToggleTheme,
  onSaveProfile,
  onOpenAdmin,
  onSignOut,
}) => {
  const isSuperadmin = isAdmin || user.role === 'superadmin';
  const initialPhone = splitE164Phone(user.phoneNumber);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [dialCode, setDialCode] = useState(initialPhone.dialCode);
  const [nationalNumber, setNationalNumber] = useState(initialPhone.nationalNumber);
  const [photoDataUrl, setPhotoDataUrl] = useState(user.photoDataUrl);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState(user.avatarId);

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [copiedQr, setCopiedQr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const split = splitE164Phone(user.phoneNumber);
    setDisplayName(user.displayName);
    setUsername(user.username);
    setDialCode(split.dialCode);
    setNationalNumber(split.nationalNumber);
    setPhotoDataUrl(user.photoDataUrl);
    setAvatarId(user.avatarId);
  }, [user]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const house = getHouseById(user.houseId);
  const cls = getClassById(user.classId);
  const { nextTier, progressPercent, pointsToNext } = getNextRankProgress(
    user.points,
    user.isGiantsChosen
  );

  const joinedLabel = (() => {
    const d = new Date(user.joinedAt);
    return Number.isNaN(d.getTime())
      ? user.joinedAt.slice(0, 10)
      : d.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
  })();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setFeedback(null);
    setUploadingPhoto(true);
    setUploadProgress(15);

    let nextPreview: string | null = null;
    try {
      const processed = await processAvatarImage(file);
      nextPreview = processed.previewUrl;
      setLocalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextPreview;
      });
      setUploadProgress(50);

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const formData = new FormData();
      formData.append('avatar', processed.blob, 'avatar.webp');

      setUploadProgress(75);
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        avatarUrl?: string;
        error?: string;
      };
      if (!response.ok || !payload.avatarUrl) {
        throw new Error(payload.error || 'Upload failed. Please try another photo.');
      }

      setUploadProgress(92);
      await updateUserAvatarUrl(user.uid, payload.avatarUrl);
      setPhotoDataUrl(payload.avatarUrl);
      setUploadProgress(100);
      setFeedback({
        type: 'success',
        text: `Profile picture updated (${Math.max(1, Math.round(processed.sizeBytes / 1024))} KB WebP).`,
      });
    } catch (err) {
      if (nextPreview) {
        URL.revokeObjectURL(nextPreview);
        setLocalPreviewUrl(null);
      }
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to process image upload.',
      });
    } finally {
      setUploadingPhoto(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  };

  const handleRemovePhoto = async () => {
    setFeedback(null);
    setUploadingPhoto(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch('/api/profile/avatar', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      }
      await updateUserAvatarUrl(user.uid, '');
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
      setPhotoDataUrl('');
      setFeedback({ type: 'success', text: 'Profile picture removed.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to remove profile picture.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCopyQr = async () => {
    try {
      await navigator.clipboard.writeText(user.memberQrId);
      setCopiedQr(true);
      setTimeout(() => setCopiedQr(false), 2000);
    } catch {
      setCopiedQr(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const { phoneNumber } = normalizePhone(dialCode, nationalNumber);
    if (nationalNumber.replace(/\D/g, '').length < 6) {
      setFeedback({
        type: 'error',
        text: 'Please enter a valid phone number with country code.',
      });
      return;
    }

    const normalizedUser = sanitizeUsername(username, '');
    if (!normalizedUser) {
      setFeedback({ type: 'error', text: 'Please enter a username.' });
      return;
    }

    setSaving(true);
    try {
      await onSaveProfile({
        displayName: displayName.trim(),
        username: normalizedUser,
        phoneNumber,
        photoDataUrl,
        avatarId: isSuperadmin ? 'crest' : avatarId,
        bio: user.bio || 'Sworn to the Red Giant in Aethermere.',
        themePreference: theme,
      });
      setFeedback({ type: 'success', text: 'Profile updated and synced to The Council.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not update profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const displayedPhoto = localPreviewUrl || photoDataUrl;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            {isSuperadmin ? 'Superadmin Profile' : 'Member Profile'}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your Council identity, appearance mode, and verified contact details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Light / Dark Mode Switch */}
          <div className="flex items-center rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-1">
            <button
              type="button"
              onClick={() => onToggleTheme('light')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-[#E31E24] text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleTheme('dark')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#E31E24] text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Dark</span>
            </button>
          </div>

          {isSuperadmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#F7D117] px-4 py-2 text-xs font-bold text-[#121212] hover:bg-[#FCE205] cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Superadmin Console</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void onSignOut()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/12 bg-white dark:bg-[#18181E] px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:border-[#E31E24] cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Member QR Pass + Rank (hidden for Superadmin) + Account Info */}
        <div className="lg:col-span-5 space-y-6">
          {!isSuperadmin && (
            <section className="rounded-3xl border border-[#D4AF37]/40 bg-white dark:bg-gradient-to-br dark:from-[#211518] dark:via-[#18181E] dark:to-[#121212] p-5 sm:p-6 shadow-sm dark:shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                    Official Member QR Pass
                  </p>
                  <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white mt-0.5">
                    @{user.username.toLowerCase()}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Show this QR to event crews to collect points at activations
                  </p>
                </div>
                <QrCode className="h-5 w-5 text-[#E31E24] dark:text-[#F7D117] shrink-0" />
              </div>

              <div className="mt-5 flex flex-col items-center rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white p-5">
                <QRCodeSVG value={user.memberQrId} size={184} level="H" />
                <p className="mt-3 font-mono text-xs font-bold text-[#121212] tracking-wider">
                  {user.memberQrId}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyQr}
                className="mt-4 w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-[#E31E24] dark:hover:border-[#F7D117] cursor-pointer"
              >
                {copiedQr ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>QR ID Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
                    <span>Copy Member QR ID</span>
                  </>
                )}
              </button>
            </section>
          )}

          {/* Rank (Non-Superadmin) & Account Metadata */}
          <section className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-6 space-y-5 shadow-sm dark:shadow-none">
            {!isSuperadmin ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Current Rank</p>
                    <h3 className="font-display text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <span>{user.rank}</span>
                      <Crown className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Points</p>
                    <p className="font-mono text-2xl font-bold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
                      {user.points.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
                    <span>
                      {nextTier && nextTier.minPoints !== null
                        ? `Next: ${nextTier.title}`
                        : 'Highest Rank Tier'}
                    </span>
                    <span className="font-mono tabular-nums">
                      {nextTier && nextTier.minPoints !== null
                        ? `${pointsToNext.toLocaleString()} pts away`
                        : `${progressPercent}%`}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-[#121212]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#E31E24] via-[#F7D117] to-[#D4AF37]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-200 dark:border-white/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <HouseCrest houseId={user.houseId} size="sm" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">House</p>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        {house ? house.name : 'Unpledged'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ClassInsignia classId={user.classId} size="sm" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Class</p>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        {cls ? cls.name : 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E31E24]/15 text-[#E31E24] dark:text-[#F7D117]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Role</p>
                  <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                    Council Superadmin
                  </h3>
                </div>
              </div>
            )}

            <div
              className={`space-y-2.5 text-xs ${
                !isSuperadmin ? 'pt-4 border-t border-zinc-200 dark:border-white/10' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <Mail className="h-3.5 w-3.5" />
                  <span>Email</span>
                </span>
                <span className="font-medium text-zinc-900 dark:text-white truncate">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <Phone className="h-3.5 w-3.5" />
                  <span>Phone No.</span>
                </span>
                <span className="font-mono font-medium text-zinc-900 dark:text-white">
                  {user.phoneNumber || 'Not set'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Account Created</span>
                </span>
                <span className="font-mono font-medium text-zinc-900 dark:text-white">
                  {joinedLabel}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Edit Profile Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-7 space-y-5 shadow-sm dark:shadow-none"
        >
          <div>
            <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white">
              Identity & Security Details
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Customize your profile photo, @username, display name, and verified phone number.
            </p>
          </div>

          {/* Profile Picture Upload (512x512 WebP, Max 10 MB) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-4">
            <div className="relative shrink-0">
              <AvatarSigil
                avatarId={isSuperadmin ? 'crest' : avatarId}
                photoDataUrl={displayedPhoto}
                size="xl"
              />
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-white">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Profile Picture
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  JPG, PNG, or WebP · Max 10 MB
                </p>
              </div>

              {uploadingPhoto && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#E31E24] transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E31E24] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                </button>
                {displayedPhoto && (
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => void handleRemovePhoto()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-white/12 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-red-500 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display Name & Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
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
                className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3.5 text-sm text-zinc-900 dark:text-white focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
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
                  required
                  maxLength={40}
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.replace(/^@+/, '').toLowerCase())
                  }
                  placeholder="jasonduval123"
                  className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] pl-8 pr-3.5 font-mono text-sm text-zinc-900 dark:text-white lowercase focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Phone Number with Country Code Selector */}
          <PhoneInputField
            dialCode={dialCode}
            nationalNumber={nationalNumber}
            onDialCodeChange={setDialCode}
            onNationalNumberChange={setNationalNumber}
            label="Phone Number"
            helperText="Linked uniquely to your Council account for verification and event notifications."
          />

          {/* Sigil Emblem Fallback (Hidden for Superadmin) */}
          {!isSuperadmin && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Fallback House Sigil Emblem
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {AVATAR_PRESETS.map((preset) => {
                  const selected = avatarId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAvatarId(preset.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#E31E24] dark:border-[#F7D117] bg-[#E31E24]/10'
                          : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212]'
                      }`}
                    >
                      <AvatarSigil avatarId={preset.id} size="sm" />
                      <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300 text-center leading-tight">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {feedback && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs ${
                feedback.type === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                  : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving || uploadingPhoto}
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#E31E24] px-6 py-3 text-sm font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
