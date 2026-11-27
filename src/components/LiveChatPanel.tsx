import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CornerUpLeft,
  Crown,
  Heart,
  Lock,
  MessageSquare,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { getHouseById } from '../data/aethermere.ts';
import { SRG_LOGO_URL } from '../data/media.ts';
import {
  deleteLiveChatMessage,
  sendLiveChatMessage,
  toggleLiveChatLike,
} from '../services/councilFirebase.ts';
import type { LiveChatMessage, UserProfile } from '../types/council.ts';

interface LiveChatPanelProps {
  user: UserProfile | null;
  messages: LiveChatMessage[];
  desktopOpen: boolean;
  mobileOpen: boolean;
  onToggleDesktop: (open: boolean) => void;
  onToggleMobile: (open: boolean) => void;
  onOpenAuth: (mode?: 'signin' | 'register') => void;
  onNotify?: (title: string, subtitle?: string) => void;
}

function formatMessageTime(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

const ChatAvatar: React.FC<{
  avatarId: string;
  photoDataUrl?: string;
  displayName: string;
  isStaff?: boolean;
}> = ({ avatarId, photoDataUrl, displayName, isStaff }) => {
  if (photoDataUrl) {
    return (
      <img
        src={photoDataUrl}
        alt={displayName}
        className={`h-9 w-9 shrink-0 rounded-full object-cover border ${
          isStaff ? 'border-[#F7D117]' : 'border-zinc-300 dark:border-white/15'
        }`}
      />
    );
  }

  const initial = displayName.trim().slice(0, 1).toUpperCase() || 'S';

  if (avatarId === 'crest') {
    return (
      <div
        className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-zinc-900 p-1.5 border ${
          isStaff ? 'border-[#F7D117]' : 'border-[#D4AF37]/40'
        }`}
      >
        <img
          src={SRG_LOGO_URL}
          alt={displayName}
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center font-display text-xs font-bold border ${
        isStaff
          ? 'bg-[#E31E24] text-white border-[#F7D117]'
          : 'bg-zinc-200 dark:bg-[#23232C] text-zinc-800 dark:text-white border-zinc-300 dark:border-white/15'
      }`}
    >
      {initial}
    </div>
  );
};

export const LiveChatPanel: React.FC<LiveChatPanelProps> = ({
  user,
  messages,
  desktopOpen,
  mobileOpen,
  onToggleDesktop,
  onToggleMobile,
  onOpenAuth,
  onNotify,
}) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    messageId: string;
    displayName: string;
    snippet: string;
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeParticipants = useMemo(() => {
    const uids = new Set(messages.map((m) => m.uid));
    if (user) uids.add(user.uid);
    return uids.size;
  }, [messages, user]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, desktopOpen, mobileOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth('signin');
      return;
    }
    const clean = draft.trim();
    if (!clean || sending) return;

    setSending(true);
    try {
      await sendLiveChatMessage(user, clean, replyTarget ?? undefined);
      setDraft('');
      setReplyTarget(null);
    } catch (err) {
      onNotify?.(
        'Message Failed',
        err instanceof Error ? err.message : 'Unable to send chat message.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleReplyClick = (msg: LiveChatMessage) => {
    if (!user) {
      onOpenAuth('register');
      return;
    }
    setReplyTarget({
      messageId: msg.messageId,
      displayName: msg.displayName,
      snippet: msg.text.slice(0, 90),
    });
    inputRef.current?.focus();
  };

  const handleLikeClick = async (msg: LiveChatMessage) => {
    if (!user) {
      onOpenAuth('register');
      return;
    }
    try {
      await toggleLiveChatLike(msg.messageId, user.uid);
    } catch (err) {
      onNotify?.(
        'Action Failed',
        err instanceof Error ? err.message : 'Could not update reaction.'
      );
    }
  };

  const handleDeleteClick = async (msg: LiveChatMessage) => {
    if (!user) return;
    try {
      await deleteLiveChatMessage(msg.messageId);
    } catch (err) {
      onNotify?.(
        'Delete Failed',
        err instanceof Error ? err.message : 'Could not delete message.'
      );
    }
  };

  const renderInnerChat = (isMobileDrawer: boolean) => (
    <div className="flex h-full flex-col bg-white dark:bg-[#14151A] text-zinc-900 dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-white/10 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => (isMobileDrawer ? onToggleMobile(false) : onToggleDesktop(false))}
            aria-label="Collapse live chat"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/12 text-zinc-600 dark:text-zinc-300 hover:border-[#E31E24] hover:text-[#E31E24] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="font-display text-sm font-bold uppercase tracking-wide truncate">
            Live Chat
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300 tabular-nums">
            {activeParticipants > 0
              ? `${activeParticipants} ${activeParticipants === 1 ? 'fan' : 'fans'} live`
              : 'Live'}
          </span>
        </div>
      </div>

      {/* Guest Read-Only Live Notice Banner */}
      {!user && (
        <div className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#191A21] px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate">
              Watching live · Sign in to chat
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAuth('register')}
            className="shrink-0 rounded-lg bg-[#E31E24] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#C8102E] cursor-pointer"
          >
            Sign Up
          </button>
        </div>
      )}

      {/* Message Feed */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-white/5"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E31E24]/30 bg-[#E31E24]/10 text-[#E31E24] dark:text-[#F7D117]">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="mt-3 font-display text-sm font-bold text-zinc-900 dark:text-white">
              Council Chat Is Live
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[230px]">
              {user
                ? 'Be the first member to drop a message in today’s SRG live feed.'
                : 'Messages stream here in real time. Sign up or log in to join the conversation.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isStaff = msg.role === 'superadmin' || msg.role === 'warden';
            const house =
              msg.houseId !== 'unpledged' ? getHouseById(msg.houseId) : undefined;
            const likedByMe = user ? msg.likedByUids.includes(user.uid) : false;
            const likeCount = msg.likedByUids.length;
            const canDelete = Boolean(
              user && (user.uid === msg.uid || user.role === 'superadmin')
            );

            return (
              <div
                key={msg.messageId}
                className={`px-3.5 py-3 transition-colors ${
                  isStaff
                    ? 'border-l-2 border-l-[#E31E24] bg-[#E31E24]/[0.05] dark:bg-[#E31E24]/[0.10]'
                    : 'hover:bg-zinc-50/70 dark:hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <ChatAvatar
                    avatarId={msg.avatarId}
                    photoDataUrl={msg.photoDataUrl}
                    displayName={msg.displayName}
                    isStaff={isStaff}
                  />

                  <div className="min-w-0 flex-1">
                    {/* Top meta row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-xs font-bold truncate ${
                            isStaff
                              ? 'text-[#E31E24] dark:text-[#F7D117]'
                              : 'text-zinc-900 dark:text-white'
                          }`}
                        >
                          {msg.displayName}
                        </span>

                        {msg.role === 'superadmin' && (
                          <span
                            title="Council Superadmin"
                            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#E31E24] text-white"
                          >
                            <ShieldCheck className="h-2.5 w-2.5" />
                          </span>
                        )}
                        {msg.role === 'warden' && (
                          <span
                            title="House Warden"
                            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#F7D117] text-[#121212]"
                          >
                            <Crown className="h-2.5 w-2.5" />
                          </span>
                        )}
                        {msg.role === 'member' && house && (
                          <span
                            title={house.name}
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: house.accentColor }}
                          />
                        )}

                        <span className="font-mono text-[10px] text-zinc-400 tabular-nums shrink-0">
                          {formatMessageTime(msg.sentAtIso)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReplyClick(msg)}
                          aria-label={`Reply to ${msg.displayName}`}
                          title={user ? 'Reply' : 'Sign in to reply'}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                        >
                          <CornerUpLeft className="h-3.5 w-3.5" />
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteClick(msg)}
                            aria-label="Delete message"
                            title="Delete message"
                            className="p-1 rounded text-zinc-400 hover:text-[#E31E24] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleLikeClick(msg)}
                          aria-label="Like message"
                          title={user ? 'Like' : 'Sign in to react'}
                          className={`inline-flex items-center gap-1 p-1 rounded cursor-pointer transition-colors ${
                            likedByMe
                              ? 'text-[#E31E24]'
                              : 'text-zinc-400 hover:text-[#E31E24]'
                          }`}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${likedByMe ? 'fill-[#E31E24]' : ''}`}
                          />
                          {likeCount > 0 && (
                            <span className="font-mono text-[10px] tabular-nums">
                              {likeCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Reply Preview */}
                    {msg.replyToName && msg.replyToSnippet && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        <CornerUpLeft className="h-3 w-3 shrink-0 text-[#E31E24] dark:text-[#F7D117]" />
                        <span className="truncate">
                          Replying to <strong className="font-semibold">{msg.replyToName}</strong>:{' '}
                          {msg.replyToSnippet}
                        </span>
                      </div>
                    )}

                    {/* Message Body */}
                    <p className="mt-1 text-xs sm:text-[13px] text-zinc-700 dark:text-zinc-200 leading-relaxed break-words">
                      {msg.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Composer / Guest Login Lock */}
      <div className="border-t border-zinc-200 dark:border-white/10 p-3 bg-zinc-50 dark:bg-[#111217] shrink-0">
        {user ? (
          <div className="space-y-2">
            {replyTarget && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E31E24]/30 bg-[#E31E24]/10 px-2.5 py-1.5 text-[11px]">
                <span className="truncate text-zinc-700 dark:text-zinc-200">
                  Replying to <strong>{replyTarget.displayName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  aria-label="Cancel reply"
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                maxLength={400}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  replyTarget
                    ? `Reply to ${replyTarget.displayName}...`
                    : 'Write a live message...'
                }
                className="flex-1 min-h-[42px] rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#18181E] px-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-[#E31E24] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Send message"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-[#E31E24] text-white hover:bg-[#C8102E] disabled:opacity-45 cursor-pointer transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenAuth('signin')}
            className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#18181E] px-3.5 py-2 flex items-center justify-between gap-2 text-left hover:border-[#E31E24] transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="h-3.5 w-3.5 text-[#E31E24] shrink-0" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white truncate">
                Log in or sign up to chat...
              </span>
            </div>
            <span className="shrink-0 font-display text-[11px] font-bold uppercase text-[#E31E24] dark:text-[#F7D117]">
              Log In →
            </span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Left-Side Docked Live Chat Panel */}
      {desktopOpen ? (
        <aside
          aria-label="Live Chat Panel"
          className="hidden lg:block w-80 xl:w-[356px] shrink-0 sticky top-16 h-[calc(100dvh-4rem)] border-r border-zinc-200 dark:border-white/10 z-20"
        >
          {renderInnerChat(false)}
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => onToggleDesktop(true)}
          className="hidden lg:inline-flex fixed left-4 top-20 z-30 items-center gap-2 rounded-xl border border-zinc-300 dark:border-white/15 bg-white/95 dark:bg-[#18181E]/95 px-3.5 py-2.5 text-xs font-semibold text-zinc-900 dark:text-white shadow-lg backdrop-blur-md hover:border-[#E31E24] cursor-pointer"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <MessageSquare className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
          <span className="font-display uppercase">Live Chat</span>
          {messages.length > 0 && (
            <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
              ({messages.length})
            </span>
          )}
        </button>
      )}

      {/* Mobile Floating Left-Side Live Chat Trigger */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => onToggleMobile(true)}
          className="lg:hidden fixed bottom-20 left-3 z-30 inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-white/15 bg-white/95 dark:bg-[#18181E]/95 px-3.5 py-2 text-xs font-semibold text-zinc-900 dark:text-white shadow-lg backdrop-blur-md cursor-pointer"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <MessageSquare className="h-4 w-4 text-[#E31E24] dark:text-[#F7D117]" />
          <span className="font-display uppercase">Live Chat</span>
        </button>
      )}

      {/* Mobile Left-Side Slide-Over Drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Live Chat"
        >
          <div className="h-full w-[90vw] max-w-sm border-r border-zinc-200 dark:border-white/10 shadow-2xl">
            {renderInnerChat(true)}
          </div>
          <button
            type="button"
            aria-label="Close chat backdrop"
            onClick={() => onToggleMobile(false)}
            className="flex-1 cursor-pointer"
          />
        </div>
      )}
    </>
  );
};
