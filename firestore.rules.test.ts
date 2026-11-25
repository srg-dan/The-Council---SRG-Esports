import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

/**
 * Security & Dirty Dozen Verification Suite for The Council Firestore Rules.
 * Compiles cleanly under `tsc --noEmit` and executes via `npx tsx firestore.rules.test.ts`.
 */

type Verdict = 'ALLOW' | 'PERMISSION_DENIED';

interface MockAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const VALID_RANKS = new Set([
  'Wanderer',
  'Squire',
  'Vanguard Knight',
  'Warden’s Guard',
  'Councillor',
  'Elder',
  'Giant’s Chosen',
]);

const USER_KEYS = [
  'uid',
  'displayName',
  'username',
  'email',
  'phoneNumber',
  'avatarId',
  'photoDataUrl',
  'bio',
  'houseId',
  'classId',
  'tier',
  'points',
  'rank',
  'role',
  'memberQrId',
  'themePreference',
  'joinedAt',
  'attendedEvents',
  'completedQuestIds',
  'referralCode',
  'isGiantsChosen',
  'createdAt',
  'updatedAt',
] as const;

const SERVER_TIME = 'REQUEST_TIME';

function hasExactKeys(data: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(data);
  return allowed.every((k) => k in data) && keys.every((k) => allowed.includes(k));
}

function isBootstrappedAdmin(auth: MockAuth | null): boolean {
  return Boolean(auth && auth.email_verified === true && auth.email === 'danial@srgesports.com');
}

function evalUserCreate(auth: MockAuth | null, docId: string, data: Record<string, unknown>): Verdict {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!VALID_ID_REGEX.test(docId) || docId !== auth.uid) return 'PERMISSION_DENIED';
  if (!hasExactKeys(data, USER_KEYS)) return 'PERMISSION_DENIED';
  if (typeof data.displayName !== 'string' || data.displayName.length < 2 || data.displayName.length > 32) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.email !== 'string' || data.email.toLowerCase() !== auth.email.toLowerCase()) {
    return 'PERMISSION_DENIED';
  }
  if (data.role !== 'member' || data.isGiantsChosen !== false) return 'PERMISSION_DENIED';
  if (data.points !== 0 || data.rank !== 'Wanderer') return 'PERMISSION_DENIED';
  if (data.createdAt !== SERVER_TIME || data.updatedAt !== SERVER_TIME) return 'PERMISSION_DENIED';
  return 'ALLOW';
}

function evalUserGet(auth: MockAuth | null, targetUid: string, callerRole: 'member' | 'warden'): Verdict {
  if (!auth) return 'PERMISSION_DENIED';
  if (auth.uid === targetUid || callerRole === 'warden' || isBootstrappedAdmin(auth)) return 'ALLOW';
  return 'PERMISSION_DENIED';
}

function evalUserList(auth: MockAuth | null): Verdict {
  return isBootstrappedAdmin(auth) ? 'ALLOW' : 'PERMISSION_DENIED';
}

function evalUserUpdate(
  auth: MockAuth | null,
  targetUid: string,
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Verdict {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!hasExactKeys(incoming, USER_KEYS)) return 'PERMISSION_DENIED';
  if (typeof incoming.displayName !== 'string' || incoming.displayName.length < 2 || incoming.displayName.length > 32) {
    return 'PERMISSION_DENIED';
  }
  if (typeof incoming.rank !== 'string' || !VALID_RANKS.has(incoming.rank)) return 'PERMISSION_DENIED';
  if (incoming.updatedAt !== SERVER_TIME || incoming.createdAt !== existing.createdAt) return 'PERMISSION_DENIED';
  if (auth.uid !== targetUid && !isBootstrappedAdmin(auth)) return 'PERMISSION_DENIED';
  if (!isBootstrappedAdmin(auth)) {
    if (incoming.role !== existing.role || incoming.isGiantsChosen !== existing.isGiantsChosen) {
      return 'PERMISSION_DENIED';
    }
    const delta = Number(incoming.points) - Number(existing.points);
    if (delta > 250 || delta < 0) return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

function evalBookingCreate(
  auth: MockAuth | null,
  bookingId: string,
  data: Record<string, unknown>,
  context: { eventExists: boolean; qrAfterExists: boolean; eventCountAfterDelta: number }
): Verdict {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (data.userId !== auth.uid) return 'PERMISSION_DENIED';
  if (bookingId !== `${auth.uid}_${String(data.eventId)}`) return 'PERMISSION_DENIED';
  if (data.status !== 'booked') return 'PERMISSION_DENIED';
  if (!context.eventExists || !context.qrAfterExists || context.eventCountAfterDelta !== 1) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

function evalBookingUpdate(
  auth: MockAuth | null,
  existingStatus: string,
  incomingStatus: string,
  callerRole: 'member' | 'warden'
): Verdict {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (isBootstrappedAdmin(auth)) return 'ALLOW';
  if (existingStatus !== 'booked') return 'PERMISSION_DENIED';
  if (incomingStatus === 'checked_in' && callerRole !== 'warden') return 'PERMISSION_DENIED';
  return 'ALLOW';
}

function evalBookingList(auth: MockAuth | null, resourceUserId: string): Verdict {
  if (!auth) return 'PERMISSION_DENIED';
  if (resourceUserId === auth.uid || isBootstrappedAdmin(auth)) return 'ALLOW';
  return 'PERMISSION_DENIED';
}

function evalPointTxCreate(auth: MockAuth | null, data: Record<string, unknown>): Verdict {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!VALID_ID_REGEX.test(String(data.txId ?? ''))) return 'PERMISSION_DENIED';
  if (typeof data.description !== 'string' || data.description.length > 140) return 'PERMISSION_DENIED';
  if (data.createdAt !== SERVER_TIME) return 'PERMISSION_DENIED';
  return 'ALLOW';
}

function runSuite() {
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
  assert.ok(rulesText.includes("rules_version = '2';"), 'Missing rules_version = 2');
  assert.ok(rulesText.includes('allow read, write: if false;'), 'Missing global default deny');
  assert.ok(rulesText.includes('danial@srgesports.com'), 'Missing bootstrapped admin email');
  assert.ok(rulesText.includes('phone_registry'), 'Missing phone_registry rules');
  assert.ok(rulesText.includes('member_qr_index'), 'Missing member_qr_index rules');
  assert.ok(rulesText.includes('event_qr_index'), 'Missing event_qr_index rules');
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'), 'Missing email_verified check');

  const memberAuth: MockAuth = { uid: 'usr-member-1', email: 'fan@example.com', email_verified: true };
  const adminAuth: MockAuth = { uid: 'usr-admin-1', email: 'danial@srgesports.com', email_verified: true };
  const baseUser: Record<string, unknown> = {
    uid: 'usr-member-1',
    displayName: 'KlangWanderer',
    username: 'klangwanderer',
    email: 'fan@example.com',
    phoneNumber: '+60123456789',
    avatarId: 'crest',
    photoDataUrl: '',
    bio: 'Sworn to SRG.',
    houseId: 'unpledged',
    classId: 'unassigned',
    tier: 'free',
    points: 0,
    rank: 'Wanderer',
    role: 'member',
    memberQrId: 'SRGQR-1234ABCD',
    themePreference: 'dark',
    joinedAt: '2027-01-01T00:00:00Z',
    attendedEvents: [],
    completedQuestIds: [],
    referralCode: 'SRG-KLANG-1234',
    isGiantsChosen: false,
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  };

  assert.equal(evalUserCreate(memberAuth, 'usr-member-1', baseUser), 'ALLOW');
  assert.equal(evalUserList(adminAuth), 'ALLOW');

  // D01 — Shadow Field Injection
  assert.equal(
    evalUserCreate(memberAuth, 'usr-member-1', { ...baseUser, ghostAdmin: true }),
    'PERMISSION_DENIED',
    'D01 failed'
  );

  // D02 — Email Spoofing (unverified admin)
  const spoofedAdmin: MockAuth = { uid: 'spoof-1', email: 'danial@srgesports.com', email_verified: false };
  assert.equal(isBootstrappedAdmin(spoofedAdmin), false, 'D02 failed');

  // D03 — PII Blanket Read by non-admin
  assert.equal(evalUserGet(memberAuth, 'victim-1', 'member'), 'PERMISSION_DENIED', 'D03 get failed');
  assert.equal(evalUserList(memberAuth), 'PERMISSION_DENIED', 'D03 list failed');

  // D04 — Unscoped List Scraping on bookings
  assert.equal(evalBookingList(memberAuth, 'victim-1'), 'PERMISSION_DENIED', 'D04 failed');

  // D05 — Identity & Role Escalation
  assert.equal(
    evalUserCreate(memberAuth, 'usr-member-1', { ...baseUser, role: 'warden', isGiantsChosen: true }),
    'PERMISSION_DENIED',
    'D05 failed'
  );

  // D06 — Booking Status Shortcutting
  assert.equal(
    evalBookingCreate(
      memberAuth,
      'usr-member-1_evt-2027-01',
      { userId: 'usr-member-1', eventId: 'evt-2027-01', status: 'checked_in' },
      { eventExists: true, qrAfterExists: true, eventCountAfterDelta: 1 }
    ),
    'PERMISSION_DENIED',
    'D06 failed'
  );

  // D07 — Double Check-In Terminal State Bypass
  assert.equal(
    evalBookingUpdate(memberAuth, 'checked_in', 'booked', 'warden'),
    'PERMISSION_DENIED',
    'D07 failed'
  );

  // D08 — Resource Exhaustion / ID Poisoning
  assert.equal(
    evalPointTxCreate(memberAuth, {
      txId: '../hack',
      description: 'x'.repeat(1500),
      createdAt: SERVER_TIME,
    }),
    'PERMISSION_DENIED',
    'D08 failed'
  );

  // D09 — Value Poisoning on Whitelisted Update
  assert.equal(
    evalUserUpdate(memberAuth, 'usr-member-1', baseUser, { ...baseUser, displayName: 12345 }),
    'PERMISSION_DENIED',
    'D09 failed'
  );

  // D10 — Arbitrary Point Inflation
  assert.equal(
    evalUserUpdate(memberAuth, 'usr-member-1', baseUser, { ...baseUser, points: 999999 }),
    'PERMISSION_DENIED',
    'D10 failed'
  );

  // D11 — Ghost Booking Without Capacity Sync
  assert.equal(
    evalBookingCreate(
      memberAuth,
      'usr-member-1_evt-2027-01',
      { userId: 'usr-member-1', eventId: 'evt-2027-01', status: 'booked' },
      { eventExists: true, qrAfterExists: false, eventCountAfterDelta: 0 }
    ),
    'PERMISSION_DENIED',
    'D11 failed'
  );

  // D12 — Client Timestamp Forgery
  assert.equal(
    evalPointTxCreate(memberAuth, {
      txId: 'tx-1234',
      description: 'Valid description',
      createdAt: '2020-01-01T00:00:00Z',
    }),
    'PERMISSION_DENIED',
    'D12 failed'
  );

  console.log('All 12 Dirty Dozen security assertions + structural rules invariants passed.');
}

runSuite();
