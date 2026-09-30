import React, { useRef, useEffect } from 'react';

interface PinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  mask?: boolean;
  className?: string;
  error?: boolean;
}

export default function PinInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  mask = true,
  className = '',
  error = false,
}: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Split value into array of characters padded to length
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const updatePinAtIndex = (index: number, newChar: string) => {
    const chars = Array.from({ length }, (_, i) => value[i] || '');
    chars[index] = newChar;
    // Trim trailing empty spaces while keeping sequence
    const updated = chars.join('').slice(0, length);
    onChange(updated);
    if (updated.length === length && onComplete) {
      onComplete(updated);
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanDigits = rawVal.replace(/\D/g, '');

    if (!cleanDigits) {
      updatePinAtIndex(index, '');
      return;
    }

    if (cleanDigits.length > 1) {
      // Multiple digits entered (paste or rapid typing)
      const currentDigits = Array.from({ length }, (_, i) => value[i] || '');
      let insertIdx = index;
      for (let i = 0; i < cleanDigits.length && insertIdx < length; i++, insertIdx++) {
        currentDigits[insertIdx] = cleanDigits[i];
      }
      const updated = currentDigits.join('').slice(0, length);
      onChange(updated);
      const nextTarget = Math.min(insertIdx, length - 1);
      inputRefs.current[nextTarget]?.focus();
      if (updated.length === length && onComplete) {
        onComplete(updated);
      }
      return;
    }

    // Single digit entered
    const single = cleanDigits[cleanDigits.length - 1];
    const currentDigits = Array.from({ length }, (_, i) => value[i] || '');
    currentDigits[index] = single;
    const updated = currentDigits.join('').slice(0, length);
    onChange(updated);

    // Auto-advance to next empty slot or next index
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (updated.length === length && onComplete) {
      onComplete(updated);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const currentDigits = Array.from({ length }, (_, i) => value[i] || '');
      if (currentDigits[index]) {
        currentDigits[index] = '';
        const updated = currentDigits.join('').slice(0, length);
        onChange(updated);
      } else if (index > 0) {
        currentDigits[index - 1] = '';
        const updated = currentDigits.join('').slice(0, length);
        onChange(updated);
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      return;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    onChange(pasted);
    const nextIdx = Math.min(pasted.length, length - 1);
    inputRefs.current[nextIdx]?.focus();

    if (pasted.length === length && onComplete) {
      onComplete(pasted);
    }
  };

  return (
    <div className={`flex items-center justify-center gap-2 sm:gap-3 ${className}`}>
      {digits.map((digit, idx) => {
        const isFilled = digit !== '';
        return (
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type={mask ? 'password' : 'text'}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2} // Allows catching rapid typing
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(idx, e)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`w-11 h-13 sm:w-13 sm:h-15 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl border-2 transition-all outline-hidden ${
              error
                ? 'border-red-500 bg-red-50/50 text-red-900 focus:border-red-600 focus:ring-2 focus:ring-red-200'
                : isFilled
                ? 'border-[#0f2b5c] bg-white text-[#0f2b5c] shadow-xs'
                : 'border-[#ddd5c7] bg-[#faf8f5] text-[#1a1a1a] focus:border-[#0f2b5c] focus:bg-white focus:ring-2 focus:ring-[#0f2b5c]/15'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        );
      })}
    </div>
  );
}
