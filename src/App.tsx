import React, { useCallback, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarDays,
  Home,
  LogOut,
  MailCheck,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCircle2,
} from 'lucide-react';
import { AuthGateModal, type EmailRegistrationPayload } from './components/AuthGateModal.tsx';
import { EventsView } from './components/EventsView.tsx';
import { HomeView, type NavTab } from './components/HomeView.tsx';
import { HousesView } from './components/HousesView.tsx';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { OathOnboardingWizard } from './components/OathOnboardingWizard.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { SuperadminView } from './components/SuperadminView.tsx';
import { EVENTS_2027, HOUSES } from './data/aethermere.ts';
import { SRG_LOGO_URL } from './data/media.ts';
import { auth } from './firebase.ts';
import {
  adminAwardEventPointsByMemberQr,
  bookEventTransaction,
  checkIsAdminRecord,
  claimEventQrTransaction,
  completeOathTransaction,
  ensureUserProfile,
  grantWardenRoleAdmin,
  isPhoneAvailable,
  isUserAdminAccount,
  seedCatalogIfEmpty,
  subscribeCouncilData,
  updateProfileTransaction,
  updateThemePreference,
  verifyCheckInTransaction,
} from './services/councilFirebase.ts';
import type {
  ClassId,
  CouncilEvent,
  EventBooking,
  House,
  HouseId,
  LeaderboardMember,
  PointTransaction,
  ThemePreference,
  UserProfile,
} from './types/council.ts';

const OFFLINE_CACHE_KEY = 'srg_council_offline_snapshot_v2';
const THEME_STORAGE_KEY = 'srg_council_theme_v1';

interface OfflineSnapshot {
  houses: House[];
  events: CouncilEvent[];
  bookings: EventBooking[];
}

function readInitialTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function readOfflineSnapshot(): OfflineSnapshot | null {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineSnapshot;
  } catch {
    return null;
  }
}

function writeOfflineSnapshot(snapshot: OfflineSnapshot) {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
}

function formatFirebaseAuthError(err: unknown): string {
  if (!(err instanceof Error)) return 'Authentication failed. Please try again.';
  const msg = err.message;
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not enabled in Firebase Authentication yet. Enable it under Authentication -> Sign-in method in Firebase Console, or sign in with Google.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'Incorrect email or password.';
  }
  if (msg.includes('auth/user-not-found')) {
    return 'No registered account found for that email. Switch to Register to create one.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters.';
  }
  return msg;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [theme, setTheme] = useState<ThemePreference>(readInitialTheme);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [houses, setHouses] = useState<House[]>(HOUSES);
  const [events, setEvents] = useState<CouncilEvent[]>(EVENTS_2027);
  const [bookings, setBookings] = useState<EventBooking[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardMember[]>([]);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [oathWizardOpen, setOathWizardOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CouncilEvent | null>(null);
  const [verifyingRefresh, setVerifyingRefresh] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [toast, setToast] = useState<{
    id: number;
    title: string;
    subtitle?: string;
  } | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  const showToast = useCallback((title: string, subtitle?: string) => {
    const id = Date.now();
    setToast({ id, title, subtitle });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 3600);
  }, []);

  // Apply Tailwind dark class & meta theme-color
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#121212' : '#F6F6F8');
    }
  }, [theme]);

  const handleToggleTheme = useCallback((nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    const uid = auth.currentUser?.uid;
    if (uid) {
      void updateThemePreference(uid, nextTheme);
    }
  }, []);

  useEffect(() => {
    const cached = readOfflineSnapshot();
    if (cached) {
      setHouses(cached.houses);
      setEvents(cached.events);
      setBookings(cached.bookings);
    }
  }, []);

  const syncSignedInUser = useCallback(
    async (
      firebaseUser: NonNullable<typeof auth.currentUser>,
      unsubRef: { current: (() => void) | null },
      isMounted: () => boolean
    ) => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      if (!firebaseUser.emailVerified) {
        if (!isMounted()) return;
        setNeedsEmailVerification(true);
        setIsAdmin(false);
        setUser(null);
        setAuthReady(true);
        return;
      }

      setNeedsEmailVerification(false);

      const [profile, adminRecord] = await Promise.all([
        ensureUserProfile(firebaseUser),
        checkIsAdminRecord(firebaseUser.uid),
      ]);
      const adminFlag = isUserAdminAccount(firebaseUser, adminRecord);
      await seedCatalogIfEmpty(adminFlag);

      if (!isMounted()) return;
      setIsAdmin(adminFlag);
      setUser(profile);
      if (profile.themePreference) {
        setTheme(profile.themePreference);
      }
      setAuthReady(true);

      if (adminFlag) {
        setOathWizardOpen(false);
        setActiveTab((curr) => (curr === 'home' ? 'superadmin' : curr));
      } else if (!profile.houseId || !profile.classId || !profile.phoneNumber) {
        setOathWizardOpen(true);
      }

      unsubRef.current = subscribeCouncilData(firebaseUser.uid, {
        onUser: (nextUser) => {
          if (nextUser) setUser(nextUser);
        },
        onHouses: (nextHouses) => setHouses(nextHouses),
        onQuests: () => {},
        onEvents: (nextEvents) => setEvents(nextEvents),
        onLeaderboard: (nextLeaderboard) => setLeaderboard(nextLeaderboard),
        onBookings: (nextBookings) => setBookings(nextBookings),
        onTransactions: (nextTransactions) => setTransactions(nextTransactions),
        onError: (err) => setFatalError(err),
      });
    },
    []
  );

  useEffect(() => {
    const unsubRef: { current: (() => void) | null } = { current: null };
    let active = true;
    const isMounted = () => active;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      if (!firebaseUser) {
        if (!active) return;
        setNeedsEmailVerification(false);
        setIsAdmin(false);
        setUser(null);
        setBookings([]);
        setTransactions([]);
        setLeaderboard([]);
        setAuthReady(true);
        return;
      }

      try {
        await syncSignedInUser(firebaseUser, unsubRef, isMounted);
      } catch (err) {
        if (active && err instanceof Error) {
          setFatalError(err);
        }
      }
    });

    void getRedirectResult(auth)
      .then((result) => {
        if (active && result?.user) {
          showToast(
            `Welcome, ${result.user.displayName || 'Wanderer'}`,
            'Connected to The Council Firestore ledger'
          );
        }
      })
      .catch((err) => {
        if (active) {
          showToast('Google Sign-In Notice', formatFirebaseAuthError(err));
        }
      });

    return () => {
      active = false;
      unsubAuth();
      if (unsubRef.current) unsubRef.current();
    };
  }, [syncSignedInUser, showToast]);

  useEffect(() => {
    if (!authReady || !user) return;
    writeOfflineSnapshot({ houses, events, bookings });
  }, [authReady, user, houses, events, bookings]);

  const handleGoogleSuccess = useCallback(
    (displayName: string | null) => {
      showToast(
        `Welcome, ${displayName || 'Wanderer'}`,
        'Connected to The Council Firestore ledger'
      );
    },
    [showToast]
  );

  const handleEmailSignIn = async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        showToast(
          'Verify Your Email',
          'A verification link was sent to your inbox to activate your Council seat.'
        );
      } else {
        showToast('Signed In', `Welcome back, ${cred.user.displayName || cred.user.email}`);
      }
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const handleEmailRegister = async (payload: EmailRegistrationPayload) => {
    const available = await isPhoneAvailable(payload.phoneNumber);
    if (!available) {
      throw new Error(
        'This phone number is already linked to another registered Council account.'
      );
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
      await updateProfile(cred.user, { displayName: payload.displayName });
      await ensureUserProfile(cred.user, {
        displayName: payload.displayName,
        username: payload.username,
        phoneNumber: payload.phoneNumber,
      });
      await sendEmailVerification(cred.user);
      showToast(
        'Verification Email Sent',
        `Verify ${payload.email} via the link in your inbox, then tap refresh.`
      );
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
  };

  const handleRefreshVerification = async () => {
    if (!auth.currentUser) return;
    setVerifyingRefresh(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        window.location.reload();
      } else {
        showToast(
          'Not Verified Yet',
          'Please click the verification link sent to your email inbox first.'
        );
      }
    } finally {
      setVerifyingRefresh(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
    showToast('Verification Email Resent', `Check ${auth.currentUser.email}`);
  };

  const handleCompleteOath = async (payload: {
    displayName: string;
    username: string;
    phoneNumber: string;
    avatarId: string;
    bio: string;
    houseId: HouseId;
    classId: ClassId;
  }) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setAuthModalOpen(true);
      return;
    }

    const res = await completeOathTransaction(uid, payload);
    showToast(
      res.wasUnpledged ? 'Oath of the Red Giant Sealed' : 'Council Profile Updated',
      res.wasUnpledged
        ? `+${res.awardedPoints} Oath Bonus points awarded to your House`
        : `@${payload.username}`
    );
  };

  const handleSaveProfile = async (payload: {
    displayName: string;
    username: string;
    phoneNumber: string;
    photoDataUrl: string;
    avatarId: string;
    bio: string;
    themePreference: ThemePreference;
  }) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await updateProfileTransaction(uid, payload);
    showToast('Profile Saved', `@${payload.username} synced to The Council`);
  };

  const handleBookEvent = async (eventId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setAuthModalOpen(true);
      throw new Error('Sign in to reserve an activation pass.');
    }
    const booking = await bookEventTransaction(uid, eventId);
    showToast('QR Activation Pass Ready', `Token ${booking.qrCodeToken} saved offline`);
    return booking;
  };

  const handleClaimEventQr = async (eventQrCode: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setAuthModalOpen(true);
      throw new Error('Sign in to claim Event QR points.');
    }
    const res = await claimEventQrTransaction(uid, eventQrCode);
    showToast(
      res.rankedUp ? `Rank Up: ${res.newRank}!` : `+${res.awardedPoints} pts Collected`,
      res.eventTitle
    );
    return res;
  };

  const handleVerifyCheckIn = async (rawToken: string, eventId?: string) => {
    const cleaned = rawToken.trim().toUpperCase();
    if (cleaned.startsWith('SRGQR-')) {
      if (!eventId) throw new Error('Select an event to credit Member QR points.');
      const res = await adminAwardEventPointsByMemberQr(cleaned, eventId);
      showToast(
        `Member Credited: ${res.attendeeName}`,
        `+${res.awardedPoints} pts awarded for ${res.eventTitle}`
      );
      return res;
    }

    const res = await verifyCheckInTransaction(cleaned);
    showToast(
      `Check-In Verified: ${res.attendeeName}`,
      `+${res.awardedPoints} pts awarded for ${res.eventTitle}`
    );
    return res;
  };

  const handleGrantWarden = async (targetUid: string) => {
    await grantWardenRoleAdmin(targetUid);
    showToast('Warden Access Granted', `Updated role for ${targetUid}`);
  };

  const handleSignOut = async () => {
    if (auth.currentUser) {
      await signOut(auth);
    }
    setUser(null);
    setIsAdmin(false);
    setNeedsEmailVerification(false);
    setBookings([]);
    setTransactions([]);
    setLeaderboard([]);
    setActiveTab('home');
    showToast('Signed out of The Council');
  };

  const navItems: {
    id: NavTab;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    isAdmin
      ? {
          id: 'superadmin',
          label: 'Superadmin',
          mobileLabel: 'Superadmin',
          icon: ShieldCheck,
        }
      : {
          id: 'home',
          label: 'Home',
          mobileLabel: 'Home',
          icon: Home,
        },
    { id: 'houses', label: 'Houses', mobileLabel: 'Houses', icon: Shield },
    { id: 'events', label: 'Events', mobileLabel: 'Events', icon: CalendarDays },
    { id: 'leaderboard', label: 'Leaderboard', mobileLabel: 'Ranks', icon: Trophy },
    { id: 'profile', label: 'Profile', mobileLabel: 'Profile', icon: UserCircle2 },
  ];

  const isSplitSignInView = authReady && !needsEmailVerification && !user;
  const resolvedTab: NavTab = isAdmin && activeTab === 'home' ? 'superadmin' : activeTab;

  return (
    <div
      className={`min-h-dvh bg-[#F6F6F8] dark:bg-[#121212] text-zinc-900 dark:text-[#F4F3F6] transition-colors ${
        isSplitSignInView ? 'pb-0' : 'pb-24 md:pb-12'
      }`}
    >
      {/* Desktop Top Header Navigation (hidden on mobile; mobile uses bottom navbar) */}
      {user && !isSplitSignInView && (
        <header className="hidden md:block sticky top-0 z-30 border-b border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-6">
            {/* Zone 1: Brand Mark */}
            <button
              type="button"
              onClick={() => setActiveTab(isAdmin ? 'superadmin' : 'home')}
              className="flex items-center gap-3 text-left shrink-0 cursor-pointer"
            >
              <img
                src={SRG_LOGO_URL}
                alt="SRG Esports"
                referrerPolicy="no-referrer"
                className="h-9 w-9 object-contain"
              />
              <div>
                <p className="font-display text-base font-bold leading-tight text-zinc-900 dark:text-white">
                  The Council
                </p>
                <p className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                  SRG Esports
                </p>
              </div>
            </button>

            {/* Zone 2: Single-line Primary Navigation */}
            <nav aria-label="Desktop Primary Navigation" className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = resolvedTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#E31E24]/10 text-[#E31E24] dark:bg-[#E31E24]/20 dark:text-[#F7D117]'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        active ? 'text-[#E31E24] dark:text-[#F7D117]' : ''
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Zone 3: Account & Sign Out */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="text-right pr-1 cursor-pointer group"
              >
                <p className="font-display text-xs font-bold text-zinc-900 dark:text-white group-hover:text-[#E31E24] dark:group-hover:text-[#F7D117] transition-colors">
                  {user.displayName}
                </p>
                <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  @{user.username}
                </p>
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                aria-label="Sign out"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/12 px-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-[#E31E24] hover:text-[#E31E24] dark:hover:text-[#F7D117] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {isSplitSignInView ? (
        <AuthGateModal
          isOpen={true}
          embedded={true}
          onClose={() => setAuthModalOpen(false)}
          onGoogleSuccess={handleGoogleSuccess}
          onEmailSignIn={handleEmailSignIn}
          onEmailRegister={handleEmailRegister}
        />
      ) : (
        <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-5 md:pt-7">
          {!authReady ? (
            <div className="min-h-[75dvh] flex flex-col items-center justify-center gap-3">
              <img
                src={SRG_LOGO_URL}
                alt="SRG Esports"
                referrerPolicy="no-referrer"
                className="h-14 w-14 object-contain animate-pulse"
              />
              <p className="font-display text-sm text-zinc-500 dark:text-zinc-400">
                Synchronizing The Council Ledger...
              </p>
            </div>
          ) : needsEmailVerification ? (
            <div className="min-h-[75dvh] flex items-center justify-center">
              <div className="w-full max-w-md rounded-3xl border border-[#D4AF37]/35 bg-white dark:bg-[#18181E] p-6 sm:p-8 text-center space-y-4 shadow-xl">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E31E24]/15 text-[#E31E24] dark:text-[#F7D117]">
                  <MailCheck className="h-7 w-7" />
                </div>
                <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
                  Verify Your Email Address
                </h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  We sent a verification link to{' '}
                  <strong className="text-zinc-900 dark:text-white">
                    {auth.currentUser?.email}
                  </strong>
                  . Open the link in your inbox, then tap refresh below to enter The Council.
                </p>
                <div className="pt-2 space-y-2.5">
                  <button
                    type="button"
                    disabled={verifyingRefresh}
                    onClick={() => void handleRefreshVerification()}
                    className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#E31E24] text-sm font-semibold text-white hover:bg-[#C8102E] cursor-pointer"
                  >
                    <RefreshCw className={`h-4 w-4 ${verifyingRefresh ? 'animate-spin' : ''}`} />
                    <span>{verifyingRefresh ? 'Checking...' : "I've Verified — Continue"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 text-xs font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                  >
                    Resend Verification Email
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="w-full min-h-[40px] text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  >
                    Sign Out & Use Another Account
                  </button>
                </div>
              </div>
            </div>
          ) : user ? (
            <>
              {resolvedTab === 'home' && !isAdmin && (
                <HomeView
                  user={user}
                  houses={houses}
                  events={events}
                  bookings={bookings}
                  transactions={transactions}
                  onNavigate={setActiveTab}
                  onOpenAuth={() => setAuthModalOpen(true)}
                  onOpenOath={() => setOathWizardOpen(true)}
                  onSelectEvent={(evt) => {
                    setSelectedEvent(evt);
                    setActiveTab('events');
                  }}
                />
              )}

              {resolvedTab === 'houses' && (
                <HousesView
                  houses={houses}
                  events={events}
                  user={user}
                  onSelectEvent={(evt) => {
                    setSelectedEvent(evt);
                    setActiveTab('events');
                  }}
                  onPledgeHouse={() => setOathWizardOpen(true)}
                />
              )}

              {resolvedTab === 'events' && (
                <EventsView
                  events={events}
                  bookings={bookings}
                  user={user}
                  isAdmin={isAdmin}
                  selectedEvent={selectedEvent}
                  onSelectEvent={setSelectedEvent}
                  onBookEvent={handleBookEvent}
                  onClaimEventQr={handleClaimEventQr}
                  onVerifyCheckIn={handleVerifyCheckIn}
                  onGrantWarden={handleGrantWarden}
                  onOpenAuth={() => setAuthModalOpen(true)}
                />
              )}

              {resolvedTab === 'leaderboard' && (
                <LeaderboardView
                  houses={houses}
                  leaderboard={leaderboard}
                  user={user}
                />
              )}

              {resolvedTab === 'profile' && (
                <ProfileView
                  user={user}
                  theme={theme}
                  isAdmin={isAdmin}
                  onToggleTheme={handleToggleTheme}
                  onSaveProfile={handleSaveProfile}
                  onOpenAdmin={() => setActiveTab('superadmin')}
                  onSignOut={handleSignOut}
                />
              )}

              {resolvedTab === 'superadmin' && isAdmin && (
                <SuperadminView
                  currentUser={user}
                  houses={houses}
                  events={events}
                  onNotify={showToast}
                />
              )}
            </>
          ) : null}
        </main>
      )}

      {/* Mobile-Only Bottom App-Style Navigation Bar */}
      {user && (
        <nav
          aria-label="Mobile Primary Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 h-full items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = resolvedTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                    active
                      ? 'text-[#E31E24] dark:text-[#F7D117]'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      active ? 'text-[#E31E24] dark:text-[#F7D117]' : ''
                    }`}
                  />
                  <span className="text-[10px] font-medium tracking-tight truncate max-w-full px-0.5">
                    {item.mobileLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Celebration Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            role="status"
            aria-live="polite"
            className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 rounded-2xl border border-[#F7D117]/50 bg-white/95 dark:bg-[#18181E]/95 px-4 py-3.5 shadow-2xl backdrop-blur-md flex items-start gap-3"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-[#E31E24] dark:text-[#F7D117] mt-0.5" />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                {toast.title}
              </p>
              {toast.subtitle && (
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                  {toast.subtitle}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <OfflineIndicator />

      <AuthGateModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onGoogleSuccess={handleGoogleSuccess}
        onEmailSignIn={handleEmailSignIn}
        onEmailRegister={handleEmailRegister}
      />

      <OathOnboardingWizard
        isOpen={oathWizardOpen && !isAdmin}
        user={user}
        onClose={() => setOathWizardOpen(false)}
        onComplete={handleCompleteOath}
      />
    </div>
  );
}
