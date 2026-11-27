import type { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import {
  EVENTS_2027,
  HOUSES,
  calculateRank,
} from '../data/aethermere.ts';
import {
  ADMIN_EMAIL,
  OperationType,
  db,
  handleFirestoreError,
} from '../firebase.ts';
import type {
  ClassId,
  CouncilEvent,
  EventBooking,
  House,
  HouseId,
  LeaderboardMember,
  LiveChatMessage,
  MembershipTier,
  PointTransaction,
  Quest,
  RankTitle,
  ThemePreference,
  UserProfile,
  UserRole,
} from '../types/council.ts';

const VALID_AVATARS = new Set(['crest', 'knight', 'visor', 'tome', 'lyre', 'coin']);
const VALID_HOUSES = new Set<HouseId>(['circuit', 'sigil', 'stride', 'reel', 'echo']);
const VALID_CLASSES = new Set<ClassId>(['vanguard', 'scout', 'bard', 'sage', 'merchant']);
const DANIAL_PHONE = '+60197684608';

function clampString(val: unknown, max: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

export function sanitizeUsername(raw: string, fallback = 'wanderer'): string {
  const cleaned = raw.trim().replace(/^@+/, '').toLowerCase();
  const sliced = cleaned.slice(0, 40);
  return sliced.length >= 1 ? sliced : fallback.toLowerCase().slice(0, 40);
}

export function normalizePhone(dialCode: string, nationalInput: string): {
  phoneNumber: string;
  phoneKey: string;
} {
  const cleanDial = dialCode.startsWith('+')
    ? `+${dialCode.replace(/\D/g, '')}`
    : `+${dialCode.replace(/\D/g, '') || '60'}`;
  let nationalDigits = nationalInput.replace(/\D/g, '');
  // Strip redundant leading 0 when using Malaysia/SG style dial codes
  if ((cleanDial === '+60' || cleanDial === '+65' || cleanDial === '+62') && nationalDigits.startsWith('0')) {
    nationalDigits = nationalDigits.replace(/^0+/, '');
  }
  const phoneNumber = `${cleanDial}${nationalDigits}`.slice(0, 24);
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  const phoneKey = `p_${digitsOnly}`.slice(0, 24);
  return { phoneNumber, phoneKey };
}

export function phoneToKey(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  return digits.length >= 6 ? `p_${digits}`.slice(0, 24) : '';
}

export function buildMemberQrId(uid: string): string {
  const cleanUid = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = (cleanUid.slice(0, 12) || 'MEMBER2027').padEnd(6, '0');
  return `SRGQR-${suffix}`.slice(0, 40);
}

function buildReferralCode(displayName: string, uid: string): string {
  const prefix = displayName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SRG';
  const suffix = uid.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '2027';
  return `SRG-${prefix}-${suffix}`.slice(0, 24);
}

function sanitizeAvatar(avatarId: string): string {
  return VALID_AVATARS.has(avatarId) ? avatarId : 'crest';
}

function isDanialUser(displayName: string, email: string): boolean {
  return (
    email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
    displayName.trim().toLowerCase() === 'danial danish'
  );
}

function mapFirestoreUser(data: DocumentData): UserProfile {
  const rawHouse = data.houseId as string | undefined;
  const rawClass = data.classId as string | undefined;
  const uid = String(data.uid ?? '');
  const displayName = String(data.displayName ?? 'Wanderer');
  const email = String(data.email ?? '');

  let role: UserRole = 'member';
  if (data.role === 'superadmin') role = 'superadmin';
  else if (data.role === 'warden') role = 'warden';

  return {
    uid,
    displayName,
    username: sanitizeUsername(
      String(data.username ?? (email.split('@')[0] || displayName || 'wanderer'))
    ),
    email,
    phoneNumber: String(
      data.phoneNumber || (isDanialUser(displayName, email) ? DANIAL_PHONE : '')
    ),
    avatarId: String(data.avatarId ?? 'crest'),
    photoDataUrl: String(data.photoDataUrl ?? ''),
    bio: String(data.bio ?? 'Sworn to the Red Giant in Aethermere.'),
    houseId: rawHouse && VALID_HOUSES.has(rawHouse as HouseId) ? (rawHouse as HouseId) : null,
    classId: rawClass && VALID_CLASSES.has(rawClass as ClassId) ? (rawClass as ClassId) : null,
    tier: data.tier === 'diamond' ? 'diamond' : 'free',
    points: typeof data.points === 'number' ? data.points : 0,
    rank: (data.rank as RankTitle) || 'Wanderer',
    role,
    memberQrId: String(data.memberQrId || buildMemberQrId(uid)),
    themePreference: data.themePreference === 'dark' ? 'dark' : 'light',
    joinedAt: String(data.joinedAt ?? new Date().toISOString()),
    attendedEvents: Array.isArray(data.attendedEvents) ? (data.attendedEvents as string[]) : [],
    completedQuestIds: Array.isArray(data.completedQuestIds)
      ? (data.completedQuestIds as string[])
      : [],
    referralCode: String(data.referralCode ?? 'SRG-2027'),
    isGiantsChosen: Boolean(data.isGiantsChosen),
  };
}

export function isUserAdminAccount(
  firebaseUser: FirebaseUser | null,
  adminDocExists: boolean
): boolean {
  if (!firebaseUser) return false;
  if (firebaseUser.emailVerified && firebaseUser.email?.toLowerCase() === ADMIN_EMAIL) {
    return true;
  }
  return adminDocExists;
}

export async function checkIsAdminRecord(uid: string): Promise<boolean> {
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function isPhoneAvailable(phoneNumber: string, currentUid?: string): Promise<boolean> {
  const key = phoneToKey(phoneNumber);
  if (!key) return false;
  try {
    const snap = await getDoc(doc(db, 'phone_registry', key));
    if (!snap.exists()) return true;
    return currentUid ? snap.data().uid === currentUid : false;
  } catch {
    return true;
  }
}

export async function ensureUserProfile(
  firebaseUser: FirebaseUser,
  registrationExtras?: {
    displayName?: string;
    username?: string;
    phoneNumber?: string;
  }
): Promise<UserProfile> {
  const userPath = `users/${firebaseUser.uid}`;
  const userRef = doc(db, 'users', firebaseUser.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (existingSnap.exists()) {
    const existingData = existingSnap.data();
    const mapped = mapFirestoreUser(existingData);

    // Ensure member_qr_index exists for crew point scanning
    const qrRef = doc(db, 'member_qr_index', mapped.memberQrId);
    try {
      const qrSnap = await getDoc(qrRef);
      if (!qrSnap.exists()) {
        await setDoc(qrRef, {
          memberQrId: mapped.memberQrId,
          uid: mapped.uid,
          username: mapped.username,
          displayName: mapped.displayName,
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal if user is mid-verification
    }

    // Ensure Danial Danish / danial@srgesports.com has +60197684608 and superadmin role synced
    const needsDanialPhone =
      isDanialUser(mapped.displayName, mapped.email) && !existingData.phoneNumber;
    const needsAdminRole =
      firebaseUser.emailVerified &&
      firebaseUser.email?.toLowerCase() === ADMIN_EMAIL &&
      existingData.role !== 'superadmin';
    const needsSchemaBackfill =
      existingData.username === undefined ||
      existingData.memberQrId === undefined ||
      existingData.photoDataUrl === undefined ||
      existingData.themePreference === undefined ||
      existingData.phoneNumber === undefined;

    if (needsDanialPhone || needsAdminRole || needsSchemaBackfill) {
      const backfillPayload = {
        uid: mapped.uid,
        displayName: mapped.displayName,
        username: mapped.username,
        email: mapped.email,
        phoneNumber: needsDanialPhone ? DANIAL_PHONE : mapped.phoneNumber,
        avatarId: sanitizeAvatar(mapped.avatarId),
        photoDataUrl: mapped.photoDataUrl,
        bio: mapped.bio,
        houseId: mapped.houseId ?? 'unpledged',
        classId: mapped.classId ?? 'unassigned',
        tier: mapped.tier,
        points: mapped.points,
        rank: mapped.rank,
        role: needsAdminRole ? 'superadmin' : mapped.role,
        memberQrId: mapped.memberQrId,
        themePreference: mapped.themePreference,
        joinedAt: mapped.joinedAt,
        attendedEvents: mapped.attendedEvents,
        completedQuestIds: mapped.completedQuestIds,
        referralCode: mapped.referralCode,
        isGiantsChosen: Boolean(mapped.isGiantsChosen),
        createdAt: existingData.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(userRef, backfillPayload);
        if (needsDanialPhone) {
          const dKey = phoneToKey(DANIAL_PHONE);
          if (dKey) {
            const pRef = doc(db, 'phone_registry', dKey);
            const pSnap = await getDoc(pRef);
            if (!pSnap.exists()) {
              await setDoc(pRef, {
                phoneKey: dKey,
                phoneNumber: DANIAL_PHONE,
                uid: mapped.uid,
                createdAt: serverTimestamp(),
              });
            }
          }
        }
        return mapFirestoreUser(backfillPayload);
      } catch {
        // Return mapped even if unverified user can't write yet
      }
    }

    return mapped;
  }

  const rawName =
    clampString(registrationExtras?.displayName, 32) ||
    clampString(firebaseUser.displayName, 32) ||
    clampString(firebaseUser.email?.split('@')[0], 32) ||
    'Wanderer';
  const safeName = rawName.length >= 2 ? rawName : 'Wanderer';
  const nowIso = new Date().toISOString().slice(0, 40);
  const newEmail = clampString(
    firebaseUser.email?.toLowerCase(),
    160,
    `${firebaseUser.uid}@council.srg`
  );
  const username = sanitizeUsername(
    registrationExtras?.username || firebaseUser.email?.split('@')[0] || safeName
  );
  const phoneNumber =
    clampString(registrationExtras?.phoneNumber, 24) ||
    (isDanialUser(safeName, newEmail) ? DANIAL_PHONE : '');
  const memberQrId = buildMemberQrId(firebaseUser.uid);
  const isBootAdmin =
    firebaseUser.emailVerified && newEmail.toLowerCase() === ADMIN_EMAIL;

  const initialPayload = {
    uid: firebaseUser.uid,
    displayName: safeName,
    username,
    email: newEmail,
    phoneNumber,
    avatarId: 'crest',
    photoDataUrl: '',
    bio: 'Sworn to the Red Giant in Aethermere.',
    houseId: 'unpledged',
    classId: 'unassigned',
    tier: 'free' as MembershipTier,
    points: 0,
    rank: 'Wanderer' as RankTitle,
    role: (isBootAdmin ? 'superadmin' : 'member') as UserRole,
    memberQrId,
    themePreference: 'light' as ThemePreference,
    joinedAt: nowIso,
    attendedEvents: [] as string[],
    completedQuestIds: [] as string[],
    referralCode: buildReferralCode(safeName, firebaseUser.uid),
    isGiantsChosen: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(userRef, initialPayload);
    await setDoc(doc(db, 'member_qr_index', memberQrId), {
      memberQrId,
      uid: firebaseUser.uid,
      username,
      displayName: safeName,
      createdAt: serverTimestamp(),
    });
    if (phoneNumber.length >= 7) {
      const pKey = phoneToKey(phoneNumber);
      if (pKey) {
        const pRef = doc(db, 'phone_registry', pKey);
        const pSnap = await getDoc(pRef);
        if (!pSnap.exists()) {
          await setDoc(pRef, {
            phoneKey: pKey,
            phoneNumber,
            uid: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  return mapFirestoreUser(initialPayload);
}

export async function seedCatalogIfEmpty(isAdminUser: boolean): Promise<void> {
  // Houses (zero-initialized for registered users only)
  try {
    const housesSnap = await getDocs(
      query(collection(db, 'houses'), where('isPublic', '==', true))
    );
    const existingIds = new Set(housesSnap.docs.map((d) => d.id));
    const missingHouses = HOUSES.filter((h) => !existingIds.has(h.houseId));
    if (missingHouses.length > 0) {
      const batch = writeBatch(db);
      for (const h of missingHouses) {
        batch.set(doc(db, 'houses', h.houseId), {
          ...h,
          isPublic: true,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'houses');
  }

  // Events 2027 + Event QR Index backfill
  try {
    const eventsSnap = await getDocs(
      query(collection(db, 'events'), where('seasonYear', '>=', 2026))
    );
    const existingById = new Map(eventsSnap.docs.map((d) => [d.id, d.data()]));
    const missingEvents = EVENTS_2027.filter((e) => !existingById.has(e.eventId));
    const eventsToBackfillQr = EVENTS_2027.filter((e) => {
      const existing = existingById.get(e.eventId);
      return Boolean(existing && !existing.eventQrId && e.eventQrId);
    });

    if (missingEvents.length > 0 || eventsToBackfillQr.length > 0) {
      const batch = writeBatch(db);
      for (const evt of missingEvents) {
        batch.set(doc(db, 'events', evt.eventId), {
          ...evt,
          diamondPriceRM: evt.basePriceRM,
          isCrownEvent: Boolean(evt.isCrownEvent),
          seasonYear: 2027,
          updatedAt: serverTimestamp(),
        });
        if (evt.eventQrId) {
          batch.set(doc(db, 'event_qr_index', evt.eventQrId), {
            eventQrId: evt.eventQrId,
            eventId: evt.eventId,
            createdAt: serverTimestamp(),
          });
        }
      }
      for (const evt of eventsToBackfillQr) {
        if (!evt.eventQrId) continue;
        batch.update(doc(db, 'events', evt.eventId), {
          eventQrId: evt.eventQrId,
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'event_qr_index', evt.eventQrId), {
          eventQrId: evt.eventQrId,
          eventId: evt.eventId,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'events');
  }

  // Purge any legacy seed-* unregistered leaderboard docs when Superadmin logs in
  if (isAdminUser) {
    try {
      const lbSnap = await getDocs(
        query(collection(db, 'leaderboard'), where('isPublic', '==', true))
      );
      const staleSeeds = lbSnap.docs.filter((d) => d.id.startsWith('seed-'));
      if (staleSeeds.length > 0) {
        const batch = writeBatch(db);
        for (const seedDoc of staleSeeds) {
          batch.delete(seedDoc.ref);
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leaderboard');
    }
  }
}

export interface CouncilSubscriptions {
  onUser: (user: UserProfile | null) => void;
  onHouses: (houses: House[]) => void;
  onQuests: (quests: Quest[]) => void;
  onEvents: (events: CouncilEvent[]) => void;
  onLeaderboard: (members: LeaderboardMember[]) => void;
  onBookings: (bookings: EventBooking[]) => void;
  onTransactions: (transactions: PointTransaction[]) => void;
  onError?: (err: Error) => void;
}

export function subscribeCouncilData(uid: string, handlers: CouncilSubscriptions): () => void {
  const handleSubError = (err: unknown, op: OperationType, path: string) => {
    try {
      handleFirestoreError(err, op, path);
    } catch (wrapped) {
      if (handlers.onError && wrapped instanceof Error) {
        handlers.onError(wrapped);
      }
    }
  };

  const unsubUser = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      handlers.onUser(snap.exists() ? mapFirestoreUser(snap.data()) : null);
    },
    (error) => handleSubError(error, OperationType.GET, `users/${uid}`)
  );

  const unsubHouses = onSnapshot(
    query(collection(db, 'houses'), where('isPublic', '==', true)),
    (snap) => {
      if (snap.empty) {
        handlers.onHouses(HOUSES);
        return;
      }
      const list = snap.docs.map((d) => d.data() as House);
      handlers.onHouses(list);
    },
    (error) => handleSubError(error, OperationType.LIST, 'houses')
  );

  const unsubQuests = () => {};
  handlers.onQuests([]);

  const unsubEvents = onSnapshot(
    query(collection(db, 'events'), where('seasonYear', '>=', 2026)),
    (snap) => {
      if (snap.empty) {
        handlers.onEvents(EVENTS_2027);
        return;
      }
      const list = snap.docs
        .map((d) => d.data() as CouncilEvent)
        .sort((a, b) => a.date.localeCompare(b.date) || a.monthIndex - b.monthIndex);
      handlers.onEvents(list);
    },
    (error) => handleSubError(error, OperationType.LIST, 'events')
  );

  // ONLY registered Firebase users appear on the leaderboard (filter out any legacy seed-* docs)
  const unsubLeaderboard = onSnapshot(
    query(collection(db, 'leaderboard'), where('isPublic', '==', true)),
    (snap) => {
      const registered: LeaderboardMember[] = snap.docs
        .filter((d) => !d.id.startsWith('seed-'))
        .map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid ?? d.id),
            displayName: String(data.displayName ?? 'Wanderer'),
            username: sanitizeUsername(String(data.username ?? data.displayName ?? 'wanderer')),
            avatarId: String(data.avatarId ?? 'crest'),
            photoDataUrl: String(data.photoDataUrl ?? ''),
            houseId: data.houseId as HouseId,
            classId: data.classId as ClassId,
            tier: (data.tier === 'diamond' ? 'diamond' : 'free') as MembershipTier,
            points: typeof data.points === 'number' ? data.points : 0,
            rank: (data.rank as RankTitle) || 'Wanderer',
            isPublic: true,
          };
        })
        .sort((a, b) => b.points - a.points);
      handlers.onLeaderboard(registered);
    },
    (error) => handleSubError(error, OperationType.LIST, 'leaderboard')
  );

  const unsubBookings = onSnapshot(
    query(collection(db, 'bookings'), where('userId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as EventBooking)
        .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt));
      handlers.onBookings(list);
    },
    (error) => handleSubError(error, OperationType.LIST, 'bookings')
  );

  const unsubTx = onSnapshot(
    query(collection(db, 'point_transactions'), where('userId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as PointTransaction)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 30);
      handlers.onTransactions(list);
    },
    (error) => handleSubError(error, OperationType.LIST, 'point_transactions')
  );

  return () => {
    unsubUser();
    unsubHouses();
    unsubQuests();
    unsubEvents();
    unsubLeaderboard();
    unsubBookings();
    unsubTx();
  };
}

export function subscribePublicCouncilData(handlers: {
  onHouses: (houses: House[]) => void;
  onEvents: (events: CouncilEvent[]) => void;
  onLeaderboard: (members: LeaderboardMember[]) => void;
}): () => void {
  const unsubHouses = onSnapshot(
    query(collection(db, 'houses'), where('isPublic', '==', true)),
    (snap) => {
      if (snap.empty) {
        handlers.onHouses(HOUSES);
        return;
      }
      const list = snap.docs.map((d) => d.data() as House);
      handlers.onHouses(list);
    },
    () => {
      handlers.onHouses(HOUSES);
    }
  );

  const unsubEvents = onSnapshot(
    query(collection(db, 'events'), where('seasonYear', '>=', 2026)),
    (snap) => {
      if (snap.empty) {
        handlers.onEvents(EVENTS_2027);
        return;
      }
      const list = snap.docs
        .map((d) => d.data() as CouncilEvent)
        .sort((a, b) => a.date.localeCompare(b.date) || a.monthIndex - b.monthIndex);
      handlers.onEvents(list);
    },
    () => {
      handlers.onEvents(EVENTS_2027);
    }
  );

  const unsubLeaderboard = onSnapshot(
    query(collection(db, 'leaderboard'), where('isPublic', '==', true)),
    (snap) => {
      const registered: LeaderboardMember[] = snap.docs
        .filter((d) => !d.id.startsWith('seed-'))
        .map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid ?? d.id),
            displayName: String(data.displayName ?? 'Wanderer'),
            username: sanitizeUsername(String(data.username ?? data.displayName ?? 'wanderer')),
            avatarId: String(data.avatarId ?? 'crest'),
            photoDataUrl: String(data.photoDataUrl ?? ''),
            houseId: data.houseId as HouseId,
            classId: data.classId as ClassId,
            tier: (data.tier === 'diamond' ? 'diamond' : 'free') as MembershipTier,
            points: typeof data.points === 'number' ? data.points : 0,
            rank: (data.rank as RankTitle) || 'Wanderer',
            isPublic: true,
          };
        })
        .sort((a, b) => b.points - a.points);
      handlers.onLeaderboard(registered);
    },
    () => {
      handlers.onLeaderboard([]);
    }
  );

  return () => {
    unsubHouses();
    unsubEvents();
    unsubLeaderboard();
  };
}

export async function completeOathTransaction(
  uid: string,
  payload: {
    displayName: string;
    username: string;
    phoneNumber: string;
    avatarId: string;
    bio: string;
    houseId: HouseId;
    classId: ClassId;
  }
): Promise<{ wasUnpledged: boolean; awardedPoints: number }> {
  const cleanName = clampString(payload.displayName, 32);
  if (cleanName.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }
  const cleanUsername = sanitizeUsername(payload.username, '');
  if (cleanUsername.length < 1) {
    throw new Error('Please set a username.');
  }
  const cleanPhone = clampString(payload.phoneNumber, 24);
  const newPhoneKey = phoneToKey(cleanPhone);
  if (cleanPhone.length < 7 || !newPhoneKey) {
    throw new Error('Please enter a valid phone number with country code.');
  }
  if (!VALID_HOUSES.has(payload.houseId)) {
    throw new Error('Please pledge allegiance to one of the Five Houses.');
  }
  if (!VALID_CLASSES.has(payload.classId)) {
    throw new Error('Please choose one of the Five Classes.');
  }
  const cleanAvatar = sanitizeAvatar(payload.avatarId);
  const cleanBio = clampString(payload.bio, 140, 'Sworn to the Red Giant in Aethermere.');

  const userRef = doc(db, 'users', uid);
  const leaderboardRef = doc(db, 'leaderboard', uid);
  const newPhoneRef = doc(db, 'phone_registry', newPhoneKey);

  try {
    return await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('Member profile not found.');
      }
      const userData = userSnap.data();
      const lbSnap = await tx.get(leaderboardRef);
      const phoneSnap = await tx.get(newPhoneRef);

      if (phoneSnap.exists() && phoneSnap.data().uid !== uid) {
        throw new Error('This phone number is already registered to another Council account.');
      }

      const oldPhone = String(userData.phoneNumber ?? '');
      const oldPhoneKey = phoneToKey(oldPhone);
      if (oldPhoneKey && oldPhoneKey !== newPhoneKey) {
        tx.delete(doc(db, 'phone_registry', oldPhoneKey));
      }
      if (!phoneSnap.exists()) {
        tx.set(newPhoneRef, {
          phoneKey: newPhoneKey,
          phoneNumber: cleanPhone,
          uid,
          createdAt: serverTimestamp(),
        });
      }

      const wasUnpledged = userData.houseId === 'unpledged';
      const memberQrId = String(userData.memberQrId || buildMemberQrId(uid));

      if (wasUnpledged) {
        const houseRef = doc(db, 'houses', payload.houseId);
        const houseSnap = await tx.get(houseRef);
        if (!houseSnap.exists()) {
          throw new Error('Selected House does not exist yet.');
        }
        const houseData = houseSnap.data();

        const multiplier = 1;
        const awardedPoints = 100;
        const nextPoints = Number(userData.points ?? 0) + awardedPoints;
        const nextRank = calculateRank(nextPoints, Boolean(userData.isGiantsChosen));

        tx.update(userRef, {
          displayName: cleanName,
          username: cleanUsername,
          phoneNumber: cleanPhone,
          avatarId: cleanAvatar,
          bio: cleanBio,
          houseId: payload.houseId,
          classId: payload.classId,
          points: nextPoints,
          rank: nextRank,
          updatedAt: serverTimestamp(),
        });

        tx.update(houseRef, {
          memberCount: Number(houseData.memberCount ?? 0) + 1,
          totalPoints: Number(houseData.totalPoints ?? 0) + awardedPoints,
          updatedAt: serverTimestamp(),
        });

        tx.set(leaderboardRef, {
          uid,
          displayName: cleanName,
          username: cleanUsername,
          avatarId: cleanAvatar,
          photoDataUrl: String(userData.photoDataUrl ?? ''),
          houseId: payload.houseId,
          classId: payload.classId,
          tier: userData.tier === 'diamond' ? 'diamond' : 'free',
          points: nextPoints,
          rank: nextRank,
          isPublic: true,
          updatedAt: serverTimestamp(),
        });

        const qrIndexRef = doc(db, 'member_qr_index', memberQrId);
        const qrIndexSnap = await tx.get(qrIndexRef);
        if (qrIndexSnap.exists()) {
          tx.update(qrIndexRef, {
            username: cleanUsername,
            displayName: cleanName,
          });
        } else {
          tx.set(qrIndexRef, {
            memberQrId,
            uid,
            username: cleanUsername,
            displayName: cleanName,
            createdAt: serverTimestamp(),
          });
        }

        const txId = `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        tx.set(doc(db, 'point_transactions', txId), {
          txId,
          userId: uid,
          houseId: payload.houseId,
          source: 'quest',
          description: 'Oath of the Red Giant Sworn',
          basePoints: 100,
          multiplierApplied: multiplier,
          finalPoints: awardedPoints,
          timestamp: new Date().toISOString().slice(0, 40),
          createdAt: serverTimestamp(),
        });

        return { wasUnpledged: true, awardedPoints };
      }

      // Existing member profile edit
      tx.update(userRef, {
        displayName: cleanName,
        username: cleanUsername,
        phoneNumber: cleanPhone,
        avatarId: cleanAvatar,
        bio: cleanBio,
        updatedAt: serverTimestamp(),
      });

      if (lbSnap.exists()) {
        tx.update(leaderboardRef, {
          displayName: cleanName,
          username: cleanUsername,
          avatarId: cleanAvatar,
          updatedAt: serverTimestamp(),
        });
      }

      return { wasUnpledged: false, awardedPoints: 0 };
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, userRef.path);
  }
}

export async function updateProfileTransaction(
  uid: string,
  payload: {
    displayName: string;
    username: string;
    phoneNumber: string;
    photoDataUrl: string;
    avatarId: string;
    bio: string;
    themePreference: ThemePreference;
  }
): Promise<void> {
  const cleanName = clampString(payload.displayName, 32);
  if (cleanName.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }
  const cleanUsername = sanitizeUsername(payload.username, '');
  if (cleanUsername.length < 1) {
    throw new Error('Please enter a username.');
  }
  const cleanPhone = clampString(payload.phoneNumber, 24);
  const newPhoneKey = phoneToKey(cleanPhone);
  if (cleanPhone.length < 7 || !newPhoneKey) {
    throw new Error('Enter a valid phone number with country code.');
  }
  if (payload.photoDataUrl.length > 250000) {
    throw new Error('Profile photo exceeds the maximum allowed size.');
  }
  const cleanAvatar = sanitizeAvatar(payload.avatarId);
  const cleanBio = clampString(payload.bio, 140, 'Sworn to the Red Giant in Aethermere.');
  const cleanTheme: ThemePreference = payload.themePreference === 'dark' ? 'dark' : 'light';

  const userRef = doc(db, 'users', uid);
  const lbRef = doc(db, 'leaderboard', uid);
  const newPhoneRef = doc(db, 'phone_registry', newPhoneKey);

  try {
    await runTransaction(db, async (tx) => {
      const [userSnap, lbSnap, phoneSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(lbRef),
        tx.get(newPhoneRef),
      ]);
      if (!userSnap.exists()) throw new Error('Member profile not found.');

      if (phoneSnap.exists() && phoneSnap.data().uid !== uid) {
        throw new Error('This phone number is already linked to another account.');
      }

      const userData = userSnap.data();
      const oldPhoneKey = phoneToKey(String(userData.phoneNumber ?? ''));
      if (oldPhoneKey && oldPhoneKey !== newPhoneKey) {
        tx.delete(doc(db, 'phone_registry', oldPhoneKey));
      }
      if (!phoneSnap.exists()) {
        tx.set(newPhoneRef, {
          phoneKey: newPhoneKey,
          phoneNumber: cleanPhone,
          uid,
          createdAt: serverTimestamp(),
        });
      }

      tx.update(userRef, {
        displayName: cleanName,
        username: cleanUsername,
        phoneNumber: cleanPhone,
        photoDataUrl: payload.photoDataUrl,
        avatarId: cleanAvatar,
        bio: cleanBio,
        themePreference: cleanTheme,
        updatedAt: serverTimestamp(),
      });

      if (lbSnap.exists()) {
        tx.update(lbRef, {
          displayName: cleanName,
          username: cleanUsername,
          avatarId: cleanAvatar,
          photoDataUrl: payload.photoDataUrl,
          updatedAt: serverTimestamp(),
        });
      }

      const qrId = String(userData.memberQrId || buildMemberQrId(uid));
      const qrRef = doc(db, 'member_qr_index', qrId);
      const qrSnap = await tx.get(qrRef);
      if (qrSnap.exists()) {
        tx.update(qrRef, {
          username: cleanUsername,
          displayName: cleanName,
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, userRef.path);
  }
}

export async function updateThemePreference(uid: string, theme: ThemePreference): Promise<void> {
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      themePreference: theme,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking UI preference fallback
  }
}

export async function updateUserAvatarUrl(uid: string, avatarUrl: string): Promise<void> {
  if (avatarUrl.length > 250000) {
    throw new Error('Avatar URL exceeds the maximum allowed length.');
  }
  const userRef = doc(db, 'users', uid);
  const lbRef = doc(db, 'leaderboard', uid);

  try {
    await runTransaction(db, async (tx) => {
      const [userSnap, lbSnap] = await Promise.all([tx.get(userRef), tx.get(lbRef)]);
      if (!userSnap.exists()) throw new Error('Member profile not found.');

      tx.update(userRef, {
        photoDataUrl: avatarUrl,
        updatedAt: serverTimestamp(),
      });

      if (lbSnap.exists()) {
        tx.update(lbRef, {
          photoDataUrl: avatarUrl,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userRef.path);
  }
}

export async function claimQuestTransaction(
  uid: string,
  questId: string,
  answerIndex?: number
): Promise<{
  transaction: PointTransaction;
  newRank: RankTitle;
  rankedUp: boolean;
}> {
  const userRef = doc(db, 'users', uid);
  const questRef = doc(db, 'quests', questId);
  const leaderboardRef = doc(db, 'leaderboard', uid);

  try {
    return await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      const questSnap = await tx.get(questRef);
      const lbSnap = await tx.get(leaderboardRef);

      if (!userSnap.exists()) throw new Error('Member profile not found.');
      if (!questSnap.exists()) throw new Error('Quest not found.');

      const userData = userSnap.data();
      const questData = questSnap.data() as Quest;

      if (!VALID_HOUSES.has(userData.houseId) || !VALID_CLASSES.has(userData.classId)) {
        throw new Error('Complete the Oath Onboarding first to pledge a House.');
      }
      if (questData.classFilter !== 'all' && questData.classFilter !== userData.classId) {
        throw new Error(`This quest is exclusive to the ${questData.classFilter} class.`);
      }
      const completedIds: string[] = Array.isArray(userData.completedQuestIds)
        ? userData.completedQuestIds
        : [];
      if (completedIds.includes(questId)) {
        throw new Error('Quest points have already been claimed for this cycle.');
      }
      if (questData.triviaQuestion) {
        if (typeof answerIndex !== 'number') {
          throw new Error('Select an answer to complete this challenge.');
        }
        if (questId === 'q-sage-trivia' && answerIndex !== questData.triviaQuestion.correctIndex) {
          throw new Error('Not quite! Hint: Look at the SRG shield crest at the top of the Citadel.');
        }
      }
      if (completedIds.length >= 50) {
        throw new Error('Maximum quest log limit reached for this cycle.');
      }

      const houseId = userData.houseId as HouseId;
      const houseRef = doc(db, 'houses', houseId);
      const houseSnap = await tx.get(houseRef);
      if (!houseSnap.exists()) throw new Error('Member House record missing.');

      const multiplier = 1;
      const finalPoints = Number(questData.basePoints);
      const previousRank = String(userData.rank) as RankTitle;
      const newPoints = Number(userData.points ?? 0) + finalPoints;
      const newRank = calculateRank(newPoints, Boolean(userData.isGiantsChosen));

      tx.update(userRef, {
        points: newPoints,
        rank: newRank,
        completedQuestIds: [...completedIds, questId],
        updatedAt: serverTimestamp(),
      });

      tx.update(houseRef, {
        totalPoints: Number(houseSnap.data().totalPoints ?? 0) + finalPoints,
        updatedAt: serverTimestamp(),
      });

      if (lbSnap.exists()) {
        tx.update(leaderboardRef, {
          points: newPoints,
          rank: newRank,
          updatedAt: serverTimestamp(),
        });
      }

      const txId = `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const timestamp = new Date().toISOString().slice(0, 40);
      const txPayload: PointTransaction = {
        txId,
        userId: uid,
        houseId,
        source: questId.includes('referral') ? 'referral' : 'quest',
        description: clampString(questData.title, 140, 'Council Quest'),
        basePoints: Number(questData.basePoints),
        multiplierApplied: multiplier,
        finalPoints,
        timestamp,
      };

      tx.set(doc(db, 'point_transactions', txId), {
        ...txPayload,
        createdAt: serverTimestamp(),
      });

      return {
        transaction: txPayload,
        newRank,
        rankedUp: previousRank !== newRank,
      };
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, userRef.path);
  }
}

export async function bookEventTransaction(uid: string, eventId: string): Promise<EventBooking> {
  const bookingId = `${uid}_${eventId}`;
  const bookingRef = doc(db, 'bookings', bookingId);
  const eventRef = doc(db, 'events', eventId);
  const userRef = doc(db, 'users', uid);

  try {
    return await runTransaction(db, async (tx) => {
      const [userSnap, eventSnap, existingBookingSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(eventRef),
        tx.get(bookingRef),
      ]);

      if (!userSnap.exists()) throw new Error('Member profile not found.');
      if (!eventSnap.exists()) throw new Error('Activation event not found.');

      if (existingBookingSnap.exists()) {
        const existingData = existingBookingSnap.data() as EventBooking;
        if (existingData.status !== 'cancelled') {
          return existingData;
        }
      }

      const eventData = eventSnap.data() as CouncilEvent;
      if (eventData.bookedCount >= eventData.capacity) {
        throw new Error('This activation has reached full capacity.');
      }

      const paidAmountRM = eventData.basePriceRM;
      const randomToken = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      const qrCodeToken = `SRG27-${eventData.month.toUpperCase()}-${randomToken}`;
      const bookedAt = new Date().toISOString().slice(0, 40);

      const booking: EventBooking = {
        bookingId,
        eventId: eventData.eventId,
        userId: uid,
        qrCodeToken,
        status: 'booked',
        bookedAt,
        paidAmountRM,
      };

      tx.set(bookingRef, {
        ...booking,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(doc(db, 'qr_tickets', qrCodeToken), {
        qrCodeToken,
        bookingId,
        userId: uid,
        eventId: eventData.eventId,
        createdAt: serverTimestamp(),
      });

      tx.update(eventRef, {
        bookedCount: Number(eventData.bookedCount) + 1,
        updatedAt: serverTimestamp(),
      });

      return booking;
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, bookingRef.path);
  }
}

export async function toggleTierTransaction(uid: string, tier: MembershipTier): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const lbRef = doc(db, 'leaderboard', uid);

  try {
    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('Member profile not found.');
      const lbSnap = await tx.get(lbRef);

      tx.update(userRef, {
        tier,
        updatedAt: serverTimestamp(),
      });

      if (lbSnap.exists()) {
        tx.update(lbRef, {
          tier,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userRef.path);
  }
}

export async function verifyCheckInTransaction(rawToken: string): Promise<{
  eventTitle: string;
  attendeeName: string;
  awardedPoints: number;
  multiplierApplied: number;
}> {
  const normalizedToken = rawToken.trim().toUpperCase();
  if (!/^[A-Z0-9\-]{6,40}$/.test(normalizedToken)) {
    throw new Error('Enter a valid QR ticket token (e.g. SRG27-JAN-A1B2C3D4).');
  }

  const qrRef = doc(db, 'qr_tickets', normalizedToken);

  try {
    return await runTransaction(db, async (tx) => {
      const qrSnap = await tx.get(qrRef);
      if (!qrSnap.exists()) {
        throw new Error('No ticket found for this QR code.');
      }
      const { bookingId } = qrSnap.data() as { bookingId: string };
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists()) {
        throw new Error('Associated booking record not found.');
      }

      const booking = bookingSnap.data() as EventBooking;
      if (booking.status === 'checked_in') {
        throw new Error('Duplicate scan blocked: this ticket has already checked in.');
      }
      if (booking.status === 'cancelled') {
        throw new Error('This ticket was cancelled.');
      }

      const eventRef = doc(db, 'events', booking.eventId);
      const attendeeRef = doc(db, 'users', booking.userId);
      const lbRef = doc(db, 'leaderboard', booking.userId);

      const [eventSnap, attendeeSnap, lbSnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(attendeeRef),
        tx.get(lbRef),
      ]);

      if (!eventSnap.exists() || !attendeeSnap.exists()) {
        throw new Error('Event or attendee record missing.');
      }

      const eventData = eventSnap.data() as CouncilEvent;
      const attendeeData = attendeeSnap.data();
      const targetHouseId: HouseId = VALID_HOUSES.has(attendeeData.houseId)
        ? (attendeeData.houseId as HouseId)
        : 'circuit';

      const houseRef = doc(db, 'houses', targetHouseId);
      const houseSnap = await tx.get(houseRef);
      if (!houseSnap.exists()) {
        throw new Error('House standing record missing.');
      }

      const multiplier = 1;
      const awardedPoints = Number(eventData.checkInPoints);
      const nextPoints = Number(attendeeData.points ?? 0) + awardedPoints;
      const nextRank = calculateRank(nextPoints, Boolean(attendeeData.isGiantsChosen));
      const existingAttended: string[] = Array.isArray(attendeeData.attendedEvents)
        ? attendeeData.attendedEvents
        : [];
      const updatedAttended = existingAttended.includes(eventData.eventId)
        ? existingAttended
        : [...existingAttended, eventData.eventId].slice(0, 50);

      const checkedInAt = new Date().toISOString().slice(0, 40);

      tx.update(bookingRef, {
        status: 'checked_in',
        checkedInAt,
        updatedAt: serverTimestamp(),
      });

      tx.update(attendeeRef, {
        points: nextPoints,
        rank: nextRank,
        attendedEvents: updatedAttended,
        updatedAt: serverTimestamp(),
      });

      tx.update(houseRef, {
        totalPoints: Number(houseSnap.data().totalPoints ?? 0) + awardedPoints,
        updatedAt: serverTimestamp(),
      });

      if (lbSnap.exists()) {
        tx.update(lbRef, {
          points: nextPoints,
          rank: nextRank,
          updatedAt: serverTimestamp(),
        });
      }

      const txId = `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      tx.set(doc(db, 'point_transactions', txId), {
        txId,
        userId: booking.userId,
        houseId: targetHouseId,
        source: 'event_checkin',
        description: clampString(`Check-in: ${eventData.title}`, 140),
        basePoints: Number(eventData.checkInPoints),
        multiplierApplied: multiplier,
        finalPoints: awardedPoints,
        timestamp: checkedInAt,
        createdAt: serverTimestamp(),
      });

      return {
        eventTitle: eventData.title,
        attendeeName: String(attendeeData.displayName ?? 'Member'),
        awardedPoints,
        multiplierApplied: multiplier,
      };
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, qrRef.path);
  }
}

export async function grantWardenRoleAdmin(targetUid: string): Promise<void> {
  const cleanUid = clampString(targetUid, 128);
  if (!/^[a-zA-Z0-9_\-]+$/.test(cleanUid)) {
    throw new Error('Enter a valid Firebase Member UID.');
  }
  const userRef = doc(db, 'users', cleanUid);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) {
        throw new Error('No member profile exists for that UID.');
      }
      tx.update(userRef, {
        role: 'warden',
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, userRef.path);
  }
}

// =========================================================================
// SUPERADMIN CONSOLE OPERATIONS (danial@srgesports.com)
// =========================================================================

export function subscribeAllUsersAdmin(
  onUsers: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const list = snap.docs
        .map((d) => mapFirestoreUser(d.data()))
        .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));
      onUsers(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function adminUpdateUser(
  targetUid: string,
  updates: {
    displayName?: string;
    username?: string;
    phoneNumber?: string;
    role?: UserRole;
    tier?: MembershipTier;
    isGiantsChosen?: boolean;
    pointsDelta?: number;
    awardReason?: string;
  }
): Promise<void> {
  const userRef = doc(db, 'users', targetUid);
  const lbRef = doc(db, 'leaderboard', targetUid);

  try {
    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User record not found.');
      const userData = userSnap.data();
      const lbSnap = await tx.get(lbRef);

      const nextName = updates.displayName
        ? clampString(updates.displayName, 32, String(userData.displayName))
        : String(userData.displayName);
      const nextUsername = updates.username
        ? sanitizeUsername(updates.username)
        : sanitizeUsername(String(userData.username ?? nextName));
      const nextPhone =
        updates.phoneNumber !== undefined
          ? clampString(updates.phoneNumber, 24)
          : String(userData.phoneNumber ?? '');
      const nextRole: UserRole = updates.role ?? (userData.role as UserRole) ?? 'member';
      const nextTier: MembershipTier =
        updates.tier ?? (userData.tier === 'diamond' ? 'diamond' : 'free');
      const nextGiantsChosen =
        updates.isGiantsChosen !== undefined
          ? updates.isGiantsChosen
          : Boolean(userData.isGiantsChosen);

      const oldPoints = Number(userData.points ?? 0);
      const delta = Math.trunc(Number(updates.pointsDelta ?? 0));
      const nextPoints = Math.max(0, oldPoints + delta);
      const actualDelta = nextPoints - oldPoints;
      const nextRank = calculateRank(nextPoints, nextGiantsChosen);

      // Update phone_registry if phone changed
      const oldPhoneKey = phoneToKey(String(userData.phoneNumber ?? ''));
      const newPhoneKey = phoneToKey(nextPhone);
      if (newPhoneKey && newPhoneKey !== oldPhoneKey) {
        const phoneSnap = await tx.get(doc(db, 'phone_registry', newPhoneKey));
        if (phoneSnap.exists() && phoneSnap.data().uid !== targetUid) {
          throw new Error('Phone number is already assigned to another account.');
        }
        if (oldPhoneKey) tx.delete(doc(db, 'phone_registry', oldPhoneKey));
        if (!phoneSnap.exists()) {
          tx.set(doc(db, 'phone_registry', newPhoneKey), {
            phoneKey: newPhoneKey,
            phoneNumber: nextPhone,
            uid: targetUid,
            createdAt: serverTimestamp(),
          });
        }
      }

      const houseId = userData.houseId as string;
      const hasHouse = VALID_HOUSES.has(houseId as HouseId);
      if (hasHouse && actualDelta !== 0) {
        const houseRef = doc(db, 'houses', houseId);
        const houseSnap = await tx.get(houseRef);
        if (houseSnap.exists()) {
          tx.update(houseRef, {
            totalPoints: Math.max(0, Number(houseSnap.data().totalPoints ?? 0) + actualDelta),
            updatedAt: serverTimestamp(),
          });
        }
      }

      tx.update(userRef, {
        displayName: nextName,
        username: nextUsername,
        phoneNumber: nextPhone,
        role: nextRole,
        tier: nextTier,
        isGiantsChosen: nextGiantsChosen,
        points: nextPoints,
        rank: nextRank,
        updatedAt: serverTimestamp(),
      });

      if (lbSnap.exists()) {
        tx.update(lbRef, {
          displayName: nextName,
          username: nextUsername,
          tier: nextTier,
          points: nextPoints,
          rank: nextRank,
          updatedAt: serverTimestamp(),
        });
      }

      if (hasHouse && actualDelta > 0) {
        const txId = `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        tx.set(doc(db, 'point_transactions', txId), {
          txId,
          userId: targetUid,
          houseId: houseId as HouseId,
          source: 'admin_award',
          description: clampString(
            updates.awardReason || 'Superadmin Council Point Award',
            140
          ),
          basePoints: Math.min(5000, actualDelta),
          multiplierApplied: 1,
          finalPoints: Math.min(6250, actualDelta),
          timestamp: new Date().toISOString().slice(0, 40),
          createdAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, userRef.path);
  }
}

export async function adminDeleteUser(profile: UserProfile): Promise<void> {
  const userRef = doc(db, 'users', profile.uid);
  try {
    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) return;
      const userData = userSnap.data();

      if (VALID_HOUSES.has(userData.houseId)) {
        const houseRef = doc(db, 'houses', userData.houseId);
        const houseSnap = await tx.get(houseRef);
        if (houseSnap.exists()) {
          tx.update(houseRef, {
            memberCount: Math.max(0, Number(houseSnap.data().memberCount ?? 0) - 1),
            totalPoints: Math.max(
              0,
              Number(houseSnap.data().totalPoints ?? 0) - Number(userData.points ?? 0)
            ),
            updatedAt: serverTimestamp(),
          });
        }
      }

      tx.delete(userRef);
      tx.delete(doc(db, 'leaderboard', profile.uid));
      const qrId = String(userData.memberQrId || profile.memberQrId);
      if (qrId) {
        tx.delete(doc(db, 'member_qr_index', qrId));
      }
      const pKey = phoneToKey(String(userData.phoneNumber || profile.phoneNumber));
      if (pKey) {
        tx.delete(doc(db, 'phone_registry', pKey));
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, userRef.path);
  }
}

const MONTH_ABBRS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function generateEventQrId(seasonYear: number): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `SRGEVT-${seasonYear}-${rand}`.slice(0, 40);
}

export async function adminUpsertEvent(input: {
  eventId?: string;
  title: string;
  date: string;
  time: string;
  location: string;
  houseId: HouseId | 'all';
  wardenName: string;
  description: string;
  capacity: number;
  basePriceRM: number;
  diamondPriceRM?: number;
  checkInPoints: number;
  isCrownEvent?: boolean;
  mediaKey?: 'arena' | 'racing' | 'hall';
}): Promise<string> {
  const cleanTitle = clampString(input.title, 100);
  if (cleanTitle.length < 3) throw new Error('Event title must be at least 3 characters.');

  const cleanDate = clampString(input.date, 20);
  const parsedDate = new Date(cleanDate);
  const monthIndex = Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getMonth();
  const seasonYear = Number.isNaN(parsedDate.getTime())
    ? 2027
    : Math.min(2035, Math.max(2026, parsedDate.getFullYear()));
  const month = MONTH_ABBRS[monthIndex] ?? 'Jan';

  const capacity = Math.min(10000, Math.max(5, Math.trunc(input.capacity)));
  const basePriceRM = Math.min(2000, Math.max(0, Math.trunc(input.basePriceRM)));
  const checkInPoints = Math.min(5000, Math.max(10, Math.trunc(input.checkInPoints)));

  const eventId =
    input.eventId && /^[a-zA-Z0-9_\-]+$/.test(input.eventId)
      ? input.eventId
      : `evt-${seasonYear}-${Date.now().toString(36)}`;

  const eventRef = doc(db, 'events', eventId);

  try {
    const existingSnap = await getDoc(eventRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;
    const bookedCount = existingData
      ? Math.min(capacity, Number(existingData.bookedCount ?? 0))
      : 0;
    const eventQrId =
      typeof existingData?.eventQrId === 'string' && existingData.eventQrId.length >= 6
        ? existingData.eventQrId
        : generateEventQrId(seasonYear);

    const batch = writeBatch(db);
    batch.set(eventRef, {
      eventId,
      title: cleanTitle,
      month,
      monthIndex,
      date: cleanDate,
      time: clampString(input.time, 40, '18:00 – 22:00 MYT'),
      location: clampString(input.location, 120, 'Klang Valley'),
      houseId: input.houseId,
      wardenName: clampString(input.wardenName, 60, 'All Five Wardens'),
      description: clampString(input.description, 360, 'Official SRG Council activation event.'),
      capacity,
      bookedCount,
      basePriceRM,
      diamondPriceRM: basePriceRM,
      checkInPoints,
      isCrownEvent: Boolean(input.isCrownEvent ?? existingData?.isCrownEvent ?? false),
      mediaKey: input.mediaKey ?? (existingData?.mediaKey as 'arena' | 'racing' | 'hall') ?? 'arena',
      eventQrId,
      seasonYear,
      updatedAt: serverTimestamp(),
    });

    const qrIndexRef = doc(db, 'event_qr_index', eventQrId);
    const qrIndexSnap = await getDoc(qrIndexRef);
    if (!qrIndexSnap.exists()) {
      batch.set(qrIndexRef, {
        eventQrId,
        eventId,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return eventId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, eventRef.path);
  }
}

export async function adminDeleteEvent(eventId: string): Promise<void> {
  const eventRef = doc(db, 'events', eventId);
  try {
    const snap = await getDoc(eventRef);
    const eventQrId = snap.exists() ? (snap.data().eventQrId as string | undefined) : undefined;
    await deleteDoc(eventRef);
    if (eventQrId && /^[A-Z0-9\-]{6,40}$/.test(eventQrId)) {
      await deleteDoc(doc(db, 'event_qr_index', eventQrId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, eventRef.path);
  }
}

export async function adminAwardEventPointsByMemberQr(
  rawMemberQrId: string,
  eventId: string
): Promise<{
  eventTitle: string;
  attendeeName: string;
  attendeeUsername: string;
  awardedPoints: number;
  multiplierApplied: number;
}> {
  const normalizedQr = rawMemberQrId.trim().toUpperCase();
  if (!/^[A-Z0-9\-]{6,40}$/.test(normalizedQr)) {
    throw new Error('Enter a valid Member QR ID (e.g. SRGQR-...).');
  }

  const qrIndexRef = doc(db, 'member_qr_index', normalizedQr);
  const eventRef = doc(db, 'events', eventId);

  try {
    return await runTransaction(db, async (tx) => {
      const [qrSnap, eventSnap] = await Promise.all([tx.get(qrIndexRef), tx.get(eventRef)]);
      if (!qrSnap.exists()) {
        throw new Error('No registered member matches this Member QR ID.');
      }
      if (!eventSnap.exists()) {
        throw new Error('Selected event was not found.');
      }

      const targetUid = String(qrSnap.data().uid);
      const userRef = doc(db, 'users', targetUid);
      const lbRef = doc(db, 'leaderboard', targetUid);
      const [userSnap, lbSnap] = await Promise.all([tx.get(userRef), tx.get(lbRef)]);
      if (!userSnap.exists()) {
        throw new Error('Member profile no longer exists.');
      }

      const userData = userSnap.data();
      const eventData = eventSnap.data() as CouncilEvent;
      const attended: string[] = Array.isArray(userData.attendedEvents)
        ? userData.attendedEvents
        : [];
      if (attended.includes(eventId)) {
        throw new Error('Duplicate scan blocked: member already collected points for this event.');
      }

      const targetHouseId: HouseId = VALID_HOUSES.has(userData.houseId)
        ? (userData.houseId as HouseId)
        : 'circuit';
      const houseRef = doc(db, 'houses', targetHouseId);
      const houseSnap = await tx.get(houseRef);
      if (!houseSnap.exists()) {
        throw new Error('Target House document missing.');
      }

      const multiplier = 1;
      const awardedPoints = Number(eventData.checkInPoints);
      const nextPoints = Number(userData.points ?? 0) + awardedPoints;
      const nextRank = calculateRank(nextPoints, Boolean(userData.isGiantsChosen));
      const updatedAttended = [...attended, eventId].slice(0, 50);
      const checkedInAt = new Date().toISOString().slice(0, 40);

      tx.update(userRef, {
        points: nextPoints,
        rank: nextRank,
        attendedEvents: updatedAttended,
        updatedAt: serverTimestamp(),
      });

      tx.update(houseRef, {
        totalPoints: Number(houseSnap.data().totalPoints ?? 0) + awardedPoints,
        updatedAt: serverTimestamp(),
      });

      if (lbSnap.exists()) {
        tx.update(lbRef, {
          points: nextPoints,
          rank: nextRank,
          updatedAt: serverTimestamp(),
        });
      }

      const txId = `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      tx.set(doc(db, 'point_transactions', txId), {
        txId,
        userId: targetUid,
        houseId: targetHouseId,
        source: 'event_checkin',
        description: clampString(`Event QR Check-In: ${eventData.title}`, 140),
        basePoints: Number(eventData.checkInPoints),
        multiplierApplied: multiplier,
        finalPoints: awardedPoints,
        timestamp: checkedInAt,
        createdAt: serverTimestamp(),
      });

      return {
        eventTitle: eventData.title,
        attendeeName: String(userData.displayName ?? 'Member'),
        attendeeUsername: sanitizeUsername(String(userData.username ?? 'member')),
        awardedPoints,
        multiplierApplied: multiplier,
      };
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, qrIndexRef.path);
  }
}

export async function adminRecalculateHousesFromUsers(): Promise<void> {
  try {
    const [usersSnap, lbSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(query(collection(db, 'leaderboard'), where('isPublic', '==', true))),
    ]);

    const tally = new Map<HouseId, { points: number; count: number }>();
    for (const h of HOUSES) {
      tally.set(h.houseId, { points: 0, count: 0 });
    }

    for (const uDoc of usersSnap.docs) {
      const data = uDoc.data();
      const hId = data.houseId as HouseId;
      if (VALID_HOUSES.has(hId)) {
        const entry = tally.get(hId)!;
        entry.count += 1;
        entry.points += Math.max(0, Number(data.points ?? 0));
      }
    }

    const batch = writeBatch(db);
    for (const h of HOUSES) {
      const entry = tally.get(h.houseId)!;
      batch.set(doc(db, 'houses', h.houseId), {
        ...h,
        totalPoints: entry.points,
        memberCount: entry.count,
        rankDelta: 0,
        isPublic: true,
        updatedAt: serverTimestamp(),
      });
    }

    for (const lDoc of lbSnap.docs) {
      if (lDoc.id.startsWith('seed-')) {
        batch.delete(lDoc.ref);
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'houses');
  }
}

export async function claimEventQrTransaction(
  uid: string,
  rawEventQrId: string
): Promise<{
  eventTitle: string;
  awardedPoints: number;
  newRank: RankTitle;
  rankedUp: boolean;
}> {
  const normalizedQr = rawEventQrId.trim().toUpperCase();
  if (!/^[A-Z0-9\-]{6,40}$/.test(normalizedQr)) {
    throw new Error('Enter a valid Event QR code (e.g. SRGEVT-2027-...).');
  }

  const qrIndexRef = doc(db, 'event_qr_index', normalizedQr);
  const userRef = doc(db, 'users', uid);
  const lbRef = doc(db, 'leaderboard', uid);

  try {
    return await runTransaction(db, async (tx) => {
      const qrSnap = await tx.get(qrIndexRef);
      if (!qrSnap.exists()) {
        throw new Error('This Event QR code is invalid or expired.');
      }

      const eventId = String(qrSnap.data().eventId);
      const eventRef = doc(db, 'events', eventId);

      const [eventSnap, userSnap, lbSnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(userRef),
        tx.get(lbRef),
      ]);

      if (!eventSnap.exists()) {
        throw new Error('The linked activation event could not be found.');
      }
      if (!userSnap.exists()) {
        throw new Error('Member profile not found.');
      }

      const eventData = eventSnap.data() as CouncilEvent;
      const userData = userSnap.data();
      const attended: string[] = Array.isArray(userData.attendedEvents)
        ? userData.attendedEvents
        : [];
      if (attended.includes(eventId)) {
        throw new Error('Already claimed: you have already collected points for this event.');
      }
      if (attended.length >= 50) {
        throw new Error('Maximum attended event log reached.');
      }

      const awardedPoints = Number(eventData.checkInPoints);
      const previousRank = String(userData.rank) as RankTitle;
      const nextPoints = Number(userData.points ?? 0) + awardedPoints;
      const nextRank = calculateRank(nextPoints, Boolean(userData.isGiantsChosen));
      const updatedAttended = [...attended, eventId];
      const nowIso = new Date().toISOString().slice(0, 40);

      tx.update(userRef, {
        points: nextPoints,
        rank: nextRank,
        attendedEvents: updatedAttended,
        updatedAt: serverTimestamp(),
      });

      if (lbSnap.exists()) {
        tx.update(lbRef, {
          points: nextPoints,
          rank: nextRank,
          updatedAt: serverTimestamp(),
        });
      }

      const hasHouse = VALID_HOUSES.has(userData.houseId as HouseId);
      if (hasHouse) {
        const houseId = userData.houseId as HouseId;
        const houseRef = doc(db, 'houses', houseId);
        const houseSnap = await tx.get(houseRef);
        if (houseSnap.exists()) {
          tx.update(houseRef, {
            totalPoints: Number(houseSnap.data().totalPoints ?? 0) + awardedPoints,
            updatedAt: serverTimestamp(),
          });

          const txId = `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          tx.set(doc(db, 'point_transactions', txId), {
            txId,
            userId: uid,
            houseId,
            source: 'event_checkin',
            description: clampString(`Event QR Scan: ${eventData.title}`, 140),
            basePoints: awardedPoints,
            multiplierApplied: 1,
            finalPoints: awardedPoints,
            timestamp: nowIso,
            createdAt: serverTimestamp(),
          });
        }
      }

      return {
        eventTitle: eventData.title,
        awardedPoints,
        newRank: nextRank,
        rankedUp: previousRank !== nextRank,
      };
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, userRef.path);
  }
}

export function subscribeLiveChat(
  onMessages: (messages: LiveChatMessage[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, 'live_chat_messages'), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const mapped: LiveChatMessage[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            messageId: String(data.messageId ?? d.id),
            uid: String(data.uid ?? ''),
            displayName: String(data.displayName ?? 'Member'),
            username: sanitizeUsername(String(data.username ?? 'member')),
            avatarId: String(data.avatarId ?? 'crest'),
            photoDataUrl: String(data.photoDataUrl ?? ''),
            houseId: VALID_HOUSES.has(data.houseId as HouseId)
              ? (data.houseId as HouseId)
              : ('unpledged' as const),
            role:
              data.role === 'superadmin' || data.role === 'warden'
                ? (data.role as UserRole)
                : 'member',
            text: String(data.text ?? ''),
            replyToId: typeof data.replyToId === 'string' ? data.replyToId : undefined,
            replyToName: typeof data.replyToName === 'string' ? data.replyToName : undefined,
            replyToSnippet:
              typeof data.replyToSnippet === 'string' ? data.replyToSnippet : undefined,
            likedByUids: Array.isArray(data.likedByUids)
              ? (data.likedByUids as string[])
              : [],
            sentAtIso: String(data.sentAtIso ?? ''),
            isPublic: true,
          };
        })
        .sort((a, b) => a.sentAtIso.localeCompare(b.sentAtIso))
        .slice(-80);
      onMessages(mapped);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'live_chat_messages');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function sendLiveChatMessage(
  user: UserProfile,
  rawText: string,
  replyTo?: {
    messageId: string;
    displayName: string;
    snippet: string;
  }
): Promise<void> {
  const text = clampString(rawText, 400);
  if (!text) {
    throw new Error('Enter a message before sending.');
  }

  const nonce = Math.random().toString(36).slice(2, 7);
  const messageId = `msg-${Date.now().toString(36)}-${nonce}`.slice(0, 64);
  const msgRef = doc(db, 'live_chat_messages', messageId);

  const payload: Record<string, unknown> = {
    messageId,
    uid: user.uid,
    displayName: clampString(user.displayName, 32, 'Member'),
    username: sanitizeUsername(user.username),
    avatarId: sanitizeAvatar(user.avatarId),
    photoDataUrl: user.photoDataUrl.slice(0, 300000),
    houseId: user.houseId && VALID_HOUSES.has(user.houseId) ? user.houseId : 'unpledged',
    role: user.role,
    text,
    likedByUids: [],
    sentAtIso: new Date().toISOString().slice(0, 40),
    isPublic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (replyTo && /^[a-zA-Z0-9_\-]{1,64}$/.test(replyTo.messageId)) {
    const cleanReplyName = clampString(replyTo.displayName, 32, 'Member');
    const cleanSnippet = clampString(replyTo.snippet, 120);
    if (cleanReplyName && cleanSnippet) {
      payload.replyToId = replyTo.messageId;
      payload.replyToName = cleanReplyName;
      payload.replyToSnippet = cleanSnippet;
    }
  }

  try {
    await setDoc(msgRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, msgRef.path);
  }
}

export async function toggleLiveChatLike(messageId: string, uid: string): Promise<void> {
  const msgRef = doc(db, 'live_chat_messages', messageId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(msgRef);
      if (!snap.exists()) return;
      const existingLikes: string[] = Array.isArray(snap.data().likedByUids)
        ? (snap.data().likedByUids as string[])
        : [];
      const alreadyLiked = existingLikes.includes(uid);
      const nextLikes = alreadyLiked
        ? existingLikes.filter((id) => id !== uid)
        : existingLikes.length < 500
          ? [...existingLikes, uid]
          : existingLikes;

      tx.update(msgRef, {
        likedByUids: nextLikes,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, msgRef.path);
  }
}

export async function deleteLiveChatMessage(messageId: string): Promise<void> {
  const msgRef = doc(db, 'live_chat_messages', messageId);
  try {
    await deleteDoc(msgRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, msgRef.path);
  }
}

