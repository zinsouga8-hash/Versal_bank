import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../lib/AuthContext';
import { 
  getClientProfileByEmailOrId, 
  saveMovementToSupabase, 
  fetchFundingChannels, 
  subscribeToBankData, 
  DEFAULT_FUNDING_CHANNELS 
} from '../lib/supabaseBankService';
import { useI18n } from '../lib/i18n';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  QrCode,
  ShieldCheck,
  Clock,
  Loader2,
} from 'lucide-react';
import { ClientAccount } from '../types';
import { notifyDepositSubmitted } from '../lib/emailService';

export default function FundingForm() {
  const { channelId } = useParams();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [channels, setChannels] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('versalbank_channels_store');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_FUNDING_CHANNELS;
  });
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [senderName, setSenderName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadChannels = async () => {
      try {
        const list = await fetchFundingChannels();
        if (mounted && Array.isArray(list) && list.length > 0) {
          setChannels(list);
        }
      } catch (e) {
        console.warn('Channels load error in form:', e);
      }
    };

    loadChannels();

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('versalbank_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'channels_updated' && Array.isArray(event.data.channels)) {
          setChannels(event.data.channels);
        } else {
          loadChannels();
        }
      };
    } catch (_) {}

    const handleChannelsUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setChannels(e.detail);
      } else {
        loadChannels();
      }
    };

    const unsub = subscribeToBankData(loadChannels);
    window.addEventListener('versalbank_channels_updated', handleChannelsUpdate);
    window.addEventListener('versalbank_update', loadChannels);
    window.addEventListener('storage', loadChannels);
    window.addEventListener('focus', loadChannels);

    return () => {
      mounted = false;
      unsub();
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
      window.removeEventListener('versalbank_channels_updated', handleChannelsUpdate);
      window.removeEventListener('versalbank_update', loadChannels);
      window.removeEventListener('storage', loadChannels);
      window.removeEventListener('focus', loadChannels);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const email = user.email || '';
    const uid = user.uid || (user as any)?.id;
    getClientProfileByEmailOrId(email || uid).then((data) => {
      if (data) setAccount(data);
    });
  }, [user]);

  const channel = channels.find((c) => c.id === channelId) || DEFAULT_FUNDING_CHANNELS.find((c) => c.id === channelId);

  if (!channel) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-[#8a857e] dark:text-slate-400">
          {lang === 'en' ? 'Deposit method not found.' : 'Moyen de recharge introuvable.'}
        </p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/espace/approvisionnement">
            {t('funding_form_back')}
          </Link>
        </Button>
      </div>
    );
  }

  const isCrypto = Boolean(
    channel.isCrypto || 
    channel.category?.toLowerCase().includes('crypto') || 
    channel.id === 'usdt-trc20' || 
    channel.id === 'bitcoin'
  );

  const coords = {
    addressLabel: channel.addressLabel || (isCrypto ? (lang === 'en' ? 'Deposit Address' : 'Adresse de dépôt') : (lang === 'en' ? 'Deposit Coordinates' : 'Coordonnées de dépôt')),
    addressValue: channel.addressValue || 'contact@versalbank.com',
    notes: channel.notes || channel.description || (lang === 'en' ? 'Transfer funds using the coordinates below. Mention your name and client account number.' : 'Transférez les fonds selon les coordonnées ci-dessous. Mentionnez votre nom et identifiant client.'),
    isCrypto,
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t('funding_coords_copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error(lang === 'en' ? 'Please enter a valid amount.' : 'Veuillez saisir un montant valide.');
      return;
    }
    if (!reference.trim()) {
      toast.error(lang === 'en' ? 'Please provide the transaction hash or deposit reference.' : 'Veuillez renseigner le hash de transaction ou la référence du dépôt.');
      return;
    }

    setSubmitting(true);
    try {
      await saveMovementToSupabase({
        account_id: user?.uid || (user as any)?.id || '',
        client_id: account?.client_id || '',
        client_email: user?.email || '',
        user_email: user?.email || '',
        kind: 'deposit',
        direction: 'credit',
        method: channel.name,
        amount: amountVal,
        currency: account?.currency || 'EUR',
        reference: `REC-${Math.floor(10000000 + Math.random() * 90000000)}`,
        beneficiary_details: JSON.stringify({
          channel_id: channel.id,
          deposit_reference: reference.trim(),
          sender_name: senderName.trim() || account?.first_name,
        }),
        motif: `Recharge ${channel.name}`,
        description: `Recharge ${channel.name}`,
        status: 'pending',
        createdAt: Date.now(),
      });

      notifyDepositSubmitted({
        user_email: user?.email || '',
        first_name: account?.first_name || '',
        amount: amountVal,
        currency: account?.currency || 'EUR',
        channel_name: channel.name,
        reference: reference.trim(),
        language: (account?.language as any) || (lang as any) || 'fr',
      }).catch((e) => console.warn('Email notice:', e));

      toast.success(t('funding_form_success'));
      navigate('/espace/tableau-de-bord');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Error saving deposit request.' : 'Erreur lors de l’enregistrement de la recharge.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/espace/approvisionnement"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#8a857e] hover:text-[#0f2b5c] dark:hover:text-blue-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('funding_form_back')}
      </Link>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-[#eee8dd] dark:border-slate-800 shadow-xs space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-[#eee8dd] dark:border-slate-800 pb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center border text-xl font-bold bg-[#0f2b5c]/10 dark:bg-blue-500/10 text-[#0f2b5c] dark:text-blue-400 border-[#0f2b5c]/20 dark:border-blue-500/20">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading font-serif text-2xl font-bold text-[#1a1a1a] dark:text-white">
                {lang === 'en' ? `Deposit via ${channel.name}` : `Recharge par ${channel.name}`}
              </h1>
              {channel.badge && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#faf7f0] dark:bg-slate-800 text-[#0f2b5c] dark:text-blue-400 border border-[#eee8dd] dark:border-slate-700">
                  {channel.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-[#8a857e] dark:text-slate-400 mt-0.5">{channel.description}</p>
          </div>
        </div>

        {/* Deposit Instructions Card */}
        <div className="p-5 rounded-2xl bg-[#faf8f5] dark:bg-slate-800/60 border border-[#eee8dd] dark:border-slate-800 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0f2b5c] dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-[#666] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{coords.notes}</p>
          </div>

          {/* If Crypto, show a styled QR Code */}
          {coords.isCrypto && (
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-[#eee8dd] dark:border-slate-700 flex flex-col items-center justify-center gap-3">
              <div className="w-32 h-32 bg-[#131720] text-white rounded-xl flex flex-col items-center justify-center p-3">
                <QrCode className="w-20 h-20 text-blue-400" />
                <span className="text-[9px] uppercase tracking-wider text-blue-300 font-semibold mt-1">
                  {lang === 'en' ? 'Scan to Pay' : 'Scanner pour payer'}
                </span>
              </div>
            </div>
          )}

          {/* Copyable Address / IBAN Box */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-[#8a857e] dark:text-slate-400 uppercase tracking-wider">
              {coords.addressLabel}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={coords.addressValue}
                className="font-mono text-xs sm:text-sm bg-white dark:bg-slate-900 rounded-xl h-11 border-[#eee8dd] dark:border-slate-700 text-[#1a1a1a] dark:text-white"
              />
              <Button
                type="button"
                onClick={() => handleCopy(coords.addressValue)}
                className="h-11 px-4 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white shrink-0 gap-1.5 text-xs font-semibold cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                {copied ? t('funding_copied') : t('funding_copy')}
              </Button>
            </div>
          </div>
        </div>

        {/* Declaration Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="funding-amount" className="text-xs font-semibold text-[#1a1a1a] dark:text-white">
              {t('funding_form_amount')} ({account?.currency || 'EUR'})
            </Label>
            <Input
              id="funding-amount"
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 1000"
              required
              className="rounded-xl h-11 text-base font-semibold border-[#eee8dd] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="funding-ref" className="text-xs font-semibold text-[#1a1a1a] dark:text-white">
              {coords.isCrypto
                ? (lang === 'en' ? 'Transaction Hash (TxID) / Transfer ID *' : 'Hash de transaction (TxID) / ID de transfert *')
                : (lang === 'en' ? 'Transaction Number / Wire Reference / MTCN *' : 'Numéro de transaction / Référence du virement / MTCN *')}
            </Label>
            <Input
              id="funding-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={coords.isCrypto ? 'Ex: 7a8f9c2d1e0...' : 'Ex: VIR-84920194 ou MTCN #...'}
              required
              className="rounded-xl h-11 font-mono text-sm border-[#eee8dd] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="funding-sender" className="text-xs font-semibold text-[#1a1a1a] dark:text-white">
              {lang === 'en' ? 'Sender Name (account holder or source wallet)' : "Nom de l'émetteur (titulaire du compte ou wallet source)"}
            </Label>
            <Input
              id="funding-sender"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder={`${account?.first_name || ''} ${account?.last_name || ''}`}
              className="rounded-xl h-11 text-sm border-[#eee8dd] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="p-4 rounded-xl bg-[#faf7f0] dark:bg-slate-800/50 border border-[#eee8dd] dark:border-slate-800 flex items-center gap-3 text-xs text-[#666] dark:text-slate-400">
            <Clock className="w-4 h-4 text-[#0f2b5c] dark:text-blue-400 shrink-0" />
            <span>
              {lang === 'en'
                ? 'After submitting your declaration, our Treasury department will reconcile funds and credit your primary balance within 15 minutes to 2 business hours.'
                : 'Après validation de votre déclaration, le département Trésorerie rapprochera les fonds et créditera votre solde principal sous un délai de 15 minutes à 2 heures ouvrées.'}
            </span>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white font-semibold text-sm shadow-sm cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t('funding_form_submitting')}
              </>
            ) : (
              t('funding_form_submit')
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
