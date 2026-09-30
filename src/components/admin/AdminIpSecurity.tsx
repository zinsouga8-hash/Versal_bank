import React, { useEffect, useState } from 'react';
import { fetchIpRules, saveIpRules } from '../../lib/supabaseBankService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { Loader2, ShieldAlert, ShieldCheck, Plus, Trash2, Ban, Shield, Globe, Lock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminIpSecurity() {
  const [ips, setIps] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('versalbank_ip_rules');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const raw = localStorage.getItem('versalbank_ip_rules');
      return !raw || JSON.parse(raw).length === 0;
    } catch {
      return false;
    }
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('Tentatives de connexion abusives / Activité suspecte');
  const [submitting, setSubmitting] = useState(false);

  const loadIps = async () => {
    setLoading(true);
    try {
      const data = await fetchIpRules();
      setIps(data);
    } catch (e) {
      console.error(e);
      toast.error("Impossible de récupérer la liste des IP sécurisées.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIps();
  }, []);

  const handleAddIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim()) {
      toast.error("Veuillez renseigner une adresse IP valide.");
      return;
    }

    setSubmitting(true);
    try {
      const newRule = {
        id: `ip_${Date.now()}`,
        ip: newIp.trim(),
        reason: newReason.trim(),
        active: true,
        createdAt: Date.now()
      };

      const updated = [newRule, ...ips];
      await saveIpRules(updated);
      setIps(updated);
      toast.success(`L'adresse IP ${newIp} a été ajoutée à la liste.`);
      setNewIp('');
      setModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement de la règle IP.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const updated = ips.map(i => i.id === id ? { ...i, active: !current } : i);
      await saveIpRules(updated);
      setIps(updated);
      toast.success(`Règle ${!current ? 'activée' : 'désactivée'}.`);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la modification.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous débloquer cette adresse IP ?")) return;
    try {
      const updated = ips.filter(i => i.id !== id);
      await saveIpRules(updated);
      setIps(updated);
      toast.success("Règle de filtrage supprimée.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur de suppression.");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-serif font-bold text-slate-900">
            Pare-feu & Filtrage des Adresses IP
          </h2>
          <p className="text-xs text-slate-500">
            Protection périmétrique contre les attaques DDoS, brute-force et accès non autorisés.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadIps} 
            disabled={loading}
            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 h-10 rounded-xl cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Button 
            onClick={() => setModalOpen(true)}
            className="bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white text-xs h-10 px-4 rounded-xl font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Bloquer une IP
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0f2b5c]" />
          <p className="text-sm font-medium">Chargement des règles pare-feu...</p>
        </div>
      ) : ips.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
          <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
          <p className="text-sm font-medium text-slate-700">Aucune adresse IP n'est actuellement bloquée.</p>
          <p className="text-xs text-slate-500 mt-1">Toutes les connexions légitimes sont autorisées.</p>
        </div>
      ) : (
        <>
          {/* Mobile view */}
          <div className="block sm:hidden space-y-3">
            {ips.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-slate-900 text-sm">{item.ip}</div>
                    <div className="text-xs text-slate-500">{item.reason}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    item.active ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {item.active ? 'Bloquée' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggle(item.id, item.active)}
                    className="text-xs h-8 rounded-xl"
                  >
                    {item.active ? 'Désactiver' : 'Réactiver'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(item.id)}
                    className="text-xs h-8 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Adresse IP</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Motif de restriction</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ips.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
                      {item.ip}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {item.reason}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        item.active 
                          ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {item.active ? 'Bloquée' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleToggle(item.id, item.active)}
                          className="text-xs h-8 border-slate-200"
                        >
                          {item.active ? 'Désactiver' : 'Réactiver'}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(item.id)}
                          className="text-xs h-8 text-rose-600 hover:bg-rose-50"
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
        </>
      )}

      {/* MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md w-[95vw] p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif font-bold text-slate-900">
              Restreindre une Adresse IP
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddIp} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Adresse IPv4 ou IPv6</Label>
              <Input 
                value={newIp} 
                onChange={(e) => setNewIp(e.target.value)} 
                placeholder="ex: 198.51.100.42"
                className="mt-1 h-10 rounded-xl bg-slate-50 text-sm font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Raison du blocage</Label>
              <Input 
                value={newReason} 
                onChange={(e) => setNewReason(e.target.value)} 
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
                disabled={submitting}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs h-10 px-6 font-semibold cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Bloquer l'accès
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
