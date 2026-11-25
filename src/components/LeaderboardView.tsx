import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Crown, Minus, Users } from 'lucide-react';
import { HOUSES, getClassById, getHouseById } from '../data/aethermere.ts';
import type {
  House,
  HouseId,
  LeaderboardMember,
  UserProfile,
} from '../types/council.ts';
import { AvatarSigil, HouseCrest } from './CouncilIcons.tsx';

interface LeaderboardViewProps {
  houses: House[];
  leaderboard: LeaderboardMember[];
  user: UserProfile | null;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  houses,
  leaderboard,
  user,
}) => {
  const [tab, setTab] = useState<'houses' | 'individual'>('houses');
  const [houseFilter, setHouseFilter] = useState<HouseId | 'all'>('all');

  const sortedHouses = [...houses].sort((a, b) => b.totalPoints - a.totalPoints);
  const topPoints = Math.max(1, sortedHouses[0]?.totalPoints || 0);

  const filteredMembers = leaderboard.filter((m) =>
    houseFilter === 'all' ? true : m.houseId === houseFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            Crown Banner Standings
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Live standings computed exclusively from registered Firebase Council accounts.
          </p>
        </div>

        {/* Segmented Primary / Secondary View Switcher */}
        <div className="flex items-center rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTab('houses')}
            className={`min-h-[40px] rounded-lg px-4 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'houses'
                ? 'bg-[#E31E24] text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            House Standings
          </button>
          <button
            type="button"
            onClick={() => setTab('individual')}
            className={`min-h-[40px] rounded-lg px-4 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'individual'
                ? 'bg-[#E31E24] text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Individual Standings
          </button>
        </div>
      </div>

      {tab === 'houses' ? (
        <div className="space-y-3.5">
          {sortedHouses.map((house, idx) => {
            const pct =
              house.totalPoints === 0
                ? 0
                : Math.max(8, Math.round((house.totalPoints / topPoints) * 100));
            const isLeader = idx === 0 && house.totalPoints > 0;
            const isUserHouse = user?.houseId === house.houseId;

            return (
              <div
                key={house.houseId}
                className={`rounded-3xl border p-5 sm:p-6 transition-colors shadow-sm dark:shadow-none ${
                  isLeader
                    ? 'border-[#F7D117]/65 bg-amber-50/70 dark:bg-gradient-to-r dark:from-[#231915] dark:via-[#18181E] dark:to-[#18181E]'
                    : isUserHouse
                      ? 'border-[#E31E24]/50 bg-white dark:bg-[#18181E]'
                      : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold tabular-nums ${
                        isLeader
                          ? 'bg-[#F7D117] text-[#121212]'
                          : 'bg-zinc-100 dark:bg-[#121212] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10'
                      }`}
                    >
                      #{idx + 1}
                    </div>

                    <HouseCrest houseId={house.houseId} size="md" />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white truncate">
                          {house.name}
                        </h2>
                        {isLeader && (
                          <Crown className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117] shrink-0" />
                        )}
                        {isUserHouse && (
                          <span className="text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                            · Your House
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Warden {house.wardenName} · {house.domain} ·{' '}
                        <span className="font-mono tabular-nums">
                          {house.memberCount.toLocaleString()}
                        </span>{' '}
                        registered
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5">
                    <div className="flex items-center gap-1 text-xs font-mono tabular-nums">
                      {house.rankDelta > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-500">
                          <ArrowUp className="h-3.5 w-3.5" />
                          {house.rankDelta}
                        </span>
                      ) : house.rankDelta < 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-rose-500">
                          <ArrowDown className="h-3.5 w-3.5" />
                          {Math.abs(house.rankDelta)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-zinc-400">
                          <Minus className="h-3.5 w-3.5" />0
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-xl font-bold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
                        {house.totalPoints.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">pooled points</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-[#121212]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: house.accentColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {/* House Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setHouseFilter('all')}
              className={`min-h-[44px] rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                houseFilter === 'all'
                  ? 'bg-[#E31E24] text-white'
                  : 'border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-white/25'
              }`}
            >
              All Houses
            </button>
            {HOUSES.map((h) => (
              <button
                key={h.houseId}
                type="button"
                onClick={() => setHouseFilter(h.houseId)}
                className={`min-h-[44px] rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  houseFilter === h.houseId
                    ? 'bg-[#E31E24] text-white'
                    : 'border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-white/25'
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] divide-y divide-zinc-200 dark:divide-white/8 overflow-hidden shadow-sm dark:shadow-none">
            {filteredMembers.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                <Users className="h-6 w-6 mx-auto mb-2 text-zinc-400" />
                No registered members have pledged to this House yet.
              </div>
            ) : (
              filteredMembers.map((member, idx) => {
                const house = getHouseById(member.houseId);
                const cls = getClassById(member.classId);
                const isSelf = user?.uid === member.uid;

                return (
                  <div
                    key={member.uid}
                    className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 ${
                      isSelf ? 'bg-[#E31E24]/8 dark:bg-[#E31E24]/12' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-sm font-semibold text-zinc-500 dark:text-zinc-400 w-7 tabular-nums shrink-0">
                        #{idx + 1}
                      </span>
                      <AvatarSigil
                        avatarId={member.avatarId}
                        photoDataUrl={member.photoDataUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                            {member.displayName}
                          </p>
                          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            @{member.username.toLowerCase()}
                          </span>
                          {isSelf && (
                            <span className="text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                              (You)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {house?.name} · {cls?.name} · {member.rank}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-bold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
                        {member.points.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-zinc-500">pts</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
