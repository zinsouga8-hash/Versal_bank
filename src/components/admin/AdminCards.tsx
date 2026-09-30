import React, { useEffect, useState, useRef } from 'react';
import { 
  fetchCardsPaginated,
  saveCardToSupabase, 
  deleteCardFromSupabase,
  fetchClientsPaginated,
  subscribeToBankData,
  notifyDataChanged
} from '../../lib/supabaseBankService';
import { VirtualCard, ClientAccount, CardBrand, CardTier, CardStatus } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, CreditCard, Ban, CheckCircle2, Plus, RefreshCw, 
  Trash2, ShieldCheck, Eye, EyeOff, Sparkles, Send, Truck, Check, ArrowRight, Settings,
  Lock, Unlock, ArrowLeftRight, User, Mail, MapPin, Clock, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { notifyCardActivated, notifyCardStatus } from '../../lib/emailService';

export const CARD_SHIPMENT_STEPS = [
  "Commande reçue",
  "Fabrication en cours",
  "Expédition internationale",
  "Dédouanement",
  "En transit local",
  "Livrée"
];

export default function AdminCards() {
  const [cards, setCards] = useState<(VirtualCard & { id: string })[]>([]);
  const [clients, setClients] = useState<(ClientAccount & { id: string })[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Search & Filter & Pagination states (Fixed 10 per page as requested)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCards, setTotalCards] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Card details & delivery tracking modal state
  const [detailsCard, setDetailsCard] = useState<(VirtualCard & { id: string }) | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [updatingCard, setUpdatingCard] = useState(false);

  // New card modal form state
  const [targetClientId, setTargetClientId] = useState<string>('');
  const [brand, setBrand] = useState<CardBrand>('visa');
  const [tier, setTier] = useState<CardTier>('gold');
  const [dailyLimit, setDailyLimit] = useState<number>(3000);
  const [monthlyLimit, setMonthlyLimit] = useState<number>(10000);
  const [initialBalance, setInitialBalance] = useState<number>(0);

  const fetchSeqRef = useRef(0);
  const currentParamsRef = useRef({ page: 1, search: '', status: 'all' });
  currentParamsRef.current = { page, search: searchTerm, status: statusFilter };

  const fetchData = async (
    isManual = false,
    targetPage = page,
    targetSearch = searchTerm,
    targetStatus = statusFilter
  ) => {
    const seq = ++fetchSeqRef.current;

    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetchCardsPaginated({
        page: targetPage,
        pageSize,
        search: targetSearch,
        status: targetStatus,
      });

      if (seq === fetchSeqRef.current) {
        if (Array.isArray(res.data)) {
          setCards(res.data);
        }
        setTotalCards(res.total);
        setTotalPages(res.totalPages);
        setPage(res.page);
      }
    } catch (e) {
      console.error(e);
      console.warn("Erreur cartes", e);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData(false, 1, searchTerm, statusFilter);
    const unsub = subscribeToBankData(() => {
      fetchData(
        false, 
        currentParamsRef.current.page, 
        currentParamsRef.current.search, 
        currentParamsRef.current.status
      );
    });
    return () => unsub();
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
    fetchData(false, 1, val, statusFilter);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
    fetchData(false, 1, searchTerm, status);
  };

  const handleOpenCreateModal = async () => {
    setModalOpen(true);
    if (clients.length === 0) {
      setLoadingClients(true);
      try {
        const res = await fetchClientsPaginated({ pageSize: 50 });
        const clientList = Array.isArray(res?.data) ? res.data : [];
        setClients(clientList);
        if (clientList.length > 0 && !targetClientId) {
          setTargetClientId(clientList[0].id);
        }
      } finally {
        setLoadingClients(false);
      }
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 1. Approuver la demande : la carte est approuvée mais RESTE BLOQUÉE et CVC masqué
  const handleApproveCard = async (card: VirtualCard & { id: string }) => {
    try {
      const updated = {
        ...card,
        status: 'approved' as const,
        is_locked: true,
        cvc_visible: false,
      };
      await saveCardToSupabase(updated as any);
      setCards(prev => prev.map(c => c.id === card.id ? updated : c));
      if (detailsCard?.id === card.id) {
        setDetailsCard(updated);
      }
      window.dispatchEvent(new Event('versalbank_update'));
      notifyDataChanged();

      const clientEmail = card.client_email || (card as any).user_email;
      if (clientEmail) {
        notifyCardStatus({
          user_email: clientEmail,
          card_type: card.tier || 'visa',
          card_number: card.number || (card as any).card_number || '••••',
          action: 'approved',
        }).catch(e => console.warn('Card approve email notice:', e));
      }

      toast.success("Demande approuvée ! La carte est émise mais reste verrouillée (CVC masqué pour le client).");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'approbation.");
    }
  };

  // 2. Débloquer la carte en 1 clic : débloque la carte et rend le CVC visible
  const handleUnlockCard = async (card: VirtualCard & { id: string }) => {
    try {
      const updated = {
        ...card,
        status: 'active' as const,
        is_locked: false,
        cvc_visible: true,
      };
      await saveCardToSupabase(updated as any);
      setCards(prev => prev.map(c => c.id === card.id ? updated : c));
      if (detailsCard?.id === card.id) {
        setDetailsCard(updated);
      }
      window.dispatchEvent(new Event('versalbank_update'));
      notifyDataChanged();

      const clientEmail = card.client_email || (card as any).user_email;
      if (clientEmail) {
        await notifyCardActivated(
          { user_email: clientEmail },
          { card_number: card.number || (card as any).card_number, card_type: card.tier || 'visa', currency: 'CAD' }
        );
      }

      toast.success("Carte débloquée en 1 clic ! Le code CVC est désormais visible pour le client.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du déblocage de la carte.");
    }
  };

  // 3. Verrouiller la carte en 1 clic : masque le CVC et bloque la carte
  const handleLockCard = async (card: VirtualCard & { id: string }) => {
    try {
      const updated = {
        ...card,
        status: 'blocked' as const,
        is_locked: true,
        cvc_visible: false,
      };
      await saveCardToSupabase(updated as any);
      setCards(prev => prev.map(c => c.id === card.id ? updated : c));
      if (detailsCard?.id === card.id) {
        setDetailsCard(updated);
      }
      window.dispatchEvent(new Event('versalbank_update'));
      notifyDataChanged();

      const clientEmail = card.client_email || (card as any).user_email;
      if (clientEmail) {
        notifyCardStatus({
          user_email: clientEmail,
          card_type: card.tier || 'visa',
          card_number: card.number || (card as any).card_number || '••••',
          action: 'frozen',
        }).catch(e => console.warn('Card lock email notice:', e));
      }

      toast.success("Carte verrouillée. Code CVC masqué pour le client.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du verrouillage.");
    }
  };

  // 4. Activer / désactiver les transferts vers la carte par le client
  const handleToggleTransfer = async (cardId: string, currentVal: boolean) => {
    try {
      const targetCard = cards.find(c => c.id === cardId) || (detailsCard?.id === cardId ? detailsCard : null);
      if (!targetCard) return;
      const nextVal = !currentVal;
      const updated = {
        ...targetCard,
        transfer_enabled: nextVal,
      };
      await saveCardToSupabase(updated as any);
      setCards(prev => prev.map(c => c.id === cardId ? updated : c));
      if (detailsCard?.id === cardId) {
        setDetailsCard(updated);
      }
      window.dispatchEvent(new Event('versalbank_update'));
      notifyDataChanged();
      toast.success(nextVal ? "Bouton Transférer activé pour le client !" : "Bouton Transférer désactivé pour le client.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la modification de l'autorisation de transfert.");
    }
  };

  const openCardDetails = (card: VirtualCard & { id: string }) => {
    setDetailsCard(card);
    setDetailsModalOpen(true);
  };

  const handleSetShipmentStep = async (card: VirtualCard & { id: string }, stepIndex: number) => {
    try {
      const updated = {
        ...card,
        shipping_requested: true,
        shipment_step: stepIndex,
      };
      await saveCardToSupabase(updated as any);
      setCards(prev => prev.map(c => c.id === card.id ? updated : c));
      setDetailsCard(updated);
      window.dispatchEvent(new Event('versalbank_update'));
      notifyDataChanged();
      toast.success(`Étape de livraison mise à jour : ${CARD_SHIPMENT_STEPS[stepIndex]}`);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la mise à jour du suivi.");
    }
  };

  const handleConfirmCurrentShipmentStep = async () => {
    if (!detailsCard) return;
    const stepIdx = detailsCard.shipment_step ?? 0;
    try {
      const updated = {
        ...detailsCard,
        shipping_requested: true,
        shipment_step: stepIdx,
      };
      await saveCardToSupabase(updated as any);
      setCards(prev => prev.map(c => c.id === detailsCard.id ? updated : c));
      setDetailsCard(updated);
      window.dispatchEvent(new Event('versalbank_update'));
      notifyDataChanged();
      toast.success(`Étape de livraison enregistrée et transmise au client : Étape ${stepIdx + 1}/6 - ${CARD_SHIPMENT_STEPS[stepIdx]}`);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement de l'étape de livraison.");
    }
  };

  const handleSaveDetailsCard = async () => {
    if (!detailsCard) return;
    setUpdatingCard(true);
    try {
      await saveCardToSupabase(detailsCard as any);
      setCards(prev => prev.map(c => c.id === detailsCard.id ? detailsCard : c));
      window.dispatchEvent(new Event('versalbank_update'));
      notifyDataChanged();
      toast.success("Informations de la carte et paramètres enregistrés avec succès.");
      setDetailsModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setUpdatingCard(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous supprimer définitivement cette carte bancaire ?")) return;
    try {
      await deleteCardFromSupabase(id);
      setCards(prev => prev.filter(c => c.id !== id));
      toast.success("Carte supprimée.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur de suppression.");
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClient = clients.find(c => c.id === targetClientId);
    if (!targetClient) {
      toast.error("Veuillez sélectionner un client.");
      return;
    }

    setCreating(true);
    try {
      const prefix = brand === 'visa' ? '4152' : '5241';
      const middle = Math.floor(1000 + Math.random() * 9000);
      const middle2 = Math.floor(1000 + Math.random() * 9000);
      const last = Math.floor(1000 + Math.random() * 9000);
      const fullNumber = `${prefix} ${middle} ${middle2} ${last}`;
      const cvc = Math.floor(100 + Math.random() * 900).toString();
      
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 4);
      const expiry = `${String(futureDate.getMonth() + 1).padStart(2, '0')}/${String(futureDate.getFullYear()).slice(-2)}`;

      const clientName = `${targetClient.first_name || ''} ${targetClient.last_name || ''}`.trim() || targetClient.full_name || 'CLIENT VERSALBANK';
      const clientEmail = targetClient.user_email || (targetClient as any).email || '';

      const newCard: any = {
        id: `card_${Date.now()}`,
        account_id: targetClient.id,
        client_id: targetClient.client_id || targetClient.id,
        user_id: targetClient.id,
        client_email: clientEmail,
        user_email: clientEmail,
        holder_name: clientName,
        card_holder: clientName,
        brand,
        card_type: brand,
        tier,
        number: fullNumber,
        card_number: fullNumber,
        cvc,
        cvv: cvc,
        cvc_visible: false,
        is_locked: true,
        expiry,
        daily_limit: Number(dailyLimit) || 3000,
        monthly_limit: Number(monthlyLimit) || 10000,
        limit_monthly: Number(monthlyLimit) || 10000,
        balance: Number(initialBalance) || 0,
        status: 'approved',
        transfer_enabled: false,
        shipping_requested: false,
        shipment_step: 0,
        createdAt: Date.now(),
        created_at: Date.now(),
      };

      await saveCardToSupabase(newCard);
      setCards(prev => [newCard, ...prev]);
      setModalOpen(false);
      toast.success("Carte émise avec succès ! Elle est actuellement verrouillée (CVC masqué).");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'émission de la carte.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[#0f2b5c]" />
            Cartes Virtuelles & Physiques
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestion des demandes, approbation, déblocage 1-clic du CVC et autorisation des transferts par le client.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchData(true, page, searchTerm, statusFilter)} 
            disabled={loading || refreshing}
            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 h-10 rounded-xl cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Button 
            onClick={handleOpenCreateModal}
            className="bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white text-xs h-10 px-4 rounded-xl font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Émettre une carte
          </Button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              type="text" 
              placeholder="Rechercher par titulaire, numéro, email client..." 
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-10 bg-white rounded-xl text-sm border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <Button 
              variant={statusFilter === 'all' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => handleStatusChange('all')} 
              className={`h-8 text-xs rounded-full cursor-pointer ${statusFilter === 'all' ? 'bg-[#0f2b5c] text-white' : ''}`}
            >
              Toutes
            </Button>
            <Button 
              variant={statusFilter === 'active' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => handleStatusChange('active')} 
              className={`h-8 text-xs rounded-full cursor-pointer ${statusFilter === 'active' ? 'bg-emerald-600 text-white' : ''}`}
            >
              Actives
            </Button>
            <Button 
              variant={statusFilter === 'inactive' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => handleStatusChange('inactive')} 
              className={`h-8 text-xs rounded-full cursor-pointer ${statusFilter === 'inactive' ? 'bg-amber-600 text-white' : ''}`}
            >
              Inactives
            </Button>
            <Button 
              variant={statusFilter === 'blocked' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => handleStatusChange('blocked')} 
              className={`h-8 text-xs rounded-full cursor-pointer ${statusFilter === 'blocked' ? 'bg-rose-600 text-white' : ''}`}
            >
              Bloquées
            </Button>
          </div>
        </div>
      </div>

      {/* Cards list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0f2b5c]" />
          <p className="text-sm font-medium">Chargement des cartes...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
          <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">Aucune carte émise ou demandée pour le moment.</p>
          <p className="text-xs text-slate-400 mt-1">Les demandes de cartes soumises par les clients apparaîtront ici.</p>
        </div>
      ) : (
        <>
          {/* Mobile view */}
          <div className="block sm:hidden space-y-3">
            {cards.map((card) => {
              const cardNum = card.number || (card as any).card_number || '4532 •••• •••• 0000';
              const isRevealed = revealedIds.has(card.id);
              const holder = card.holder_name || (card as any).card_holder || 'CLIENT VERSALBANK';
              const clientEmail = card.client_email || (card as any).user_email || 'Email non renseigné';
              const clientId = card.client_id || card.account_id || '';
              const isInactive = card.status === 'inactive';
              const isLocked = card.is_locked || !card.cvc_visible || card.status === 'blocked' || card.status === 'approved';
              const isActive = card.status === 'active' && !card.is_locked && card.cvc_visible;
              const currentStep = card.shipment_step ?? 0;

              return (
                <div key={card.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#0f2b5c]" />
                        {holder}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {clientEmail}
                      </div>
                      {clientId && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: {clientId}
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isActive 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : isInactive 
                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {isActive ? 'Active (Débloquée)' : isInactive ? 'Demande en attente' : 'Bloquée (CVC masqué)'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900 text-white rounded-xl font-mono text-xs flex items-center justify-between">
                    <div>
                      <div>{isRevealed ? cardNum : `${cardNum.slice(0, 7)} •••• •••• ${cardNum.slice(-4)}`}</div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-3">
                        <span>EXP : {card.expiry || '12/28'}</span>
                        <span>CVC : {isRevealed ? (card.cvc || (card as any).cvv || '•••') : '•••'}</span>
                        <span className="uppercase text-amber-300 font-bold font-sans">{card.tier || card.brand}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => toggleReveal(card.id)} className="text-slate-400 hover:text-white cursor-pointer p-1">
                      {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Transfer toggle button */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <span className="text-slate-600 font-medium">Bouton Transférer :</span>
                    <button
                      type="button"
                      onClick={() => handleToggleTransfer(card.id, card.transfer_enabled)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        card.transfer_enabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {card.transfer_enabled ? <Check className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3 text-amber-600" />}
                      {card.transfer_enabled ? 'Activé' : 'Désactivé'}
                    </button>
                  </div>

                  {/* Delivery summary badge */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      <Truck className="w-3.5 h-3.5 text-[#0f2b5c]" />
                      Suivi livraison :
                    </span>
                    {card.shipping_requested ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-900 border border-blue-300 shadow-xs">
                          DEMANDER
                        </span>
                        <div className="text-[10px] text-blue-800 font-semibold mt-0.5">
                          Étape {currentStep + 1}/6 : {CARD_SHIPMENT_STEPS[currentStep]}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                        Non demandé
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      onClick={() => openCardDetails(card)}
                      className="w-full text-xs h-9 rounded-xl font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5 mr-1" /> Détails & Suivi
                    </Button>

                    {isInactive ? (
                      <Button
                        size="sm"
                        onClick={() => handleApproveCard(card)}
                        className="w-full text-xs h-9 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Approuver
                      </Button>
                    ) : isLocked ? (
                      <Button
                        size="sm"
                        onClick={() => handleUnlockCard(card)}
                        className="w-full text-xs h-9 rounded-xl font-semibold bg-[#0f2b5c] hover:bg-[#0a1e40] text-white cursor-pointer"
                        title="Débloquer la carte et révéler le code CVC pour le client"
                      >
                        <Unlock className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Débloquer CVC
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLockCard(card)}
                        className="w-full text-xs h-9 rounded-xl font-medium text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer"
                        title="Bloquer la carte et masquer le code CVC"
                      >
                        <Lock className="w-3.5 h-3.5 mr-1" /> Bloquer
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop view */}
          <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Client / Titulaire</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Carte & Code CVC</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Gamme / Exp.</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Solde & Plafond</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-center">Bouton Transférer</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-center">Suivi livraison</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Statut Carte & CVC</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((card) => {
                  const cardNum = card.number || (card as any).card_number || '4532 •••• •••• 0000';
                  const isRevealed = revealedIds.has(card.id);
                  const holder = card.holder_name || (card as any).card_holder || 'CLIENT VERSALBANK';
                  const clientEmail = card.client_email || (card as any).user_email || 'Email non renseigné';
                  const clientId = card.client_id || card.account_id || '';
                  const isInactive = card.status === 'inactive';
                  const isLocked = card.is_locked || !card.cvc_visible || card.status === 'blocked' || card.status === 'approved';
                  const isActive = card.status === 'active' && !card.is_locked && card.cvc_visible;
                  const cvcCode = card.cvc || (card as any).cvv || '•••';

                  return (
                    <TableRow key={card.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Client info */}
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#0f2b5c] shrink-0" />
                          {holder}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          {clientEmail}
                        </div>
                        {clientId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            ID: {clientId}
                          </div>
                        )}
                      </TableCell>

                      {/* Card Number & CVC */}
                      <TableCell>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span>{isRevealed ? cardNum : `${cardNum.slice(0, 7)} •••• •••• ${cardNum.slice(-4)}`}</span>
                          <button 
                            type="button" 
                            onClick={() => toggleReveal(card.id)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            title={isRevealed ? "Masquer les numéros" : "Afficher les numéros"}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                          <span>CVC : {isRevealed ? cvcCode : '•••'}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${card.cvc_visible && !card.is_locked ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {card.cvc_visible && !card.is_locked ? 'CVC visible client' : 'CVC masqué client'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Network & Expiry */}
                      <TableCell>
                        <span className="text-xs font-semibold uppercase text-[#0f2b5c]">
                          {card.tier || card.brand || 'VISA'}
                        </span>
                        <div className="text-[11px] text-slate-400 font-mono">{card.expiry || '12/28'}</div>
                      </TableCell>

                      {/* Solde & Plafonds */}
                      <TableCell>
                        <div className="font-mono font-semibold text-xs text-slate-900 solde-banque">
                          Solde : {(Number(card.balance) || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} CAD
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Plafond : {(card.monthly_limit || (card as any).limit_monthly || 10000).toLocaleString('fr-CA')} CAD/m
                        </div>
                      </TableCell>

                      {/* Transfer Authorization Toggle */}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleTransfer(card.id, card.transfer_enabled)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                            card.transfer_enabled
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                              : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300'
                          }`}
                          title={card.transfer_enabled ? "Cliquer pour désactiver les transferts" : "Cliquer pour autoriser les transferts"}
                        >
                          {card.transfer_enabled ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Activé</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Désactivé</span>
                            </>
                          )}
                        </button>
                      </TableCell>

                      {/* Suivi livraison */}
                      <TableCell className="text-center">
                        {card.shipping_requested ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-blue-100 text-blue-900 border border-blue-300 shadow-xs">
                              <Truck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                              DEMANDER
                            </span>
                            <span className="text-[10px] text-blue-900 font-semibold max-w-[150px] truncate">
                              Étape {(card.shipment_step ?? 0) + 1}/6 : {CARD_SHIPMENT_STEPS[card.shipment_step ?? 0]}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Non demandé
                          </span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          isActive 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : isInactive 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active & Débloquée
                            </>
                          ) : isInactive ? (
                            'Demande en attente'
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-rose-600" /> Bloquée (CVC masqué)
                            </>
                          )}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => openCardDetails(card)}
                            className="text-xs h-8 bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white cursor-pointer px-2.5"
                            title="Gérer la carte et le suivi d'expédition"
                          >
                            <Truck className="w-3.5 h-3.5 mr-1" /> Détails
                          </Button>

                          {isInactive ? (
                            <Button 
                              size="sm" 
                              onClick={() => handleApproveCard(card)}
                              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-2.5"
                              title="Approuver la demande (la carte reste bloquée)"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Approuver
                            </Button>
                          ) : isLocked ? (
                            <Button 
                              size="sm" 
                              onClick={() => handleUnlockCard(card)}
                              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-2.5 font-semibold"
                              title="Débloquer la carte et rendre le CVC visible au client en 1 clic"
                            >
                              <Unlock className="w-3.5 h-3.5 mr-1" /> Débloquer CVC
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleLockCard(card)}
                              className="text-xs h-8 border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer px-2.5"
                              title="Bloquer la carte et masquer le code CVC pour le client"
                            >
                              <Lock className="w-3.5 h-3.5 mr-1" /> Bloquer
                            </Button>
                          )}

                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(card.id)}
                            className="text-xs h-8 text-rose-600 hover:bg-rose-50 cursor-pointer p-2"
                            title="Supprimer la carte"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Server-Side Pagination Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="text-xs text-slate-500">
              Affichage de <span className="font-semibold text-slate-900">{totalCards === 0 ? 0 : (page - 1) * pageSize + 1}</span> à <span className="font-semibold text-slate-900">{Math.min(page * pageSize, totalCards)}</span> sur <span className="font-semibold text-slate-900">{totalCards}</span> cartes
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => {
                  const prev = Math.max(1, page - 1);
                  setPage(prev);
                  fetchData(false, prev, searchTerm, statusFilter);
                }}
                className="text-xs h-8 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Précédent
              </Button>
              <span className="text-xs font-semibold px-2 text-slate-700 font-mono">
                Page {page} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const next = Math.min(totalPages, page + 1);
                  setPage(next);
                  fetchData(false, next, searchTerm, statusFilter);
                }}
                className="text-xs h-8 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Suivant <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* CREATE CARD MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif font-bold text-slate-900">
              Émettre une Nouvelle Carte Bancaire
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCard} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Client Bénéficiaire</Label>
              <Select value={targetClientId} onValueChange={setTargetClientId}>
                <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-xs">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.first_name} {c.last_name} ({c.user_email || (c as any).email || c.client_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Réseau</Label>
                <Select value={brand} onValueChange={(v) => setBrand(v as CardBrand)}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visa" className="text-xs">Visa</SelectItem>
                    <SelectItem value="mastercard" className="text-xs">Mastercard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Gamme / Tier</Label>
                <Select value={tier} onValueChange={(v) => setTier(v as CardTier)}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard" className="text-xs">Standard Classic</SelectItem>
                    <SelectItem value="gold" className="text-xs">Gold Premier</SelectItem>
                    <SelectItem value="platinum" className="text-xs">Platinum Infinite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Plafond Jour</Label>
                <Input 
                  type="number" 
                  value={dailyLimit} 
                  onChange={e => setDailyLimit(Number(e.target.value))}
                  className="mt-1 h-10 rounded-xl bg-slate-50 text-xs font-numeric" 
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Plafond Mois</Label>
                <Input 
                  type="number" 
                  value={monthlyLimit} 
                  onChange={e => setMonthlyLimit(Number(e.target.value))}
                  className="mt-1 h-10 rounded-xl bg-slate-50 text-xs font-numeric" 
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Solde Initial</Label>
                <Input 
                  type="number" 
                  value={initialBalance} 
                  onChange={e => setInitialBalance(Number(e.target.value))}
                  className="mt-1 h-10 rounded-xl bg-slate-50 text-xs font-numeric" 
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
              <span className="font-bold">Remarque :</span> La carte sera créée avec le statut <strong>Approuvée (Bloquée)</strong>. Vous pourrez débloquer la carte et révéler le code CVC pour le client en un clic depuis le tableau de bord.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setModalOpen(false)}
                className="rounded-xl text-xs h-10 px-4 cursor-pointer"
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={creating}
                className="bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white rounded-xl text-xs h-10 px-6 font-semibold cursor-pointer"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Émettre la carte
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* CARD DETAILS & SETTINGS MODAL */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] p-4 sm:p-6 rounded-2xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif font-bold text-slate-900 flex items-center justify-between">
              <span>Fiche Complète & Contrôle de Carte</span>
              {detailsCard && (
                <span className="text-xs font-normal text-slate-500 font-mono">
                  ID: {detailsCard.id}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailsCard && (
            <div className="space-y-5 pt-2">
              {/* Client Info Banner */}
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-blue-950 text-sm flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[#0f2b5c]" />
                    {detailsCard.holder_name || (detailsCard as any).card_holder || 'Client Inconnu'}
                  </p>
                  <p className="text-blue-800 flex items-center gap-1 mt-1">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    {detailsCard.client_email || (detailsCard as any).user_email || 'Email non renseigné'}
                  </p>
                  <p className="text-blue-700 font-mono text-[11px] mt-0.5">
                    Compte / Client ID : {detailsCard.client_id || detailsCard.account_id || 'N/A'}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase font-bold text-blue-900">Réseau & Type</span>
                  <p className="font-bold text-[#0f2b5c] text-sm uppercase">{detailsCard.tier || 'STANDARD'} {detailsCard.brand || 'VISA'}</p>
                </div>
              </div>

              {/* Visual Card Summary with Numbers */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    {detailsCard.holder_name || (detailsCard as any).card_holder || 'TITULAIRE'}
                  </span>
                  <span className="uppercase px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-amber-300">
                    {detailsCard.tier || 'VISA'}
                  </span>
                </div>
                <div className="font-mono text-base sm:text-lg tracking-widest text-slate-100">
                  {detailsCard.number || (detailsCard as any).card_number || '4532 0000 0000 0000'}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>EXP : {detailsCard.expiry || '12/28'}</span>
                  <span className="text-amber-300 font-bold">CVC : {detailsCard.cvc || (detailsCard as any).cvv || '•••'}</span>
                  <span className="text-slate-300 font-sans">
                    Solde : {(Number(detailsCard.balance) || 0).toLocaleString('fr-CA')} CAD
                  </span>
                </div>
              </div>

              {/* APPROBATION DE DEMANDE D'ÉMISSION SI EN ATTENTE */}
              {detailsCard.status === 'inactive' && (
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-center justify-between flex-wrap gap-3 shadow-xs">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-700" />
                      Demande d'émission de carte en attente d'approbation
                    </h4>
                    <p className="text-[11px] text-amber-900 mt-1">
                      Approuvez d'abord la demande d'émission. La carte sera émise mais restera bloquée (CVC masqué pour le client) jusqu'à ce que vous la déverrouilliez en 1 clic.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleApproveCard(detailsCard)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 px-5 rounded-xl cursor-pointer shadow-xs flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approuver la demande d'émission
                  </Button>
                </div>
              )}

              {/* 1-CLICK UNLOCK / LOCK CONTROL FOR CVC */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-orange-50/50 border border-amber-200/90 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        detailsCard.is_locked || !detailsCard.cvc_visible || detailsCard.status === 'blocked' || detailsCard.status === 'approved'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {detailsCard.is_locked || !detailsCard.cvc_visible || detailsCard.status === 'blocked' || detailsCard.status === 'approved'
                          ? 'Carte Verrouillée • CVC Masqué'
                          : 'Carte Déverrouillée • CVC Visible'}
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        {detailsCard.is_locked || !detailsCard.cvc_visible || detailsCard.status === 'blocked' || detailsCard.status === 'approved' ? (
                          <Lock className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Unlock className="w-4 h-4 text-emerald-600" />
                        )}
                        Déverrouillage de la carte & CVC
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {detailsCard.is_locked || !detailsCard.cvc_visible || detailsCard.status === 'blocked' || detailsCard.status === 'approved'
                        ? "Après avoir approuvé l'émission, la carte reste verrouillée et le client ne peut pas voir son CVC. Déverrouillez-la en 1 clic ci-contre."
                        : "La carte est actuellement déverrouillée et le code CVC est visible pour le client dans son onglet CARTES."}
                    </p>
                  </div>

                  {detailsCard.is_locked || !detailsCard.cvc_visible || detailsCard.status === 'blocked' || detailsCard.status === 'approved' ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleUnlockCard(detailsCard)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 px-5 rounded-xl cursor-pointer shadow-sm flex items-center gap-2"
                    >
                      <Unlock className="w-4 h-4" />
                      Déverrouiller la carte en 1 clic
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleLockCard(detailsCard)}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-10 px-5 rounded-xl cursor-pointer shadow-sm flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      Bloquer la carte & CVC
                    </Button>
                  )}
                </div>
              </div>

              {/* TRANSFER BUTTON PERMISSION FOR CLIENT */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        detailsCard.transfer_enabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {detailsCard.transfer_enabled ? 'Bouton Transférer Activé' : 'Bouton Transférer Désactivé'}
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <ArrowLeftRight className="w-4 h-4 text-[#0f2b5c]" />
                        Bouton « Transférer » depuis le solde principal
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {detailsCard.transfer_enabled
                        ? "Le bouton « Transférer » est activé dans l'espace client. Le client peut transférer de l'argent depuis son solde principal vers cette carte."
                        : "Le bouton « Transférer » est désactivé. Le client ne peut pas cliquer dessus tant que vous ne l'activez pas ici."}
                    </p>
                  </div>

                  {detailsCard.transfer_enabled ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleToggleTransfer(detailsCard.id, true)}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-10 px-4 rounded-xl cursor-pointer shadow-sm flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      Désactiver le bouton Transférer
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleToggleTransfer(detailsCard.id, false)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 px-4 rounded-xl cursor-pointer shadow-sm flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Activer le bouton Transférer
                    </Button>
                  )}
                </div>
              </div>

              {/* Limits and Balance Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Plafond Quotidien (CAD)</Label>
                  <Input
                    type="number"
                    value={detailsCard.daily_limit || 0}
                    onChange={(e) => setDetailsCard({ ...detailsCard, daily_limit: Number(e.target.value) })}
                    className="mt-1 h-9 rounded-xl bg-slate-50 text-xs font-numeric"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Plafond Mensuel (CAD)</Label>
                  <Input
                    type="number"
                    value={detailsCard.monthly_limit || (detailsCard as any).limit_monthly || 0}
                    onChange={(e) => setDetailsCard({ ...detailsCard, monthly_limit: Number(e.target.value) })}
                    className="mt-1 h-9 rounded-xl bg-slate-50 text-xs font-numeric"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Solde de la Carte (CAD)</Label>
                  <Input
                    type="number"
                    value={detailsCard.balance || 0}
                    onChange={(e) => setDetailsCard({ ...detailsCard, balance: Number(e.target.value) })}
                    className="mt-1 h-9 rounded-xl bg-slate-50 text-xs font-numeric"
                  />
                </div>
              </div>

              {/* 6-STEP DELIVERY TRACKING SECTION */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-[#0f2b5c]" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Suivi de Livraison Physique (6 étapes)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Contrôle en direct du suivi affiché dans « Suivi d'expédition à domicile » du client
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {detailsCard.shipping_requested ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-900 border border-blue-300">
                        <Truck className="w-3.5 h-3.5 text-blue-700" />
                        Statut : DEMANDER
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                        Statut : Non demandé
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => setDetailsCard({
                        ...detailsCard,
                        shipping_requested: !detailsCard.shipping_requested,
                        shipment_step: !detailsCard.shipping_requested ? (detailsCard.shipment_step ?? 0) : 0
                      })}
                      className={`text-xs h-8 rounded-xl font-medium cursor-pointer ${
                        detailsCard.shipping_requested
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'text-slate-600 border-slate-200'
                      }`}
                    >
                      {detailsCard.shipping_requested ? 'Basculer à non demandé' : 'Activer livraison (DEMANDER)'}
                    </Button>
                  </div>
                </div>

                {/* Client Delivery Coordinates if provided */}
                {(detailsCard.shipping_name || detailsCard.shipping_address || detailsCard.shipping_phone) && (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1.5 text-xs">
                    <span className="font-bold text-blue-950 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-700" />
                      Coordonnées de livraison indiquées par le client :
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Destinataire :</span>
                        <span className="font-semibold">{detailsCard.shipping_name || 'Non spécifié'}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-slate-500 block">Adresse de livraison :</span>
                        <span className="font-semibold">{detailsCard.shipping_address || 'Non spécifiée'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Téléphone de contact :</span>
                        <span className="font-semibold">{detailsCard.shipping_phone || 'Non spécifié'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6-Step Visual Timeline with Direct Click Selection */}
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CARD_SHIPMENT_STEPS.map((stepName, idx) => {
                      const currentStep = detailsCard.shipment_step ?? 0;
                      const isCurrent = currentStep === idx;
                      const isPast = currentStep > idx;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setDetailsCard({
                            ...detailsCard,
                            shipping_requested: true,
                            shipment_step: idx
                          })}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                            isCurrent
                              ? 'bg-[#0f2b5c] text-white border-[#0f2b5c] shadow-sm ring-2 ring-[#0f2b5c]/20'
                              : isPast
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span>Étape {idx + 1}</span>
                            {isPast ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : isCurrent ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            ) : null}
                          </div>
                          <p className="text-xs font-semibold mt-1 truncate">
                            {stepName}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Step controls */}
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={(detailsCard.shipment_step ?? 0) <= 0}
                      onClick={() => setDetailsCard({
                        ...detailsCard,
                        shipping_requested: true,
                        shipment_step: Math.max(0, (detailsCard.shipment_step ?? 0) - 1)
                      })}
                      className="text-xs h-8 rounded-xl cursor-pointer"
                    >
                      ← Étape précédente
                    </Button>

                    <span className="text-xs font-semibold text-slate-700">
                      Étape {(detailsCard.shipment_step ?? 0) + 1} / 6 : <span className="text-[#0f2b5c] font-bold">{CARD_SHIPMENT_STEPS[detailsCard.shipment_step ?? 0]}</span>
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={(detailsCard.shipment_step ?? 0) >= CARD_SHIPMENT_STEPS.length - 1}
                      onClick={() => setDetailsCard({
                        ...detailsCard,
                        shipping_requested: true,
                        shipment_step: Math.min(CARD_SHIPMENT_STEPS.length - 1, (detailsCard.shipment_step ?? 0) + 1)
                      })}
                      className="text-xs h-8 rounded-xl cursor-pointer text-[#0f2b5c] border-[#0f2b5c]/30 font-semibold"
                    >
                      Étape suivante →
                    </Button>
                  </div>

                  {/* Dedicated Confirm and Save Shipment Step Button */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between flex-wrap gap-2 mt-2">
                    <div className="text-xs text-emerald-950">
                      <p className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Confirmer et enregistrer cette étape de livraison
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Cette étape s'affichera immédiatement dans « Suivi d'expédition à domicile » chez le client.
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleConfirmCurrentShipmentStep}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirmer & Enregistrer l'étape
                    </Button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetailsModalOpen(false)}
                  className="rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Fermer
                </Button>
                <Button
                  type="button"
                  disabled={updatingCard}
                  onClick={handleSaveDetailsCard}
                  className="bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white rounded-xl text-xs h-10 px-6 font-semibold cursor-pointer"
                >
                  {updatingCard ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Enregistrer les modifications
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
