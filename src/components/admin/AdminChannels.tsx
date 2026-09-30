import React, { useEffect, useState } from 'react';
import { fetchFundingChannels, saveFundingChannels, DEFAULT_FUNDING_CHANNELS } from '../../lib/supabaseBankService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Edit, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Landmark, 
  Coins, 
  Wallet, 
  Globe2, 
  CreditCard, 
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

export interface AdminPaymentChannel {
  id: string;
  name: string;
  title?: string;
  category: string;
  description?: string;
  badge?: string;
  addressLabel: string;
  addressValue: string;
  notes?: string;
  active: boolean;
  isCrypto?: boolean;
  order?: number;
}

export default function AdminChannels() {
  const [channels, setChannels] = useState<AdminPaymentChannel[]>(() => {
    try {
      const raw = localStorage.getItem('versalbank_funding_channels');
      return raw ? JSON.parse(raw) : DEFAULT_FUNDING_CHANNELS;
    } catch {
      return DEFAULT_FUNDING_CHANNELS;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const raw = localStorage.getItem('versalbank_funding_channels');
      return !raw || JSON.parse(raw).length === 0;
    } catch {
      return false;
    }
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AdminPaymentChannel | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New channel state
  const [isNew, setIsNew] = useState(false);

  const loadChannels = async (isInitial = false) => {
    if (isInitial && channels.length === 0) {
      setLoading(true);
    }
    try {
      const data = await fetchFundingChannels();
      setChannels(data);
    } catch (e) {
      console.error('Erreur chargement canaux:', e);
      toast.error("Erreur lors du chargement des moyens de recharge.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      const updated = channels.map(c => c.id === id ? { ...c, active: !current } : c);
      await saveFundingChannels(updated);
      setChannels(updated);
      toast.success(!current ? "Moyen de dépôt activé pour tous les clients !" : "Moyen de dépôt masqué pour les clients.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du changement de statut.");
    }
  };

  const handleOpenEdit = (channel: AdminPaymentChannel) => {
    setEditingChannel({ ...channel });
    setIsNew(false);
    setEditModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingChannel({
      id: `chan_${Date.now()}`,
      name: '',
      title: '',
      category: 'Fintech & Portefeuilles',
      description: 'Dépôt sécurisé vers la trésorerie VersalBank.',
      badge: 'Nouveau',
      addressLabel: 'Coordonnées de paiement',
      addressValue: '',
      notes: 'Veuillez préciser votre nom et identifiant client dans la référence.',
      active: true,
      isCrypto: false,
      order: channels.length + 1,
    });
    setIsNew(true);
    setEditModalOpen(true);
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel) return;

    if (!editingChannel.name.trim() || !editingChannel.addressValue.trim()) {
      toast.error("Veuillez renseigner au minimum le nom et les coordonnées de dépôt.");
      return;
    }

    setSubmitting(true);
    try {
      const normalizedChannel: AdminPaymentChannel = {
        ...editingChannel,
        name: editingChannel.name.trim(),
        title: editingChannel.name.trim(),
        addressLabel: (editingChannel.addressLabel || 'Coordonnées de dépôt').trim(),
        addressValue: editingChannel.addressValue.trim(),
        notes: (editingChannel.notes || '').trim(),
        description: (editingChannel.description || '').trim(),
      };

      let updated: AdminPaymentChannel[];
      if (isNew) {
        updated = [...channels, normalizedChannel];
      } else {
        updated = channels.map(c => c.id === normalizedChannel.id ? normalizedChannel : c);
      }

      await saveFundingChannels(updated);
      setChannels(updated);
      toast.success(isNew ? "Nouveau moyen de dépôt ajouté et visible chez les clients !" : "Coordonnées de dépôt mises à jour avec succès pour tous les clients !");
      setEditModalOpen(false);
      setEditingChannel(null);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Confirmer la suppression du moyen de dépôt « ${name} » ?`)) return;
    try {
      const updated = channels.filter(c => c.id !== id);
      await saveFundingChannels(updated);
      setChannels(updated);
      toast.success("Moyen de dépôt supprimé.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression.");
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm("Voulez-vous réinitialiser tous les moyens de recharge aux coordonnées d'origine de VersalBank (10 méthodes complètes) ?")) return;
    try {
      await saveFundingChannels(DEFAULT_FUNDING_CHANNELS);
      setChannels(DEFAULT_FUNDING_CHANNELS);
      toast.success("Moyens de recharge réinitialisés aux coordonnées officielles.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la réinitialisation.");
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category.toLowerCase().includes('crypto')) return <Coins className="w-4 h-4 text-amber-600" />;
    if (category.toLowerCase().includes('virement') || category.toLowerCase().includes('bancaire')) return <Landmark className="w-4 h-4 text-blue-600" />;
    if (category.toLowerCase().includes('agence') || category.toLowerCase().includes('espèce')) return <Globe2 className="w-4 h-4 text-purple-600" />;
    return <Wallet className="w-4 h-4 text-emerald-600" />;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-serif font-bold text-slate-900">
              Moyens de Paiement & Coordonnées de Dépôt
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              {channels.length} canaux
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">
            Tous les moyens de dépôt figurant dans l'onglet <strong>RECHARGE</strong> du client. 
            Les coordonnées et consignes modifiées ici s'appliquent automatiquement et instantanément à tous les comptes clients.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetDefaults}
            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 h-9 rounded-xl cursor-pointer"
            title="Rétablir les coordonnées par défaut de la banque"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Par défaut
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadChannels} 
            disabled={loading}
            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 h-9 rounded-xl cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>

          <Button 
            onClick={handleOpenNew}
            className="bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs h-9 px-4 rounded-xl font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Ajouter un moyen
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0f2b5c]" />
          <p className="text-sm font-medium">Chargement des moyens de paiement client...</p>
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-6">
          <Landmark className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-700">Aucun moyen de recharge configuré.</p>
          <Button onClick={handleResetDefaults} className="mt-4 bg-[#0f2b5c] text-white rounded-xl text-xs h-9">
            Charger les 10 moyens par défaut
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile cards */}
          <div className="block lg:hidden space-y-3">
            {channels.map((chan) => (
              <div key={chan.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-100">
                      {getCategoryIcon(chan.category)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        {chan.name || chan.title}
                        {chan.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {chan.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{chan.category}</div>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    chan.active ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {chan.active ? 'Affiché client' : 'Masqué client'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    {chan.addressLabel || 'Coordonnées affichées chez le client'} :
                  </span>
                  <div className="font-mono text-xs font-semibold text-slate-900 break-all select-all">
                    {chan.addressValue}
                  </div>
                </div>

                {chan.notes && (
                  <p className="text-[11px] text-slate-600 italic">
                    « {chan.notes} »
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(chan.id, chan.active)}
                    className={`text-xs h-8 rounded-xl cursor-pointer ${
                      chan.active ? 'text-amber-700 border-amber-200 hover:bg-amber-50' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {chan.active ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                    {chan.active ? 'Masquer' : 'Activer'}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleOpenEdit(chan)}
                      className="text-xs h-8 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" /> Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(chan.id, chan.name || chan.title || '')}
                      className="text-xs h-8 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Moyen de Dépôt (Onglet RECHARGE)</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Catégorie & Badge</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Coordonnées affichées chez les clients</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Instructions / Notes client</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-center">Statut Client</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((chan) => (
                  <TableRow key={chan.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-semibold text-slate-900 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                          {getCategoryIcon(chan.category)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{chan.name || chan.title}</div>
                          <div className="text-[11px] text-slate-400 font-mono">id: {chan.id}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-medium text-slate-700">{chan.category}</div>
                      {chan.badge && (
                        <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {chan.badge}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="max-w-[280px]">
                      <div className="text-[10px] font-bold uppercase text-slate-500 truncate">
                        {chan.addressLabel || 'Coordonnées'}
                      </div>
                      <div className="font-mono text-xs font-semibold text-slate-900 break-all select-all mt-0.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        {chan.addressValue}
                      </div>
                    </TableCell>

                    <TableCell className="max-w-[260px]">
                      <p className="text-xs text-slate-600 line-clamp-2" title={chan.notes}>
                        {chan.notes || <span className="text-slate-400 italic">Aucune consigne</span>}
                      </p>
                    </TableCell>

                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(chan.id, chan.active)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          chan.active 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300'
                        }`}
                        title={chan.active ? "Cliquer pour masquer du compte client" : "Cliquer pour afficher dans le compte client"}
                      >
                        {chan.active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Activé</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Masqué</span>
                          </>
                        )}
                      </button>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleOpenEdit(chan)}
                          className="text-xs h-8 rounded-xl border-slate-200 hover:bg-slate-100 cursor-pointer font-medium"
                        >
                          <Edit className="w-3 h-3 mr-1" /> Modifier
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(chan.id, chan.name || chan.title || '')}
                          className="text-xs h-8 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                          title="Supprimer ce moyen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* EDIT / CREATE MODAL */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-xl w-[95vw] p-4 sm:p-6 rounded-2xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#0f2b5c]" />
              {isNew ? 'Ajouter un Moyen de Recharge Client' : `Modifier les Coordonnées : ${editingChannel?.name}`}
            </DialogTitle>
          </DialogHeader>

          {editingChannel && (
            <form onSubmit={handleSaveChannel} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Nom du moyen de dépôt *</Label>
                  <Input 
                    value={editingChannel.name} 
                    onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })} 
                    placeholder="ex: Revolut, Wise, IBAN Trésorerie..."
                    required
                    className="mt-1 h-10 rounded-xl bg-slate-50 text-sm font-semibold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Catégorie *</Label>
                  <Select 
                    value={editingChannel.category} 
                    onValueChange={(val) => setEditingChannel({ ...editingChannel, category: val })}
                  >
                    <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fintech & Portefeuilles">Fintech & Portefeuilles</SelectItem>
                      <SelectItem value="Virements Bancaires">Virements Bancaires</SelectItem>
                      <SelectItem value="Cryptomonnaies">Cryptomonnaies</SelectItem>
                      <SelectItem value="Agences & Espèces">Agences & Espèces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Badge / Mention rapide</Label>
                  <Input 
                    value={editingChannel.badge || ''} 
                    onChange={(e) => setEditingChannel({ ...editingChannel, badge: e.target.value })} 
                    placeholder="ex: Instantané, TRC20, Sans frais, Cash..."
                    className="mt-1 h-10 rounded-xl bg-slate-50 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Libellé des coordonnées client *</Label>
                  <Input 
                    value={editingChannel.addressLabel} 
                    onChange={(e) => setEditingChannel({ ...editingChannel, addressLabel: e.target.value })} 
                    placeholder="ex: IBAN Trésorerie Centrale, Adresse USDT, Revtag..."
                    required
                    className="mt-1 h-10 rounded-xl bg-slate-50 text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Coordonnées affichées chez le client (IBAN / Revtag / Adresse crypto / Email / Agence) *
                </Label>
                <Textarea 
                  value={editingChannel.addressValue} 
                  onChange={(e) => setEditingChannel({ ...editingChannel, addressValue: e.target.value })} 
                  placeholder="ex: FR76 3000 4818 4706 52099 300 ou TLx8jD8ZqM2z9Vp7f3k4mB1wQe5rTy6uXa"
                  required
                  rows={3}
                  className="mt-1 rounded-xl bg-slate-50 text-sm font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Ce texte exact sera copié par le client lorsqu'il cliquera sur le bouton « Copier » dans l'onglet RECHARGE.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Consignes & Instructions affichées au client</Label>
                <Textarea 
                  value={editingChannel.notes || ''} 
                  onChange={(e) => setEditingChannel({ ...editingChannel, notes: e.target.value })} 
                  placeholder="ex: Veuillez mentionner votre identifiant client dans la référence du virement..."
                  rows={2}
                  className="mt-1 rounded-xl bg-slate-50 text-sm"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Visibilité dans l'onglet RECHARGE</span>
                  <span className="text-[11px] text-slate-500">
                    {editingChannel.active 
                      ? 'Actuellement visible et utilisable par tous les clients.' 
                      : 'Masqué. Les clients ne peuvent pas voir ce moyen pour le moment.'}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingChannel({ ...editingChannel, active: !editingChannel.active })}
                  className={`text-xs h-8 rounded-xl font-bold cursor-pointer ${
                    editingChannel.active ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {editingChannel.active ? 'Actif' : 'Masqué'}
                </Button>
              </div>

              <DialogFooter className="pt-3 border-t border-slate-200 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="bg-[#0f2b5c] hover:bg-[#0a1e40] text-white rounded-xl text-xs h-10 px-6 font-semibold cursor-pointer shadow-xs"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Enregistrer et appliquer aux clients
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
