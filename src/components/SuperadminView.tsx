import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CalendarPlus,
  Check,
  Coins,
  Copy,
  LayoutDashboard,
  Pencil,
  QrCode,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { HOUSES, WARDEN_OPTIONS, getHouseById } from '../data/aethermere.ts';
import {
  adminAwardEventPointsByMemberQr,
  adminDeleteEvent,
  adminDeleteUser,
  adminRecalculateHousesFromUsers,
  adminUpdateUser,
  adminUpsertEvent,
  subscribeAllUsersAdmin,
  verifyCheckInTransaction,
} from '../services/councilFirebase.ts';
import type {
  CouncilEvent,
  House,
  HouseId,
  UserProfile,
  UserRole,
} from '../types/council.ts';
import { AvatarSigil, HouseCrest } from './CouncilIcons.tsx';
import { SuperadminDashboard } from './SuperadminDashboard.tsx';

interface SuperadminViewProps {
  currentUser: UserProfile;
  houses: House[];
  events: CouncilEvent[];
  onNotify: (title: string, subtitle?: string) => void;
}

type AdminSection = 'dashboard' | 'users' | 'events' | 'qr_award' | 'houses';

const EMPTY_EVENT_FORM = {
  eventId: '',
  title: '',
  date: '2027-06-01',
  time: '18:00 – 22:00 MYT',
  location: 'Klang Valley Arena',
  houseId: 'all' as HouseId | 'all',
  wardenName: WARDEN_OPTIONS[0] as string,
  description: '',
  capacity: 150,
  basePriceRM: 30,
  checkInPoints: 250,
};

export const SuperadminView: React.FC<SuperadminViewProps> = ({
  currentUser,
  houses,
  events,
  onNotify,
}) => {
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // Inline User Editor modal/panel state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('member');
  const [editGiantsChosen, setEditGiantsChosen] = useState(false);
  const [pointsDelta, setPointsDelta] = useState('0');
  const [awardReason, setAwardReason] = useState('Superadmin Council Award');
  const [userBusy, setUserBusy] = useState(false);

  // Event Creator/Editor state
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [eventSearch, setEventSearch] = useState('');
  const [eventBusy, setEventBusy] = useState(false);
  const [activeEventQr, setActiveEventQr] = useState<CouncilEvent | null>(null);
  const [copiedEventQr, setCopiedEventQr] = useState<string | null>(null);

  // QR Award state
  const [qrInput, setQrInput] = useState('');
  const [selectedAwardEventId, setSelectedAwardEventId] = useState(events[0]?.eventId ?? '');
  const [qrBusy, setQrBusy] = useState(false);
  const [qrStatus, setQrStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // House Audit state
  const [auditBusy, setAuditBusy] = useState(false);

  useEffect(() => {
    const unsub = subscribeAllUsersAdmin(
      (list) => {
        setAllUsers(list);
        setUsersError(null);
      },
      (err) => {
        setUsersError(err.message);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedAwardEventId && events.length > 0) {
      setSelectedAwardEventId(events[0].eventId);
    }
  }, [events, selectedAwardEventId]);

  const openEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setEditDisplayName(u.displayName);
    setEditUsername(u.username);
    setEditPhone(u.phoneNumber);
    setEditRole(u.role);
    setEditGiantsChosen(Boolean(u.isGiantsChosen));
    setPointsDelta('0');
    setAwardReason('Superadmin Council Award');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUserBusy(true);
    try {
      await adminUpdateUser(editingUser.uid, {
        displayName: editDisplayName,
        username: editUsername,
        phoneNumber: editPhone,
        role: editRole,
        isGiantsChosen: editGiantsChosen,
        pointsDelta: Number(pointsDelta) || 0,
        awardReason,
      });
      onNotify('User Updated', `Saved changes for @${editUsername}`);
      setEditingUser(null);
    } catch (err) {
      onNotify(
        'Update Failed',
        err instanceof Error ? err.message : 'Unable to update user.'
      );
    } finally {
      setUserBusy(false);
    }
  };

  const handleDeleteUser = async (target: UserProfile) => {
    if (target.uid === currentUser.uid) {
      onNotify('Action Blocked', 'You cannot delete the active Superadmin session.');
      return;
    }
    setUserBusy(true);
    try {
      await adminDeleteUser(target);
      onNotify('User Removed', `Removed @${target.username} from Council registry.`);
      if (editingUser?.uid === target.uid) setEditingUser(null);
    } catch (err) {
      onNotify('Delete Failed', err instanceof Error ? err.message : 'Unable to delete user.');
    } finally {
      setUserBusy(false);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventBusy(true);
    try {
      const basePrice = Number(eventForm.basePriceRM) || 0;
      const id = await adminUpsertEvent({
        eventId: eventForm.eventId || undefined,
        title: eventForm.title,
        date: eventForm.date,
        time: eventForm.time,
        location: eventForm.location,
        houseId: eventForm.houseId,
        wardenName: eventForm.wardenName,
        description: eventForm.description,
        capacity: Number(eventForm.capacity) || 100,
        basePriceRM: basePrice,
        diamondPriceRM: basePrice,
        checkInPoints: Number(eventForm.checkInPoints) || 100,
        isCrownEvent: false,
        mediaKey: 'arena',
      });
      onNotify(
        eventForm.eventId ? 'Event Updated' : 'Event Created',
        `${eventForm.title} (+${eventForm.checkInPoints} pts) · ${id}`
      );
      setEventForm(EMPTY_EVENT_FORM);
    } catch (err) {
      onNotify('Event Save Error', err instanceof Error ? err.message : 'Failed to save event.');
    } finally {
      setEventBusy(false);
    }
  };

  const handleDeleteEvent = async (evt: CouncilEvent) => {
    setEventBusy(true);
    try {
      await adminDeleteEvent(evt.eventId);
      onNotify('Event Deleted', evt.title);
      if (eventForm.eventId === evt.eventId) {
        setEventForm(EMPTY_EVENT_FORM);
      }
      if (activeEventQr?.eventId === evt.eventId) {
        setActiveEventQr(null);
      }
    } catch (err) {
      onNotify('Delete Failed', err instanceof Error ? err.message : 'Could not delete event.');
    } finally {
      setEventBusy(false);
    }
  };

  const handleCopyEventQr = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback visual toggle
    }
    setCopiedEventQr(code);
    setTimeout(() => setCopiedEventQr((curr) => (curr === code ? null : curr)), 1800);
  };

  const handleAwardQr = async (e: React.FormEvent) => {
    e.preventDefault();
    setQrStatus(null);
    const cleaned = qrInput.trim().toUpperCase();
    if (!cleaned) return;

    setQrBusy(true);
    try {
      if (cleaned.startsWith('SRGQR-')) {
        if (!selectedAwardEventId) {
          throw new Error('Select an event to assign its points.');
        }
        const res = await adminAwardEventPointsByMemberQr(cleaned, selectedAwardEventId);
        setQrStatus({
          type: 'success',
          text: `Awarded +${res.awardedPoints} pts to ${res.attendeeName} (@${res.attendeeUsername}) for "${res.eventTitle}".`,
        });
        onNotify('Member QR Credited', `+${res.awardedPoints} pts to @${res.attendeeUsername}`);
      } else {
        const res = await verifyCheckInTransaction(cleaned);
        setQrStatus({
          type: 'success',
          text: `Checked in ${res.attendeeName} for "${res.eventTitle}" (+${res.awardedPoints} pts).`,
        });
        onNotify('Ticket Checked In', `+${res.awardedPoints} pts to ${res.attendeeName}`);
      }
      setQrInput('');
    } catch (err) {
      setQrStatus({
        type: 'error',
        text: err instanceof Error ? err.message : 'QR verification failed.',
      });
    } finally {
      setQrBusy(false);
    }
  };

  const handleRecalculateHouses = async () => {
    setAuditBusy(true);
    try {
      await adminRecalculateHousesFromUsers();
      onNotify(
        'Houses Synchronized',
        'House standings recalculated strictly from registered Firebase accounts.'
      );
    } catch (err) {
      onNotify('Sync Failed', err instanceof Error ? err.message : 'Could not sync houses.');
    } finally {
      setAuditBusy(false);
    }
  };

  const filteredUsers = allUsers.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phoneNumber.toLowerCase().includes(q) ||
      u.memberQrId.toLowerCase().includes(q)
    );
  });

  const filteredEvents = events.filter((evt) => {
    const q = eventSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      evt.title.toLowerCase().includes(q) ||
      evt.date.toLowerCase().includes(q) ||
      evt.eventId.toLowerCase().includes(q) ||
      (evt.eventQrId ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Superadmin Header */}
      <div className="rounded-3xl border border-[#D4AF37]/45 bg-white dark:bg-gradient-to-r dark:from-[#241418] dark:via-[#18181E] dark:to-[#121212] p-5 sm:p-6 shadow-sm dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E31E24] text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                Council Backend Administration · {currentUser.email}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                Superadmin Command Center
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Registered Users</p>
              <p className="font-mono text-lg font-bold text-zinc-900 dark:text-white tabular-nums">
                {allUsers.length}
              </p>
            </div>
            <div className="h-8 w-px bg-zinc-200 dark:bg-white/10" />
            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Active Events</p>
              <p className="font-mono text-lg font-bold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
                {events.length}
              </p>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
            { id: 'users' as const, label: 'Manage Users', icon: Users },
            { id: 'events' as const, label: 'Events & Points', icon: CalendarPlus },
            { id: 'qr_award' as const, label: 'QR Point Award', icon: QrCode },
            { id: 'houses' as const, label: 'Houses Sync', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#E31E24] text-white'
                    : 'border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] text-zinc-700 dark:text-zinc-300 hover:border-[#E31E24]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 0: EXECUTIVE DASHBOARD (DEFAULT) */}
      {section === 'dashboard' && (
        <SuperadminDashboard
          allUsers={allUsers}
          houses={houses}
          events={events}
          onCreateEvent={(prefillDate) => {
            setEventForm({
              ...EMPTY_EVENT_FORM,
              date: prefillDate || EMPTY_EVENT_FORM.date,
            });
            setSection('events');
          }}
          onEditEvent={(evt) => {
            setEventForm({
              eventId: evt.eventId,
              title: evt.title,
              date: evt.date,
              time: evt.time,
              location: evt.location,
              houseId: evt.houseId,
              wardenName: WARDEN_OPTIONS.includes(evt.wardenName as (typeof WARDEN_OPTIONS)[number])
                ? evt.wardenName
                : WARDEN_OPTIONS[0],
              description: evt.description,
              capacity: evt.capacity,
              basePriceRM: evt.basePriceRM,
              checkInPoints: evt.checkInPoints,
            });
            setSection('events');
          }}
          onOpenEventQr={(evt) => setActiveEventQr(evt)}
        />
      )}

      {/* SECTION 1: MANAGE USERS */}
      {section === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name, @username, email, phone, QR ID..."
                className="w-full min-h-[44px] rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] pl-10 pr-4 text-xs text-zinc-900 dark:text-white focus:border-[#E31E24] focus:outline-none"
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Showing {filteredUsers.length} registered Firebase account
              {filteredUsers.length === 1 ? '' : 's'}
            </p>
          </div>

          {usersError && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-700 dark:text-red-200">
              {usersError}
            </div>
          )}

          {editingUser && (
            <form
              onSubmit={handleSaveUser}
              className="rounded-3xl border border-[#F7D117]/60 bg-white dark:bg-[#18181E] p-5 sm:p-6 space-y-4 shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                    Editing Member UID: {editingUser.uid}
                  </p>
                  <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                    {editingUser.displayName} (@{editingUser.username})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="min-h-[40px] rounded-xl border border-zinc-200 dark:border-white/12 px-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase())}
                    className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 font-mono text-xs text-zinc-900 dark:text-white lowercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+60197684608"
                    className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 font-mono text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-xs text-zinc-900 dark:text-white"
                  >
                    <option value="member">Member</option>
                    <option value="warden">Warden (Scanner)</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Adjust Points (+/-)
                  </label>
                  <input
                    type="number"
                    min={-10000}
                    max={5000}
                    value={pointsDelta}
                    onChange={(e) => setPointsDelta(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 font-mono text-xs text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Adjustment Note
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={awardReason}
                    onChange={(e) => setAwardReason(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editGiantsChosen}
                    onChange={(e) => setEditGiantsChosen(e.target.checked)}
                    className="h-4 w-4 accent-[#E31E24]"
                  />
                  <span>Bestow Giant&apos;s Chosen Rank (Invite-Only)</span>
                </label>

                <button
                  type="submit"
                  disabled={userBusy}
                  className="min-h-[44px] rounded-xl bg-[#E31E24] px-5 text-xs font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer"
                >
                  {userBusy ? 'Applying...' : 'Save User Changes'}
                </button>
              </div>
            </form>
          )}

          <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] divide-y divide-zinc-200 dark:divide-white/8 overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No registered Firebase users match your search.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const h = getHouseById(u.houseId);
                const rowIsAdmin = u.role === 'superadmin';
                return (
                  <div
                    key={u.uid}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <AvatarSigil
                        avatarId={rowIsAdmin ? 'crest' : u.avatarId}
                        photoDataUrl={u.photoDataUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white truncate">
                            {u.displayName}
                          </h3>
                          <span className="font-mono text-xs text-[#E31E24] dark:text-[#F7D117]">
                            @{u.username}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200">
                            {u.role}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
                          {u.email} · {u.phoneNumber || 'No phone'}
                        </p>
                        {!rowIsAdmin && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                            {h ? h.name : 'Unpledged'} · {u.rank} · {u.points.toLocaleString()} pts ·{' '}
                            {u.memberQrId}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditUser(u)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-[#E31E24] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5 text-[#E31E24] dark:text-[#F7D117]" />
                        <span>Manage</span>
                      </button>
                      {u.uid !== currentUser.uid && (
                        <button
                          type="button"
                          disabled={userBusy}
                          onClick={() => void handleDeleteUser(u)}
                          aria-label={`Delete ${u.displayName}`}
                          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-zinc-200 dark:border-white/12 text-zinc-500 hover:border-red-500 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: CREATE / EDIT EVENTS & ASSIGN POINTS */}
      {section === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveEvent}
            className="lg:col-span-5 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-5 sm:p-6 space-y-4 shadow-sm dark:shadow-none"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                {eventForm.eventId ? 'Edit Activation Event' : 'Create New Event'}
              </h2>
              {eventForm.eventId && (
                <button
                  type="button"
                  onClick={() => setEventForm(EMPTY_EVENT_FORM)}
                  className="text-xs font-semibold text-[#E31E24] cursor-pointer"
                >
                  + New Event
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Event Title
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={100}
                value={eventForm.title}
                onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. SRG Fan Meet & Watch Party"
                className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-xs text-zinc-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={eventForm.date}
                  onChange={(e) => setEventForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 font-mono text-xs text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Time Window
                </label>
                <input
                  type="text"
                  required
                  value={eventForm.time}
                  onChange={(e) => setEventForm((f) => ({ ...f, time: e.target.value }))}
                  placeholder="18:00 – 22:00 MYT"
                  className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-xs text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Location
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={eventForm.location}
                onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-xs text-zinc-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Host House
                </label>
                <select
                  value={eventForm.houseId}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, houseId: e.target.value as HouseId | 'all' }))
                  }
                  className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-xs text-zinc-900 dark:text-white"
                >
                  <option value="all">All Houses</option>
                  {HOUSES.map((h) => (
                    <option key={h.houseId} value={h.houseId}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Hosting Warden
                </label>
                <select
                  value={eventForm.wardenName}
                  onChange={(e) => setEventForm((f) => ({ ...f, wardenName: e.target.value }))}
                  className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-xs text-zinc-900 dark:text-white"
                >
                  {WARDEN_OPTIONS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#E31E24] dark:text-[#F7D117] mb-1">
                  Event Points
                </label>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  required
                  value={eventForm.checkInPoints}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, checkInPoints: Number(e.target.value) }))
                  }
                  className="w-full min-h-[42px] rounded-xl border border-[#E31E24]/50 bg-zinc-50 dark:bg-[#121212] px-3 font-mono text-xs text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Capacity
                </label>
                <input
                  type="number"
                  min={5}
                  max={10000}
                  required
                  value={eventForm.capacity}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, capacity: Number(e.target.value) }))
                  }
                  className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 font-mono text-xs text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Entry Fee (RM)
                </label>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  required
                  value={eventForm.basePriceRM}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, basePriceRM: Number(e.target.value) }))
                  }
                  className="w-full min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 font-mono text-xs text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                required
                minLength={10}
                maxLength={360}
                value={eventForm.description}
                onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe activation activities, dress code, and check-in rewards..."
                className="w-full rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] p-3 text-xs text-zinc-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={eventBusy}
              className="w-full min-h-[46px] rounded-xl bg-[#E31E24] text-sm font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer"
            >
              {eventBusy
                ? 'Saving Event...'
                : eventForm.eventId
                  ? 'Update Event & Points'
                  : 'Publish Event & Generate QR'}
            </button>
          </form>

          {/* Existing Events List + Search */}
          <div className="lg:col-span-7 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="search"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Search by event name, date (YYYY-MM-DD), or event ID..."
                className="w-full min-h-[44px] rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] pl-10 pr-4 text-xs text-zinc-900 dark:text-white focus:border-[#E31E24] focus:outline-none"
              />
            </div>

            <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] divide-y divide-zinc-200 dark:divide-white/8 overflow-hidden shadow-sm dark:shadow-none">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No events match your search.
                </div>
              ) : (
                filteredEvents.map((evt) => {
                  const qrValue = evt.eventQrId || evt.eventId.toUpperCase();
                  return (
                    <div
                      key={evt.eventId}
                      className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <HouseCrest houseId={evt.houseId} size="sm" />
                        <div className="min-w-0">
                          <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white truncate">
                            {evt.title}
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {evt.date} · {evt.location} · Warden {evt.wardenName}
                          </p>
                          <p className="font-mono text-[11px] text-[#E31E24] dark:text-[#F7D117] mt-0.5 truncate">
                            +{evt.checkInPoints} pts · {evt.bookedCount}/{evt.capacity} seats ·{' '}
                            {evt.basePriceRM === 0 ? 'FREE' : `RM${evt.basePriceRM}`} ·{' '}
                            <span className="text-zinc-500 dark:text-zinc-400">{qrValue}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveEventQr(evt)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#D4AF37]/50 bg-zinc-50 dark:bg-[#121212] px-3 text-xs font-semibold text-zinc-800 dark:text-[#F7D117] hover:border-[#E31E24] cursor-pointer"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>Event QR</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEventForm({
                              eventId: evt.eventId,
                              title: evt.title,
                              date: evt.date,
                              time: evt.time,
                              location: evt.location,
                              houseId: evt.houseId,
                              wardenName: WARDEN_OPTIONS.includes(evt.wardenName as (typeof WARDEN_OPTIONS)[number])
                                ? evt.wardenName
                                : WARDEN_OPTIONS[0],
                              description: evt.description,
                              capacity: evt.capacity,
                              basePriceRM: evt.basePriceRM,
                              checkInPoints: evt.checkInPoints,
                            })
                          }
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-zinc-200 dark:border-white/12 px-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-[#E31E24] cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          disabled={eventBusy}
                          onClick={() => void handleDeleteEvent(evt)}
                          aria-label={`Delete ${evt.title}`}
                          className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-zinc-200 dark:border-white/12 text-zinc-500 hover:border-red-500 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: CREW QR POINT AWARD */}
      {section === 'qr_award' && (
        <div className="max-w-xl rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-6 space-y-5 shadow-sm dark:shadow-none">
          <div>
            <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Coins className="h-5 w-5 text-[#E31E24] dark:text-[#F7D117]" />
              <span>Award Event Points by QR ID</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Scan or enter either a fan&apos;s personal Member QR ID (<span className="font-mono">SRGQR-...</span>) paired with an event below, or an Event Ticket Token (<span className="font-mono">SRG27-...</span>).
            </p>
          </div>

          <form onSubmit={handleAwardQr} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Event Assigning Points (for Member QR IDs)
              </label>
              <select
                value={selectedAwardEventId}
                onChange={(e) => setSelectedAwardEventId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3.5 text-xs text-zinc-900 dark:text-white"
              >
                {events.map((evt) => (
                  <option key={evt.eventId} value={evt.eventId}>
                    {evt.title} (+{evt.checkInPoints} pts · {evt.date})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Member QR ID or Booking Token
              </label>
              <input
                type="text"
                required
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="SRGQR-... or SRG27-JAN-..."
                className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-4 font-mono text-sm text-zinc-900 dark:text-white uppercase"
              />
            </div>

            {qrStatus && (
              <div
                className={`rounded-xl border px-4 py-3 text-xs ${
                  qrStatus.type === 'success'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                    : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200'
                }`}
              >
                {qrStatus.text}
              </div>
            )}

            <button
              type="submit"
              disabled={qrBusy}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#E31E24] text-sm font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{qrBusy ? 'Crediting...' : 'Verify QR & Award Event Points'}</span>
            </button>
          </form>
        </div>
      )}

      {/* SECTION 4: HOUSES SYNC & CLEANUP */}
      {section === 'houses' && (
        <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-6 space-y-5 shadow-sm dark:shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white">
                House Standings Integrity Audit
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Recomputes House totals strictly from registered Firebase users and clears any legacy seed records.
              </p>
            </div>
            <button
              type="button"
              disabled={auditBusy}
              onClick={() => void handleRecalculateHouses()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E31E24] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`h-4 w-4 ${auditBusy ? 'animate-spin' : ''}`} />
              <span>{auditBusy ? 'Syncing...' : 'Recalculate From Registered Users'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {houses.map((h) => (
              <div
                key={h.houseId}
                className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <HouseCrest houseId={h.houseId} size="sm" />
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white truncate">
                      {h.name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {h.memberCount} registered member{h.memberCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
                  {h.totalPoints.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unique Event QR Modal for Venue Display */}
      {activeEventQr && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl border border-[#D4AF37]/40 bg-white dark:bg-[#18181E] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                  Unique Event Check-In QR
                </p>
                <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white mt-0.5">
                  {activeEventQr.title}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {activeEventQr.date} · +{activeEventQr.checkInPoints} pts auto-reward
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveEventQr(null)}
                aria-label="Close Event QR dialog"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const code = activeEventQr.eventQrId || activeEventQr.eventId.toUpperCase();
              return (
                <>
                  <div className="mt-5 flex flex-col items-center rounded-2xl border border-zinc-200 dark:border-transparent bg-zinc-50 dark:bg-white p-5">
                    <QRCodeSVG value={code} size={208} level="H" />
                    <p className="mt-3 font-mono text-xs font-bold text-[#121212] tracking-wider">
                      {code}
                    </p>
                  </div>

                  <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
                    Display this QR at the venue. Registered fans scan it in the Events tab to claim +{activeEventQr.checkInPoints} points once per account.
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleCopyEventQr(code)}
                    className="mt-4 w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-[#E31E24] cursor-pointer"
                  >
                    {copiedEventQr === code ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span>Event QR Code Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
                        <span>Copy Event QR Code</span>
                      </>
                    )}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
