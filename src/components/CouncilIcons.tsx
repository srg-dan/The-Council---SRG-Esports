import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  Coins,
  Crown,
  Film,
  Footprints,
  Gauge,
  Music2,
  Shield,
  Sparkles,
  Swords,
} from 'lucide-react';
import type { ClassId, HouseId } from '../types/council.ts';
import { SRG_LOGO_URL } from '../data/media.ts';

export const HouseCrest: React.FC<{
  houseId: HouseId | 'all' | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}> = ({ houseId, size = 'md' }) => {
  const dims = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const iconDims = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';

  switch (houseId) {
    case 'circuit':
      return (
        <div
          className={`${dims} flex shrink-0 items-center justify-center rounded-xl border border-orange-500/40 bg-orange-500/15 text-orange-600 dark:text-orange-400`}
        >
          <Gauge className={iconDims} />
        </div>
      );
    case 'sigil':
      return (
        <div
          className={`${dims} flex shrink-0 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-500/15 text-purple-600 dark:text-purple-300`}
        >
          <Shield className={iconDims} />
        </div>
      );
    case 'stride':
      return (
        <div
          className={`${dims} flex shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300`}
        >
          <Footprints className={iconDims} />
        </div>
      );
    case 'reel':
      return (
        <div
          className={`${dims} flex shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300`}
        >
          <Film className={iconDims} />
        </div>
      );
    case 'echo':
      return (
        <div
          className={`${dims} flex shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300`}
        >
          <Music2 className={iconDims} />
        </div>
      );
    default:
      return (
        <div
          className={`${dims} flex shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#E31E24]/15 text-[#E31E24] dark:text-[#F7D117]`}
        >
          <Crown className={iconDims} />
        </div>
      );
  }
};

export const ClassInsignia: React.FC<{
  classId: ClassId | null | undefined;
  size?: 'sm' | 'md';
}> = ({ classId, size = 'md' }) => {
  const dims = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
  const iconDims = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';

  const Icon =
    classId === 'vanguard'
      ? Swords
      : classId === 'scout'
        ? Compass
        : classId === 'bard'
          ? Music2
          : classId === 'sage'
            ? BookOpen
            : classId === 'merchant'
              ? Coins
              : Sparkles;

  return (
    <div
      className={`${dims} flex shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-zinc-100 dark:bg-[#202028] text-amber-700 dark:text-[#F3E5AB]`}
    >
      <Icon className={iconDims} />
    </div>
  );
};

export const AvatarSigil: React.FC<{
  avatarId: string;
  photoDataUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ avatarId, photoDataUrl, size = 'md' }) => {
  const dims =
    size === 'sm'
      ? 'h-9 w-9'
      : size === 'lg'
        ? 'h-16 w-16'
        : size === 'xl'
          ? 'h-20 w-20'
          : 'h-12 w-12';

  if (photoDataUrl) {
    return (
      <div
        className={`${dims} shrink-0 overflow-hidden rounded-2xl border border-[#D4AF37]/50 bg-zinc-200 dark:bg-[#18181E]`}
      >
        <img
          src={photoDataUrl}
          alt="Member avatar"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (avatarId === 'crest') {
    return (
      <div
        className={`${dims} flex shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/45 bg-zinc-900 dark:bg-[#18181E] p-1.5`}
      >
        <img
          src={SRG_LOGO_URL}
          alt="SRG Crest Avatar"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  const iconMap: Record<string, React.ReactNode> = {
    knight: <Shield className="h-1/2 w-1/2 text-[#F7D117]" />,
    visor: <Gauge className="h-1/2 w-1/2 text-[#E31E24]" />,
    tome: <BookOpen className="h-1/2 w-1/2 text-[#F3E5AB]" />,
    lyre: <Music2 className="h-1/2 w-1/2 text-cyan-300" />,
    coin: <Coins className="h-1/2 w-1/2 text-[#F7D117]" />,
  };

  return (
    <div
      className={`${dims} flex shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-br from-[#23151A] to-[#18181E]`}
    >
      {iconMap[avatarId] ?? <Crown className="h-1/2 w-1/2 text-[#F7D117]" />}
    </div>
  );
};

export const ResilientBannerImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#2A1015] via-[#18181E] to-[#121212] ${className}`}
      >
        <img
          src={SRG_LOGO_URL}
          alt={alt}
          referrerPolicy="no-referrer"
          className="h-16 w-16 opacity-60 object-contain"
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
