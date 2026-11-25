import React from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Crown,
  Lock,
  Trophy,
} from 'lucide-react';
import { HOUSES, RANKS, getHouseById } from '../data/aethermere.ts';
import { MEDIA_ASSETS, SRG_LOGO_URL } from '../data/media.ts';
import type {
  CouncilEvent,
  EventBooking,
  House,
  PointTransaction,
  UserProfile,
} from '../types/council.ts';
import { HouseCrest, ResilientBannerImage } from './CouncilIcons.tsx';
import { MemberCard } from './MemberCard.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';

export type NavTab =
  | 'home'
  | 'houses'
  | 'events'
  | 'leaderboard'
  | 'profile'
  | 'superadmin';

interface HomeViewProps {
  user: UserProfile | null;
  houses: House[];
  events: CouncilEvent[];
  bookings: EventBooking[];
  transactions: PointTransaction[];
  onNavigate: (tab: NavTab) => void;
  onOpenAuth: () => void;
  onOpenOath: () => void;
  onSelectEvent: (event: CouncilEvent) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  houses,
  events,
  bookings,
  transactions,
  onNavigate,
  onOpenAuth,
  onOpenOath,
  onSelectEvent,
}) => {
  const isSuperadmin = user?.role === 'superadmin';
  const sortedHouses = [...houses].sort((a, b) => b.totalPoints - a.totalPoints);
  const leadingHouse = sortedHouses[0] ?? HOUSES[0];
  const leadingPoints = Math.max(1, leadingHouse.totalPoints);
  const nextEvent = events[0];
  const nextEventBooking = bookings.find(
    (b) => b.eventId === nextEvent?.eventId && b.status !== 'cancelled'
  );

  const primaryCtaAction = () => {
    if (!user) {
      onOpenAuth();
    } else if (!user.houseId) {
      onOpenOath();
    } else {
      onNavigate('events');
    }
  };

  const primaryCtaLabel = !user
    ? 'Take the Oath'
    : !user.houseId
      ? 'Complete Your Oath'
      : 'Explore Events & Scan QR';

  return (
    <div className="space-y-8">
      {/* Hero Focal Anchor */}
      <section className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/30 bg-[#18181E]">
        <div className="absolute inset-0">
          <ResilientBannerImage
            src={MEDIA_ASSETS.arena}
            alt="Citadel of Aethermere Esports Arena"
            className="h-full w-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/75 to-[#121212]/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#121212]/90 via-[#121212]/55 to-transparent" />
        </div>

        <div className="relative z-10 p-6 sm:p-9 lg:p-11 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <img
                src={SRG_LOGO_URL}
                alt="Selangor Red Giants Esports Crest"
                referrerPolicy="no-referrer"
                className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
              />
              <div>
                <p className="font-display text-xs font-semibold text-[#F7D117]">
                  Selangor Red Giants Esports · Aethermere
                </p>
                <p className="text-xs text-zinc-300">
                  Official Fan Council · Season 2027
                </p>
              </div>
            </div>

            <h1 className="font-display mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              Every voice has a seat.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-zinc-200 max-w-xl leading-relaxed">
              Swear the Oath of the Red Giant, pledge to one of five Houses led by SRG Wardens, and rally across 2027 Klang Valley gatherings for the Crown Banner.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={primaryCtaAction}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#E31E24] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#C8102E] cursor-pointer whitespace-nowrap"
              >
                <span>{primaryCtaLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <PWAInstallButton />
            </div>
          </div>

          <div className="flex items-center gap-6 border-t border-white/10 pt-4 lg:border-t-0 lg:pt-0 text-xs text-zinc-300">
            <div>
              <p className="text-zinc-400">Crown Banner Leader</p>
              <p className="mt-0.5 font-display text-base font-bold text-[#F7D117]">
                {leadingHouse.totalPoints > 0 ? leadingHouse.name : 'Season Starting'}
              </p>
            </div>
            <div className="h-8 w-px bg-white/15" />
            <div>
              <p className="text-zinc-400">2027 Activations</p>
              <p className="mt-0.5 font-mono text-base font-semibold text-white tabular-nums">
                {events.length} Events · KL & PJ
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Responsive Two-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Member Card + 7-Tier Rank Progression (Rank hidden for Superadmin) */}
        <div className="lg:col-span-7 space-y-6">
          <MemberCard
            user={user}
            onOpenAuth={onOpenAuth}
            onOpenOath={onOpenOath}
          />

          {!isSuperadmin && (
            <section className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-6 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                    Seven Ranks of the Council
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Automatic rank promotion as you earn activation points
                  </p>
                </div>
                <Crown className="h-5 w-5 text-[#E31E24] dark:text-[#F7D117] shrink-0" />
              </div>

              <div className="mt-4 divide-y divide-zinc-200 dark:divide-white/8">
                {RANKS.map((rankTier) => {
                  const userPoints = user?.points ?? 0;
                  const isCurrent = user?.rank === rankTier.title;
                  const isUnlocked =
                    Boolean(user) &&
                    ((rankTier.minPoints !== null && userPoints >= rankTier.minPoints) ||
                      (rankTier.inviteOnly && Boolean(user?.isGiantsChosen)));

                  return (
                    <div
                      key={rankTier.id}
                      className={`py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-4 ${
                        isCurrent ? 'opacity-100' : isUnlocked ? 'opacity-90' : 'opacity-65'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                            isCurrent
                              ? 'border-[#E31E24] dark:border-[#F7D117] bg-[#E31E24]/15 text-[#E31E24] dark:text-[#F7D117]'
                              : isUnlocked
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                : 'border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-[#121212] text-zinc-400 dark:text-zinc-500'
                          }`}
                        >
                          {isUnlocked ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Lock className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                              {rankTier.title}
                            </span>
                            {isCurrent && (
                              <span className="text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                                · Current Rank
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                            {rankTier.perkSummary}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                        {rankTier.minPoints !== null
                          ? `${rankTier.minPoints.toLocaleString()} pts`
                          : 'Invite-only'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Crown Banner Snapshot, Next Activation, Points Ledger */}
        <div className="lg:col-span-5 space-y-6">
          {/* Crown Banner Standings Snapshot */}
          <section className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-6 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                  Crown Banner Race
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Live pooled House standings (Registered members)
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('leaderboard')}
                className="min-h-[44px] px-2 text-xs font-semibold text-[#E31E24] dark:text-[#F7D117] hover:opacity-80 cursor-pointer whitespace-nowrap"
              >
                Full Standings →
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              {sortedHouses.slice(0, 3).map((house, idx) => {
                const ratio =
                  house.totalPoints === 0
                    ? 0
                    : Math.max(6, Math.round((house.totalPoints / leadingPoints) * 100));
                return (
                  <div key={house.houseId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-5 tabular-nums">
                          #{idx + 1}
                        </span>
                        <HouseCrest houseId={house.houseId} size="sm" />
                        <div className="min-w-0">
                          <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white truncate">
                            {house.name}
                          </h3>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Warden {house.wardenName} · {house.memberCount} members
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-amber-700 dark:text-[#F3E5AB] tabular-nums shrink-0">
                        {house.totalPoints.toLocaleString()} pts
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-[#121212]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${ratio}%`,
                          backgroundColor: house.accentColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Featured 2027 Activation */}
          {nextEvent && (
            <section className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] shadow-sm dark:shadow-none">
              <div className="relative h-36">
                <ResilientBannerImage
                  src={MEDIA_ASSETS[nextEvent.mediaKey]}
                  alt={nextEvent.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between gap-2">
                  <span className="font-display text-xs font-semibold text-[#F7D117]">
                    {nextEvent.month} · {nextEvent.wardenName}
                  </span>
                  <span className="font-mono text-xs text-zinc-100 tabular-nums">
                    +{nextEvent.checkInPoints} pts
                  </span>
                </div>
              </div>
              <div className="p-5 pt-4">
                <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                  {nextEvent.title}
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {nextEvent.date} · {nextEvent.location}
                </p>
                <p className="mt-2.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2">
                  {nextEvent.description}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-700 dark:text-zinc-300 font-mono tabular-nums">
                    {nextEvent.basePriceRM === 0 ? 'FREE' : `RM${nextEvent.basePriceRM}`}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(nextEvent)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E31E24] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C8102E] cursor-pointer whitespace-nowrap"
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span>{nextEventBooking ? 'View QR Ticket' : 'RSVP & Details'}</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Points Ledger */}
          <section className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-6 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                  Points Ledger
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Verified event check-in awards
                </p>
              </div>
              <Trophy className="h-4 w-4 text-[#E31E24] dark:text-[#D4AF37]" />
            </div>

            {transactions.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-[#121212] p-4 text-xs text-zinc-600 dark:text-zinc-400">
                Complete the Oath Onboarding or check in at a Council event to record your first point transaction.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-zinc-200 dark:divide-white/8">
                {transactions.slice(0, 5).map((tx) => {
                  const txHouse = getHouseById(tx.houseId);
                  return (
                    <div
                      key={tx.txId}
                      className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {tx.description}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {txHouse?.name ?? 'Council'} · {tx.finalPoints} pts
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-[#E31E24] dark:text-[#F7D117] tabular-nums shrink-0">
                        +{tx.finalPoints}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
