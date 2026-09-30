import React from 'react';
import { useI18n } from '../../lib/i18n';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  className?: string;
  showIcon?: boolean;
}

export default function LanguageSelector({ className = '', showIcon = true }: LanguageSelectorProps) {
  const { lang, setLang } = useI18n();

  return (
    <div
      id="language-selector-toggle"
      className={`inline-flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-full border border-[#dce5f2] shadow-xs ${className}`}
    >
      {showIcon && (
        <span className="pl-1.5 pr-0.5 text-[#627592]">
          <Globe className="w-3.5 h-3.5" />
        </span>
      )}
      <button
        type="button"
        id="lang-btn-fr"
        onClick={() => setLang('fr')}
        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
          lang === 'fr'
            ? 'bg-[#0f2b5c] text-white shadow-xs'
            : 'text-[#5a6c85] hover:text-[#0f2b5c]'
        }`}
        aria-label="Passer en Français"
      >
        FR
      </button>
      <button
        type="button"
        id="lang-btn-en"
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
          lang === 'en'
            ? 'bg-[#0f2b5c] text-white shadow-xs'
            : 'text-[#5a6c85] hover:text-[#0f2b5c]'
        }`}
        aria-label="Switch to English"
      >
        EN
      </button>
    </div>
  );
}
