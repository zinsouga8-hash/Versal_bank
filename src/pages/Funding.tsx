import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Wallet,
  Building2,
  Coins,
  Globe2,
  Lock,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { fetchFundingChannels, subscribeToBankData, DEFAULT_FUNDING_CHANNELS } from '../lib/supabaseBankService';
import { useI18n } from '../lib/i18n';

export interface FundingChannelInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  badge?: string;
  color?: string;
  textColor?: string;
  addressLabel?: string;
  addressValue?: string;
  notes?: string;
  active?: boolean;
}

export const fundingChannelsList: FundingChannelInfo[] = DEFAULT_FUNDING_CHANNELS as any;

export default function Funding() {
  const { t, lang } = useI18n();
  const [channels, setChannels] = useState<FundingChannelInfo[]>(() => {
    try {
      const cached = localStorage.getItem('versalbank_channels_store');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_FUNDING_CHANNELS as any;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const list = await fetchFundingChannels();
        if (mounted && Array.isArray(list) && list.length > 0) {
          setChannels(list);
        }
      } catch (e) {
        console.warn('Funding channels load error:', e);
      }
    };

    load();

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('versalbank_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'channels_updated' && Array.isArray(event.data.channels)) {
          setChannels(event.data.channels);
        } else {
          load();
        }
      };
    } catch (_) {}

    const handleChannelsUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setChannels(e.detail);
      } else {
        load();
      }
    };

    const unsub = subscribeToBankData(load);
    window.addEventListener('versalbank_channels_updated', handleChannelsUpdate);
    window.addEventListener('versalbank_update', load);
    window.addEventListener('storage', load);
    window.addEventListener('focus', load);

    return () => {
      mounted = false;
      unsub();
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
      window.removeEventListener('versalbank_channels_updated', handleChannelsUpdate);
      window.removeEventListener('versalbank_update', load);
      window.removeEventListener('storage', load);
      window.removeEventListener('focus', load);
    };
  }, []);

  const getIcon = (id: string, category?: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('crypto') || id === 'usdt-trc20' || id === 'bitcoin') {
      return <Coins className="w-5 h-5" />;
    }
    if (cat.includes('virement') || cat.includes('bancaire') || id === 'sepa-swift') {
      return <Building2 className="w-5 h-5" />;
    }
    if (cat.includes('agence') || cat.includes('espèce') || id === 'western-union' || id === 'ria' || id === 'moneygram') {
      return <Globe2 className="w-5 h-5" />;
    }
    return <Wallet className="w-5 h-5" />;
  };

  const getStyle = (id: string) => {
    switch (id) {
      case 'revolut':
        return { color: 'bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/10', textColor: 'text-black dark:text-white' };
      case 'wise':
        return { color: 'bg-teal-500/10 border-teal-200 dark:border-teal-800', textColor: 'text-teal-700 dark:text-teal-400' };
      case 'sepa-swift':
        return { color: 'bg-blue-600/10 border-blue-200 dark:border-blue-800', textColor: 'text-blue-700 dark:text-blue-400' };
      case 'usdt-trc20':
        return { color: 'bg-emerald-600/10 border-emerald-200 dark:border-emerald-800', textColor: 'text-emerald-700 dark:text-emerald-400' };
      case 'bitcoin':
        return { color: 'bg-amber-600/10 border-amber-200 dark:border-amber-800', textColor: 'text-amber-700 dark:text-amber-400' };
      case 'western-union':
        return { color: 'bg-yellow-500/10 border-yellow-200 dark:border-yellow-800', textColor: 'text-yellow-700 dark:text-yellow-400' };
      case 'ria':
        return { color: 'bg-orange-500/10 border-orange-200 dark:border-orange-800', textColor: 'text-orange-700 dark:text-orange-400' };
      case 'paypal':
        return { color: 'bg-blue-700/10 border-blue-200 dark:border-blue-800', textColor: 'text-blue-800 dark:text-blue-400' };
      case 'skrill':
        return { color: 'bg-fuchsia-600/10 border-fuchsia-200 dark:border-fuchsia-800', textColor: 'text-fuchsia-700 dark:text-fuchsia-400' };
      case 'moneygram':
        return { color: 'bg-red-600/10 border-red-200 dark:border-red-800', textColor: 'text-red-700 dark:text-red-400' };
      default:
        return { color: 'bg-blue-900/10 border-blue-200 dark:border-blue-800', textColor: 'text-[#0f2b5c] dark:text-blue-400' };
    }
  };

  const activeChannels = channels.filter(c => c.active !== false);

  const filteredChannels = activeChannels.filter((c) => {
    if (selectedCategory === 'all') return true;
    const cat = (c.category || '').toLowerCase();
    if (selectedCategory === 'crypto') return cat.includes('crypto') || c.id === 'usdt-trc20' || c.id === 'bitcoin';
    if (selectedCategory === 'bank') return cat.includes('virement') || cat.includes('bancaire') || c.id === 'sepa-swift';
    if (selectedCategory === 'cash') return cat.includes('agence') || cat.includes('espèce') || c.id === 'western-union' || c.id === 'ria' || c.id === 'moneygram';
    if (selectedCategory === 'wallet') return cat.includes('fintech') || cat.includes('portefeuille') || c.id === 'revolut' || c.id === 'wise' || c.id === 'paypal' || c.id === 'skrill';
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Top Header Row */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0f2b5c] dark:text-blue-400 mb-1">
          {t('funding_title')}
        </p>
        <h1 className="font-heading font-serif text-3xl sm:text-4xl text-[#1a1a1a] dark:text-white font-normal">
          {t('funding_heading')}
        </h1>
        <p className="text-sm text-[#8a857e] dark:text-slate-400 mt-1 max-w-2xl">
          {t('funding_desc')}
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: t('funding_category_all') },
          { id: 'bank', label: t('funding_category_bank') },
          { id: 'crypto', label: t('funding_category_crypto') },
          { id: 'wallet', label: t('funding_category_wallet') },
          { id: 'cash', label: t('funding_category_cash') },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-[#0f2b5c] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-[#666] dark:text-slate-300 border border-[#eee8dd] dark:border-slate-700 hover:border-[#0f2b5c]/30'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid of Funding Methods */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#1a1a1a] dark:text-white flex items-center gap-2">
          {t('funding_choose_method')}
        </h2>

        {filteredChannels.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-[#eee8dd] dark:border-slate-700 text-[#8a857e]">
            {t('funding_no_methods')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredChannels.map((channel) => {
              const style = getStyle(channel.id);
              return (
                <Link key={channel.id} to={`/espace/approvisionnement/${channel.id}`}>
                  <div className="group h-full bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#eee8dd] dark:border-slate-800 hover:border-[#0f2b5c]/50 dark:hover:border-blue-500/50 hover:shadow-md transition-all flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105 ${style.color} ${style.textColor}`}
                        >
                          {getIcon(channel.id, channel.category)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm text-[#1a1a1a] dark:text-white group-hover:text-[#0f2b5c] dark:group-hover:text-blue-400 transition-colors">
                              {channel.name}
                            </h3>
                            {channel.badge && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#faf7f0] dark:bg-slate-800 text-[#0f2b5c] dark:text-blue-400 border border-[#eee8dd] dark:border-slate-700 shrink-0">
                                {channel.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#8a857e] dark:text-slate-400 mt-0.5 line-clamp-1">
                            {channel.description}
                          </p>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-[#faf7f0] dark:bg-slate-800 flex items-center justify-center text-[#8a857e] group-hover:text-[#0f2b5c] dark:group-hover:text-blue-400 group-hover:bg-[#0f2b5c]/10 transition-colors shrink-0">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Coordinates preview */}
                    {channel.addressValue && (
                      <div className="p-2.5 rounded-xl bg-[#faf8f5] dark:bg-slate-800/60 border border-[#eee8dd] dark:border-slate-800 text-xs">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e] dark:text-slate-400 truncate">
                          {channel.addressLabel || t('funding_coords_label')}
                        </p>
                        <p className="font-mono text-xs text-[#1a1a1a] dark:text-slate-200 font-semibold truncate mt-0.5">
                          {channel.addressValue}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="p-4 rounded-2xl bg-[#faf7f0] dark:bg-slate-900 border border-[#eee8dd] dark:border-slate-800 flex items-center gap-3 text-xs text-[#666] dark:text-slate-400">
        <ShieldCheck className="w-5 h-5 text-[#0f2b5c] dark:text-blue-400 shrink-0" />
        <p>
          {t('funding_security_note')}
        </p>
      </div>
    </div>
  );
}
