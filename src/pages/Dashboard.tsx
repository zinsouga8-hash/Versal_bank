import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  getClientProfileByEmailOrId, 
  fetchMovementsFromSupabase, 
  fetchTransactionsFromSupabase,
  subscribeToBankData 
} from '../lib/supabaseBankService';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/ThemeContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ClientAccount, Movement } from '../types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Send,
  Download,
  CreditCard,
  Banknote,
  FileText,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Activity,
  Hand,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import BankMonogram from '../components/public/BankMonogram';
import TransactionReceiptModal from '../components/portal/TransactionReceiptModal';

export default function Dashboard() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const { isDark } = useTheme();
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [copiedIban, setCopiedIban] = useState(false);
  const [selectedReceiptMovement, setSelectedReceiptMovement] = useState<Movement | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementDirectionFilter, setMovementDirectionFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Live GMT Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    // Multi-key helper to read cached movements strictly for this client
    const userEmail = (user.email || '').trim().toLowerCase();
    const cacheKey = `versalbank_cached_movements_${userEmail}`;

    const isClientMovement = (m: any, clientId?: string): boolean => {
      if (!m) return false;
      const mEmail = (m.client_email || m.user_email || '').trim().toLowerCase();
      if (mEmail) return mEmail === userEmail;
      if (clientId && m.client_id) return String(m.client_id).trim() === String(clientId).trim();
      if (user.uid && m.account_id) return m.account_id === user.uid;
      return false;
    };

    const getExistingCachedMovements = (clientId?: string): Movement[] => {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            return list.filter((m) => isClientMovement(m, clientId));
          }
        }
      } catch (_) {}

      try {
        const raw = localStorage.getItem('versalbank_movements_store');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            return list.filter((m) => isClientMovement(m, clientId));
          }
        }
      } catch (_) {}

      return [];
    };

    // 1. Initial instant load from client cache
    const initialCached = getExistingCachedMovements();
    if (initialCached.length > 0) {
      setMovements(initialCached);
    }

    const loadDashboardData = async () => {
      try {
        const email = (user.email || '').trim().toLowerCase();
        const uid = user.uid || (user as any)?.id;
        const profile = await getClientProfileByEmailOrId(email || uid);
        if (profile && isMounted) {
          setAccount(profile);
        }

        const activeClientId = profile?.client_id;

        if (email) {
          const [moves, txs] = await Promise.all([
            fetchMovementsFromSupabase(email),
            fetchTransactionsFromSupabase(email),
          ]);

          const movesMap = new Map<string, Movement>();

          // First, seed with all current cached movements strictly for this client
          const existingList = getExistingCachedMovements(activeClientId);
          existingList.forEach((m) => {
            const k = m.reference || m.id;
            if (k && isClientMovement(m, activeClientId)) movesMap.set(k, m);
          });

          // Overlay current in-memory state movements if any
          setMovements((prev) => {
            prev.forEach((m) => {
              const k = m.reference || m.id;
              if (k && isClientMovement(m, activeClientId) && !movesMap.has(k)) movesMap.set(k, m);
            });
            return prev;
          });

          // Then overlay fetched movements from server/supabase strictly for this client
          (moves || []).forEach((m) => {
            if (isClientMovement(m, activeClientId)) {
              const k = m.reference || m.id;
              if (k) movesMap.set(k, { ...movesMap.get(k), ...m });
            }
          });

          // Overlay transactions strictly for this client
          (txs || []).forEach((t: any) => {
            const tEmail = (t.client_email || t.user_email || '').trim().toLowerCase();
            const tClientId = t.client_id;
            const belongs = (!tEmail && !tClientId) || tEmail === email || (activeClientId && tClientId === activeClientId);
            if (belongs) {
              const key = t.reference || t.id;
              if (key) {
                const existing = movesMap.get(key);
                movesMap.set(key, {
                  ...existing,
                  id: t.id || existing?.id,
                  account_id: t.account_id || existing?.account_id || profile?.client_id || '',
                  client_id: t.client_id || existing?.client_id || profile?.client_id || '',
                  client_email: email,
                  user_email: email,
                  reference: t.reference || t.id || existing?.reference,
                  amount: Math.abs(Number(t.amount) || existing?.amount || 0),
                  currency: t.currency || profile?.currency || 'CAD',
                  direction: t.direction || (Number(t.amount) >= 0 ? 'credit' : 'debit'),
                  kind: t.kind || (t.type === 'deposit' ? 'deposit' : 'transfer'),
                  method: t.method || existing?.method || (t.kind === 'loan_credit' ? 'Prêt bancaire' : 'Virement'),
                  beneficiary_name: t.beneficiary_name || t.recipient_name || existing?.beneficiary_name,
                  motif: t.motif || t.description || existing?.motif || 'Opération bancaire',
                  description: t.description || t.motif || existing?.description || 'Opération bancaire',
                  status: t.status || existing?.status || 'completed',
                  createdAt: typeof t.createdAt === 'number' ? t.createdAt : (t.created_at ? new Date(t.created_at).getTime() : (existing?.createdAt || Date.now())),
                });
              }
            }
          });

          const allMovements = Array.from(movesMap.values())
            .filter((m) => isClientMovement(m, activeClientId))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

          if (isMounted) {
            setMovements(allMovements);
            try {
              localStorage.setItem(cacheKey, JSON.stringify(allMovements));
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn("Dashboard data fetch notice:", err);
      }
    };

    loadDashboardData();

    // Safety fallback: if no account found after 2s, create provisional account state
    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setAccount((prev) => {
          if (prev) return prev;
          return {
            uid: user.uid,
            user_email: user.email || '',
            first_name: user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Client',
            last_name: user.displayName?.split(' ').slice(1).join(' ') || '',
            client_id: 'CL-' + (user.uid || '0000').slice(0, 6).toUpperCase(),
            account_number: 'CA81847065209',
            iban: 'CA98VERSAL00992101',
            bic: 'VERSCA2TMTR',
            balance: 0,
            currency: 'CAD',
            account_active: false,
            status: 'pending',
            createdAt: Date.now(),
          };
        });
      }
    }, 2000);

    const unsubscribe = subscribeToBankData(() => {
      if (isMounted) {
        loadDashboardData();
      }
    });

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('versalbank_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'movements_updated' || event.data?.type === 'data_changed') {
          if (isMounted) loadDashboardData();
        }
      };
    } catch (_) {}

    const handleMovementsUpdated = () => {
      if (isMounted) {
        loadDashboardData();
      }
    };
    window.addEventListener('versalbank_movements_updated', handleMovementsUpdated);
    window.addEventListener('versalbank_update', handleMovementsUpdated);
    window.addEventListener('storage', handleMovementsUpdated);
    window.addEventListener('focus', handleMovementsUpdated);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      unsubscribe();
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
      window.removeEventListener('versalbank_movements_updated', handleMovementsUpdated);
      window.removeEventListener('versalbank_update', handleMovementsUpdated);
      window.removeEventListener('storage', handleMovementsUpdated);
      window.removeEventListener('focus', handleMovementsUpdated);
    };
  }, [user]);

  const currencySymbol = (account?.currency || 'CAD').toUpperCase();

  const formatCurrency = (amount: number, currency: string = currencySymbol) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || currencySymbol,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const copyIban = (iban: string) => {
    navigator.clipboard.writeText(iban);
    setCopiedIban(true);
    toast.success(lang === 'en' ? 'IBAN copied to clipboard' : 'IBAN copié dans le presse-papier');
    setTimeout(() => setCopiedIban(false), 2000);
  };

  // Date & Time formatting depending on language
  const formattedDay = lang === 'en'
    ? format(currentTime, 'EEEE, MMMM dd, yyyy')
    : format(currentTime, 'EEEE dd MMMM yyyy', { locale: fr });
  const capitalizedDate = formattedDay.charAt(0).toUpperCase() + formattedDay.slice(1);
  const formattedTimeGmt = lang === 'en'
    ? `${format(currentTime, 'HH:mm:ss')} GMT`
    : `${format(currentTime, 'HH')} h ${format(currentTime, 'mm')} min ${format(currentTime, 'ss')} s GMT`;

  // Calculate totals
  const totalCredits = movements
    .filter((m) => m.direction === 'credit' && m.status === 'completed')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalDebits = movements
    .filter((m) => m.direction === 'debit')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Active timeframe selector: 1W (1 Semaine), 1M (1 Mois), 3M (3 Mois), 1Y (1 An), ALL (Tout)
  const [timeframe, setTimeframe] = useState<'1W' | '1M' | '3M' | '1Y' | 'ALL'>('1M');

  // Balance & dynamic asset history chart
  const userBalance = Number(account?.balance) || 0;

  const { chartData, peakBalance, lowBalance, netChange, netChangePercent, periodInflows, periodOutflows } = useMemo(() => {
    const currentBal = Number(account?.balance) || 0;
    const now = Date.now();

    let daysBack = 30;
    if (timeframe === '1W') daysBack = 7;
    else if (timeframe === '1M') daysBack = 30;
    else if (timeframe === '3M') daysBack = 90;
    else if (timeframe === '1Y') daysBack = 365;
    else if (timeframe === 'ALL') daysBack = 730;

    const cutoffTime = now - daysBack * 24 * 3600 * 1000;

    // Filter relevant completed movements
    const relevantMovements = movements
      .filter((m) => m.status === 'completed' || !m.status)
      .map((m) => {
        const timeVal = m.date ? new Date(m.date).getTime() : (m.created_at ? new Date(m.created_at).getTime() : now);
        return {
          ...m,
          time: isNaN(timeVal) ? now : timeVal,
        };
      })
      .sort((a, b) => a.time - b.time);

    // Period Inflow / Outflow calculation
    const periodMovements = relevantMovements.filter((m) => m.time >= cutoffTime);
    const periodInflows = periodMovements
      .filter((m) => m.direction === 'credit' || m.kind === 'deposit' || m.kind === 'admin_credit')
      .reduce((acc, m) => acc + Math.abs(Number(m.amount) || 0), 0);
    const periodOutflows = periodMovements
      .filter((m) => m.direction === 'debit' || m.kind === 'transfer')
      .reduce((acc, m) => acc + Math.abs(Number(m.amount) || 0), 0);

    const numPoints = daysBack <= 7 ? 8 : (daysBack <= 30 ? 12 : 14);
    const intervalMs = (now - cutoffTime) / (numPoints - 1);
    const points: { date: string; fullDate: string; balance: number; timestamp: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
      const pointTime = cutoffTime + i * intervalMs;
      // Movements that occurred strictly AFTER pointTime
      const futureMovements = relevantMovements.filter((m) => m.time > pointTime);
      const futureNet = futureMovements.reduce((acc, m) => {
        const amt = Math.abs(Number(m.amount) || 0);
        const isCredit = m.direction === 'credit' || m.kind === 'deposit' || m.kind === 'admin_credit';
        return isCredit ? acc + amt : acc - amt;
      }, 0);

      const estimatedBal = Math.max(0, currentBal - futureNet);
      const dateLabel = format(new Date(pointTime), lang === 'en' ? 'MMM dd' : 'dd MMM', {
        locale: lang === 'fr' ? fr : undefined,
      });
      const fullDate = format(new Date(pointTime), lang === 'en' ? 'MMM dd, yyyy' : 'dd MMMM yyyy', {
        locale: lang === 'fr' ? fr : undefined,
      });

      points.push({
        date: dateLabel,
        fullDate,
        balance: Math.round(estimatedBal * 100) / 100,
        timestamp: pointTime,
      });
    }

    // Anchor the very last point to the exact live current balance
    if (points.length > 0) {
      points[points.length - 1].balance = currentBal;
      points[points.length - 1].date = lang === 'en' ? 'Today' : "Aujourd'hui";
      points[points.length - 1].fullDate = lang === 'en' ? 'Live Today' : 'Aujourd’hui (En direct)';
    }

    const balances = points.map((p) => p.balance);
    const peak = Math.max(...balances, currentBal);
    const low = Math.min(...balances, currentBal);
    const startBal = points[0]?.balance ?? currentBal;
    const change = currentBal - startBal;
    const changePct = startBal > 0 ? (change / startBal) * 100 : (change > 0 ? 100 : 0);

    return {
      chartData: points,
      peakBalance: peak,
      lowBalance: low,
      netChange: change,
      netChangePercent: changePct,
      periodInflows,
      periodOutflows,
    };
  }, [account?.balance, movements, timeframe, lang]);

  if (!account) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-10 w-48 bg-[#eee8dd] rounded-xl"></div>
        <div className="h-56 bg-[#eee8dd] rounded-3xl w-full"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[#eee8dd] rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  const ibanDisplay = account.iban || 'CA98VERSAL00992101';
  const rawBic = (account.bic || '').trim();
  const bicDisplay = (rawBic && !rawBic.endsWith('XXX')) 
    ? rawBic 
    : (rawBic ? rawBic.replace(/XXX$/, 'MTR') : 'VERSCA2TMTR');
  const accountNumberDisplay = account.account_number || '81847065209';

  return (
    <div className="space-y-8">
      {/* Receipt Modal */}
      <TransactionReceiptModal
        movement={selectedReceiptMovement}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
      />

      {/* Top Header & Live GMT Clock */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0f2b5c] mb-1">
            {t('accounts_label')}
          </p>
          <h1 className="font-heading font-serif text-3xl sm:text-4xl text-[#1a1a1a] font-normal">
            {t('hello_greeting', { name: account.first_name || '' })}
          </h1>
        </div>

        {/* Live Clock Card */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white border border-[#eee8dd] shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#0f2b5c]/10 flex items-center justify-center text-[#0f2b5c] shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-[#1a1a1a] leading-tight">
              {formattedTimeGmt}
            </p>
            <p className="text-[11px] text-[#8a857e] leading-tight mt-0.5">{capitalizedDate}</p>
          </div>
        </div>
      </div>

      {/* Luxury Black Solde Card (Matches Capture 69!) */}
      <div className="relative rounded-3xl bg-[#131720] text-white p-6 sm:p-8 shadow-2xl overflow-hidden border border-[#232936]">
        {/* Subtle Background Elements */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#0f2b5c]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-6 right-6 opacity-30">
          <BankMonogram className="w-16 h-16" />
        </div>

        <div className="relative z-10 space-y-6">
          {/* Header row: Label + Eye toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-[0.2em] text-white/70 font-semibold">
                {t('available_balance')}
              </span>
            </div>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors self-start sm:self-auto"
              title={showBalance ? t('hide_balance') : t('view_balance')}
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Balance Display */}
          <div className="text-4xl sm:text-5xl font-bold text-white tracking-tight solde-banque">
            {showBalance ? formatCurrency(account.balance, currencySymbol) : `•••••••• ${currencySymbol}`}
          </div>

          {/* Account Details row */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                {t('account_number')}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-white text-sm font-semibold">{accountNumberDisplay}</span>
                 
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                  {t('iban')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-white/90 text-xs sm:text-sm truncate">
                    {ibanDisplay}
                  </span>
                  <button
                    onClick={() => copyIban(ibanDisplay)}
                    className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    title={t('copy_iban')}
                  >
                    {copiedIban ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                  {t('bic')}
                </p>
                <p className="font-mono text-white font-semibold text-sm mt-1">{bicDisplay}</p>
                {/* Statut ACTIF (en vert) ou INACTIF (en rouge) du compte client en petite taille ecrit juste en dessous du code BIC */}
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${account.account_active ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50' : 'bg-red-400 animate-pulse shadow-xs shadow-red-400/50'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${account.account_active ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {account.account_active 
                      ? (lang === 'en' ? 'ACTIVE' : 'ACTIF') 
                      : (lang === 'en' ? 'INACTIVE' : 'INACTIF')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Quick Actions Grid (Virement, Recharge, Cartes, Financement) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Link
          to="/espace/virement"
          className="group p-4 sm:p-5 rounded-2xl bg-white border border-[#eee8dd] hover:border-[#0f2b5c]/40 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-[#0f2b5c]/10 group-hover:bg-[#0f2b5c] text-[#0f2b5c] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a1a1a] group-hover:text-[#0f2b5c] transition-colors">
              {t('transfer_money')}
            </p>
            <p className="text-[11px] text-[#8a857e]">{t('send_funds')}</p>
          </div>
        </Link>

        <Link
          to="/espace/approvisionnement"
          className="group p-4 sm:p-5 rounded-2xl bg-white border border-[#eee8dd] hover:border-[#0f2b5c]/40 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-[#0f2b5c]/10 group-hover:bg-[#0f2b5c] text-[#0f2b5c] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a1a1a] group-hover:text-[#0f2b5c] transition-colors">
              {t('recharge_account')}
            </p>
            <p className="text-[11px] text-[#8a857e]">{t('fund_balance')}</p>
          </div>
        </Link>

        <Link
          to="/espace/cartes"
          className="group p-4 sm:p-5 rounded-2xl bg-white border border-[#eee8dd] hover:border-[#0f2b5c]/40 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-[#0f2b5c]/10 group-hover:bg-[#0f2b5c] text-[#0f2b5c] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a1a1a] group-hover:text-[#0f2b5c] transition-colors">
              {t('cards_menu')}
            </p>
            <p className="text-[11px] text-[#8a857e]">{t('card_management')}</p>
          </div>
        </Link>

        <Link
          to="/espace/financement"
          className="group p-4 sm:p-5 rounded-2xl bg-white border border-[#eee8dd] hover:border-[#0f2b5c]/40 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-[#0f2b5c]/10 group-hover:bg-[#0f2b5c] text-[#0f2b5c] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a1a1a] group-hover:text-[#0f2b5c] transition-colors">
              {t('financing_menu')}
            </p>
            <p className="text-[11px] text-[#8a857e]">{t('fixed_rate_loans')}</p>
          </div>
        </Link>
      </div>

      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#eee8dd] shadow-xs">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
            {t('executed_credits')}
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1 solde-banque">
            {formatCurrency(totalCredits > 0 ? totalCredits : account.balance, account.currency)}
          </p>
          <p className="text-[11px] text-[#8a857e] mt-1">{t('funds_credited')}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#eee8dd] shadow-xs">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
            {t('executed_debits')}
          </p>
          <p className="text-2xl font-bold text-[#1a1a1a] mt-1 solde-banque">
            {formatCurrency(totalDebits, account.currency)}
          </p>
          <p className="text-[11px] text-[#8a857e] mt-1">{t('outflows_transfers')}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#eee8dd] shadow-xs">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
            {t('movements_count')}
          </p>
          <p className="text-2xl font-bold text-[#0f2b5c] mt-1 solde-banque">
            {movements.length}
          </p>
          <p className="text-[11px] text-[#8a857e] mt-1">{t('registered_operations')}</p>
        </div>
      </div>

      {/* Evolution Graph & Suivi des Mouvements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph Card - Pro Digital Treasury Terminal */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-[#eee8dd] shadow-xs flex flex-col justify-between">
          <div>
            {/* Header with Title & Period Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono">
                    {lang === 'en' ? 'LIVE DIGITAL TELEMETRY • CANAFE / FINTRAC' : 'TÉLÉMÉTRIE EN DIRECT • CANAFE / FINTRAC'}
                  </span>
                </div>
                <h3 className="font-heading font-serif text-lg sm:text-xl font-bold text-[#1a1a1a] mt-1.5 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#0f2b5c]" />
                  {t('treasury_evolution')}
                </h3>
                <p className="text-xs text-[#8a857e] mt-0.5">
                  {lang === 'en' 
                    ? 'Dynamic trajectory of consolidated client assets and liquid reserves.' 
                    : 'Trajectoire dynamique des actifs consolidés et des réserves liquides.'}
                </p>
              </div>

              {/* Timeframe pill selector */}
              <div className="flex items-center bg-[#faf8f5] p-1 rounded-xl border border-[#eee8dd] self-start sm:self-auto shadow-2xs">
                {(['1W', '1M', '3M', '1Y', 'ALL'] as const).map((tf) => {
                  const labels: Record<string, string> = {
                    '1W': lang === 'en' ? '7D' : '1S',
                    '1M': '1M',
                    '3M': '3M',
                    '1Y': lang === 'en' ? '1Y' : '1A',
                    'ALL': lang === 'en' ? 'ALL' : 'TOUT',
                  };
                  const active = timeframe === tf;
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer font-mono ${
                        active
                          ? 'bg-[#0f2b5c] text-white shadow-xs'
                          : 'text-[#8a857e] hover:text-[#1a1a1a] hover:bg-white/70'
                      }`}
                    >
                      {labels[tf]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* High-Tech Digital KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 p-3.5 sm:p-4 bg-gradient-to-br from-[#faf8f5] to-[#f4efe6] rounded-2xl border border-[#eee8dd] mb-4 shadow-2xs">
              <div>
                <p className="text-[10px] font-semibold text-[#8a857e] uppercase tracking-wider">
                  {lang === 'en' ? 'Current Assets' : 'Actifs en cours'}
                </p>
                <p className="text-base sm:text-lg font-bold text-[#0f2b5c] mt-0.5 truncate font-mono solde-banque">
                  {showBalance ? formatCurrency(userBalance, account.currency) : '••••••'}
                </p>
                <span className="text-[9px] text-emerald-700 font-medium">
                  {lang === 'en' ? '100% Liquid' : '100% Disponible'}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#8a857e] uppercase tracking-wider">
                  {lang === 'en' ? 'Period Net Delta' : 'Variation Période'}
                </p>
                <p
                  className={`text-sm sm:text-base font-bold mt-0.5 flex items-center gap-1 truncate font-mono ${
                    netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {netChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {netChange >= 0 ? '+' : ''}
                    {netChangePercent.toFixed(1)}%
                  </span>
                </p>
                <span className="text-[9px] text-[#8a857e] font-mono">
                  {netChange >= 0 ? '+' : ''}{formatCurrency(netChange, account.currency)}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#8a857e] uppercase tracking-wider">
                  {lang === 'en' ? 'Period Peak' : 'Plus-Haut Période'}
                </p>
                <p className="text-xs sm:text-sm font-bold text-[#1a1a1a] mt-0.5 truncate font-mono solde-banque">
                  {showBalance ? formatCurrency(peakBalance, account.currency) : '••••••'}
                </p>
                <span className="text-[9px] text-[#8a857e]">
                  {lang === 'en' ? 'Max valuation' : 'Valorisation max'}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#8a857e] uppercase tracking-wider">
                  {lang === 'en' ? 'Period Floor' : 'Plus-Bas Période'}
                </p>
                <p className="text-xs sm:text-sm font-bold text-[#1a1a1a] mt-0.5 truncate font-mono solde-banque">
                  {showBalance ? formatCurrency(lowBalance, account.currency) : '••••••'}
                </p>
                <span className="text-[9px] text-[#8a857e]">
                  {lang === 'en' ? 'Min valuation' : 'Valorisation min'}
                </span>
              </div>
            </div>

            {/* Inflow / Outflow micro strip */}
            <div className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-[#eee8dd] text-[11px] mb-4 text-[#8a857e] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{lang === 'en' ? 'Period Inflows:' : 'Entrées Période :'}</span>
                <span className="font-bold text-emerald-700 solde-banque">+{formatCurrency(periodInflows, account.currency)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>{lang === 'en' ? 'Period Outflows:' : 'Sorties Période :'}</span>
                <span className="font-bold text-rose-700 solde-banque">-{formatCurrency(periodOutflows, account.currency)}</span>
              </div>
            </div>
          </div>

          {/* Area Chart with dynamic readable Y-Axis and glowing Digital Gradient */}
          <div className="h-64 sm:h-72 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 15, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="proDigitalTreasuryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f2b5c" stopOpacity={0.35} />
                    <stop offset="60%" stopColor="#2563eb" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0f2b5c" />
                    <stop offset="50%" stopColor="#1d4ed8" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#222f42' : '#eee8dd'} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#8a857e', fontFamily: 'monospace' }}
                  dy={6}
                />
                <YAxis
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin * 0.90', 'dataMax * 1.08']}
                  tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#8a857e', fontFamily: 'monospace' }}
                  tickFormatter={(val: number) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (val >= 1000) return `${Math.round(val / 1000)}k$`;
                    return `${Math.round(val)}$`;
                  }}
                  width={52}
                />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload;
                    const val = item.balance;
                    const startBal = chartData[0]?.balance ?? val;
                    const diff = val - startBal;
                    const diffPct = startBal > 0 ? (diff / startBal) * 100 : 0;

                    return (
                      <div className="bg-[#0b1322] border border-[#1e293b] rounded-2xl p-3.5 shadow-2xl text-white min-w-[210px]">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2 border-b border-white/10 pb-2">
                          <span className="font-mono flex items-center gap-1.5 text-sky-400">
                            <Clock className="w-3 h-3" />
                            {item.fullDate || item.date}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                            {lang === 'en' ? 'LIVE SYNC' : 'EN DIRECT'}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                            {lang === 'en' ? 'Total Client Assets' : 'Actifs Totaux du Client'}
                          </p>
                          <p className="text-lg font-bold font-mono text-white mt-0.5 solde-banque text-emerald-400">
                            {formatCurrency(val, account.currency)}
                          </p>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-400">{lang === 'en' ? 'Delta vs start:' : 'Delta vs début :'}</span>
                          <span className={`font-bold flex items-center gap-0.5 ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {diff >= 0 ? '+' : ''}{formatCurrency(diff, account.currency)} ({diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="url(#strokeGradient)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#proDigitalTreasuryGrad)"
                  dot={{ r: 3, fill: '#0f2b5c', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2.5, stroke: '#ffffff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Suivi des Mouvements (Recent Transactions with Reçu button!) */}
        <div className="bg-white rounded-3xl p-6 border border-[#eee8dd] shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-serif text-lg font-bold text-[#1a1a1a]">
              {t('movements_monitoring')}
            </h3>
            <span className="text-xs text-[#8a857e]">
              {t('operations_count', { count: movements.length })}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#eee8dd] max-h-[340px] pr-1">
            {movements.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#faf7f0] border border-[#eee8dd] text-[#8a857e] mx-auto flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1a1a1a]">
                    {lang === 'en' ? 'No recent transactions' : 'Aucun mouvement pour le moment'}
                  </p>
                  <p className="text-[11px] text-[#8a857e] mt-0.5">
                    {lang === 'en'
                      ? 'Your transfers and credits will appear here once executed.'
                      : 'Vos virements et opérations apparaîtront ici dès leur exécution.'}
                  </p>
                </div>
              </div>
            ) : (
              movements.map((move) => {
                const isCredit = move.direction === 'credit' || move.kind === 'deposit' || move.kind === 'loan_credit' || move.kind === 'admin_credit';
                return (
                  <div key={move.reference || move.id} className="py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isCredit
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1a1a1a] truncate capitalize">
                          {move.motif || move.description || move.kind} {move.method ? `· ${move.method}` : ''}
                        </p>
                        <p className="text-[10px] text-[#8a857e] truncate font-mono">
                          {move.reference} {move.beneficiary_name ? `· ${move.beneficiary_name}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`text-xs font-bold solde-banque ${
                          isCredit ? 'text-emerald-600' : 'text-[#1a1a1a]'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {formatCurrency(move.amount, move.currency)}
                      </p>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border ${
                            move.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : move.status === 'rejected' || move.status === 'failed' || move.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {move.status === 'completed' 
                            ? (lang === 'en' ? 'COMPLETED' : 'COMPLÉTÉ') 
                            : move.status === 'rejected' || move.status === 'failed'
                            ? (lang === 'en' ? 'REJECTED' : 'REJETÉ')
                            : t('in_progress')}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedReceiptMovement(move);
                            setReceiptOpen(true);
                          }}
                          className="text-[10px] font-medium text-[#0f2b5c] hover:underline"
                        >
                          [{t('receipt_button')}]
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
