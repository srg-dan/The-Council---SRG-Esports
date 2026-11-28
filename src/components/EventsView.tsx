import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ImagePlus,
  List,
  MapPin,
  QrCode,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { HOUSES, getHouseById } from '../data/aethermere.ts';
import { MEDIA_ASSETS } from '../data/media.ts';
import type {
  CouncilEvent,
  EventBooking,
  HouseId,
  RankTitle,
  UserProfile,
} from '../types/council.ts';
import { HouseCrest, ResilientBannerImage, WardenLabel } from './CouncilIcons.tsx';

interface EventsViewProps {
  events: CouncilEvent[];
  bookings: EventBooking[];
  user: UserProfile | null;
  isAdmin: boolean;
  selectedEvent: CouncilEvent | null;
  onSelectEvent: (evt: CouncilEvent | null) => void;
  onBookEvent: (eventId: string) => Promise<EventBooking>;
  onClaimEventQr: (eventQrCode: string) => Promise<{
    eventTitle: string;
    awardedPoints: number;
    newRank: RankTitle;
    rankedUp: boolean;
  }>;
  onVerifyCheckIn: (qrCodeToken: string, eventId?: string) => Promise<{
    eventTitle: string;
    attendeeName: string;
    awardedPoints: number;
    multiplierApplied: number;
  }>;
  onGrantWarden: (targetUid: string) => Promise<void>;
  onOpenAuth: () => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  bookings,
  user,
  isAdmin,
  selectedEvent,
  onSelectEvent,
  onBookEvent,
  onClaimEventQr,
  onVerifyCheckIn,
  onGrantWarden,
  onOpenAuth,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [houseFilter, setHouseFilter] = useState<HouseId | 'all'>('all');
  const [activeTicket, setActiveTicket] = useState<{
    booking: EventBooking;
    event: CouncilEvent;
  } | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // User Scan Event QR Modal state
  const [showEventQrModal, setShowEventQrModal] = useState(false);
  const [eventQrInput, setEventQrInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [eventQrBusy, setEventQrBusy] = useState(false);
  const [eventQrStatus, setEventQrStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const qrImageInputRef = useRef<HTMLInputElement | null>(null);

  // Warden Check-In Desk modal state
  const [showScanner, setShowScanner] = useState(false);
  const [scanToken, setScanToken] = useState('');
  const [scanEventId, setScanEventId] = useState(events[0]?.eventId ?? '');
  const [targetWardenUid, setTargetWardenUid] = useState('');
  const [copiedUid, setCopiedUid] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [scannerBusy, setScannerBusy] = useState(false);

  const stopCamera = () => {
    if (scanRafRef.current !== null) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!showEventQrModal) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [showEventQrModal]);

  const submitEventQrCode = async (rawCode: string) => {
    const cleaned = rawCode.trim().toUpperCase();
    if (!cleaned || eventQrBusy) return;
    setEventQrBusy(true);
    setEventQrStatus(null);
    stopCamera();
    try {
      const res = await onClaimEventQr(cleaned);
      setEventQrInput('');
      setEventQrStatus({
        type: 'success',
        message: `Awarded +${res.awardedPoints} pts for "${res.eventTitle}"${
          res.rankedUp ? ` · Promoted to ${res.newRank}!` : '!'
        }`,
      });
    } catch (err) {
      setEventQrStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to claim Event QR code.',
      });
    } finally {
      setEventQrBusy(false);
    }
  };

  const startCameraScan = async () => {
    setEventQrStatus(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setEventQrStatus({
        type: 'error',
        message: 'Camera access is not supported in this browser. Upload a QR photo or enter the code below.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);

      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        void video.play();

        const tick = () => {
          if (!videoRef.current || !streamRef.current) return;
          const v = videoRef.current;
          if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
            const canvas = scanCanvasRef.current ?? document.createElement('canvas');
            scanCanvasRef.current = canvas;
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const decoded = jsQR(imgData.data, imgData.width, imgData.height);
              if (decoded?.data) {
                void submitEventQrCode(decoded.data);
                return;
              }
            }
          }
          scanRafRef.current = requestAnimationFrame(tick);
        };
        scanRafRef.current = requestAnimationFrame(tick);
      });
    } catch {
      setEventQrStatus({
        type: 'error',
        message: 'Camera permission denied. Upload a QR photo or enter the Event QR code manually.',
      });
      stopCamera();
    }
  };

  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEventQrStatus(null);
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not read the QR image.'));
        el.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable.');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imgData.data, imgData.width, imgData.height);
      if (!decoded?.data) {
        throw new Error('No QR code detected in that image. Try cropping closer or entering the code.');
      }
      await submitEventQrCode(decoded.data);
    } catch (err) {
      setEventQrStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to decode QR image.',
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (houseFilter === 'all') return true;
    return e.houseId === houseFilter || e.houseId === 'all';
  });

  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const hasScannerAccess = Boolean(
    user && (user.role === 'warden' || user.role === 'superadmin' || isAdmin)
  );

  const handleBook = async (evt: CouncilEvent) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setBookingError(null);
    setBookingLoading(true);
    try {
      const created = await onBookEvent(evt.eventId);
      onSelectEvent(null);
      setActiveTicket({ booking: created, event: evt });
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Booking failed.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScannerStatus(null);
    setScannerBusy(true);
    try {
      const res = await onVerifyCheckIn(scanToken, scanEventId || events[0]?.eventId);
      setScanToken('');
      setScannerStatus({
        type: 'success',
        message: `Checked in ${res.attendeeName} for ${res.eventTitle} (+${res.awardedPoints} pts).`,
      });
    } catch (err) {
      setScannerStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Check-in verification failed.',
      });
    } finally {
      setScannerBusy(false);
    }
  };

  const handleGrantWardenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScannerStatus(null);
    setScannerBusy(true);
    try {
      await onGrantWarden(targetWardenUid);
      setTargetWardenUid('');
      setScannerStatus({
        type: 'success',
        message: 'Warden scanner privileges granted to member UID.',
      });
    } catch (err) {
      setScannerStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to grant Warden access.',
      });
    } finally {
      setScannerBusy(false);
    }
  };

  const handleCopyUid = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      setCopiedUid(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            2027 Klang Valley Calendar
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Official Council activations across KL, PJ, and Subang Jaya · Scan Event QRs to earn points.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#E31E24] text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-[#E31E24] text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Month Grid</span>
            </button>
          </div>

          {user && (
            <button
              type="button"
              onClick={() => {
                setEventQrStatus(null);
                setShowEventQrModal(true);
              }}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#E31E24] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#C8102E] cursor-pointer whitespace-nowrap"
            >
              <QrCode className="h-4 w-4" />
              <span>Scan Event QR</span>
            </button>
          )}

          {hasScannerAccess && (
            <button
              type="button"
              onClick={() => {
                setScannerStatus(null);
                if (!scanEventId && events[0]) setScanEventId(events[0].eventId);
                setShowScanner(true);
              }}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#D4AF37]/50 bg-white dark:bg-[#18181E] px-3.5 py-2 text-xs font-semibold text-zinc-900 dark:text-[#F3E5AB] hover:border-[#E31E24] dark:hover:border-[#F7D117] cursor-pointer whitespace-nowrap"
            >
              <ScanLine className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
              <span>Crew Check-In</span>
            </button>
          )}
        </div>
      </div>

      {/* Booked QR Ticket Vault */}
      {activeBookings.length > 0 && (
        <section className="rounded-3xl border border-[#D4AF37]/35 bg-white dark:bg-gradient-to-br dark:from-[#201618] dark:via-[#18181E] dark:to-[#121212] p-5 sm:p-6 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Ticket className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
                <span>My QR Ticket Vault</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Cached locally for offline venue entry · Tap any pass to expand
              </p>
            </div>
            <span className="font-mono text-xs text-amber-700 dark:text-[#F3E5AB] tabular-nums">
              {activeBookings.length} pass{activeBookings.length === 1 ? '' : 'es'}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeBookings.map((booking) => {
              const evt = events.find((e) => e.eventId === booking.eventId);
              if (!evt) return null;
              const checkedIn = booking.status === 'checked_in';

              return (
                <button
                  key={booking.bookingId}
                  type="button"
                  onClick={() => setActiveTicket({ booking, event: evt })}
                  className="flex items-center gap-3.5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-3.5 text-left transition-colors hover:border-[#E31E24] dark:hover:border-[#F7D117]/60 cursor-pointer"
                >
                  <div className="shrink-0 rounded-xl bg-white p-1.5 border border-zinc-200 dark:border-transparent">
                    <QRCodeSVG value={booking.qrCodeToken} size={56} level="M" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                      {evt.month} · {checkedIn ? 'Checked In' : 'Ready for Entry'}
                    </p>
                    <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white truncate">
                      {evt.title}
                    </h3>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {booking.qrCodeToken}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* House Filter Bar */}
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
          All Events
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

      {/* List or Monthly Calendar Grid */}
      {viewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((evt) => {
            const house = evt.houseId === 'all' ? null : getHouseById(evt.houseId);
            const existingBooking = activeBookings.find((b) => b.eventId === evt.eventId);
            const alreadyClaimedQr = Boolean(user?.attendedEvents.includes(evt.eventId));

            return (
              <article
                key={evt.eventId}
                className="flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] transition-colors hover:border-zinc-300 dark:hover:border-white/25 shadow-sm dark:shadow-none"
              >
                <div>
                  <div className="relative h-36">
                    <ResilientBannerImage
                      src={MEDIA_ASSETS[evt.mediaKey]}
                      alt={evt.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#F7D117]">
                        {evt.month.toUpperCase()} · {evt.date}
                      </span>
                      <span className="font-mono text-xs text-zinc-100 tabular-nums">
                        +{evt.checkInPoints} pts
                      </span>
                    </div>
                  </div>

                  <div className="p-5 pt-3">
                    <div className="flex items-center gap-2.5">
                      <HouseCrest houseId={evt.houseId} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {house ? house.name : 'All Houses'} · <WardenLabel wardenName={evt.wardenName} />
                        </p>
                        <h2 className="font-display text-base font-bold text-zinc-900 dark:text-white leading-snug">
                          {evt.title}
                        </h2>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2">
                      {evt.description}
                    </p>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span className="truncate">{evt.location}</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-zinc-900 dark:text-white tabular-nums">
                      {evt.basePriceRM === 0 ? 'FREE' : `RM${evt.basePriceRM}`}
                    </p>
                    {alreadyClaimedQr && (
                      <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        Points collected
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (existingBooking) {
                        setActiveTicket({ booking: existingBooking, event: evt });
                      } else {
                        onSelectEvent(evt);
                      }
                    }}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      existingBooking
                        ? 'border border-[#E31E24] dark:border-[#F7D117]/50 bg-zinc-50 dark:bg-[#121212] text-[#E31E24] dark:text-[#F7D117] hover:bg-zinc-100 dark:hover:bg-[#202028]'
                        : 'bg-[#E31E24] text-white hover:bg-[#C8102E]'
                    }`}
                  >
                    {existingBooking ? (
                      <>
                        <QrCode className="h-4 w-4" />
                        <span>
                          {existingBooking.status === 'checked_in' ? 'Checked In' : 'View QR'}
                        </span>
                      </>
                    ) : (
                      <span>{user ? 'Book Seat' : 'View Details'}</span>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {filteredEvents.map((evt) => {
            const house = evt.houseId === 'all' ? null : getHouseById(evt.houseId);
            const existingBooking = activeBookings.find((b) => b.eventId === evt.eventId);

            return (
              <button
                key={evt.eventId}
                type="button"
                onClick={() =>
                  existingBooking
                    ? setActiveTicket({ booking: existingBooking, event: evt })
                    : onSelectEvent(evt)
                }
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181E] p-4 text-left transition-colors hover:border-[#E31E24] dark:hover:border-[#F7D117]/50 cursor-pointer shadow-sm dark:shadow-none"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-bold text-[#E31E24] dark:text-[#F7D117]">
                      {evt.month}
                    </span>
                    <HouseCrest houseId={evt.houseId} size="sm" />
                  </div>
                  <h3 className="mt-2.5 font-display text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                    {evt.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {house ? house.name : 'All Houses'} · {evt.date}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-white/8 flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                    {evt.basePriceRM === 0 ? 'FREE' : `RM${evt.basePriceRM}`}
                  </span>
                  <span className="font-semibold text-amber-700 dark:text-[#F3E5AB]">
                    {existingBooking ? 'Ticket Ready' : `+${evt.checkInPoints} pts`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Scan Event QR Modal (Auto-Reward Points) */}
      {showEventQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[#D4AF37]/40 bg-white dark:bg-[#18181E] p-6 shadow-2xl max-h-[92dvh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                  Event Point Collection
                </p>
                <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white mt-0.5">
                  Scan Event QR Code
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEventQrModal(false)}
                aria-label="Close Event QR scanner"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Scan the official event QR displayed at the venue using your camera or QR photo to automatically collect event points to your profile.
            </p>

            {/* Camera Preview or Scan Controls */}
            {cameraActive ? (
              <div className="space-y-2.5">
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-[#E31E24] bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-[#F7D117]/80" />
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full min-h-[40px] rounded-xl border border-zinc-300 dark:border-white/15 text-xs font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                >
                  Stop Camera
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={eventQrBusy}
                  onClick={() => void startCameraScan()}
                  className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#E31E24] px-3 text-xs font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                  <span>Open Camera</span>
                </button>
                <input
                  ref={qrImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQrImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={eventQrBusy}
                  onClick={() => qrImageInputRef.current?.click()}
                  className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-[#121212] px-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-[#E31E24] disabled:opacity-50 cursor-pointer"
                >
                  <ImagePlus className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
                  <span>Scan QR Image</span>
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitEventQrCode(eventQrInput);
              }}
              className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/10"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Or Enter Event QR Code Manually
                </label>
                <input
                  type="text"
                  required
                  value={eventQrInput}
                  onChange={(e) => setEventQrInput(e.target.value)}
                  placeholder="SRGEVT-2027..."
                  className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-4 font-mono text-sm text-zinc-900 dark:text-white uppercase focus:border-[#E31E24] focus:outline-none"
                />
              </div>

              {eventQrStatus && (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                    eventQrStatus.type === 'success'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                      : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200'
                  }`}
                >
                  {eventQrStatus.message}
                </div>
              )}

              <button
                type="submit"
                disabled={eventQrBusy || !eventQrInput.trim()}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7D117] text-sm font-bold text-[#121212] hover:bg-[#FCE205] disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>{eventQrBusy ? 'Claiming Points...' : 'Claim Event Points'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Event Detail & Booking Sheet Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-zinc-200 dark:border-white/12 bg-white dark:bg-[#18181E] overflow-hidden shadow-2xl max-h-[92dvh] overflow-y-auto">
            <div className="relative h-44">
              <ResilientBannerImage
                src={MEDIA_ASSETS[selectedEvent.mediaKey]}
                alt={selectedEvent.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
              <button
                type="button"
                onClick={() => {
                  setBookingError(null);
                  onSelectEvent(null);
                }}
                aria-label="Close event details"
                className="absolute right-4 top-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-black/60 text-white hover:bg-black/80 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 pt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                  {selectedEvent.month} Activation · Hosted by <WardenLabel wardenName={selectedEvent.wardenName} />
                </p>
                <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                  {selectedEvent.title}
                </h2>
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {selectedEvent.description}
              </p>

              <div className="space-y-2 border-y border-zinc-200 dark:border-white/10 py-4 text-xs text-zinc-600 dark:text-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Date & Time</span>
                  <span className="font-mono text-zinc-900 dark:text-white">
                    {selectedEvent.date} · {selectedEvent.time}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500 dark:text-zinc-400">Venue</span>
                  <span className="text-right text-zinc-900 dark:text-white">
                    {selectedEvent.location}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Attendance Capacity</span>
                  <span className="font-mono text-zinc-900 dark:text-white tabular-nums inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-zinc-400" />
                    {selectedEvent.bookedCount} / {selectedEvent.capacity}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Check-In Reward</span>
                  <span className="font-mono font-semibold text-[#E31E24] dark:text-[#F7D117] tabular-nums">
                    +{selectedEvent.checkInPoints} pts
                  </span>
                </div>
              </div>

              {bookingError && (
                <p className="text-xs text-red-600 dark:text-red-300">{bookingError}</p>
              )}

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Entry Fee</p>
                  <p className="font-mono text-xl font-bold text-zinc-900 dark:text-white tabular-nums">
                    {selectedEvent.basePriceRM === 0 ? 'FREE' : `RM${selectedEvent.basePriceRM}`}
                  </p>
                </div>

                {activeBookings.some((b) => b.eventId === selectedEvent.eventId) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const b = activeBookings.find(
                        (item) => item.eventId === selectedEvent.eventId
                      );
                      if (b) {
                        onSelectEvent(null);
                        setActiveTicket({ booking: b, event: selectedEvent });
                      }
                    }}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#F7D117] px-5 py-3 text-sm font-bold text-[#121212] cursor-pointer"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Open QR Ticket</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={bookingLoading}
                    onClick={() => handleBook(selectedEvent)}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#E31E24] px-6 py-3 text-sm font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    <Ticket className="h-4 w-4" />
                    <span>
                      {bookingLoading ? 'Booking...' : !user ? 'Sign In to Book' : 'Confirm RSVP'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full QR Ticket Modal */}
      {activeTicket && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl border border-[#D4AF37]/40 bg-white dark:bg-[#18181E] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#E31E24] dark:text-[#F7D117]">
                  Official Council Activation Pass
                </p>
                <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white mt-0.5">
                  {activeTicket.event.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveTicket(null)}
                aria-label="Close ticket modal"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center rounded-2xl border border-zinc-200 dark:border-transparent bg-zinc-50 dark:bg-white p-5">
              <QRCodeSVG value={activeTicket.booking.qrCodeToken} size={196} level="H" />
              <p className="mt-3 font-mono text-xs font-bold text-[#121212] tracking-wider">
                {activeTicket.booking.qrCodeToken}
              </p>
            </div>

            <div className="mt-4 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Date</span>
                <span className="font-mono text-zinc-900 dark:text-white">
                  {activeTicket.event.date} · {activeTicket.event.time}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500 dark:text-zinc-400">Venue</span>
                <span className="text-right text-zinc-900 dark:text-white">
                  {activeTicket.event.location}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Pass Status</span>
                <span
                  className={`font-semibold inline-flex items-center gap-1 ${
                    activeTicket.booking.status === 'checked_in'
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : 'text-[#E31E24] dark:text-[#F7D117]'
                  }`}
                >
                  {activeTicket.booking.status === 'checked_in' ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Checked In (+Points Awarded)</span>
                    </>
                  ) : (
                    <span>Valid · Present at Door</span>
                  )}
                </span>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
              Saved for offline access in your Council PWA. Present to crew at the door to claim +{activeTicket.event.checkInPoints} pts.
            </p>
          </div>
        </div>
      )}

      {/* Warden & Crew QR Check-In Desk Modal */}
      {showScanner && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[#D4AF37]/35 bg-white dark:bg-[#18181E] p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#E31E24] dark:text-[#D4AF37]">
                  Live Activation Gate
                </p>
                <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white mt-0.5">
                  Crew QR Check-In Desk
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                aria-label="Close Crew scanner"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!user ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Sign in with an authorized SRG Warden or Superadmin account to verify live QR check-ins.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowScanner(false);
                    onOpenAuth();
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-[#E31E24] text-sm font-semibold text-white cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            ) : !hasScannerAccess ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] p-4 flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-[#E31E24] dark:text-[#F7D117] shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    Crew QR check-in privileges are assigned by Council Superadmin. Share your Member UID below if you are staffing an activation gate.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#121212] px-3.5 py-2.5">
                  <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate">
                    {user.uid}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUid}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 text-xs font-medium text-[#E31E24] dark:text-[#F7D117] cursor-pointer"
                  >
                    {copiedUid ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy UID</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-6">
                <form onSubmit={handleScanSubmit} className="space-y-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    Scan or enter a fan&apos;s personal Member QR ID (<span className="font-mono">SRGQR-...</span>) or Event Ticket Token (<span className="font-mono">SRG27-...</span>) to credit points atomically.
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Active Event (used for Member QR IDs)
                    </label>
                    <select
                      value={scanEventId}
                      onChange={(e) => setScanEventId(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3 text-xs text-zinc-900 dark:text-white"
                    >
                      {events.map((evt) => (
                        <option key={evt.eventId} value={evt.eventId}>
                          {evt.title} (+{evt.checkInPoints} pts)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Member QR ID or Ticket Token
                    </label>
                    <input
                      type="text"
                      required
                      value={scanToken}
                      onChange={(e) => setScanToken(e.target.value)}
                      placeholder="SRGQR-... or SRG27-JAN-..."
                      className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-4 font-mono text-sm text-zinc-900 dark:text-white focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
                    />
                  </div>

                  {scannerStatus && (
                    <div
                      className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                        scannerStatus.type === 'success'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                          : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200'
                      }`}
                    >
                      {scannerStatus.message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={scannerBusy}
                    className="w-full min-h-[48px] rounded-xl bg-[#E31E24] text-sm font-semibold text-white hover:bg-[#C8102E] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{scannerBusy ? 'Verifying...' : 'Verify & Award Points'}</span>
                  </button>
                </form>

                {isAdmin && (
                  <form
                    onSubmit={handleGrantWardenSubmit}
                    className="pt-5 border-t border-zinc-200 dark:border-white/10 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
                      <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                        Superadmin: Authorize Crew Member
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={targetWardenUid}
                        onChange={(e) => setTargetWardenUid(e.target.value)}
                        placeholder="Paste member Firebase UID"
                        className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3.5 font-mono text-xs text-zinc-900 dark:text-white focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={scannerBusy}
                        className="min-h-[44px] rounded-xl bg-[#F7D117] px-4 text-xs font-bold text-[#121212] hover:bg-[#FCE205] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        Grant
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
