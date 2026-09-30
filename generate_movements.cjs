const fs = require('fs');
const content = `
import React, { useEffect, useState } from 'react';
import { 
  fetchTransactionsFromSupabase, 
  saveTransactionToSupabase, 
  deleteTransactionFromSupabase,
  fetchClientsFromSupabase,
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
import { Loader2, Plus, RefreshCw, ArrowUpRight, ArrowDownLeft, Trash2, Clock, CheckCircle2, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { notifyMovementStatusUpdated } from '../../lib/emailService';

export default function AdminMovements() {
  const [movements, setMovements] = useState<any[]>([]);
  const [clients, setClients] = useState<(ClientAccount & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // New manual movement form
  const [targetClientId, setTargetClientId] = useState<string>('');
  const [kind, setKind] = useState<MovementKind>('deposit');
  const [direction, setDirection] = useState<MovementDirection>('credit');
  const [amount, setAmount] = useState<number>(1000);
  const [currency, setCurrency] = useState<string>('CAD');
  const [method, setMethod] = useState<string>('Virement Bancaire International');
  const [motif, setMotif] = useState<string>('Crédit de compte / Dépôt de fonds');
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const txData = await fetchTransactionsFromSupabase();
      setMovements(txData);

      const clientData = await fetchClientsFromSupabase();
      setClients(clientData);
      if (clientData.length > 0 && !targetClientId) {
        setTargetClientId(clientData[0].id);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la récupération des mouvements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = subscribeToBankData(() => {
      fetchData();
    });
    return () => unsub();
  }, []);

  const handleUpdateStatus = async (move: any, newStatus: MovementStatus) => {
    try {
      const isCredit = move.direction === 'credit' || move.type === 'deposit';
      const moveAmount = Number(move.amount) || 0;
      const client = clients.find(c => c.id === move.account_id || c.id === move.user_id || c.user_email === move.user_email);

      if (client) {
        let newBalance = client.balance || 0;
        if (move.status === 'completed' && newStatus !== 'completed') {
          if (isCredit) newBalance -= moveAmount;
          else newBalance += moveAmount;
        }
        if (move.status !== 'completed' && newStatus === 'completed') {
          if (isCredit) newBalance += moveAmount;
          else newBalance = Math.max(0, newBalance - moveAmount);
        }
        await saveClientToSupabase({ id: client.id, balance: newBalance });
      }

      await saveTransactionToSupabase({ ...move, status: newStatus });
      setMovements(prev => prev.map(m => m.id === move.id ? { ...m, status: newStatus } : m));

      if (move.user_email || move.client_email) {
        notifyMovementStatusUpdated(
          move.user_email || move.client_email,
          newStatus,
          moveAmount,
          move.currency || 'CAD',
          move.reference || move.id,
          isCredit
        );
      }
      toast.success(\`Statut mis à jour (\${newStatus}).\`);
    } catch (e) {
      console.error(e);
      toast.error("Erreur de mise à jour.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous supprimer l'enregistrement de ce mouvement ?")) return;
    try {
      await deleteTransactionFromSupabase(id);
      setMovements(prev => prev.filter(m => m.id !== id));
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
        status: 'completed',
        reference: \`VBD-\${Math.random().toString(36).substring(2,8).toUpperCase()}\`,
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

      let newBalance = targetClient.balance || 0;
      if (direction === 'credit') {
        newBalance += Number(amount);
      } else {
        newBalance = Math.max(0, newBalance - Number(amount));
      }
      await saveClientToSupabase({ id: targetClient.id, balance: newBalance });
      toast.success("Mouvement enregistré et solde client mis à jour !");
      setModalOpen(false);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création.");
    } finally {
      setCreating(false);
    }
  };

  const filteredMovements = movements.filter(m => {
    if (filterType === 'all') return true;
    return m.status === filterType;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-slate-900">Mouvements & Transactions</h2>
          <p className="text-sm text-slate-500">Supervision des opérations comptables des clients.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button onClick={() => fetchData()} variant="outline" size="sm" className="h-9 px-3 shrink-0 cursor-pointer">
            <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} />
          </Button>
          <Button onClick={() => setModalOpen(true)} size="sm" className="h-9 px-4 bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white shadow-md flex-1 sm:flex-none cursor-pointer">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau mouvement
          </Button>
        </div>
      </div>

      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
        <Button variant={filterType === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterType('all')} className={\`h-8 text-xs rounded-full \${filterType === 'all' ? 'bg-slate-800 text-white' : ''} cursor-pointer\`}>Tous</Button>
        <Button variant={filterType === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilterType('pending')} className={\`h-8 text-xs rounded-full \${filterType === 'pending' ? 'bg-amber-600 text-white' : ''} cursor-pointer\`}>En attente</Button>
        <Button variant={filterType === 'completed' ? 'default' : 'outline'} size="sm" onClick={() => setFilterType('completed')} className={\`h-8 text-xs rounded-full \${filterType === 'completed' ? 'bg-emerald-600 text-white' : ''} cursor-pointer\`}>Approuvés</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0f2b5c]" />
        </div>
      ) : filteredMovements.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
          <ArrowLeftRight className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">Aucun mouvement</h3>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto shadow-xs">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">Client / Réf</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Type / Direction</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Montant</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Statut</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((move) => {
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
                      <span className={\`inline-flex items-center gap-1 text-xs font-semibold \${isCredit ? 'text-emerald-700' : 'text-slate-700'}\`}>
                        {isCredit ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />}
                        {isCredit ? 'Crédit / Dépôt' : 'Débit / Retrait'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={\`font-mono font-bold text-sm \${isCredit ? 'text-emerald-700' : 'text-slate-900'}\`}>
                        {isCredit ? '+' : '-'}{Number(move.amount || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 ml-1">
                        {move.currency || 'CAD'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <select
                        value={move.status}
                        onChange={(e) => handleUpdateStatus(move, e.target.value as any)}
                        className="text-xs h-8 rounded-lg border border-slate-200 px-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-[#0f2b5c]/20"
                      >
                        <option value="pending">En attente</option>
                        <option value="completed">Approuvé</option>
                        <option value="failed">Rejeté</option>
                      </select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(move.id)}
                        className="text-xs h-8 text-rose-600 hover:bg-rose-50 cursor-pointer p-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

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
`;
fs.writeFileSync('src/components/admin/AdminMovements.tsx', content);
