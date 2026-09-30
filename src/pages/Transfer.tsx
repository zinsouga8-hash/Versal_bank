import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { transferCarriers } from '../lib/transferCarriers';
import { useAuth } from '../lib/AuthContext';
import { useI18n } from '../lib/i18n';
import { getClientProfileByEmailOrId, subscribeToBankData } from '../lib/supabaseBankService';
import { ClientAccount } from '../types';
import {
  Send,
  ChevronRight,
  ShieldCheck,
  Building2,
  Wallet,
  Globe2,
  Coins,
  ArrowUpRight,
  Lock,
} from 'lucide-react';

export default function Transfer() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [account, setAccount] = useState<ClientAccount | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAccount = async () => {
      const email = user.email || '';
      const uid = user.uid || (user as any)?.id;
      const data = await getClientProfileByEmailOrId(email || uid);
      if (data) {
        setAccount(data);
      }
    };
    fetchAccount();
    const unsub = subscribeToBankData(() => {
      fetchAccount();
    });
    return () => unsub();
  }, [user]);

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getCarrierIcon = (carrierId: string) => {
    switch (carrierId) {
      case 'interac':
      case 'swift':
      case 'eft':
        return <Building2 className="w-5 h-5" />;
      case 'wise':
      case 'paypal':
      case 'skrill':
      case 'xe':
      case 'ofx':
      case 'paysend':
        return <Wallet className="w-5 h-5" />;
      case 'western-union':
      case 'moneygram':
      case 'remitly':
      case 'worldremit':
        return <Globe2 className="w-5 h-5" />;
      case 'usdt':
      case 'bitcoin':
        return <Coins className="w-5 h-5" />;
      default:
        return <Send className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header Row with Available Balance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0f2b5c] mb-1">
            {lang === 'en' ? 'Funds Transfer' : 'Virement de fonds'}
          </p>
          <h1 className="font-heading font-serif text-3xl sm:text-4xl text-[#1a1a1a] font-normal">
            {t('nav_transfer')}
          </h1>
          <p className="text-sm text-[#8a857e] mt-1 max-w-2xl">
            {lang === 'en'
              ? 'Choose a transfer method to enter recipient coordinates and confirm wire order.'
              : "Choisissez un moyen de transfert pour saisir les coordonnées du destinataire et confirmer l'ordre de virement."}
          </p>
        </div>

        {/* Solde Disponible Card */}
        <div className="bg-white p-4 rounded-2xl border border-[#eee8dd] shadow-xs flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#0f2b5c]/10 flex items-center justify-center text-[#0f2b5c] shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
              {t('available_balance')}
            </p>
            <p className="text-lg font-heading font-bold text-[#1a1a1a] leading-tight solde-banque">
              {formatCurrency(account?.balance ?? 0, account?.currency ?? 'CAD')}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of 15 Transfer Methods */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#1a1a1a] flex items-center gap-2">
          {lang === 'en' ? 'Select a transfer method' : 'Choisir un moyen de transfert'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {transferCarriers.map((carrier) => (
            <Link key={carrier.id} to={`/espace/virement/${carrier.id}`}>
              <div className="group h-full bg-white rounded-2xl p-4 border border-[#eee8dd] hover:border-[#0f2b5c]/50 hover:shadow-md transition-all flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105 ${carrier.color} ${carrier.textColor}`}
                  >
                    {getCarrierIcon(carrier.id)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm text-[#1a1a1a] group-hover:text-[#0f2b5c] transition-colors truncate">
                        {carrier.name}
                      </h3>
                      {carrier.badge && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-medium bg-[#faf7f0] text-[#8a857e] border border-[#eee8dd] shrink-0">
                          {carrier.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8a857e] truncate mt-0.5">
                      {carrier.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#ccc] group-hover:text-[#0f2b5c] group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Security notice banner */}
      <div className="p-4 rounded-2xl bg-[#faf8f5] border border-[#eee8dd] flex items-center gap-3 text-xs text-[#666] leading-relaxed">
        <Lock className="w-5 h-5 text-[#0f2b5c] shrink-0" />
        <p>
          <span className="font-semibold text-[#1a1a1a]">
            {lang === 'en' ? 'Secure Transactions' : 'Transactions sécurisées'}
          </span>
          {lang === 'en'
            ? ' — all transfers are encrypted and processed under FINTRAC security protocols. Never disclose your PIN code to anyone.'
            : ' — tous les transferts sont chiffrés et traités en toute sécurité selon les normes FINTRAC. Ne partagez jamais votre code PIN avec qui que ce soit.'}
        </p>
      </div>
    </div>
  );
}
