import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface SearchableOption {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  id?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  disabled?: boolean;
  allowCustomInput?: boolean;
  className?: string;
}

export default function SearchableSelect({
  id,
  placeholder = 'Sélectionner...',
  value,
  onChange,
  options,
  disabled = false,
  allowCustomInput = false,
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    (opt.sub && opt.sub.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedOption = options.find(opt => opt.value === value || opt.label === value);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const handleCustomSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && allowCustomInput && search.trim()) {
      e.preventDefault();
      onChange(search.trim());
      setIsOpen(false);
      setSearch('');
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full h-11 px-3.5 py-2 rounded-xl bg-[#faf8f5] border border-[#e8e4dc] hover:border-[#0f2b5c]/60 focus:border-[#0f2b5c] focus:ring-2 focus:ring-[#0f2b5c]/20 transition-all flex items-center justify-between text-left text-sm ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon && <span className="text-base shrink-0">{selectedOption.icon}</span>}
          <span className={`truncate ${value ? 'text-[#1a1a1a] font-medium' : 'text-[#8a857e]'}`}>
            {selectedOption ? selectedOption.label : (value || placeholder)}
          </span>
          {selectedOption?.sub && (
            <span className="text-xs text-[#8a857e] font-mono shrink-0">({selectedOption.sub})</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-[#8a857e] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[#0f2b5c]' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl border border-[#e8e4dc] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input Bar */}
          <div className="p-2 border-b border-[#f0ede6] bg-[#faf8f5] flex items-center gap-2">
            <Search className="w-4 h-4 text-[#8a857e] shrink-0 ml-1.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleCustomSubmit}
              placeholder={allowCustomInput ? "Rechercher ou saisir..." : "Filtrer ou faire défiler..."}
              className="w-full bg-transparent text-xs sm:text-sm text-[#1a1a1a] placeholder:text-[#8a857e] focus:outline-none h-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 hover:bg-[#eee8dd] rounded-lg text-[#8a857e]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options Scroll List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.value || value === opt.label;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs sm:text-sm flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#0f2b5c]/10 text-[#0f2b5c] font-semibold'
                        : 'text-[#1a1a1a] hover:bg-[#faf8f5]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {opt.icon && <span className="text-base shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                      {opt.sub && (
                        <span className="text-[11px] text-[#8a857e] font-mono shrink-0">
                          {opt.sub}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#0f2b5c] shrink-0" />}
                  </button>
                );
              })
            ) : allowCustomInput && search.trim() ? (
              <div className="p-3 text-center space-y-2">
                <p className="text-xs text-[#8a857e]">
                  Ville personnalisée : <strong className="text-[#1a1a1a]">"{search.trim()}"</strong>
                </p>
                <button
                  type="button"
                  onClick={() => handleSelect(search.trim())}
                  className="w-full py-2 px-3 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs font-semibold"
                >
                  Valider cette ville
                </button>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#8a857e]">
                Aucun résultat pour "{search}".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
