export type HouseId = 'circuit' | 'sigil' | 'stride' | 'reel' | 'echo';

export type ClassId = 'vanguard' | 'scout' | 'bard' | 'sage' | 'merchant';

export type MembershipTier = 'free' | 'diamond';

export type UserRole = 'member' | 'warden' | 'superadmin';

export type ThemePreference = 'dark' | 'light';

export type RankTitle =
  | 'Wanderer'
  | 'Squire'
  | 'Vanguard Knight'
  | 'Warden’s Guard'
  | 'Councillor'
  | 'Elder'
  | 'Giant’s Chosen';

export interface RankTier {
  id: string;
  title: RankTitle;
  minPoints: number | null;
  inviteOnly?: boolean;
  perkSummary: string;
  perks: string[];
}

export interface House {
  houseId: HouseId;
  name: string;
  domain: string;
  wardenName: string;
  wardenTitle: string;
  wardenQuote: string;
  signatureActivation: string;
  description: string;
  totalPoints: number;
  memberCount: number;
  accentColor: string;
  rankDelta: number;
}

export interface CouncilClass {
  classId: ClassId;
  name: string;
  archetype: string;
  description: string;
  questFocus: string;
}

export interface Quest {
  questId: string;
  title: string;
  description: string;
  classFilter: 'all' | ClassId;
  basePoints: number;
  type: 'daily' | 'weekly' | 'one_time';
  expiresAt: string;
  verificationHint: string;
  triviaQuestion?: {
    prompt: string;
    options: string[];
    correctIndex: number;
  };
}

export interface PointTransaction {
  txId: string;
  userId: string;
  houseId: HouseId;
  source: 'quest' | 'event_checkin' | 'referral' | 'admin_award';
  description: string;
  basePoints: number;
  multiplierApplied: number;
  finalPoints: number;
  timestamp: string;
}

export interface CouncilEvent {
  eventId: string;
  title: string;
  month: string;
  monthIndex: number;
  date: string;
  time: string;
  location: string;
  houseId: HouseId | 'all';
  wardenName: string;
  description: string;
  capacity: number;
  bookedCount: number;
  basePriceRM: number;
  diamondPriceRM: number;
  checkInPoints: number;
  eventQrId?: string;
  isCrownEvent?: boolean;
  seasonYear?: number;
  mediaKey: 'arena' | 'racing' | 'hall';
}

export interface EventBooking {
  bookingId: string;
  eventId: string;
  userId: string;
  qrCodeToken: string;
  status: 'booked' | 'checked_in' | 'cancelled';
  bookedAt: string;
  checkedInAt?: string;
  paidAmountRM: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  phoneNumber: string;
  avatarId: string;
  photoDataUrl: string;
  bio: string;
  houseId: HouseId | null;
  classId: ClassId | null;
  tier: MembershipTier;
  points: number;
  rank: RankTitle;
  role: UserRole;
  memberQrId: string;
  themePreference: ThemePreference;
  joinedAt: string;
  attendedEvents: string[];
  completedQuestIds: string[];
  referralCode: string;
  isGiantsChosen?: boolean;
}

export interface LeaderboardMember {
  uid: string;
  displayName: string;
  username: string;
  avatarId: string;
  photoDataUrl: string;
  houseId: HouseId;
  classId: ClassId;
  tier: MembershipTier;
  points: number;
  rank: RankTitle;
  isPublic?: boolean;
}

export interface CountryCodeOption {
  code: string;
  country: string;
  flag: string;
}
