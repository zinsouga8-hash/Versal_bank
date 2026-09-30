import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  getClientProfileByEmailOrId, 
  fetchCardsFromSupabase, 
  saveCardToSupabase,
  saveClientToSupabase,
  saveTransactionToSupabase,
  subscribeToBankData,
  getBankSupportEmail 
} from '../lib/supabaseBankService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  CreditCard,
  Lock,
  Unlock,
  Plus,
  Wifi,
  Sparkles,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  Loader2,
  X,
  Eye,
  EyeOff,
  ArrowLeftRight,
  ArrowRight,
  Wallet
} from 'lucide-react';
import { VirtualCard, ClientAccount } from '../types';
import BankMonogram from '../components/public/BankMonogram';
import { notifyCardStatus, notifyCardShippingRequested, notifyCardRequested } from '../lib/emailService';
import { useI18n } from '../lib/i18n';

export default function Cards() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const isEn = lang === 'en';
  const [cards, setCards] = useState<(VirtualCard & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<ClientAccount | null>(null);

  // Card Creation Form state
  const [holderName, setHolderName] = useState('');
  const [network, setNetwork] = useState<'visa' | 'mastercard'>('visa');
  const [tier, setTier] = useState<'standard' | 'gold' | 'platinum'>('standard');
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Revealed CVC map for client
  const [revealedCvc, setRevealedCvc] = useState<Record<string, boolean>>({});

  // Transfer Modal state
  const [transferModalCard, setTransferModalCard] = useState<(VirtualCard & { id: string }) | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [processingTransfer, setProcessingTransfer] = useState(false);

  // Shipping Form Modal state
  const [shippingCard, setShippingCard] = useState<(VirtualCard & { id: string }) | null>(null);
  const [shippingForm, setShippingForm] = useState({
    recipient_name: '',
    address: '',
    city: '',
    postal_code: '',
    country: '',
    phone: '',
  });
  const [submittingShipping, setSubmittingShipping] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const email = user.email || '';
      const uid = user.uid || (user as any)?.id;
      const acc = await getClientProfileByEmailOrId(email || uid);
      if (acc) {
        setAccount(acc);
        if (!holderName) {
          setHolderName(`${acc.first_name || ''} ${acc.last_name || ''}`.trim().toUpperCase());
        }
      }

      const data = await fetchCardsFromSupabase(email);
      if (Array.isArray(data)) {
        setCards(data as any);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToBankData(() => {
      loadData();
    });
    const handleSync = () => {
      loadData();
    };
    window.addEventListener('versalbank_update', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      unsub();
      window.removeEventListener('versalbank_update', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [user]);

  const toggleCvcVisibility = (cardId: string) => {
    setRevealedCvc(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email || !account) return;
    setCreating(true);

    try {
      // Generate realistic 16-digit card number
      const generateNumber = () => {
        const prefix = network === 'visa' ? '4250' : '5320';
        let res = prefix + ' ';
        for (let i = 0; i < 3; i++) {
          let chunk = '';
          for (let j = 0; j < 4; j++) {
            chunk += Math.floor(Math.random() * 10).toString();
          }
          res += chunk + (i < 2 ? ' ' : '');
        }
        return res;
      };

      const dailyLimit = tier === 'platinum' ? 50000 : tier === 'gold' ? 12000 : 2500;
      const monthlyLimit = tier === 'platinum' ? 500000 : tier === 'gold' ? 100000 : 25000;
      const cvcVal = Math.floor(100 + Math.random() * 900).toString();

      const newCard: Partial<VirtualCard> = {
        account_id: user.uid,
        client_id: account.client_id || user.uid,
        client_email: user.email,
        user_email: user.email,
        holder_name: holderName.trim() || `${account.first_name} ${account.last_name}`.toUpperCase(),
        brand: network,
        tier: tier,
        number: generateNumber(),
        cvc: cvcVal,
        cvc_visible: false, // Bloqué jusqu'à ce que l'administrateur débloque la carte
        is_locked: true,    // Bloquée par défaut
        expiry: '09/30',
        daily_limit: dailyLimit,
        monthly_limit: monthlyLimit,
        balance: 0,
        status: 'inactive', // Demande inactive par défaut, en attente d'approbation par l'admin
        transfer_enabled: false, // Le bouton transférer est inactif jusqu'à activation par l'admin
        shipping_requested: false,
        shipment_step: 0,
        createdAt: Date.now(),
      };

      const cardId = `card_${Date.now()}`;
      const cardToSave = { id: cardId, ...newCard };
      await saveCardToSupabase(cardToSave as any);
      setCards([cardToSave as any, ...cards]);

      notifyCardRequested({
        user_email: user.email || '',
        first_name: account.first_name || '',
        card_type: tier,
        card_number: newCard.number || '4532000000001234',
        language: (account.language as any) || (isEn ? 'en' : 'fr'),
      }).catch((e) => console.warn('Card email notice:', e));

      toast.success(isEn ? "Card request submitted to administration successfully!" : "Demande de carte envoyée à l'administration avec succès !");
      setShowCreateForm(false);
    } catch (err) {
      console.error(err);
      toast.error(isEn ? 'Error creating card request.' : 'Erreur lors de la création de la carte.');
    } finally {
      setCreating(false);
    }
  };

  // Open Transfer Modal
  const openTransferModal = (card: VirtualCard & { id: string }) => {
    if (!card.transfer_enabled) {
      toast.error(isEn ? "The transfer button has not been enabled yet by administration for this card." : "Le bouton Transférer n'est pas encore activé par l'administrateur pour cette carte.");
      return;
    }
    setTransferModalCard(card);
    setTransferAmount('');
  };

  // Execute Transfer from Principal Balance to Card
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalCard || !account || !user) return;

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(isEn ? 'Please enter a valid amount greater than 0.' : 'Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    const availableBalance = Number(account.balance) || 0;
    if (amountNum > availableBalance) {
      toast.error(isEn ? `Insufficient main balance (${formatAmount(availableBalance)} available).` : `Solde principal insuffisant (${formatAmount(availableBalance)} disponible).`);
      return;
    }

    setProcessingTransfer(true);
    try {
      const newAccountBalance = availableBalance - amountNum;
      const newCardBalance = (Number(transferModalCard.balance) || 0) + amountNum;

      // 1. Update card balance
      const updatedCard = {
        ...transferModalCard,
        balance: newCardBalance,
      };
      await saveCardToSupabase(updatedCard as any);

      // 2. Update client account balance
      const updatedAccount = {
        ...account,
        balance: newAccountBalance,
      };
      await saveClientToSupabase(updatedAccount);

      // 3. Record transaction movement
      await saveTransactionToSupabase({
        user_id: user.uid,
        user_email: user.email || '',
        account_id: account.id,
        type: 'transfer',
        direction: 'debit',
        amount: -amountNum,
        currency: account.currency || 'CAD',
        description: isEn ? `Transfer to card ${transferModalCard.brand.toUpperCase()} •••• ${transferModalCard.number.slice(-4)}` : `Transfert vers carte ${transferModalCard.brand.toUpperCase()} •••• ${transferModalCard.number.slice(-4)}`,
        status: 'completed',
        date: new Date().toISOString(),
        created_at: Date.now(),
      });

      // Update local state
      setAccount(updatedAccount);
      setCards(cards.map(c => c.id === transferModalCard.id ? updatedCard : c));

      toast.success(isEn ? `Transfer of ${formatAmount(amountNum)} to your card completed successfully!` : `Transfert de ${formatAmount(amountNum)} vers votre carte effectué avec succès !`);
      setTransferModalCard(null);
      setTransferAmount('');
    } catch (err) {
      console.error(err);
      toast.error(isEn ? 'Error transferring funds to the card.' : 'Erreur lors du transfert de fonds vers la carte.');
    } finally {
      setProcessingTransfer(false);
    }
  };

  const openShippingModal = (card: VirtualCard & { id: string }) => {
    setShippingCard(card);
    const fullName = `${account?.first_name || ''} ${account?.last_name || ''}`.trim() || account?.full_name || '';
    setShippingForm({
      recipient_name: fullName,
      address: account?.address || '',
      city: account?.city || '',
      postal_code: account?.postal_code || '',
      country: account?.country || (isEn ? 'Canada' : 'Canada'),
      phone: account?.phone || '',
    });
  };

  const handleConfirmShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingCard) return;
    if (!shippingForm.address.trim() || !shippingForm.city.trim() || !shippingForm.country.trim()) {
      toast.error(isEn ? 'Please provide at least the address, city, and country of delivery.' : 'Veuillez renseigner au minimum l’adresse, la ville et le pays de livraison.');
      return;
    }

    setSubmittingShipping(true);
    try {
      const fullShippingAddress = `${shippingForm.address.trim()}, ${shippingForm.postal_code.trim()} ${shippingForm.city.trim()}, ${shippingForm.country.trim()}`;
      const updatedCard = {
        ...shippingCard,
        shipping_requested: true,
        shipment_step: 0,
        shipping_name: shippingForm.recipient_name.trim(),
        shipping_address: fullShippingAddress,
        shipping_phone: shippingForm.phone.trim(),
        shipping_requested_at: Date.now(),
      };

      await saveCardToSupabase(updatedCard as any);
      setCards(cards.map((c) => (c.id === shippingCard.id ? updatedCard : c)));

      // Send client confirmation AND admin notification
      await notifyCardShippingRequested({
        user_email: user?.email || '',
        first_name: account?.first_name || '',
        last_name: account?.last_name || '',
        client_id: account?.client_id || '',
        card_type: shippingCard.tier || 'standard',
        card_number: shippingCard.number || '•••• •••• •••• ••••',
        shipping_name: shippingForm.recipient_name.trim() || `${account?.first_name || ''} ${account?.last_name || ''}`,
        shipping_address: shippingForm.address.trim(),
        shipping_city: shippingForm.city.trim(),
        shipping_postal_code: shippingForm.postal_code.trim(),
        shipping_country: shippingForm.country.trim(),
        shipping_phone: shippingForm.phone.trim(),
        language: (account?.language as any) || (isEn ? 'en' : 'fr'),
      });

      toast.success(isEn ? 'Shipping request confirmed! An acknowledgment has been sent to your email.' : 'Demande de livraison confirmée ! Un accusé de réception vous a été envoyé par e-mail.');
      setShippingCard(null);
    } catch (e) {
      console.error(e);
      toast.error(isEn ? 'Error submitting card shipping request.' : 'Erreur lors de la demande de livraison.');
    } finally {
      setSubmittingShipping(false);
    }
  };

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: account?.currency || 'CAD',
      minimumFractionDigits: 2,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0f2b5c]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0f2b5c] mb-1">
            {isEn ? 'Cards & Payments' : 'Monétique & Paiements'}
          </p>
          <h1 className="font-heading font-serif text-3xl sm:text-4xl text-[#1a1a1a] font-normal">
            {isEn ? 'Bank Cards' : 'Cartes Bancaires'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isEn ? 'View your cards, reveal your CVC code, and top up from your main balance.' : 'Visualisez vos cartes, débloquez votre code CVC et rechargez depuis votre solde principal.'}
          </p>
        </div>

        {cards.length > 0 && !showCreateForm && (
          <Button
            onClick={() => setShowCreateForm(true)}
            className="rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white gap-2 text-xs font-semibold cursor-pointer h-10 px-4"
          >
            <Plus className="w-4 h-4" />
            {isEn ? 'Request a card' : 'Demander une carte'}
          </Button>
        )}
      </div>

      {/* Account Balance Strip */}
      {account && (
        <div className="bg-white border border-[#eee8dd] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f2b5c]/10 text-[#0f2b5c] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{isEn ? 'Main Account Balance' : 'Solde Principal du Compte'}</p>
              <p className="font-bold text-xl sm:text-2xl text-slate-900 font-mono solde-banque">
                {formatAmount(account.balance || 0)}
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right text-xs text-slate-500 font-mono">
            {isEn ? 'Account:' : 'Compte :'} {account.account_number || account.client_id}
          </div>
        </div>
      )}

      {/* If No cards or Show Form is active -> Creation Form */}
      {(cards.length === 0 || showCreateForm) && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#eee8dd] shadow-xs space-y-6">
          <div className="border-b border-[#eee8dd] pb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading font-serif text-xl font-bold text-[#1a1a1a]">
                {isEn ? 'Request a virtual card' : 'Demander une carte virtuelle'}
              </h2>
              <p className="text-xs text-[#8a857e] mt-1">
                {isEn
                  ? 'Card number, expiration date, and CVC are generated automatically. Upon approval, your advisor will unlock your card to reveal your CVC code.'
                  : "Le numéro, la date d'expiration et le code CVC sont générés automatiquement. Après approbation par l'administrateur, votre conseiller débloquera votre carte en 1 clic pour révéler votre code CVC."}
              </p>
            </div>
            {cards.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setShowCreateForm(false)}
                className="text-xs text-[#8a857e] cursor-pointer"
              >
                {isEn ? 'Cancel' : 'Annuler'}
              </Button>
            )}
          </div>

          <form onSubmit={handleCreateCard} className="space-y-6">
            {/* Nom du titulaire */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-[#8a857e]">
                {isEn ? 'Cardholder Full Name' : 'Nom complet du titulaire'}
              </Label>
              <Input
                value={holderName}
                onChange={(e) => setHolderName(e.target.value.toUpperCase())}
                placeholder="MARIANO JUDICAEL"
                required
                className="rounded-xl h-11 text-sm font-semibold uppercase tracking-wider"
              />
            </div>

            {/* Réseau */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-[#8a857e]">
                {isEn ? 'Payment Network' : 'Réseau de paiement'}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNetwork('visa')}
                  className={`p-3.5 rounded-2xl border text-center font-bold text-sm transition-all cursor-pointer ${
                    network === 'visa'
                      ? 'border-[#0f2b5c] bg-[#0f2b5c]/5 text-[#0f2b5c] shadow-xs'
                      : 'border-[#eee8dd] text-[#666] hover:bg-[#faf7f0]'
                  }`}
                >
                  VISA
                </button>
                <button
                  type="button"
                  onClick={() => setNetwork('mastercard')}
                  className={`p-3.5 rounded-2xl border text-center font-bold text-sm transition-all cursor-pointer ${
                    network === 'mastercard'
                      ? 'border-[#0f2b5c] bg-[#0f2b5c]/5 text-[#0f2b5c] shadow-xs'
                      : 'border-[#eee8dd] text-[#666] hover:bg-[#faf7f0]'
                  }`}
                >
                  Mastercard
                </button>
              </div>
            </div>

            {/* Niveau de carte */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-[#8a857e]">
                {isEn ? 'Card Tier' : 'Niveau de carte'}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Standard */}
                <button
                  type="button"
                  onClick={() => setTier('standard')}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    tier === 'standard'
                      ? 'border-[#0f2b5c] bg-[#0f2b5c]/5 shadow-xs'
                      : 'border-[#eee8dd] hover:bg-[#faf7f0]'
                  }`}
                >
                  <p className="font-bold text-sm text-[#1a1a1a]">Standard</p>
                  <div className="mt-3 space-y-1 text-[11px] text-[#666]">
                    <p>{isEn ? 'DAILY:' : 'JOURNALIER :'} <span className="font-semibold text-[#1a1a1a]">2 500,00 $</span></p>
                    <p>{isEn ? 'MONTHLY:' : 'MENSUEL :'} <span className="font-semibold text-[#1a1a1a]">25 000,00 $</span></p>
                  </div>
                </button>

                {/* Gold */}
                <button
                  type="button"
                  onClick={() => setTier('gold')}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    tier === 'gold'
                      ? 'border-[#0f2b5c] bg-[#0f2b5c]/5 shadow-xs'
                      : 'border-[#eee8dd] hover:bg-[#faf7f0]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-[#0f2b5c]">Gold</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#0f2b5c]/10 text-[#0f2b5c]">
                      {isEn ? 'Recommended' : 'Recommandé'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-[11px] text-[#666]">
                    <p>{isEn ? 'DAILY:' : 'JOURNALIER :'} <span className="font-semibold text-[#1a1a1a]">12 000,00 $</span></p>
                    <p>{isEn ? 'MONTHLY:' : 'MENSUEL :'} <span className="font-semibold text-[#1a1a1a]">100 000,00 $</span></p>
                  </div>
                </button>

                {/* Platinum */}
                <button
                  type="button"
                  onClick={() => setTier('platinum')}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    tier === 'platinum'
                      ? 'border-[#0f2b5c] bg-[#0f2b5c]/5 shadow-xs'
                      : 'border-[#eee8dd] hover:bg-[#faf7f0]'
                  }`}
                >
                  <p className="font-bold text-sm text-[#1a1a1a]">Platinum</p>
                  <div className="mt-3 space-y-1 text-[11px] text-[#666]">
                    <p>{isEn ? 'DAILY:' : 'JOURNALIER :'} <span className="font-semibold text-[#1a1a1a]">50 000,00 $</span></p>
                    <p>{isEn ? 'MONTHLY:' : 'MENSUEL :'} <span className="font-semibold text-[#1a1a1a]">500 000,00 $</span></p>
                  </div>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={creating}
              className="w-full h-12 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white font-medium text-sm gap-2 shadow-sm cursor-pointer"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {creating ? (isEn ? 'Submitting request...' : 'Transmission de la demande...') : (isEn ? '✨ Request my card' : '✨ Demander ma carte')}
            </Button>
          </form>
        </div>
      )}

      {/* Display Cards List */}
      {cards.map((card) => {
        const isCardActive = card.status === 'active';
        const isCvcUnlocked = Boolean(isCardActive && (card.cvc_visible !== false) && !card.is_locked);
        const isCvcCurrentlyRevealed = Boolean(revealedCvc[card.id]);
        const isInactive = card.status === 'inactive';
        const isApprovedLocked = card.status === 'approved' || (!isCardActive && card.is_locked && !isInactive);
        const isBlocked = card.status === 'blocked';
        const cvcDisplayValue = isCvcUnlocked
          ? (isCvcCurrentlyRevealed ? (card.cvc || (card as any).cvv || '123') : '•••')
          : '•••';

        return (
          <div key={card.id} className="space-y-6">
            {/* Physical Virtual Card UI */}
            <div className="max-w-md mx-auto relative rounded-3xl bg-gradient-to-br from-[#0c1938] via-[#09152e] to-[#050b17] text-white p-7 shadow-2xl border border-[#1e3a6e] overflow-hidden">
              {/* Background luxury overlay */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#1d4ed8]/20 rounded-full blur-2xl pointer-events-none" />

              {/* Top row: Bank Header + Tier */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2.5">
                  <BankMonogram className="w-7 h-7" />
                  <div>
                    <p className="font-heading font-serif font-bold text-sm tracking-wide text-white leading-tight">
                      VersalBank
                    </p>
                    <p className="text-[8px] uppercase tracking-[0.2em] text-[#93c5fd] font-semibold">
                      {isEn ? 'Canadian Bank' : 'Banque Canadienne'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-[#93c5fd] bg-white/10 px-2.5 py-0.5 rounded-full border border-[#93c5fd]/30">
                  {card.tier}
                </span>
              </div>

              {/* Metallic EMV Chip + Contactless Wave */}
              <div className="my-6 flex items-center justify-between relative z-10">
                {/* Golden metallic realistic chip */}
                <div className="w-11 h-8 rounded-lg bg-gradient-to-br from-[#f5d77f] via-[#d4af37] to-[#aa8010] p-1 border border-[#f5d77f]/50 shadow-inner flex flex-col justify-around">
                  <div className="h-[1px] bg-[#805e0c]/40 w-full" />
                  <div className="h-[1px] bg-[#805e0c]/40 w-full" />
                </div>
                <Wifi className="w-6 h-6 text-white/40 rotate-90" />
              </div>

              {/* Card Number */}
              <div className="relative z-10 mb-5">
                <p className="font-mono text-xl sm:text-2xl font-bold tracking-[0.18em] text-white/95 drop-shadow-sm">
                  {card.number}
                </p>
              </div>

              {/* Holder name, expiry, CVC, Network */}
              <div className="relative z-10 flex items-end justify-between text-xs pt-1 border-t border-white/10">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/50">{isEn ? 'Cardholder' : 'Titulaire'}</p>
                  <p className="font-semibold text-white tracking-wider text-xs uppercase mt-0.5 truncate max-w-[140px]">
                    {card.holder_name}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/50">{isEn ? 'Expires' : 'Expire'}</p>
                  <p className="font-mono text-white font-semibold text-xs mt-0.5">{card.expiry}</p>
                </div>

                {/* CVC Code Block with dynamic reveal / lock */}
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/50">CVC</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className={`font-mono font-bold text-xs ${isCvcUnlocked ? 'text-amber-300' : 'text-white/60'}`}>
                      {cvcDisplayValue}
                    </p>
                    {isCvcUnlocked ? (
                      <button
                        type="button"
                        onClick={() => toggleCvcVisibility(card.id)}
                        className="text-amber-300 hover:text-white cursor-pointer p-0.5"
                        title={isCvcCurrentlyRevealed ? (isEn ? "Hide CVC code" : "Masquer le code CVC") : (isEn ? "Reveal CVC code" : "Révéler le code CVC")}
                      >
                        {isCvcCurrentlyRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <Lock className="w-3 h-3 text-white/50" />
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-base tracking-wider text-white font-serif">
                    {card.brand === 'visa' ? 'VISA' : 'Mastercard'}
                  </span>
                </div>
              </div>

              {/* Bottom limits strip */}
              <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/60 font-mono">
                <span className="solde-banque text-white font-semibold">
                  {isEn ? 'BALANCE' : 'SOLDE'} {formatAmount(Number(card.balance) || 0)}
                </span>
                <span className="solde-banque">
                  {isEn ? 'LIMIT D' : 'PLAFOND J'} {formatAmount(card.daily_limit)} · M {formatAmount(card.monthly_limit)}
                </span>
              </div>
            </div>

            {/* Dynamic Status Label under the Card */}
            <div className="text-center">
              {isCvcUnlocked ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-300 px-3.5 py-1.5 rounded-full shadow-xs">
                  <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  {isEn ? 'ACTIVE & UNLOCKED CARD (CVC AVAILABLE)' : 'CARTE ACTIVE & DÉBLOQUÉE (CVC DISPONIBLE)'}
                </span>
              ) : isApprovedLocked ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-900 font-semibold bg-amber-50 border border-amber-300 px-3.5 py-1.5 rounded-full shadow-xs">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  {isEn ? 'APPROVED CARD - LOCKED (CVC HIDDEN)' : 'CARTE APPROUVÉE - VERROUILLÉE (CVC MASQUÉ)'}
                </span>
              ) : isInactive ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-semibold bg-slate-100 border border-slate-300 px-3.5 py-1.5 rounded-full shadow-xs">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  {isEn ? 'APPLICATION PENDING APPROVAL' : "DEMANDE EN COURS D'APPROBATION"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-rose-800 font-semibold bg-rose-50 border border-rose-300 px-3.5 py-1.5 rounded-full shadow-xs">
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  {isEn ? 'CARD SUSPENDED / BLOCKED' : 'CARTE SUSPENDUE / BLOQUÉE'}
                </span>
              )}
            </div>

            {/* CARD MANAGEMENT & RECHARGE BOX */}
            <div className="max-w-md mx-auto bg-white rounded-3xl p-6 border border-[#eee8dd] shadow-xs space-y-4">
              {/* Header with Balance and Status */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isCvcUnlocked
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : isApprovedLocked
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {isCvcUnlocked ? <Unlock className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3" />}
                  {isCvcUnlocked ? (isEn ? 'ACTIVE & UNLOCKED' : 'ACTIVE & DÉBLOQUÉE') : isApprovedLocked ? (isEn ? 'APPROVED (LOCKED)' : 'APPROUVÉE (VERROUILLÉE)') : (isEn ? 'PENDING' : 'EN ATTENTE')}
                </span>
                <div className="text-right">
                  <span className="text-[11px] text-[#8a857e] block">{isEn ? 'Dedicated card balance' : 'Solde dédié carte'}</span>
                  <span className="font-bold text-sm text-[#1a1a1a] solde-banque font-mono">
                    {formatAmount(Number(card.balance) || 0)}
                  </span>
                </div>
              </div>

              {/* Informative Status Notice */}
              {isInactive ? (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    {isEn ? 'Request pending approval' : "Demande en attente d'approbation"}
                  </p>
                  <p className="leading-relaxed text-[11px] text-amber-800">
                    {isEn
                      ? 'Your card request is currently under review. Once approved by administration, your bank advisor will proceed to unlock your card to reveal your CVC code.'
                      : "Votre demande de carte est actuellement en cours d'examen. Une fois approuvée par l'administrateur, votre conseiller bancaire procédera au déblocage de votre carte pour révéler votre code CVC."}
                  </p>
                </div>
              ) : isApprovedLocked ? (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-blue-700 shrink-0" />
                    {isEn ? 'Card approved - CVC code locked' : 'Carte approuvée - Code CVC verrouillé'}
                  </p>
                  <p className="leading-relaxed text-[11px] text-blue-900">
                    {isEn
                      ? 'Your card has been approved by the bank but remains locked for security purposes. The CVC code will remain hidden until your administrator unlocks it from their portal.'
                      : "Votre carte a été validée par la banque mais demeure verrouillée par mesure de protection. Le code CVC restera masqué jusqu'à ce que votre administrateur la débloque en un clic depuis son interface."}
                  </p>
                </div>
              ) : isCvcUnlocked ? (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    {isEn ? 'Card unlocked & CVC code accessible' : 'Carte débloquée & Code CVC accessible'}
                  </p>
                  <p className="leading-relaxed text-[11px] text-emerald-900">
                    {isEn
                      ? 'Your card is active for online and in-store payments. Use the button above to reveal your security CVC code at any time.'
                      : 'Votre carte est opérationnelle pour vos paiements en ligne et en magasin. Utilisez le bouton ci-dessus pour révéler votre code de sécurité CVC à tout moment.'}
                  </p>
                </div>
              ) : null}

              {/* TRANSFER ACTION (Managing Card) */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {isEn ? 'Card Top-Up' : 'Alimentation de la carte'}
                  </p>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {isEn ? 'Avail. balance:' : 'Solde dispo :'} {formatAmount(account?.balance || 0)}
                  </span>
                </div>

                <Button
                  type="button"
                  onClick={() => openTransferModal(card)}
                  disabled={!card.transfer_enabled}
                  className={`w-full rounded-xl text-xs font-semibold h-11 flex items-center justify-center gap-2 transition-all ${
                    card.transfer_enabled
                      ? 'bg-[#0f2b5c] hover:bg-[#0a1e40] text-white shadow-md cursor-pointer'
                      : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {isEn ? 'Transfer from main balance' : 'Transférer depuis le solde principal'}
                </Button>

                {/* Feedback on why the transfer button is active or inactive */}
                {!card.transfer_enabled ? (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-start gap-2">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      {isEn ? (
                        <>The <strong>Transfer</strong> button is not active yet. An administrator must activate it from their dashboard under <strong>Virtual Cards</strong> to authorize top-ups on this card.</>
                      ) : (
                        <>Le bouton <strong>Transférer</strong> n'est pas encore actif. L'administrateur doit l'activer depuis son tableau de bord dans l'onglet <strong>Cartes Virtuelles</strong> pour vous autoriser à recharger cette carte.</>
                      )}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      {isEn
                        ? 'Transfers authorized: you can instantly top up this card by debiting your primary balance.'
                        : 'Transferts autorisés : vous pouvez créditer cette carte instantanément en débitant votre solde principal.'}
                    </span>
                  </p>
                )}
              </div>

              {/* Physical Delivery Request & Tracking */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <Button
                  variant="outline"
                  onClick={() => openShippingModal(card)}
                  disabled={card.shipping_requested}
                  className={`w-full rounded-xl border-[#eee8dd] text-[#1a1a1a] hover:bg-[#faf7f0] text-xs h-11 gap-2 cursor-pointer ${
                    card.shipping_requested ? 'hidden' : ''
                  }`}
                >
                  <Truck className="w-4 h-4 text-[#8a857e]" />
                  {isEn ? 'Request physical home delivery' : 'Demander la livraison physique à domicile'}
                </Button>

                {card.shipping_requested && (
                  <div className="pt-3">
                    <h4 className="text-xs font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#0f2b5c]" /> {isEn ? 'Home Delivery Tracking' : "Suivi d'expédition à domicile"}
                    </h4>
                    <div className="relative pl-3">
                      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-[#eee8dd]" />
                      <div className="space-y-3">
                        {(isEn ? [
                          "Order received",
                          "Manufacturing in progress",
                          "International dispatch",
                          "Customs clearance",
                          "In local transit",
                          "Delivered"
                        ] : [
                          "Commande reçue",
                          "Fabrication en cours",
                          "Expédition internationale",
                          "Dédouanement",
                          "En transit local",
                          "Livrée"
                        ]).map((step, index) => {
                          const currentStep = card.shipment_step || 0;
                          const isCompleted = index <= currentStep;
                          return (
                            <div key={index} className="relative flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center relative z-10 ${
                                isCompleted ? 'bg-[#0f2b5c]' : 'bg-[#e5e0d8]'
                              }`}>
                                {isCompleted ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                              <p className={`text-xs font-medium ${
                                isCompleted ? 'text-[#1a1a1a] font-semibold' : 'text-[#8a857e]'
                              }`}>
                                {step}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* TRANSFER MODAL (Principal to Card) */}
      <Dialog open={Boolean(transferModalCard)} onOpenChange={(open) => !open && setTransferModalCard(null)}>
        <DialogContent className="max-w-md w-[95vw] p-5 sm:p-6 rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-[#0f2b5c]" />
              {isEn ? 'Transfer to my bank card' : 'Transférer vers ma carte bancaire'}
            </DialogTitle>
          </DialogHeader>

          {transferModalCard && account && (
            <form onSubmit={handleExecuteTransfer} className="space-y-4 pt-2">
              {/* Source Account Info */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 block">{isEn ? 'Source account:' : 'Compte source :'}</span>
                <div className="flex items-center justify-between font-semibold text-slate-900">
                  <span>{isEn ? 'Main Checking Account' : 'Compte Courant Principal'}</span>
                  <span className="font-mono text-[#0f2b5c] solde-banque">
                    {formatAmount(account.balance || 0)} {isEn ? 'available' : 'disponible'}
                  </span>
                </div>
              </div>

              {/* Destination Card Info */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs space-y-1">
                <span className="text-blue-800 block">{isEn ? 'Recipient card:' : 'Carte destinataire :'}</span>
                <div className="flex items-center justify-between font-semibold text-blue-950">
                  <span className="uppercase">
                    {transferModalCard.tier} {transferModalCard.brand} (•••• {transferModalCard.number.slice(-4)})
                  </span>
                  <span className="font-mono text-blue-900 solde-banque">
                    {isEn ? 'Current balance:' : 'Solde actuel :'} {formatAmount(Number(transferModalCard.balance) || 0)}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">{isEn ? 'Amount to transfer (CAD)' : 'Montant à transférer (CAD)'}</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    max={account.balance || 0}
                    required
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-12 rounded-xl text-base font-bold font-mono pl-3 pr-12 solde-banque"
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400">
                    {account.currency || 'CAD'}
                  </span>
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="grid grid-cols-4 gap-2">
                {[50, 100, 250, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTransferAmount(amt.toString())}
                    className="p-2 rounded-lg border border-slate-200 text-xs font-mono font-semibold hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
                  >
                    +{amt}$
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransferModalCard(null)}
                  className="rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'Annuler'}
                </Button>
                <Button
                  type="submit"
                  disabled={processingTransfer}
                  className="bg-[#0f2b5c] hover:bg-[#0a1e40] text-white rounded-xl text-xs h-10 px-6 font-semibold cursor-pointer"
                >
                  {processingTransfer ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  {isEn ? 'Confirm card transfer' : 'Confirmer le virement vers la carte'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE DEMANDE DE LIVRAISON DE CARTE PHYSIQUE */}
      {shippingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 w-full max-w-lg shadow-2xl border border-[#eee8dd] space-y-4 sm:space-y-5 my-auto overflow-hidden box-border">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0f2b5c]/10 text-[#0f2b5c] flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-serif text-base sm:text-lg font-bold text-[#1a1a1a] truncate">
                    {isEn ? 'Physical Card Delivery' : 'Livraison de carte physique'}
                  </h3>
                  <p className="text-xs text-[#8a857e] line-clamp-2 sm:line-clamp-1 leading-snug">
                    {isEn ? 'Enter your delivery address for secure shipment.' : "Renseignez l'adresse de réception pour l'expédition sécurisée."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShippingCard(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmShipping} className="space-y-3.5 sm:space-y-4 w-full box-border">
              <div className="space-y-1 w-full min-w-0">
                <Label className="text-xs font-semibold text-[#1a1a1a] block w-full text-left break-words whitespace-normal leading-snug">
                  {isEn ? 'Recipient full name' : 'Nom complet du destinataire'}
                </Label>
                <Input
                  type="text"
                  required
                  value={shippingForm.recipient_name}
                  onChange={(e) => setShippingForm({ ...shippingForm, recipient_name: e.target.value })}
                  placeholder={isEn ? "Full name" : "Nom et prénom"}
                  className="rounded-xl h-11 text-sm border-[#eee8dd] w-full min-w-0 max-w-full box-border"
                />
              </div>

              <div className="space-y-1 w-full min-w-0">
                <Label className="text-xs font-semibold text-[#1a1a1a] block w-full text-left break-words whitespace-normal leading-snug">
                  {isEn ? 'Delivery address (street, building, apt)' : 'Adresse de livraison (rue, numéro, bâtiment)'}
                </Label>
                <Input
                  type="text"
                  required
                  value={shippingForm.address}
                  onChange={(e) => setShippingForm({ ...shippingForm, address: e.target.value })}
                  placeholder={isEn ? "e.g. 145 Lilac Street, Apt 4B" : "Ex : 145 Rue des Lilas, Apt 4B"}
                  className="rounded-xl h-11 text-sm border-[#eee8dd] w-full min-w-0 max-w-full box-border"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
                <div className="space-y-1 w-full min-w-0">
                  <Label className="text-xs font-semibold text-[#1a1a1a] block w-full text-left break-words whitespace-normal leading-snug">
                    {isEn ? 'City' : 'Ville'}
                  </Label>
                  <Input
                    type="text"
                    required
                    value={shippingForm.city}
                    onChange={(e) => setShippingForm({ ...shippingForm, city: e.target.value })}
                    placeholder={isEn ? "e.g. Toronto" : "Ex : Montréal"}
                    className="rounded-xl h-11 text-sm border-[#eee8dd] w-full min-w-0 max-w-full box-border"
                  />
                </div>
                <div className="space-y-1 w-full min-w-0">
                  <Label className="text-xs font-semibold text-[#1a1a1a] block w-full text-left break-words whitespace-normal leading-snug">
                    {isEn ? 'Postal code' : 'Code postal'}
                  </Label>
                  <Input
                    type="text"
                    value={shippingForm.postal_code}
                    onChange={(e) => setShippingForm({ ...shippingForm, postal_code: e.target.value })}
                    placeholder={isEn ? "e.g. M5V 2T6" : "Ex : H2Z 1A4"}
                    className="rounded-xl h-11 text-sm border-[#eee8dd] w-full min-w-0 max-w-full box-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
                <div className="space-y-1 w-full min-w-0">
                  <Label className="text-xs font-semibold text-[#1a1a1a] block w-full text-left break-words whitespace-normal leading-snug">
                    {isEn ? 'Country' : 'Pays'}
                  </Label>
                  <Input
                    type="text"
                    required
                    value={shippingForm.country}
                    onChange={(e) => setShippingForm({ ...shippingForm, country: e.target.value })}
                    placeholder={isEn ? "e.g. Canada" : "Ex : Canada"}
                    className="rounded-xl h-11 text-sm border-[#eee8dd] w-full min-w-0 max-w-full box-border"
                  />
                </div>
                <div className="space-y-1 w-full min-w-0">
                  <Label className="text-xs font-semibold text-[#1a1a1a] block w-full text-left break-words whitespace-normal leading-snug">
                    {isEn ? 'Delivery phone number' : 'Téléphone pour la livraison'}
                  </Label>
                  <Input
                    type="tel"
                    value={shippingForm.phone}
                    onChange={(e) => setShippingForm({ ...shippingForm, phone: e.target.value })}
                    placeholder={isEn ? "+1 416 555 0199" : "+1 514 555 0199"}
                    className="rounded-xl h-11 text-sm border-[#eee8dd] w-full min-w-0 max-w-full box-border"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#faf8f5] rounded-xl border border-[#eee8dd] text-[11px] text-[#666] leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#0f2b5c] shrink-0 mt-0.5" />
                <p className="break-words w-full">
                  {isEn
                    ? 'Your physical card will be dispatched in a sealed security envelope with signature on delivery. Tracking details will be emailed to you.'
                    : "Votre carte physique sera expédiée sous enveloppe sécurisée scellée et remise en main propre. Une confirmation d'expédition et un numéro de suivi vous seront transmis."}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShippingCard(null)}
                  disabled={submittingShipping}
                  className="rounded-xl border-[#eee8dd] text-xs h-10 sm:h-11 px-4 sm:px-5 cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'Annuler'}
                </Button>
                <Button
                  type="submit"
                  disabled={submittingShipping}
                  className="rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs font-semibold h-10 sm:h-11 px-5 sm:px-6 shadow-sm cursor-pointer"
                >
                  {submittingShipping ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {isEn ? 'Saving...' : 'Enregistrement...'}
                    </>
                  ) : (
                    isEn ? 'CONFIRM ORDER' : 'CONFIRMER'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
