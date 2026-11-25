import React from 'react';
import { COUNTRY_CODES } from '../data/aethermere.ts';

export function splitE164Phone(phoneNumber: string): {
  dialCode: string;
  nationalNumber: string;
} {
  const trimmed = phoneNumber.trim();
  if (!trimmed) {
    return { dialCode: '+60', nationalNumber: '' };
  }
  // Match longest dial code first
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const item of sorted) {
    if (trimmed.startsWith(item.code)) {
      return {
        dialCode: item.code,
        nationalNumber: trimmed.slice(item.code.length).replace(/\D/g, ''),
      };
    }
  }
  return {
    dialCode: '+60',
    nationalNumber: trimmed.replace(/\D/g, ''),
  };
}

interface PhoneInputFieldProps {
  dialCode: string;
  nationalNumber: string;
  onDialCodeChange: (dialCode: string) => void;
  onNationalNumberChange: (digits: string) => void;
  label?: string;
  required?: boolean;
  helperText?: string;
}

export const PhoneInputField: React.FC<PhoneInputFieldProps> = ({
  dialCode,
  nationalNumber,
  onDialCodeChange,
  onNationalNumberChange,
  label = 'Phone Number',
  required = true,
  helperText,
}) => {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          aria-label="Country dial code"
          value={dialCode}
          onChange={(e) => onDialCodeChange(e.target.value)}
          className="min-h-[44px] w-40 shrink-0 rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-2.5 text-xs font-mono font-semibold text-zinc-900 dark:text-white focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={`${c.flag}-${c.code}-${c.country}`} value={c.code}>
              {c.flag} {c.code} · {c.country}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          required={required}
          value={nationalNumber}
          onChange={(e) => onNationalNumberChange(e.target.value.replace(/[^\d]/g, '').slice(0, 15))}
          placeholder="197684608"
          className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-zinc-300 dark:border-white/12 bg-zinc-50 dark:bg-[#121212] px-3.5 font-mono text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-[#E31E24] dark:focus:border-[#F7D117] focus:outline-none"
        />
      </div>
      {helperText && (
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          {helperText}
        </p>
      )}
    </div>
  );
};
