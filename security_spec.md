# The Council (SRG Esports) — Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Authentication & Email Verification Mandate**:
   - Every read and write across application collections requires an authenticated Firebase user (`request.auth != null`).
   - All client mutations require verified email (`request.auth.token.email_verified == true`).
   - Bootstrapped Admin (`danial@srgesports.com`) MUST satisfy both `request.auth.token.email == 'danial@srgesports.com'` AND `request.auth.token.email_verified == true`.

2. **PII Isolation (Split Collection Invariant)**:
   - `users/{userId}` stores member `email` (PII). Only the owning user (`isOwner(userId)`) or a verified Warden/Admin (for check-in / administration) can `get` a specific `users/{userId}` document; `allow list: if false;` strictly forbids collection-wide scraping of member emails.
   - Public individual standings live exclusively in `leaderboard/{userId}`, which contains zero PII (`uid`, `displayName`, `avatarId`, `houseId`, `classId`, `tier`, `points`, `rank`, `isPublic`, `updatedAt`).

3. **Relational & Atomic Sync (`getAfter` / `existsAfter`)**:
   - A `leaderboard/{userId}` entry must mirror `users/{userId}` (`points`, `houseId`, `classId`, `rank`, `tier`) in the same batch/transaction via `getAfter(/databases/$(database)/documents/users/$(userId))`.
   - An `EventBooking` (`bookings/{bookingId}`) cannot be created without an existing `events/{eventId}`, a matching `qr_tickets/{qrCodeToken}` created atomically (`existsAfter`), and an atomic +1 increment of `events/{eventId}.bookedCount` (`getAfter`).
   - A `PointTransaction` (`point_transactions/{txId}`) cannot be created without an existing `users/{userId}` and `houses/{houseId}`, bounded positive point values (`1 <= finalPoints <= 600`), and owner or Warden/Admin authorization.

4. **Strict RBAC & Non-Escalation**:
   - Users cannot self-assign `role: 'warden'` or `isGiantsChosen: true` on create or update (`role == 'member'` and `isGiantsChosen == false` on create; `role` and `isGiantsChosen` are immutable to non-admins).
   - Only `admins/{userId}` or the verified bootstrapped admin (`danial@srgesports.com`) satisfies `isAdmin()`.
   - Warden verification for QR check-ins checks the trusted server-side `users/{request.auth.uid}.data.role == 'warden'` or `isAdmin()`.

5. **Terminal State & Bounded Economy**:
   - Once an `EventBooking.status` becomes `'checked_in'` or `'cancelled'`, non-admin updates are blocked (prevents double check-in point farming).
   - Quest claims and Event check-ins bound per-action point deltas (`<= 300` for quests, `<= 125` for Oath, `<= 500` for event check-in, `<= 600` for House delta), preventing negative or inflated point tampering.
   - All string fields have explicit `.size()` caps, IDs enforce `^[a-zA-Z0-9_\-]+$`, arrays (`attendedEvents`, `completedQuestIds`) are capped at `<= 50` items, and `createdAt`/`updatedAt` must equal `request.time`.

---

## 2. The "Dirty Dozen" Attack Payloads

1. **D01 — Shadow Field Injection (`users` create)**:
   - Payload includes all required `UserProfile` fields plus `ghostAdmin: true`.
   - Expected: `PERMISSION_DENIED` (`hasOnly` rejects extra keys).

2. **D02 — Email Spoofing (`admins` / Admin Check)**:
   - Request with `auth.token.email == 'danial@srgesports.com'` and `auth.token.email_verified == false` attempting admin write to `/houses/sigil`.
   - Expected: `PERMISSION_DENIED` (`email_verified == true` is mandatory).

3. **D03 — PII Blanket Read (`users` get / list)**:
   - Authenticated non-owner (`uid: 'attacker-1'`) attempting `get /users/victim-1` or `list /users`.
   - Expected: `PERMISSION_DENIED`.

4. **D04 — Unscoped List Scraping (`bookings` list)**:
   - Authenticated user (`uid: 'attacker-1'`) attempting to list `bookings` where `resource.data.userId == 'victim-1'`.
   - Expected: `PERMISSION_DENIED` (`allow list` requires `resource.data.userId == request.auth.uid`).

5. **D05 — Identity & Role Escalation (`users` create)**:
   - New user attempting `create /users/attacker-1` with `role: 'warden'` and `isGiantsChosen: true`.
   - Expected: `PERMISSION_DENIED`.

6. **D06 — Booking Status Shortcutting (`bookings` create)**:
   - User attempting `create /bookings/bk-hack` with `status: 'checked_in'` directly on creation to bypass Warden check-in.
   - Expected: `PERMISSION_DENIED` (`status == 'booked'` enforced on create).

7. **D07 — Double Check-In Terminal State Bypass (`bookings` update)**:
   - Attempt to transition `bookings/{id}` from `status: 'checked_in'` back to `'booked'` or re-award points as non-admin.
   - Expected: `PERMISSION_DENIED`.

8. **D08 — Resource Exhaustion / ID Poisoning (`point_transactions` create)**:
   - Attempt to create `/point_transactions/tx-poison` with a 1500-char `description` or invalid `txId` (`"../hack"`).
   - Expected: `PERMISSION_DENIED`.

9. **D09 — Value Poisoning on Whitelisted Update (`users` update)**:
   - Owner updates `users/{uid}` changing `displayName` to `12345` (number) or a 200-char string.
   - Expected: `PERMISSION_DENIED` (`isValidUserProfile(incoming())` enforces string + size bounds).

10. **D10 — Arbitrary Point Inflation (`users` / `leaderboard` update)**:
    - Owner updates `users/{uid}` attempting `points: 999999` in a single quest claim, or updates `leaderboard/{uid}` without matching `users/{uid}.points`.
    - Expected: `PERMISSION_DENIED`.

11. **D11 — Ghost Booking Without Capacity Sync (`bookings` create)**:
    - User attempts to create `/bookings/{id}` referencing a non-existent `eventId` or without incrementing `events/{eventId}.bookedCount` and creating `qr_tickets/{token}` in the same transaction.
    - Expected: `PERMISSION_DENIED` (`exists` + `existsAfter` + `getAfter` checks fail).

12. **D12 — Client Timestamp Forgery (`point_transactions` create)**:
    - User creates a `PointTransaction` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
    - Expected: `PERMISSION_DENIED`.
