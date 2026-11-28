import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  Coins,
  Crown,
  Gauge,
  Music2,
  Shield,
  Sparkles,
  Swords,
} from 'lucide-react';
import type { ClassId, HouseId } from '../types/council.ts';
import { SRG_LOGO_URL } from '../data/media.ts';

const HOUSE_ICON_ASSETS: Record<
  HouseId,
  { src: string; alt: string; borderClass: string }
> = {
  circuit: {
    src: '/house_icons/House%20Circuit_Warden%20Kramm.png',
    alt: 'House Circuit · Warden Kramm',
    borderClass: 'border-green-500/60 bg-green-950/30',
  },
  sigil: {
    src: '/house_icons/House%20Sigil_Warden%20Yums.png',
    alt: 'House Sigil · Warden Yums',
    borderClass: 'border-purple-500/60 bg-purple-950/30',
  },
  stride: {
    src: '/house_icons/House%20Stride_Warden%20Stormie.png',
    alt: 'House Stride · Warden Stormie',
    borderClass: 'border-orange-500/60 bg-orange-950/30',
  },
  reel: {
    src: '/house_icons/House%20Reel_Warden%20Innocent.png',
    alt: 'House Reel · Warden Innocent',
    borderClass: 'border-yellow-400/70 bg-yellow-950/30',
  },
  echo: {
    src: '/house_icons/House%20Echo_Warden%20Sekys.png',
    alt: 'House Echo · Warden Sekys',
    borderClass: 'border-emerald-400/60 bg-emerald-950/30',
  },
};

export function getWardenTextClass(wardenName: string, onDark = false): string {
  const lower = wardenName.toLowerCase();
  if (lower.includes('kramm')) {
    return onDark
      ? 'text-[#22C55E] font-semibold'
      : 'text-[#00A82D] dark:text-[#22C55E] font-semibold';
  }
  if (lower.includes('yums')) {
    return onDark
      ? 'text-[#A78BFA] font-semibold'
      : 'text-[#6D28D9] dark:text-[#A78BFA] font-semibold';
  }
  if (lower.includes('stormie')) {
    return onDark
      ? 'text-[#FB923C] font-semibold'
      : 'text-[#EA580C] dark:text-[#F97316] font-semibold';
  }
  if (lower.includes('innocent')) {
    return onDark
      ? 'text-[#FACC15] font-semibold'
      : 'text-[#B45309] dark:text-[#FACC15] font-semibold';
  }
  if (lower.includes('sekys')) {
    return onDark
      ? 'text-[#34D399] font-semibold'
      : 'text-[#059669] dark:text-[#34D399] font-semibold';
  }
  return '';
}

export const WardenLabel: React.FC<{
  wardenName: string;
  prefix?: string;
  onDark?: boolean;
}> = ({ wardenName, prefix = '', onDark = false }) => {
  const colorClass = getWardenTextClass(wardenName, onDark);
  if (!colorClass) {
    return (
      <>
        {prefix}
        {wardenName}
      </>
    );
  }
  return (
    <span className={colorClass}>
      {prefix}
      {wardenName}
    </span>
  );
};

export const HouseCrest: React.FC<{
  houseId: HouseId | 'all' | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}> = ({ houseId, size = 'md' }) => {
  const dims = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const iconDims = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';

  if (houseId && houseId !== 'all' && houseId in HOUSE_ICON_ASSETS) {
    const asset = HOUSE_ICON_ASSETS[houseId as HouseId];
    return (
      <div
        className={`${dims} shrink-0 overflow-hidden rounded-xl border ${asset.borderClass}`}
      >
        <img
          src={asset.src}
          alt={asset.alt}
          className="h-full w-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dims} flex shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#E31E24]/15 text-[#E31E24] dark:text-[#F7D117]`}
    >
      <Crown className={iconDims} />
    </div>
  );
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
