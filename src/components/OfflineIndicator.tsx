import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex items-center gap-2.5 rounded-xl border border-[#D4AF37]/40 bg-white/95 dark:bg-[#18181E]/95 px-4 py-2.5 text-xs font-medium text-zinc-800 dark:text-[#F3E5AB] shadow-xl backdrop-blur-md"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-[#E31E24] dark:text-[#F7D117]" />
      <span>Offline mode active · Cached QR tickets and calendar remain available.</span>
    </div>
  );
};
