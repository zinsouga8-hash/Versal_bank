import React from 'react';
import { BankEmblem } from './BankLogo';

export default function BankMonogram({ className = 'w-16 h-16' }: { className?: string }) {
  return <BankEmblem className={className} />;
}
