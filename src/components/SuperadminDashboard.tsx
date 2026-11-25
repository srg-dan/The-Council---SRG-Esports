import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar as CalendarIcon,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  QrCode,
  TrendingUp,
  Users,
} from 'lucide-react';
import { CLASSES, HOUSES, getHouseById } from '../data/aethermere.ts';
import type {
  ClassId,
  CouncilEvent,
  House,
  HouseId,
  UserProfile,
  UserRole,
} from '../types/council.ts';

interface SuperadminDashboardProps {
  allUsers: UserProfile[];
  houses: House[];
  events: CouncilEvent[];
  onCreateEvent: (prefillDate?: string) => void;
  onEditEvent: (evt: CouncilEvent) => void;
  onOpenEventQr: (evt: CouncilEvent) => void;
}

type TimeframeFilter = 'all' | '30d' | '7d';
type RoleFilter = 'all' | UserRole;
type ClassFilter = 'all' | ClassId | 'unassigned';
type ActivityFilter = 'all' | 'active100' | 'squire250';
type EventScopeFilter = 'upcoming' | 'all';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HOUSE_COLORS: Record<HouseId | 'unpledged', string> = {
  circuit: '#E31E24',
  sigil: '#06B6D4',
  stride: '#10B981',
  reel: '#F59E0B',
  echo: '#8B5CF6',
  unpledged: '#71717A',
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseMonthStart(isoDate: string | undefined): Date {
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
  });
}

export const SuperadminDashboard: React.FC<SuperadminDashboardProps> = ({
  allUsers,
  houses,
  events,
  onCreateEvent,
  onEditEvent,
  onOpenEventQr,
}) => {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  // Graph 1: Registered Users filters
  const [userTimeframe, setUserTimeframe] = useState<TimeframeFilter>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<RoleFilter>('all');
  const [userChartMode, setUserChartMode] = useState<'cumulative' | 'daily'>('cumulative');
  const [hoveredBucketIdx, setHoveredBucketIdx] = useState<number | null>(null);

  // Graph 2: Users by House filters
  const [houseClassFilter, setHouseClassFilter] = useState<ClassFilter>('all');
  const [houseActivityFilter, setHouseActivityFilter] = useState<ActivityFilter>('all');

  // Upcoming Events filters
  const [upcomingHouseFilter, setUpcomingHouseFilter] = useState<'all' | HouseId>('all');
  const [upcomingScope, setUpcomingScope] = useState<EventScopeFilter>('upcoming');

  // Calendar state
  const sortedAllEvents = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );
  const firstUpcomingEvent = useMemo(
    () => sortedAllEvents.find((e) => e.date >= todayIso) ?? sortedAllEvents[0],
    [sortedAllEvents, todayIso]
  );

  const [calendarMonth, setCalendarMonth] = useState<Date>(() =>
    parseMonthStart(firstUpcomingEvent?.date)
  );
  const [calendarHouseFilter, setCalendarHouseFilter] = useState<'all' | HouseId>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    firstUpcomingEvent?.date ?? todayIso
  );

  // KPI metrics
  const kpis = useMemo(() => {
    const pledgedCount = allUsers.filter((u) => u.houseId !== null).length;
    const pledgeRate =
      allUsers.length > 0 ? Math.round((pledgedCount / allUsers.length) * 100) : 0;
    const wardenCount = allUsers.filter((u) => u.role === 'warden').length;
    const upcomingCount = sortedAllEvents.filter((e) => e.date >= todayIso).length;
    const totalPoints = allUsers.reduce((sum, u) => sum + (u.points || 0), 0);
    return {
      totalUsers: allUsers.length,
      wardenCount,
      pledgedCount,
      pledgeRate,
      upcomingCount,
      totalEvents: events.length,
      totalPoints,
    };
  }, [allUsers, sortedAllEvents, todayIso, events.length]);

  // Graph 1 Data: Registration timeline buckets
  const userTimelineData = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      userTimeframe === '7d'
        ? now - 7 * 86400_000
        : userTimeframe === '30d'
          ? now - 30 * 86400_000
          : 0;

    const filtered = allUsers.filter((u) => {
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
      if (cutoffMs > 0) {
        const ts = Date.parse(u.joinedAt);
        if (!Number.isNaN(ts) && ts < cutoffMs) return false;
      }
      return true;
    });

    const dayCounts = new Map<string, number>();
    for (const u of filtered) {
      const parsed = new Date(u.joinedAt);
      const dayKey = Number.isNaN(parsed.getTime()) ? todayIso : toIsoDate(parsed);
      dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
    }

    const sortedDays = [...dayCounts.keys()].sort((a, b) => a.localeCompare(b));
    let running = 0;
    const points = sortedDays.map((date) => {
      const daily = dayCounts.get(date) ?? 0;
      running += daily;
      return { date, daily, cumulative: running };
    });

    // If only 1 day has registrations, prepend an origin day before it so the trend line renders cleanly
    if (points.length === 1) {
      const [y, m, d] = points[0].date.split('-').map(Number);
      const prevDay = new Date(y, (m || 1) - 1, (d || 1) - 1);
      points.unshift({ date: toIsoDate(prevDay), daily: 0, cumulative: 0 });
    }

    return {
      filteredCount: filtered.length,
      points,
    };
  }, [allUsers, userTimeframe, userRoleFilter, todayIso]);

  // Graph 2 Data: Users per House
  const houseChartData = useMemo(() => {
    const filtered = allUsers.filter((u) => {
      if (houseClassFilter === 'unassigned' && u.classId !== null) return false;
      if (
        houseClassFilter !== 'all' &&
        houseClassFilter !== 'unassigned' &&
        u.classId !== houseClassFilter
      ) {
        return false;
      }
      if (houseActivityFilter === 'active100' && u.points < 100) return false;
      if (houseActivityFilter === 'squire250' && u.points < 250) return false;
      return true;
    });

    const rows = HOUSES.map((h) => {
      const houseMembers = filtered.filter((u) => u.houseId === h.houseId);
      const liveHouse = houses.find((lh) => lh.houseId === h.houseId);
      return {
        id: h.houseId as HouseId | 'unpledged',
        name: h.name.replace('House of ', ''),
        fullName: h.name,
        color: HOUSE_COLORS[h.houseId],
        count: houseMembers.length,
        points: liveHouse?.totalPoints ?? h.totalPoints,
      };
    });

    const unpledgedCount = filtered.filter((u) => u.houseId === null).length;
    rows.push({
      id: 'unpledged',
      name: 'Unpledged',
      fullName: 'Unpledged Accounts',
      color: HOUSE_COLORS.unpledged,
      count: unpledgedCount,
      points: 0,
    });

    const maxCount = Math.max(1, ...rows.map((r) => r.count));
    return {
      totalFiltered: filtered.length,
      maxCount,
      rows,
    };
  }, [allUsers, houses, houseClassFilter, houseActivityFilter]);

  // Upcoming Events filtered list
  const filteredUpcomingEvents = useMemo(() => {
    return sortedAllEvents.filter((evt) => {
      if (upcomingScope === 'upcoming' && evt.date < todayIso) return false;
      if (upcomingHouseFilter !== 'all' && evt.houseId !== upcomingHouseFilter) return false;
      return true;
    });
  }, [sortedAllEvents, upcomingScope, upcomingHouseFilter, todayIso]);

  // Calendar grid & filtered events
  const calendarFilteredEvents = useMemo(() => {
    return sortedAllEvents.filter((evt) => {
      if (calendarHouseFilter !== 'all' && evt.houseId !== calendarHouseFilter) return false;
      return true;
    });
  }, [sortedAllEvents, calendarHouseFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CouncilEvent[]>();
    for (const evt of calendarFilteredEvents) {
      const existing = map.get(evt.date) ?? [];
      existing.push(evt);
      map.set(evt.date, existing);
    }
    return map;
  }, [calendarFilteredEvents]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { iso: string; day: number; inMonth: boolean }[] = [];

    // Leading padding days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      cells.push({ iso: toIsoDate(d), day: d.getDate(), inMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      cells.push({ iso: toIsoDate(dateObj), day: d, inMonth: true });
    }

    // Trailing padding days to fill complete rows (35 or 42 cells)
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      for (let i = 1; i <= needed; i++) {
        const d = new Date(year, month + 1, i);
        cells.push({ iso: toIsoDate(d), day: d.getDate(), inMonth: false });
      }
    }

    return cells;
  }, [calendarMonth]);

  const selectedDayEvents = eventsByDate.get(selectedCalendarDate) ?? [];

  // SVG chart dimensions for Registered Users Over Time
  const svgW = 540;
  const svgH = 190;
  const padL = 34;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const chartPoints = userTimelineData.points;
  const maxY = Math.max(
    1,
    ...chartPoints.map((p) => (userChartMode === 'cumulative' ? p.cumulative : p.daily))
  );

  const coords = chartPoints.map((p, idx) => {
    const val = userChartMode === 'cumulative' ? p.cumulative : p.daily;
    const x =
      chartPoints.length <= 1
        ? padL + plotW / 2
        : padL + (idx / (chartPoints.length - 1)) * plotW;
    const y = padT + plotH - (val / maxY) * plotH;
    return { ...p, val, x, y };
  });

  const linePath =
    coords.length > 0
      ? coords.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
      : '';

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const hoveredPoint =
    hoveredBucketIdx !== null && coords[hoveredBucketIdx]
      ? coords[hoveredBucketIdx]
      : coords[coords.length - 1] ?? null;

  return (
    <div className="space-y-6">
      {/* Executive Toolbar + Create Event CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Council Operations Overview
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
            Analytics &amp; Event Schedule
          </h2>
        </div>

        <button
          type="button"
          onClick={() => onCreateEvent()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#E31E24] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#C8102E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <CalendarPlus className="h-4 w-4" />
          <span>Create Event</span>
        </button>
      </div>

      {/* 4-Column KPI Strip (Single-Elevation, Tabular Numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-white/10 overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Registered Users</p>
          <p className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
            {kpis.totalUsers}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            {kpis.wardenCount} Warden{kpis.wardenCount === 1 ? '' : 's'} assigned
          </p>
        </div>

        <div className="p-4 sm:p-5 border-l border-zinc-200 dark:border-white/10 lg:border-l-0">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">House Allegiance</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
            {kpis.pledgedCount}
            <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
              ({kpis.pledgeRate}%)
            </span>
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Pledged to a Council House
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Upcoming Events</p>
          <p className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
            {kpis.upcomingCount}
            <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
              / {kpis.totalEvents} total
            </span>
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            {firstUpcomingEvent
              ? `Next: ${formatShortDate(firstUpcomingEvent.date)}`
              : 'No events scheduled'}
          </p>
        </div>

        <div className="p-4 sm:p-5 border-l border-zinc-200 dark:border-white/10 lg:border-l-0">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Council Points</p>
          <p className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
            {kpis.totalPoints.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Across all registered accounts
          </p>
        </div>
      </div>

      {/* Graphs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRAPH 1: Total Registered Users */}
        <section className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
                <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                  Total Registered Users
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                {userTimelineData.filteredCount} matching account
                {userTimelineData.filteredCount === 1 ? '' : 's'}
                {hoveredPoint
                  ? ` · ${formatShortDate(hoveredPoint.date)}: ${
                      userChartMode === 'cumulative'
                        ? `${hoveredPoint.cumulative} total`
                        : `+${hoveredPoint.daily} joined`
                    }`
                  : ''}
              </p>
            </div>

            {/* Graph 1 Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Filter user graph by timeframe"
                value={userTimeframe}
                onChange={(e) => {
                  setUserTimeframe(e.target.value as TimeframeFilter);
                  setHoveredBucketIdx(null);
                }}
                className="min-h-[34px] rounded-lg border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                <option value="all">All Time</option>
                <option value="30d">Last 30 Days</option>
                <option value="7d">Last 7 Days</option>
              </select>

              <select
                aria-label="Filter user graph by role"
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value as RoleFilter);
                  setHoveredBucketIdx(null);
                }}
                className="min-h-[34px] rounded-lg border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                <option value="all">All Roles</option>
                <option value="member">Members</option>
                <option value="warden">Wardens</option>
                <option value="superadmin">Superadmin</option>
              </select>

              <select
                aria-label="Toggle cumulative or daily signups"
                value={userChartMode}
                onChange={(e) => setUserChartMode(e.target.value as 'cumulative' | 'daily')}
                className="min-h-[34px] rounded-lg border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                <option value="cumulative">Cumulative</option>
                <option value="daily">Daily New</option>
              </select>
            </div>
          </div>

          {coords.length === 0 ? (
            <div className="h-[190px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 text-center px-4">
              <Users className="h-6 w-6 text-zinc-400 mb-2" />
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                No registered accounts match these filters
              </p>
              <button
                type="button"
                onClick={() => {
                  setUserTimeframe('all');
                  setUserRoleFilter('all');
                }}
                className="mt-2 text-xs font-semibold text-[#E31E24] dark:text-[#F7D117] cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-48 overflow-visible"
                role="img"
                aria-label="Total registered users line chart"
              >
                <defs>
                  <linearGradient id="srgUsersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E31E24" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="#E31E24" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Horizontal Y-Axis Gridlines */}
                {[0, 0.5, 1].map((ratio) => {
                  const yVal = padT + plotH - ratio * plotH;
                  const label = Math.round(ratio * maxY);
                  return (
                    <g key={ratio}>
                      <line
                        x1={padL}
                        y1={yVal}
                        x2={svgW - padR}
                        y2={yVal}
                        stroke="currentColor"
                        className="text-zinc-200 dark:text-white/10"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padL - 8}
                        y={yVal + 4}
                        textAnchor="end"
                        className="fill-zinc-400 text-[10px] font-mono tabular-nums"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Area & Line */}
                <path d={areaPath} fill="url(#srgUsersFill)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#E31E24"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive Data Nodes & X-Axis Labels */}
                {coords.map((pt, idx) => {
                  const isActive =
                    hoveredBucketIdx === idx ||
                    (hoveredBucketIdx === null && idx === coords.length - 1);
                  const showXLabel =
                    idx === 0 ||
                    idx === coords.length - 1 ||
                    (coords.length > 4 && idx === Math.floor(coords.length / 2));
                  return (
                    <g key={pt.date}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? 5.5 : 3.5}
                        className="cursor-pointer transition-all"
                        fill={isActive ? '#F7D117' : '#E31E24'}
                        stroke="#18181E"
                        strokeWidth={1.5}
                        onMouseEnter={() => setHoveredBucketIdx(idx)}
                        onClick={() => setHoveredBucketIdx(idx)}
                      />
                      {showXLabel && (
                        <text
                          x={pt.x}
                          y={svgH - 6}
                          textAnchor={
                            idx === 0 ? 'start' : idx === coords.length - 1 ? 'end' : 'middle'
                          }
                          className="fill-zinc-500 dark:fill-zinc-400 text-[10px] font-mono"
                        >
                          {formatShortDate(pt.date)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </section>

        {/* GRAPH 2: Total Users for Each House */}
        <section className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
                <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                  Users by House
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                Distribution across 5 Houses &amp; unpledged ({houseChartData.totalFiltered} users)
              </p>
            </div>

            {/* Graph 2 Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Filter house graph by class"
                value={houseClassFilter}
                onChange={(e) => setHouseClassFilter(e.target.value as ClassFilter)}
                className="min-h-[34px] rounded-lg border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                <option value="all">All Classes</option>
                {CLASSES.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.name}
                  </option>
                ))}
                <option value="unassigned">Unassigned</option>
              </select>

              <select
                aria-label="Filter house graph by points activity"
                value={houseActivityFilter}
                onChange={(e) => setHouseActivityFilter(e.target.value as ActivityFilter)}
                className="min-h-[34px] rounded-lg border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                <option value="all">All Activity</option>
                <option value="active100">100+ pts</option>
                <option value="squire250">250+ pts (Squire+)</option>
              </select>
            </div>
          </div>

          {houseChartData.totalFiltered === 0 ? (
            <div className="h-[190px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 text-center px-4">
              <BarChart3 className="h-6 w-6 text-zinc-400 mb-2" />
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                No users match the selected Class or Activity filters
              </p>
              <button
                type="button"
                onClick={() => {
                  setHouseClassFilter('all');
                  setHouseActivityFilter('all');
                }}
                className="mt-2 text-xs font-semibold text-[#E31E24] dark:text-[#F7D117] cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {houseChartData.rows.map((row) => {
                const widthPct = Math.round((row.count / houseChartData.maxCount) * 100);
                const sharePct =
                  houseChartData.totalFiltered > 0
                    ? Math.round((row.count / houseChartData.totalFiltered) * 100)
                    : 0;
                return (
                  <div key={row.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: row.color }}
                        />
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {row.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 tabular-nums shrink-0">
                        {row.count} <span className="text-zinc-400">({sharePct}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-zinc-100 dark:bg-[#121212] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${row.count === 0 ? 0 : Math.max(4, widthPct)}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Upcoming Events + Interactive Calendar View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Upcoming Events List */}
        <section className="lg:col-span-5 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                Upcoming Events
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {filteredUpcomingEvents.length} event
                {filteredUpcomingEvents.length === 1 ? '' : 's'} shown
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Filter upcoming events scope"
                value={upcomingScope}
                onChange={(e) => setUpcomingScope(e.target.value as EventScopeFilter)}
                className="min-h-[34px] rounded-lg border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                <option value="upcoming">Upcoming</option>
                <option value="all">All Scheduled</option>
              </select>

              <select
                aria-label="Filter upcoming events by house"
                value={upcomingHouseFilter}
                onChange={(e) => setUpcomingHouseFilter(e.target.value as 'all' | HouseId)}
                className="min-h-[34px] rounded-lg border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                <option value="all">All Houses</option>
                {HOUSES.map((h) => (
                  <option key={h.houseId} value={h.houseId}>
                    {h.name.replace('House of ', '')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredUpcomingEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 p-6 text-center space-y-3">
              <CalendarIcon className="h-6 w-6 text-zinc-400 mx-auto" />
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                No upcoming events match the current filter.
              </p>
              <button
                type="button"
                onClick={() => onCreateEvent()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#E31E24] px-4 text-xs font-semibold text-white hover:bg-[#C8102E] cursor-pointer"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                <span>Create Event</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-white/8 max-h-[430px] overflow-y-auto pr-1">
              {filteredUpcomingEvents.map((evt) => {
                const house = evt.houseId === 'all' ? null : getHouseById(evt.houseId);
                const accent =
                  evt.houseId === 'all' ? '#E31E24' : HOUSE_COLORS[evt.houseId] ?? '#E31E24';
                return (
                  <div
                    key={evt.eventId}
                    className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCalendarDate(evt.date);
                          setCalendarMonth(parseMonthStart(evt.date));
                        }}
                        className="shrink-0 w-12 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] py-1.5 text-center hover:border-[#E31E24] cursor-pointer"
                      >
                        <span
                          className="block text-[10px] font-bold uppercase"
                          style={{ color: accent }}
                        >
                          {new Date(`${evt.date}T00:00:00`).toLocaleDateString('en-MY', {
                            month: 'short',
                          })}
                        </span>
                        <span className="block font-mono text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
                          {evt.date.slice(8, 10)}
                        </span>
                      </button>

                      <div className="min-w-0">
                        <h4 className="font-display text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {evt.title}
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {house ? house.name : 'All Houses'} · Warden {evt.wardenName}
                        </p>
                        <p className="font-mono text-[11px] text-[#E31E24] dark:text-[#F7D117] tabular-nums mt-0.5">
                          +{evt.checkInPoints} pts · {evt.bookedCount}/{evt.capacity} seats
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenEventQr(evt)}
                        aria-label={`Show QR for ${evt.title}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-[#E31E24] hover:text-[#E31E24] dark:hover:text-[#F7D117] cursor-pointer"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditEvent(evt)}
                        aria-label={`Edit ${evt.title}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-[#E31E24] hover:text-[#E31E24] dark:hover:text-[#F7D117] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Monthly Event Calendar View */}
        <section className="lg:col-span-7 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
                {calendarMonth.toLocaleDateString('en-MY', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Click any date to inspect or schedule Council events
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Filter calendar by house"
                value={calendarHouseFilter}
                onChange={(e) => setCalendarHouseFilter(e.target.value as 'all' | HouseId)}
                className="min-h-[34px] rounded-lg border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                <option value="all">All Houses</option>
                {HOUSES.map((h) => (
                  <option key={h.houseId} value={h.houseId}>
                    {h.name.replace('House of ', '')}
                  </option>
                ))}
              </select>

              <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] p-0.5">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = firstUpcomingEvent?.date ?? todayIso;
                    setCalendarMonth(parseMonthStart(target));
                    setSelectedCalendarDate(target);
                  }}
                  className="px-2 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 hover:text-[#E31E24] cursor-pointer"
                >
                  Next Event
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 7-Column Calendar Grid */}
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212]">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="py-2 text-center text-[11px] font-semibold text-zinc-500 dark:text-zinc-400"
                >
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 dark:divide-white/8">
              {calendarDays.map((cell) => {
                const dayEvents = eventsByDate.get(cell.iso) ?? [];
                const isSelected = selectedCalendarDate === cell.iso;
                const isToday = todayIso === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setSelectedCalendarDate(cell.iso)}
                    className={`min-h-[68px] sm:min-h-[76px] p-1.5 text-left align-top flex flex-col gap-1 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#E31E24]/8 dark:bg-[#E31E24]/15 ring-1 ring-inset ring-[#E31E24]'
                        : cell.inMonth
                          ? 'bg-white dark:bg-[#18181E] hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                          : 'bg-zinc-50/60 dark:bg-[#121212]/60 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`font-mono text-[11px] font-semibold tabular-nums ${
                          isToday
                            ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white'
                            : cell.inMonth
                              ? 'text-zinc-800 dark:text-zinc-200'
                              : 'text-zinc-400 dark:text-zinc-600'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#E31E24] dark:bg-[#F7D117]" />
                      )}
                    </div>

                    <div className="space-y-0.5 w-full overflow-hidden">
                      {dayEvents.slice(0, 2).map((evt) => {
                        const color =
                          evt.houseId === 'all'
                            ? '#E31E24'
                            : HOUSE_COLORS[evt.houseId] ?? '#E31E24';
                        return (
                          <div
                            key={evt.eventId}
                            className="truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white leading-tight"
                            style={{ backgroundColor: color }}
                            title={evt.title}
                          >
                            {evt.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 pl-0.5 tabular-nums">
                          +{dayEvents.length - 2} more
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Agenda Strip */}
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs font-bold text-zinc-900 dark:text-white tabular-nums">
                {selectedCalendarDate} · {selectedDayEvents.length} event
                {selectedDayEvents.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={() => onCreateEvent(selectedCalendarDate)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E31E24] dark:text-[#F7D117] hover:underline cursor-pointer"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                <span>Create Event on {selectedCalendarDate}</span>
              </button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No Council activations scheduled on this date.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((evt) => (
                  <div
                    key={evt.eventId}
                    className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <h4 className="font-display text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {evt.title}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {evt.time}
                        </span>
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {evt.location}
                        </span>
                        <span className="font-mono font-semibold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
                          +{evt.checkInPoints} pts
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenEventQr(evt)}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-white/12 px-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-[#E31E24] cursor-pointer"
                      >
                        <QrCode className="h-3.5 w-3.5 text-[#E31E24] dark:text-[#F7D117]" />
                        <span>QR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditEvent(evt)}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-white/12 px-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-[#E31E24] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
