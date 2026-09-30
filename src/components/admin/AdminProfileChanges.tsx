import React, { useEffect, useState } from 'react';
import { 
  fetchProfileChangesPaginated,
  saveProfileChange, 
  saveClientToSupabase, 
  getClientProfileByEmailOrId 
} from '../../lib/supabaseBankService';
import { ProfileChangeRequest } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { Loader2, UserCog, Check, Clock, AlertCircle, RefreshCw, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminProfileChanges() {
  const [requests, setRequests] = useState<(ProfileChangeRequest & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Search, filter, pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalRequests, setTotalRequests] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Selected request modal
  const [selectedReq, setSelectedReq] = useState<(ProfileChangeRequest & { id: string }) | null>(null);

  const fetchRequests = async (
    isManual = false,
    targetPage = page,
    targetSearch = search,
    targetStatus = statusFilter
  ) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetchProfileChangesPaginated({
        page: targetPage,
        pageSize,
        search: targetSearch,
        status: targetStatus,
      });

      if (Array.isArray(res.data)) {
        setRequests(res.data);
      }
      setTotalRequests(res.total);
      setTotalPages(res.totalPages);
      setPage(res.page);
    } catch (e) {
      console.error(e);
      toast.error("Impossible de récupérer les demandes de modification.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests(false, 1, search, statusFilter);
  }, []);

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
    fetchRequests(false, 1, search, status);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    fetchRequests(false, 1, val, statusFilter);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      fetchRequests(false, newPage, search, statusFilter);
    }
  };

  const handleReview = async (req: ProfileChangeRequest & { id: string }, decision: 'approved' | 'rejected') => {
    setProcessingId(req.id);
    try {
      if (decision === 'approved' && req.account_id) {
        const updates: Record<string, any> = {};
        req.changes.forEach(c => {
          updates[c.field] = c.new_value;
        });

        const client = await getClientProfileByEmailOrId(req.account_id || req.client_email);
        if (client) {
          await saveClientToSupabase({ id: client.id, ...updates });
        }
      }

      await saveProfileChange(req.id, decision);
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: decision } : r));
      if (selectedReq?.id === req.id) {
        setSelectedReq(prev => prev ? { ...prev, status: decision } : null);
      }
      toast.success(`Demande de modification ${decision === 'approved' ? 'approuvée et répercutée' : 'refusée'}.`);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-serif font-bold text-slate-900">
            Demandes de Modification de Profil
          </h2>
          <p className="text-xs text-slate-500">
            Validation des changements d'adresse, téléphone, profession et coordonnées demandés par les clients.
          </p>
        </div>
        <Button 
          onClick={() => fetchRequests(true, page, search, statusFilter)} 
          variant="outline" 
          size="sm" 
          disabled={loading || refreshing}
          className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 h-10 rounded-xl cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="Rechercher par client, courriel, ID compte..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 text-xs rounded-xl bg-white border-slate-200 h-10"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'Toutes les demandes' },
            { id: 'pending', label: 'En attente' },
            { id: 'approved', label: 'Approuvées' },
            { id: 'rejected', label: 'Rejetées' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleStatusFilterChange(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#0f2b5c] text-white shadow-xs font-semibold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#0f2b5c] mb-3" />
            <p className="text-sm font-medium">Chargement des demandes...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Check className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-slate-700">Aucune demande de modification dans cette catégorie</p>
            <p className="text-xs text-slate-400">Toutes les demandes de mise à jour ont été traitées ou correspondent au filtre.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-200">
                <TableHead className="text-xs font-semibold text-slate-600">Date & Client</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Modifications demandées</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Statut</TableHead>
                <TableHead className="text-right text-xs font-semibold text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="border-slate-100 hover:bg-slate-50/50">
                  <TableCell>
                    <div className="font-medium text-slate-900 text-sm">{req.client_email}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      ID: {req.client_id || req.account_id || 'N/A'} • {format(new Date(req.createdAt || Date.now()), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {req.changes?.map((c, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-semibold text-slate-700">{c.field}</span> :{' '}
                          <span className="text-slate-400 line-through">{c.old_value || 'vide'}</span> ➔{' '}
                          <span className="text-emerald-700 font-medium">{c.new_value}</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      req.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : req.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {req.status === 'approved' ? 'Approuvée' : req.status === 'rejected' ? 'Rejetée' : 'En attente'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedReq(req)}
                        className="text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Détail
                      </Button>
                      {req.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            disabled={processingId === req.id}
                            onClick={() => handleReview(req, 'approved')}
                            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === req.id}
                            onClick={() => handleReview(req, 'rejected')}
                            className="text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer"
                          >
                            Rejeter
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <div className="text-xs text-slate-500 order-2 sm:order-1 font-medium">
          Affichage {totalRequests === 0 ? 0 : (page - 1) * pageSize + 1} à {Math.min(page * pageSize, totalRequests)} sur {totalRequests} demande{totalRequests > 1 ? 's' : ''}
        </div>

        <div className="flex items-center gap-1.5 order-1 sm:order-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading || refreshing}
            onClick={() => handlePageChange(page - 1)}
            className="h-8 px-2.5 text-xs rounded-lg border-slate-200 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Précédent
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pNum = i + 1;
              if (totalPages > 5 && page > 3) {
                pNum = page - 3 + i;
                if (pNum > totalPages) pNum = totalPages - (4 - i);
              }
              if (pNum < 1) pNum = 1;
              return (
                <button
                  key={pNum}
                  onClick={() => handlePageChange(pNum)}
                  disabled={loading || refreshing}
                  className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    page === pNum
                      ? 'bg-[#0f2b5c] text-white font-bold'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading || refreshing}
            onClick={() => handlePageChange(page + 1)}
            className="h-8 px-2.5 text-xs rounded-lg border-slate-200 cursor-pointer"
          >
            Suivant <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* Selected Request Detail Modal */}
      <Dialog open={!!selectedReq} onOpenChange={(open) => !open && setSelectedReq(null)}>
        <DialogContent className="max-w-md p-6 rounded-3xl">
          {selectedReq && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-lg font-serif font-bold text-slate-900">
                  Détail de la Demande de Modification
                </DialogTitle>
              </DialogHeader>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <div><span className="font-semibold text-slate-700">Client :</span> {selectedReq.client_email}</div>
                <div><span className="font-semibold text-slate-700">Identifiant :</span> {selectedReq.account_id || selectedReq.client_id || 'N/A'}</div>
                <div><span className="font-semibold text-slate-700">Date de soumission :</span> {format(new Date(selectedReq.createdAt || Date.now()), 'dd MMMM yyyy HH:mm', { locale: fr })}</div>
                <div>
                  <span className="font-semibold text-slate-700">Statut :</span>{' '}
                  <span className="font-bold uppercase text-[10px]">{selectedReq.status}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Champs modifiés :</div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {selectedReq.changes?.map((c, i) => (
                    <div key={i} className="p-3 text-xs flex flex-col gap-1 bg-white">
                      <span className="font-bold text-slate-800 capitalize">{c.field}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 line-through bg-slate-50 px-2 py-0.5 rounded">{c.old_value || 'vide'}</span>
                        <span>➔</span>
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">{c.new_value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedReq.status === 'pending' && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    onClick={() => handleReview(selectedReq, 'rejected')}
                    disabled={processingId === selectedReq.id}
                    className="text-xs h-9 text-rose-600 border-rose-200"
                  >
                    Rejeter la demande
                  </Button>
                  <Button
                    onClick={() => handleReview(selectedReq, 'approved')}
                    disabled={processingId === selectedReq.id}
                    className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    Approuver et appliquer
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
