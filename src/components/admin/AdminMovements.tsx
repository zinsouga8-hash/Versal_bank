import React, { useEffect, useState, useRef } from 'react';
import { 
  fetchMovementsPaginatedFromSupabase,
  saveTransactionToSupabase, 
  deleteTransactionFromSupabase,
  saveMovementToSupabase,
  fetchClientsPaginated,
  getClientProfileByEmailOrId,
  saveClientToSupabase,
  subscribeToBankData
} from '../../lib/supabaseBankService';
import { ClientAccount, MovementKind, MovementDirection, MovementStatus } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Plus, RefreshCw, ArrowUpRight, ArrowDownLeft, Trash2, Clock, 
  CheckCircle2, ArrowLeftRight, Check, X, XCircle, Search, ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { notifyMovementStatusUpdated } from '../../lib/emailService';

export default function AdminMovements() {
  const [movements, setMovements] = useState<any[]>([]);
  const [clients, setClients] = useState<(ClientAccount & { id: string })[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');

  // Server-side pagination states (Fixed 10 per page as requested)
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalMovements, setTotalMovements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [selectedMoveDetail, setSelectedMoveDetail] = useState<any | null>(null);

  // New manual movement form
  const [targetClientId, setTargetClientId] = useState<string>('');
  const [kind, setKind] = useState<MovementKind>('deposit');
  const [direction, setDirection] = useState<MovementDirection>('credit');
  const [amount, setAmount] = useState<number>(1000);
  const [currency, setCurrency] = useState<string>('CAD');
  const [method, setMethod] = useState<string>('Virement Bancaire International');
  const [motif, setMotif] = useState<string>('Crédit de compte / Dépôt de fonds');
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');

  const fetchSeqRef = useRef(0);
  const currentParamsRef = useRef({ page: 1, search: '', status: 'all', kind: 'all' });
  currentParamsRef.current = { page, search: searchTerm, status: filterType, kind: kindFilter };

  const fetchMovements = async (
    isManual = false,
    targetPage = page,
    targetSearch = searchTerm,
    targetStatus = filterType,
    targetKind = kindFilter
  ) => {
    const seq = ++fetchSeqRef.current;

    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetchMovementsPaginatedFromSupabase({
        page: targetPage,
        limit,
        search: targetSearch,
        status: targetStatus,
        kind: targetKind,
      });

      if (seq === fetchSeqRef.current) {
        if (Array.isArray(res.movements)) {
          setMovements(res.movements);
        }
        setTotalMovements(res.total);
        setTotalPages(res.totalPages);
        setPage(res.page);
      }
    } catch (e) {
      console.error(e);
      console.warn("Erreur mouvements", e);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchMovements(false, 1, searchTerm, filterType, kindFilter);
    const unsub = subscribeToBankData(() => {
      fetchMovements(
        false, 
        currentParamsRef.current.page, 
        currentParamsRef.current.search, 
        currentParamsRef.current.status, 
        currentParamsRef.current.kind
      );
    });
    return () => unsub();
  }, []);

  const handleStatusChange = (newStatus: string) => {
    setFilterType(newStatus);
    setPage(1);
    fetchMovements(false, 1, searchTerm, newStatus, kindFilter);
  };

  const handleKindChange = (newKind: string) => {
    setKindFilter(newKind);
    setPage(1);
    fetchMovements(false, 1, searchTerm, filterType, newKind);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
    fetchMovements(false, 1, val, filterType, kindFilter);
  };

  const handleOpenNewMovementModal = async () => {
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

  const handleUpdateStatus = async (move: any, newStatus: MovementStatus) => {
    setUpdatingStatusId(move.id);
    try {
      const isCredit = move.direction === 'credit' || move.type === 'deposit';
      const moveAmount = Number(move.amount) || 0;

      // Fetch or find client to adjust balance without loading entire database
      let client = clients.find(c => c.id === move.account_id || c.id === move.user_id || c.user_email === move.user_email || c.user_email === move.client_email);
      if (!client) {
        try {
          client = await getClientProfileByEmailOrId(move.account_id || move.user_id || move.user_email || move.client_email);
        } catch (_) {}
      }

      if (client) {
        let newBalance = client.balance || 0;
        let balanceChanged = false;

        if (isCredit) {
          if (move.status !== 'completed' && newStatus === 'completed') {
            newBalance += moveAmount;
            balanceChanged = true;
          } else if (move.status === 'completed' && newStatus !== 'completed') {
            newBalance = Math.max(0, newBalance - moveAmount);
            balanceChanged = true;
          }
        } else {
          if (move.status === 'pending' && newStatus === 'completed') {
            balanceChanged = false;
          } else if (move.status === 'pending' && (newStatus === 'failed' || newStatus === 'cancelled' || newStatus === 'rejected')) {
            newBalance += moveAmount;
            balanceChanged = true;
          } else if ((move.status === 'failed' || move.status === 'cancelled' || move.status === 'rejected') && newStatus === 'completed') {
            newBalance = Math.max(0, newBalance - moveAmount);
            balanceChanged = true;
          } else if ((move.status === 'failed' || move.status === 'cancelled' || move.status === 'rejected') && newStatus === 'pending') {
            newBalance = Math.max(0, newBalance - moveAmount);
            balanceChanged = true;
          } else if (move.status === 'completed' && (newStatus === 'failed' || newStatus === 'cancelled' || newStatus === 'rejected')) {
            newBalance += moveAmount;
            balanceChanged = true;
          }
        }

        if (balanceChanged) {
          await saveClientToSupabase({ id: client.id, profile_id: client.profile_id, user_email: client.user_email, balance: newBalance });
          setClients(prev => prev.map(c => c.id === client.id ? { ...c, balance: newBalance } : c));
        }
      }

      await saveTransactionToSupabase({ ...move, status: newStatus });
      await saveMovementToSupabase({
        account_id: move.account_id || client?.client_id || client?.id || '',
        client_id: move.client_id || client?.client_id || client?.id || '',
        client_email: move.client_email || move.user_email || client?.user_email || '',
        user_email: move.user_email || move.client_email || client?.user_email || '',
        kind: move.kind || (isCredit ? 'deposit' : 'transfer'),
        direction: isCredit ? 'credit' : 'debit',
        method: move.method || 'Virement',
        amount: moveAmount,
        currency: move.currency || 'CAD',
        beneficiary_name: move.beneficiary_name || move.recipient_name || '',
        motif: move.motif || move.description || 'Virement bancaire',
        description: move.description || move.motif || 'Virement bancaire',
        reference: move.reference || move.id || `REF-${Date.now()}`,
        status: newStatus as any,
        createdAt: move.createdAt || Date.now(),
      });
      window.dispatchEvent(new Event('versalbank_update'));

      setMovements(prev => prev.map(m => m.id === move.id ? { ...m, status: newStatus } : m));
      if (selectedMoveDetail?.id === move.id) {
        setSelectedMoveDetail((prev: any) => prev ? { ...prev, status: newStatus } : null);
      }

      const recipientEmail = move.user_email || move.client_email || client?.user_email;
      if (recipientEmail) {
        notifyMovementStatusUpdated(
          { 
            user_email: recipientEmail, 
            first_name: client?.first_name || move.first_name || '' 
          },
          { 
            id: move.reference || move.id, 
            amount: moveAmount, 
            currency: move.currency || 'CAD', 
            type: isCredit ? 'credit' : 'debit', 
            status: newStatus,
            recipient_name: move.recipient_name || move.beneficiary_name || move.carrier_name || ''
          }
        ).catch(err => console.warn("Email notify movement update error:", err));
      }

      if (newStatus === 'completed') {
        toast.success("Virement validé avec succès. Email de confirmation envoyé au client.");
      } else if (newStatus === 'failed' || newStatus === 'rejected') {
        toast.success("Virement rejeté. Fonds recrédités et email de notification transmis au client.");
      } else if (newStatus === 'pending') {
        toast.success("Virement maintenu en attente. Email d'information transmis au client.");
      } else {
        toast.success(`Statut mis à jour (${newStatus}).`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur de mise à jour du statut.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous supprimer l'enregistrement de ce mouvement ?")) return;
    try {
      await deleteTransactionFromSupabase(id);
      setMovements(prev => prev.filter(m => m.id !== id));
      if (selectedMoveDetail?.id === id) {
        setSelectedMoveDetail(null);
      }
      toast.success("Mouvement supprimé.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression.");
    }
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClientId) return toast.error("Veuillez sélectionner un client");
    const targetClient = clients.find(c => c.id === targetClientId);
    if (!targetClient) return;

    setCreating(true);
    try {
      const newMove = {
        type: kind,
        direction: direction,
        amount: Number(amount),
        currency: currency,
        status: 'completed' as MovementStatus,
        reference: `VBD-${Math.random().toString(36).substring(2,8).toUpperCase()}`,
        account_id: targetClient.id,
        user_id: targetClient.id,
        user_email: targetClient.user_email,
        motif: motif,
        description: motif,
        beneficiary_name: beneficiaryName,
        payment_method: method,
        created_at: new Date().toISOString(),
      };
      await saveTransactionToSupabase(newMove);
      await saveMovementToSupabase({
        account_id: targetClient.client_id || targetClient.id,
        client_id: targetClient.client_id || targetClient.id,
        client_email: targetClient.user_email || '',
        user_email: targetClient.user_email || '',
        kind: kind as any,
        direction: direction as any,
        method: method || 'Virement administratif',
        amount: Number(amount),
        currency: currency,
        beneficiary_name: beneficiaryName || `${targetClient.first_name} ${targetClient.last_name}`,
        motif: motif,
        description: motif,
        reference: newMove.reference,
        status: 'completed',
        createdAt: Date.now(),
      });
      window.dispatchEvent(new Event('versalbank_update'));

      let newBalance = targetClient.balance || 0;
      if (direction === 'credit') {
        newBalance += Number(amount);
      } else {
        newBalance = Math.max(0, newBalance - Number(amount));
      }
      await saveClientToSupabase({ id: targetClient.id, balance: newBalance });
      toast.success("Mouvement enregistré et solde client mis à jour !");
      setModalOpen(false);
      fetchMovements(true, 1, searchTerm, filterType, kindFilter);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-slate-900">Dépôts, Retraits & Mouvements</h2>
          <p className="text-sm text-slate-500">Supervision des opérations comptables des comptes clients.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            onClick={() => fetchMovements(true, page, searchTerm, filterType, kindFilter)} 
            variant="outline" 
            size="sm" 
            disabled={refreshing || loading}
            className="h-9 px-3 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            onClick={handleOpenNewMovementModal} 
            size="sm" 
            className="h-9 px-4 bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white shadow-xs flex-1 sm:flex-none cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau mouvement
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              type="text" 
              placeholder="Rechercher par référence, email client, libellé..." 
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-10 bg-white rounded-xl text-sm border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={kindFilter} onValueChange={handleKindChange}>
              <SelectTrigger className="w-[140px] h-10 bg-white rounded-xl text-xs">
                <SelectValue placeholder="Type d'opération" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="deposit">Dépôts (+)</SelectItem>
                <SelectItem value="transfer">Virements (-)</SelectItem>
                <SelectItem value="withdrawal">Retraits (-)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[130px] h-10 bg-white rounded-xl text-xs font-medium">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="completed">Validés</SelectItem>
                <SelectItem value="failed">Rejetés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 pt-1">
          <Button 
            variant={filterType === 'all' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => handleStatusChange('all')} 
            className={`h-7 text-xs rounded-full cursor-pointer ${filterType === 'all' ? 'bg-[#0f2b5c] text-white' : ''}`}
          >
            Tous
          </Button>
          <Button 
            variant={filterType === 'pending' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => handleStatusChange('pending')} 
            className={`h-7 text-xs rounded-full cursor-pointer ${filterType === 'pending' ? 'bg-amber-600 text-white' : ''}`}
          >
            En attente
          </Button>
          <Button 
            variant={filterType === 'completed' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => handleStatusChange('completed')} 
            className={`h-7 text-xs rounded-full cursor-pointer ${filterType === 'completed' ? 'bg-emerald-600 text-white' : ''}`}
          >
            Approuvés
          </Button>
          <Button 
            variant={filterType === 'failed' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => handleStatusChange('failed')} 
            className={`h-7 text-xs rounded-full cursor-pointer ${filterType === 'failed' ? 'bg-rose-600 text-white' : ''}`}
          >
            Rejetés
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0f2b5c]" />
          <span className="text-xs text-slate-500">Chargement des mouvements paginés...</span>
        </div>
      ) : movements.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
          <ArrowLeftRight className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">Aucun mouvement trouvé</h3>
          <p className="text-xs text-slate-400 mt-1">Aucune transaction ne correspond aux critères sélectionnés.</p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW */}
          <div className="block sm:hidden space-y-3">
            {movements.map((move) => {
              const isCredit = move.direction === 'credit' || move.type === 'deposit';
              return (
                <div key={move.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{move.user_email || move.client_email || 'Client'}</div>
                      <div className="text-[11px] font-mono text-slate-400">{move.reference || move.id}</div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      move.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : move.status === 'pending'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {move.status === 'completed' ? 'Approuvé' : move.status === 'pending' ? 'En attente' : 'Rejeté'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
                    <span className={`inline-flex items-center gap-1 font-semibold ${isCredit ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {isCredit ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />}
                      {isCredit ? 'Crédit / Dépôt' : 'Débit / Retrait'}
                    </span>
                    <span className={`font-mono font-bold text-sm solde-banque ${isCredit ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {isCredit ? '+' : '-'}{Number(move.amount || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} {move.currency || 'CAD'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedMoveDetail(move)}
                      className="text-xs h-8 px-2.5 rounded-lg border-slate-200 text-slate-700 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Détail
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        disabled={updatingStatusId === move.id}
                        onClick={() => handleUpdateStatus(move, 'completed')}
                        className={`text-[11px] h-8 px-2 rounded-lg font-medium cursor-pointer ${
                          move.status === 'completed'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white'
                        }`}
                      >
                        <Check className="w-3 h-3 mr-0.5" /> Valider
                      </Button>
                      <Button
                        size="sm"
                        disabled={updatingStatusId === move.id}
                        onClick={() => handleUpdateStatus(move, 'failed')}
                        className={`text-[11px] h-8 px-2 rounded-lg font-medium cursor-pointer ${
                          move.status === 'failed' || move.status === 'rejected'
                            ? 'bg-rose-700 text-white'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white'
                        }`}
                      >
                        <X className="w-3 h-3 mr-0.5" /> Rejeter
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW */}
          <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Client / Réf</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Type / Direction</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Motif / Bénéficiaire</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Montant</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((move) => {
                  const isCredit = move.direction === 'credit' || move.type === 'deposit';
                  return (
                    <TableRow key={move.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {move.user_email || move.client_email || 'Client'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {move.reference || move.id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isCredit ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {isCredit ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />}
                          {isCredit ? 'Crédit / Dépôt' : 'Débit / Retrait'}
                        </span>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {move.method || move.kind || 'Virement'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-800 line-clamp-1 max-w-[200px]">
                          {move.motif || move.description || 'Opération de compte'}
                        </div>
                        {move.beneficiary_name && (
                          <div className="text-[11px] text-slate-500">
                            Bénéficiaire : {move.beneficiary_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono font-bold text-sm solde-banque ${isCredit ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {isCredit ? '+' : '-'}{Number(move.amount || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 ml-1">
                          {move.currency || 'CAD'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          move.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : move.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {move.status === 'completed' ? 'Approuvé' : move.status === 'pending' ? 'En attente' : 'Rejeté'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedMoveDetail(move)}
                            className="text-xs h-7.5 px-2 text-slate-600 hover:text-[#0f2b5c] hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Voir les détails complets de cette opération"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Détail
                          </Button>
                          <Button
                            size="sm"
                            disabled={updatingStatusId === move.id}
                            onClick={() => handleUpdateStatus(move, 'completed')}
                            className={`text-xs h-7.5 px-2.5 rounded-lg cursor-pointer font-medium transition-all ${
                              move.status === 'completed'
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200'
                            }`}
                            title="Valider le virement (notifie le client par email)"
                          >
                            <Check className="w-3 h-3 mr-1" /> Valider
                          </Button>
                          <Button
                            size="sm"
                            disabled={updatingStatusId === move.id}
                            onClick={() => handleUpdateStatus(move, 'failed')}
                            className={`text-xs h-7.5 px-2.5 rounded-lg cursor-pointer font-medium transition-all ${
                              move.status === 'failed' || move.status === 'rejected'
                                ? 'bg-rose-700 text-white shadow-xs'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200'
                            }`}
                            title="Rejeter le virement (recrédite le solde et notifie par email)"
                          >
                            <X className="w-3 h-3 mr-1" /> Rejeter
                          </Button>
                          <Button
                            size="sm"
                            disabled={updatingStatusId === move.id}
                            onClick={() => handleUpdateStatus(move, 'pending')}
                            className={`text-xs h-7.5 px-2.5 rounded-lg cursor-pointer font-medium transition-all ${
                              move.status === 'pending'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white border border-amber-200'
                            }`}
                            title="Garder ou remettre en attente"
                          >
                            <Clock className="w-3 h-3 mr-1" /> En attente
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(move.id)}
                            className="text-xs h-7.5 w-7.5 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer ml-0.5"
                            title="Supprimer la transaction"
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
              Affichage de <span className="font-semibold text-slate-900">{totalMovements === 0 ? 0 : (page - 1) * limit + 1}</span> à <span className="font-semibold text-slate-900">{Math.min(page * limit, totalMovements)}</span> sur <span className="font-semibold text-slate-900">{totalMovements}</span> opérations
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => {
                  const prev = Math.max(1, page - 1);
                  setPage(prev);
                  fetchMovements(false, prev, searchTerm, filterType, kindFilter);
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
                  fetchMovements(false, next, searchTerm, filterType, kindFilter);
                }}
                className="text-xs h-8 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Suivant <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* OPERATION DETAIL MODAL (Loaded on-demand only when clicking "Détail") */}
      <Dialog open={Boolean(selectedMoveDetail)} onOpenChange={(open) => !open && setSelectedMoveDetail(null)}>
        <DialogContent className="max-w-md w-[95vw] p-5 rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-serif font-bold text-slate-900 flex items-center justify-between">
              <span>Détails de l'opération</span>
              {selectedMoveDetail && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                  selectedMoveDetail.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedMoveDetail.status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {selectedMoveDetail.status === 'completed' ? 'Approuvé' : selectedMoveDetail.status === 'pending' ? 'En attente' : 'Rejeté'}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedMoveDetail && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-2 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Référence :</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedMoveDetail.reference || selectedMoveDetail.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Client / Email :</span>
                  <span className="font-medium text-slate-900">{selectedMoveDetail.user_email || selectedMoveDetail.client_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Montant :</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {Number(selectedMoveDetail.amount || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} {selectedMoveDetail.currency || 'CAD'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sens :</span>
                  <span className="font-semibold text-slate-800">
                    {selectedMoveDetail.direction === 'credit' || selectedMoveDetail.type === 'deposit' ? 'Crédit (+) Dépôt' : 'Débit (-) Virement / Retrait'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Méthode :</span>
                  <span className="text-slate-800">{selectedMoveDetail.method || selectedMoveDetail.payment_method || 'Virement bancaire'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date :</span>
                  <span className="text-slate-800">
                    {selectedMoveDetail.created_at ? format(new Date(selectedMoveDetail.created_at), 'dd MMMM yyyy HH:mm', { locale: fr }) : 'Non daté'}
                  </span>
                </div>
              </div>

              {selectedMoveDetail.beneficiary_name && (
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Bénéficiaire :</span>
                  <span className="font-medium text-slate-900">{selectedMoveDetail.beneficiary_name}</span>
                </div>
              )}

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500 block mb-0.5">Motif / Libellé :</span>
                <span className="text-slate-900">{selectedMoveDetail.motif || selectedMoveDetail.description || 'Opération de compte'}</span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <Button
                  size="sm"
                  onClick={() => handleUpdateStatus(selectedMoveDetail, 'completed')}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Valider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedMoveDetail, 'failed')}
                  className="flex-1 border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl text-xs h-9 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Rejeter
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CREATE MANUAL MOVEMENT MODAL (Clients loaded on-demand only when opening modal) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif font-bold text-slate-900">
              Saisir un Mouvement Comptable
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMovement} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Client Bénéficiaire / Débiteur</Label>
              {loadingClients ? (
                <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 rounded-xl text-xs text-slate-500 mt-1">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0f2b5c]" />
                  <span>Chargement de la liste des clients...</span>
                </div>
              ) : (
                <Select value={targetClientId} onValueChange={setTargetClientId}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-sm">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({c.user_email}) — Solde: {c.balance} {c.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Sens Comptable</Label>
                <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-sm font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Crédit (+) — Dépôt de fonds</SelectItem>
                    <SelectItem value="debit">Débit (-) — Retrait / Sortie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Type d'opération</Label>
                <Select value={kind} onValueChange={(v: any) => setKind(v)}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Dépôt externe</SelectItem>
                    <SelectItem value="transfer">Virement bancaire</SelectItem>
                    <SelectItem value="withdrawal">Retrait guichet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Montant</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={amount} 
                  onChange={e => setAmount(Number(e.target.value))}
                  className="mt-1 h-10 rounded-xl bg-slate-50 font-bold"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Devise</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">CAD ($ Canadien)</SelectItem>
                    <SelectItem value="USD">USD ($ US)</SelectItem>
                    <SelectItem value="EUR">EUR (€ Euro)</SelectItem>
                    <SelectItem value="GBP">GBP (£ Sterling)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Motif de l'opération</Label>
              <Input 
                value={motif} 
                onChange={e => setMotif(e.target.value)}
                className="mt-1 h-10 rounded-xl bg-slate-50 text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
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
                Valider
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
