import React from 'react';
import { Link } from 'react-router-dom';

interface BankEmblemProps {
  className?: string;
  size?: number;
}

export function BankEmblem({ className = 'w-10 h-10', size }: BankEmblemProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`} style={style}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
      >
        <defs>
          <linearGradient id="shieldGradVB" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#173b75" />
            <stop offset="50%" stopColor="#0f2b5c" />
            <stop offset="100%" stopColor="#081836" />
          </linearGradient>
          <linearGradient id="goldGradVB" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#dce8f8" />
            <stop offset="100%" stopColor="#8eb3e6" />
          </linearGradient>
          <linearGradient id="bevelGradVB" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
          </linearGradient>
          <filter id="shadowVB" x="0" y="2" width="64" height="60" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Outer Shield */}
        <path
          d="M32 6L10 14V30C10 44 19 54 32 58C45 54 54 44 54 30V14L32 6Z"
          fill="url(#shieldGradVB)"
          stroke="url(#goldGradVB)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          filter="url(#shadowVB)"
        />

        {/* Inner Bevel */}
        <path
          d="M32 10L14 16.5V30C14 41.5 21.5 49.5 32 53.5C42.5 49.5 50 41.5 50 30V16.5L32 10Z"
          fill="url(#bevelGradVB)"
        />

        {/* Monogram V & Arch Banking Pillar */}
        <path d="M21 21L32 45L43 21H38L32 36L26 21H21Z" fill="url(#goldGradVB)" />

        {/* Sovereign Apex Arch */}
        <path
          d="M27 21C27 18.2 29.2 16 32 16C34.8 16 37 18.2 37 21"
          stroke="url(#goldGradVB)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Center Platinum Star Accent */}
        <circle cx="32" cy="23" r="1.8" fill="#ffffff" />
      </svg>
    </div>
  );
}

interface BankBrandProps {
  to?: string;
  className?: string;
  inverted?: boolean;
  emblemSize?: string;
}

export default function BankLogo({
  to = '/',
  className = '',
  inverted = false,
  emblemSize = 'w-10 h-10',
}: BankBrandProps) {
  const content = (
    <div className={`flex items-center gap-3 group select-none ${className}`}>
      <BankEmblem className={emblemSize} />
      <div className="flex flex-col">
        <span
          className={`font-heading font-serif text-[19px] leading-tight font-bold tracking-tight transition-colors ${
            inverted
              ? 'text-white group-hover:text-blue-200'
              : 'text-[#0f2b5c] group-hover:text-[#0a1e40]'
          }`}
        >
          VersalBank
        </span>
        <span
          className={`text-[9px] uppercase tracking-[0.24em] font-semibold ${
            inverted ? 'text-blue-200/70' : 'text-[#627592]'
          }`}
        >
          Banque Canadienne
        </span>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }
  return content;
}
