import React, { useState } from 'react';
import { CalendarDays, Check, Quote, Users } from 'lucide-react';
import type { CouncilEvent, House, HouseId, UserProfile } from '../types/council.ts';
import { HouseCrest, WardenLabel } from './CouncilIcons.tsx';

interface HousesViewProps {
  houses: House[];
  events: CouncilEvent[];
  user: UserProfile | null;
  onSelectEvent: (event: CouncilEvent) => void;
  onPledgeHouse: () => void;
}

export const HousesView: React.FC<HousesViewProps> = ({
  houses,
  events,
  user,
  onSelectEvent,
  onPledgeHouse,
}) => {
  const [selectedHouseId, setSelectedHouseId] = useState<HouseId>(
    user?.houseId ?? houses[0]?.houseId ?? 'circuit'
  );

  const selectedHouse =
    houses.find((h) => h.houseId === selectedHouseId) ?? houses[0];

  const houseEvents = events.filter(
    (e) => e.houseId === selectedHouse.houseId || e.houseId === 'all'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            The Five Houses of Aethermere
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Led by SRG Wardens across five disciplines competing for the annual Crown Banner.
          </p>
        </div>
        {user && !user.houseId && (
          <button
            type="button"
            onClick={onPledgeHouse}
            className="min-h-[44px] rounded-xl bg-[#E31E24] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#C8102E] cursor-pointer whitespace-nowrap"
          >
            Pledge Allegiance
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* House Directory */}
        <div className="lg:col-span-5 space-y-3">
          {houses.map((house) => {
            const isSelected = house.houseId === selectedHouse.houseId;
            const isUserHouse = user?.houseId === house.houseId;
            return (
              <button
                key={house.houseId}
                type="button"
                onClick={() => setSelectedHouseId(house.houseId)}
                className={`w-full flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors cursor-pointer shadow-sm dark:shadow-none ${
                  isSelected
                    ? 'border-[#E31E24] dark:border-[#F7D117]/60 bg-zinc-100 dark:bg-[#202028]'
                    : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] hover:border-zinc-300 dark:hover:border-white/25'
                }`}
              >
                <HouseCrest houseId={house.houseId} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                      {house.name}
                    </h2>
                    {isUserHouse && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E31E24] dark:text-[#F7D117] shrink-0">
                        <Check className="h-3.5 w-3.5" />
                        <span>Your House</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Domain: {house.domain} · <WardenLabel wardenName={house.wardenName} prefix="Warden " />
                  </p>
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300 truncate">
                      {house.signatureActivation}
                    </span>
                    <span className="font-mono font-semibold text-amber-700 dark:text-[#F3E5AB] tabular-nums shrink-0">
                      {house.totalPoints.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected House Detail Panel */}
        <div className="lg:col-span-7 rounded-3xl border border-zinc-200 dark:border-white/12 bg-white dark:bg-[#18181E] p-6 sm:p-7 space-y-6 shadow-sm dark:shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-white/10">
            <div className="flex items-center gap-4">
              <HouseCrest houseId={selectedHouse.houseId} size="lg" />
              <div>
                <p
                  className="font-display text-xs font-semibold"
                  style={{ color: selectedHouse.accentColor }}
                >
                  Domain of {selectedHouse.domain}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                  {selectedHouse.name}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  <WardenLabel wardenName={selectedHouse.wardenName} prefix="Warden " /> · {selectedHouse.wardenTitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5 sm:text-right">
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Total Points</p>
                <p className="font-mono text-xl font-semibold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
                  {selectedHouse.totalPoints.toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-px bg-zinc-200 dark:bg-white/10" />
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Registered</p>
                <p className="font-mono text-xl font-semibold text-zinc-900 dark:text-white tabular-nums flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-zinc-400" />
                  {selectedHouse.memberCount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Lore & Warden Quote */}
          <div className="space-y-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
              {selectedHouse.description}
            </p>

            <blockquote className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-4 flex items-start gap-3">
              <Quote
                className="h-5 w-5 shrink-0 mt-0.5"
                style={{ color: selectedHouse.accentColor }}
              />
              <div>
                <p className="text-sm italic text-zinc-800 dark:text-zinc-200 leading-relaxed">
                  "{selectedHouse.wardenQuote}"
                </p>
                <footer className="mt-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  — <WardenLabel wardenName={selectedHouse.wardenName} prefix="Warden " />, {selectedHouse.name}
                </footer>
              </div>
            </blockquote>
          </div>

          {/* Signature & Upcoming Activations */}
          <div className="pt-2 border-t border-zinc-200 dark:border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                Upcoming {selectedHouse.name} & Council Activations
              </h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Signature: {selectedHouse.signatureActivation}
              </span>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-white/8">
              {houseEvents.map((evt) => (
                <div
                  key={evt.eventId}
                  className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h4 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                      {evt.title}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {evt.date} · {evt.location} · +{evt.checkInPoints} check-in pts
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(evt)}
                    className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-[#E31E24] dark:hover:border-[#F7D117] cursor-pointer whitespace-nowrap"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-[#E31E24] dark:text-[#F7D117]" />
                    <span>View Event</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
