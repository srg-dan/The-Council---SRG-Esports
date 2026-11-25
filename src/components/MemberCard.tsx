import React from 'react';
import { Edit3, ShieldCheck } from 'lucide-react';
import { getClassById, getHouseById, getNextRankProgress } from '../data/aethermere.ts';
import { SRG_LOGO_URL } from '../data/media.ts';
import type { UserProfile } from '../types/council.ts';
import { AvatarSigil, ClassInsignia, HouseCrest } from './CouncilIcons.tsx';

interface MemberCardProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  onOpenOath: () => void;
}

export const MemberCard: React.FC<MemberCardProps> = ({
  user,
  onOpenAuth,
  onOpenOath,
}) => {
  if (!user) {
    return (
      <div className="rounded-3xl border border-[#D4AF37]/35 bg-white dark:bg-gradient-to-br dark:from-[#201618] dark:via-[#18181E] dark:to-[#121212] p-6 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3.5">
          <img
            src={SRG_LOGO_URL}
            alt="SRG Crest"
            referrerPolicy="no-referrer"
            className="h-12 w-12 object-contain"
          />
          <div>
            <p className="font-display text-xs font-medium text-[#E31E24] dark:text-[#D4AF37]">
              Registered Council Seat
            </p>
            <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
              Take the Oath of the Red Giant
            </h3>
          </div>
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          Register or sign in with your verified account to pledge to one of the Five Houses of Aethermere and collect points across 2027 Klang Valley activations.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-5 w-full min-h-[48px] rounded-xl bg-[#E31E24] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#C8102E] cursor-pointer"
        >
          Sign In or Register
        </button>
      </div>
    );
  }

  const isSuperadmin = user.role === 'superadmin';
  const house = getHouseById(user.houseId);
  const councilClass = getClassById(user.classId);
  const { nextTier, progressPercent, pointsToNext } = getNextRankProgress(
    user.points,
    user.isGiantsChosen
  );

  return (
    <div className="rounded-3xl border border-zinc-200 dark:border-white/12 bg-white dark:bg-[#18181E] p-5 sm:p-6 transition-colors shadow-sm dark:shadow-none">
      {/* Top Row: Identity + Edit Action */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <AvatarSigil
            avatarId={isSuperadmin ? 'crest' : user.avatarId}
            photoDataUrl={user.photoDataUrl}
            size="lg"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg sm:text-xl font-bold text-zinc-900 dark:text-white truncate">
                {user.displayName}
              </h3>
              <span className="font-mono text-xs text-[#E31E24] dark:text-[#F7D117]">
                @{user.username.toLowerCase()}
              </span>
            </div>
            {isSuperadmin ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-[#F7D117]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Council Superadmin</span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {user.rank}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenOath}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-[#E31E24] dark:hover:border-[#D4AF37]/50 cursor-pointer whitespace-nowrap"
        >
          <Edit3 className="h-3.5 w-3.5 text-[#E31E24] dark:text-[#F7D117]" />
          <span>{house ? 'Edit Profile' : 'Swear Oath'}</span>
        </button>
      </div>

      {/* Allegiance & Class Row */}
      <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-zinc-200 dark:border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <HouseCrest houseId={user.houseId} size="sm" />
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">House Allegiance</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
              {house ? house.name : 'Unpledged'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 min-w-0">
          <ClassInsignia classId={user.classId} size="sm" />
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Council Class</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
              {councilClass ? `${councilClass.name} (${councilClass.archetype})` : 'Unassigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Points & Rank Progress (Hidden for Superadmin) */}
      {!isSuperadmin && (
        <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-white/10">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Council Standing</p>
              <p className="font-mono text-2xl font-semibold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
                {user.points.toLocaleString()}{' '}
                <span className="text-xs font-sans text-zinc-500 dark:text-zinc-400">pts</span>
              </p>
            </div>
            <div className="text-right">
              {nextTier && nextTier.minPoints !== null ? (
                <>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Next: {nextTier.title}</p>
                  <p className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">
                    {pointsToNext.toLocaleString()} pts away
                  </p>
                </>
              ) : (
                <p className="text-xs font-medium text-amber-700 dark:text-[#D4AF37]">
                  {nextTier ? `Next: ${nextTier.title} (Invite)` : 'Apex Rank'}
                </p>
              )}
            </div>
          </div>

          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-[#121212]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#E31E24] via-[#F7D117] to-[#D4AF37] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
