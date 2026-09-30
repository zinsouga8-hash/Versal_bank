import React, { useEffect, useState, useRef } from 'react';
import { 
  fetchLoansPaginated,
  saveLoanToSupabase, 
  deleteLoanFromSupabase,
  getClientProfileByEmailOrId,
  saveClientToSupabase,
  saveTransactionToSupabase,
  saveMovementToSupabase,
  subscribeToBankData
} from '../../lib/supabaseBankService';
import { LoanApplication, LoanStatus } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Check, X, FileSignature, Landmark, Banknote, 
  RefreshCw, CheckCircle2, Clock, Trash2, ExternalLink, ArrowDownLeft,
  FileText, ShieldCheck, Eye, UploadCloud, AlertCircle, Calendar,
  DollarSign, Percent, ChevronRight, ChevronLeft, Search, User, Mail, Download, ArrowUpRight
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { notifyLoanApproved, notifyLoanFunded, notifyLoanRejected, notifyLoanPending } from '../../lib/emailService';
import LoanDocumentViewerModal from '../portal/LoanDocumentViewerModal';
import { LoanPdfData } from '../../lib/loanPdfGenerator';

export default function AdminLoans() {
  const [loans, setLoans] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('versalbank_loans');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Search & Filter & Pagination states (Fixed 10 per page as requested)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalLoans, setTotalLoans] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docModalType, setDocModalType] = useState<'conditions' | 'parameters' | null>(null);
  const [pdfData, setPdfData] = useState<LoanPdfData | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<{ open: boolean; url: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchSeqRef = useRef(0);
  const currentParamsRef = useRef({ page: 1, search: '', status: 'all' });
  currentParamsRef.current = { page, search: searchTerm, status: statusFilter };

  const fetchLoans = async (
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
      const res = await fetchLoansPaginated({
        page: targetPage,
        pageSize,
        search: targetSearch,
        status: targetStatus,
      });

      if (seq === fetchSeqRef.current) {
        if (Array.isArray(res.data)) {
          setLoans(res.data);
        }
        setTotalLoans(res.total);
        setTotalPages(res.totalPages);
        setPage(res.page);
      }
    } catch (e) {
      console.error(e);
      console.warn("Erreur prets", e);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchLoans(false, 1, searchTerm, statusFilter);
    const unsub = subscribeToBankData(() => {
      fetchLoans(
        false, 
        currentParamsRef.current.page, 
        currentParamsRef.current.search, 
        currentParamsRef.current.status
      );
    });
    return () => unsub();
  }, []);

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
    fetchLoans(false, 1, searchTerm, newStatus);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
    fetchLoans(false, 1, val, statusFilter);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      fetchLoans(false, newPage, searchTerm, statusFilter);
    }
  };

  const handleUpdateStatus = async (loan: any, newStatus: LoanStatus) => {
    setActionLoadingId(loan.id);
    try {
      const clientEmail = loan.client_email || loan.user_email;
      const client = await getClientProfileByEmailOrId(clientEmail || loan.account_id || loan.user_id);
      const clientCurrency = client?.currency || 'CAD';

      // If funding the loan, credit the client's account balance and record a movement!
      if (newStatus === 'funded' && client) {
        const currentBal = Number(client.balance) || 0;
        const loanAmt = Number(loan.amount) || 0;
        const newBal = currentBal + loanAmt;
        const targetEmail = client.user_email || clientEmail || '';
        const loanRef = `LOAN-FUND-${Math.floor(100000 + Math.random() * 900000)}`;
        const loanDesc = `Mise à disposition des fonds — Prêt accordé #${loan.id ? String(loan.id).slice(0, 8) : ''}`;

        await saveClientToSupabase({ 
          id: client.id, 
          profile_id: client.profile_id || client.id,
          user_email: targetEmail,
          balance: newBal 
        });

        // Record formal transaction
        await saveTransactionToSupabase({
          id: `tx_loan_${Date.now()}`,
          user_id: client.id,
          user_email: targetEmail,
          type: 'deposit',
          kind: 'loan_credit',
          direction: 'credit',
          amount: loanAmt,
          currency: clientCurrency,
          description: loanDesc,
          motif: loanDesc,
          reference: loanRef,
          status: 'completed',
          date: new Date().toISOString(),
          createdAt: Date.now(),
          created_at: new Date().toISOString(),
        } as any);

        // Record formal movement (appears in client's "Suivi des mouvements")
        await saveMovementToSupabase({
          id: `mov_loan_${Date.now()}`,
          client_id: client.client_id || client.id,
          user_id: client.id || client.client_id,
          client_email: targetEmail,
          user_email: targetEmail,
          account_id: client.client_id || client.id,
          kind: 'loan_credit',
          direction: 'credit',
          method: 'Prêt bancaire',
          amount: loanAmt,
          currency: clientCurrency,
          beneficiary_name: `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Titulaire du compte',
          description: loanDesc,
          motif: loanDesc,
          reference: loanRef,
          status: 'completed',
          date: new Date().toISOString(),
          createdAt: Date.now(),
          created_at: new Date().toISOString(),
        });

        window.dispatchEvent(new Event('versalbank_update'));
      }

      const updated = { ...loan, status: newStatus };
      await saveLoanToSupabase(updated);
      setLoans(prev => prev.map(l => l.id === loan.id ? updated : l));

      if (selectedLoan && selectedLoan.id === loan.id) {
        setSelectedLoan(updated);
      }

      // Notifications
      if (clientEmail) {
        if (newStatus === 'approved') {
          notifyLoanApproved({ user_email: clientEmail }, { 
            amount: loan.amount, 
            currency: clientCurrency, 
            duration_months: loan.duration_months || 24, 
            monthly_payment: loan.monthly_payment || 0 
          }).catch(err => console.warn('Email notify note:', err));
        } else if (newStatus === 'funded') {
          notifyLoanFunded({ user_email: clientEmail }, { 
            amount: loan.amount, 
            currency: clientCurrency, 
            duration_months: loan.duration_months || 24 
          }).catch(err => console.warn('Email notify note:', err));
        } else if (newStatus === 'rejected') {
          notifyLoanRejected({ user_email: clientEmail }, { 
            amount: loan.amount, 
            currency: clientCurrency, 
            reason: 'Critères d\'éligibilité non atteints' 
          }).catch(err => console.warn('Email notify note:', err));
        } else if (newStatus === 'pending' || newStatus === 'processing') {
          notifyLoanPending({ user_email: clientEmail }, {
            id: loan.id,
            amount: loan.amount,
            currency: clientCurrency
          }).catch(err => console.warn('Email notify note:', err));
        }
      }

      toast.success(`Dossier #${loan.id.slice(0, 8)} passé à l'état : ${newStatus.toUpperCase()}`);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la mise à jour du prêt.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleContractSigned = async (loan: any) => {
    setActionLoadingId(loan.id);
    try {
      const nextSigned = !loan.contract_signed;
      const updated = {
        ...loan,
        contract_signed: nextSigned,
        contract_signed_at: nextSigned ? new Date().toISOString() : null,
      };
      await saveLoanToSupabase(updated);
      setLoans(prev => prev.map(l => l.id === loan.id ? updated : l));
      if (selectedLoan && selectedLoan.id === loan.id) {
        setSelectedLoan(updated);
      }
      toast.success(nextSigned ? "Paramètres de crédit marqués comme signés !" : "Paramètres marqués comme non signés.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la mise à jour du statut de signature.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUploadSignedContract = async (e: React.ChangeEvent<HTMLInputElement>, loan: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      // Convert to base64 data URL for durable storage & preview
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const updated = {
            ...loan,
            contract_signed: true,
            contract_signed_url: dataUrl,
            contract_signed_name: file.name,
            contract_signed_at: new Date().toISOString(),
          };
          await saveLoanToSupabase(updated);
          setLoans(prev => prev.map(l => l.id === loan.id ? updated : l));
          if (selectedLoan && selectedLoan.id === loan.id) {
            setSelectedLoan(updated);
          }
          toast.success(`Document signé « ${file.name} » téléversé et validé !`);
        } catch (err) {
          console.error(err);
          toast.error("Erreur d'enregistrement du document.");
        } finally {
          setUploadingDoc(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de lire le fichier.");
      setUploadingDoc(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous supprimer définitivement ce dossier de prêt ?")) return;
    try {
      await deleteLoanFromSupabase(id);
      setLoans(prev => prev.filter(l => l.id !== id));
      if (selectedLoan && selectedLoan.id === id) {
        setSelectedLoan(null);
      }
      toast.success("Dossier de prêt supprimé.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur de suppression.");
    }
  };

  const openDocumentModal = (loan: any, type: 'conditions' | 'parameters') => {
    const borrower = loan.client_name || (loan.first_name ? `${loan.first_name || ''} ${loan.last_name || ''}`.trim() : 'Client Privé');
    const docData: LoanPdfData = {
      loanId: loan.id,
      referenceNumber: `LS-${loan.id.slice(0, 6).toUpperCase()}-2026`,
      amount: Number(loan.amount || 0),
      durationMonths: Number(loan.duration_months || 24),
      interestRate: Number(loan.rate || loan.interest_rate || 3.0),
      monthlyPayment: Number(loan.monthly_payment || 0),
      currency: loan.currency || 'CAD',
      clientName: borrower,
      clientEmail: loan.client_email || loan.user_email || 'client@versalbank.com',
      clientAddress: loan.address || 'Canada',
      createdAt: loan.createdAt || Date.now(),
    };
    setPdfData(docData);
    setDocModalType(type);
    setDocModalOpen(true);
  };

  const filteredLoans = loans;

  // Summary Metrics
  const totalApplications = totalLoans;
  const pendingCount = loans.filter(l => l.status === 'pending' || l.status === 'processing').length;
  const approvedCount = loans.filter(l => l.status === 'approved').length;
  const fundedCount = loans.filter(l => l.status === 'funded').length;
  const signedCount = loans.filter(l => l.contract_signed).length;
  const totalFundedVolume = loans
    .filter(l => l.status === 'funded')
    .reduce((sum, l) => sum + Number(l.amount || 0), 0);

  const getProjectLabel = (proj: string) => {
    switch (proj) {
      case 'immobilier': return 'Acquisition immobilière';
      case 'automobile': return 'Automobile';
      case 'travaux': return 'Travaux & rénovation';
      case 'entreprise': return 'Développement d’entreprise';
      case 'etudes': return 'Études';
      case 'tresorerie': return 'Trésorerie';
      default: return proj || 'Financement bancaire';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-serif font-bold text-slate-900">
            Dossiers de Crédit & Financement
          </h2>
          <p className="text-xs text-slate-500">
            Instruction des dossiers, vérification des paramètres signés et déblocage de trésorerie.
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchLoans(true, page, searchTerm, statusFilter)} 
          disabled={loading || refreshing}
          className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 h-10 rounded-xl cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">En attente d'étude</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">{pendingCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Sur {totalApplications} dossiers</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">Paramètres signés</span>
            <FileSignature className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-blue-600">{signedCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Prêts prêts au déblocage</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">Approuvés</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-indigo-600">{approvedCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Accord de principe émis</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">Fonds Débloqués</span>
            <Banknote className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600">
            {totalFundedVolume.toLocaleString('fr-CA')} CAD
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{fundedCount} financements actifs</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="Rechercher par client, courriel, réf dossier..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 text-xs rounded-xl bg-white border-slate-200 h-10"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'Tous les dossiers' },
            { id: 'pending', label: 'En étude' },
            { id: 'approved', label: 'Approuvés' },
            { id: 'funded', label: 'Fonds débloqués' },
            { id: 'rejected', label: 'Rejetés' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleStatusChange(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#0f2b5c] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0f2b5c]" />
          <p className="text-sm font-medium">Chargement des dossiers de crédit...</p>
        </div>
      ) : filteredLoans.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
          <Banknote className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">Aucun dossier de crédit dans cette catégorie.</p>
        </div>
      ) : (
        <>
          {/* MOBILE VIEW (< sm) */}
          <div className="block sm:hidden space-y-3">
            {filteredLoans.map((loan) => {
              const isLoading = actionLoadingId === loan.id;
              const client = null;
              const borrower = loan.client_name || (loan.first_name ? `${loan.first_name || ''} ${loan.last_name || ''}`.trim() : (client ? `${client.first_name} ${client.last_name}` : 'Client Privé'));
              const borrowerEmail = loan.client_email || loan.user_email || client?.user_email || 'Email non fourni';
              return (
                <div 
                  key={loan.id} 
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{borrower}</div>
                      <div className="text-xs text-slate-500 font-mono">{borrowerEmail}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Projet : <span className="text-slate-700 font-medium">{getProjectLabel(loan.project || loan.purpose)}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      loan.status === 'funded'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : loan.status === 'approved'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : loan.status === 'pending' || loan.status === 'processing'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {loan.status === 'funded' ? 'Fonds débloqués' : loan.status === 'approved' ? 'Approuvé' : loan.status === 'rejected' ? 'Rejeté' : 'En étude'}
                    </span>
                  </div>

                  {/* Amount & terms */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Montant emprunté</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {Number(loan.amount || 0).toLocaleString('fr-CA')} CAD
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block text-[11px]">Mensualité</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {Number(loan.monthly_payment || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} CAD/m
                      </span>
                    </div>
                  </div>

                  {/* Signed Parameters Status Badge */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">Paramètres signés :</span>
                    {loan.contract_signed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-medium">
                        <Check className="w-3 h-3 text-emerald-600" /> Reçus et validés
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-medium">
                        <Clock className="w-3 h-3 text-amber-600" /> En attente
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedLoan(loan)}
                      className="text-xs h-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Dossier
                    </Button>

                    <div className="flex items-center gap-1.5 ml-auto">
                      {(loan.status === 'pending' || loan.status === 'processing') && (
                        <>
                          <Button
                            size="sm"
                            disabled={isLoading}
                            onClick={() => handleUpdateStatus(loan, 'approved')}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 rounded-xl font-medium"
                          >
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleUpdateStatus(loan, 'rejected')}
                            className="border-rose-200 text-rose-600 hover:bg-rose-50 text-xs h-8 rounded-xl"
                          >
                            Rejeter
                          </Button>
                        </>
                      )}

                      {loan.status === 'approved' && (
                        <>
                          <Button
                            size="sm"
                            disabled={isLoading}
                            onClick={() => handleUpdateStatus(loan, 'funded')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 rounded-xl font-medium"
                          >
                            Débloquer fonds
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleUpdateStatus(loan, 'rejected')}
                            className="border-rose-200 text-rose-600 hover:bg-rose-50 text-xs h-8 rounded-xl"
                          >
                            Rejeter
                          </Button>
                        </>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(loan.id)}
                        className="text-xs h-8 text-rose-600 hover:bg-rose-50 p-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP VIEW (>= sm) */}
          <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto shadow-2xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Emprunteur / Dossier</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Projet</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Montant / Durée</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Mensualité</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Paramètres signés</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.map((loan) => {
                  const isLoading = actionLoadingId === loan.id;
                  const client = null;
                  const borrower = loan.client_name || (loan.first_name ? `${loan.first_name || ''} ${loan.last_name || ''}`.trim() : (client ? `${client.first_name} ${client.last_name}` : 'Client Privé'));
                  const borrowerEmail = loan.client_email || loan.user_email || client?.user_email || 'Email non fourni';

                  return (
                    <TableRow key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm">{borrower}</div>
                        <div className="text-xs text-slate-500 font-mono">{borrowerEmail}</div>
                      </TableCell>

                      <TableCell className="text-xs text-slate-700">
                        {getProjectLabel(loan.project || loan.purpose)}
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {Number(loan.amount || 0).toLocaleString('fr-CA')} CAD
                        </span>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {loan.duration_months || 24} mois @ {loan.rate || loan.interest_rate || 3.0}%
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">
                        {Number(loan.monthly_payment || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} CAD/mois
                      </TableCell>

                      <TableCell>
                        {loan.contract_signed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3 text-emerald-600" /> Signés reçus
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 text-amber-600" /> Non signés
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          loan.status === 'funded'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : loan.status === 'approved'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : loan.status === 'pending' || loan.status === 'processing'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {loan.status === 'funded' ? 'Fonds Débloqués' : loan.status === 'approved' ? 'Approuvé' : loan.status === 'rejected' ? 'Rejeté' : 'En étude'}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedLoan(loan)}
                            className="text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Détails
                          </Button>

                          {(loan.status === 'pending' || loan.status === 'processing') && (
                            <>
                              <Button
                                size="sm"
                                disabled={isLoading}
                                onClick={() => handleUpdateStatus(loan, 'approved')}
                                className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                              >
                                Approuver
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLoading}
                                onClick={() => handleUpdateStatus(loan, 'rejected')}
                                className="text-xs h-8 border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                Rejeter
                              </Button>
                            </>
                          )}

                          {loan.status === 'approved' && (
                            <>
                              <Button
                                size="sm"
                                disabled={isLoading}
                                onClick={() => handleUpdateStatus(loan, 'funded')}
                                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              >
                                Débloquer fonds
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLoading}
                                onClick={() => handleUpdateStatus(loan, 'rejected')}
                                className="text-xs h-8 border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                Rejeter
                              </Button>
                            </>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(loan.id)}
                            className="text-xs h-8 text-rose-600 hover:bg-rose-50 cursor-pointer p-2"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500 order-2 sm:order-1 font-medium">
              Affichage {totalLoans === 0 ? 0 : (page - 1) * pageSize + 1} à {Math.min(page * pageSize, totalLoans)} sur {totalLoans} dossier{totalLoans > 1 ? 's' : ''}
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
        </>
      )}

      {/* FULL LOAN DETAILS & SIGNED PARAMETERS MODAL */}
      <Dialog open={!!selectedLoan} onOpenChange={(open) => !open && setSelectedLoan(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-3xl">
          {selectedLoan && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#0f2b5c] bg-blue-50 px-2.5 py-0.5 rounded-full">
                      Dossier #{selectedLoan.id.slice(0, 8)}
                    </span>
                    <DialogTitle className="text-xl font-serif font-bold text-slate-900 mt-1">
                      Gestion du Crédit & Paramètres
                    </DialogTitle>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    selectedLoan.status === 'funded'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : selectedLoan.status === 'approved'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : selectedLoan.status === 'pending' || selectedLoan.status === 'processing'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}>
                    {selectedLoan.status === 'funded' ? 'Fonds débloqués' : selectedLoan.status === 'approved' ? 'Approuvé' : selectedLoan.status === 'rejected' ? 'Rejeté' : 'En étude'}
                  </span>
                </div>
              </DialogHeader>

              {/* Progress Flow Stepper */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4">
                <div className="text-xs font-semibold text-slate-700 mb-3">Cycle de vie du dossier</div>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px] sm:text-xs">
                  <div className="space-y-1">
                    <div className="w-6 h-6 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">✓</div>
                    <div className="font-semibold text-slate-800">1. Déposé</div>
                  </div>
                  <div className="space-y-1">
                    <div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center font-bold ${
                      selectedLoan.status !== 'pending' && selectedLoan.status !== 'processing'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}>
                      {selectedLoan.status !== 'pending' && selectedLoan.status !== 'processing' ? '✓' : '2'}
                    </div>
                    <div className="font-semibold text-slate-800">2. Étude</div>
                  </div>
                  <div className="space-y-1">
                    <div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center font-bold ${
                      selectedLoan.contract_signed
                        ? 'bg-emerald-500 text-white'
                        : selectedLoan.status === 'approved'
                        ? 'bg-blue-500 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {selectedLoan.contract_signed ? '✓' : '3'}
                    </div>
                    <div className="font-semibold text-slate-800">3. Paramètres signés</div>
                  </div>
                  <div className="space-y-1">
                    <div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center font-bold ${
                      selectedLoan.status === 'funded'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {selectedLoan.status === 'funded' ? '✓' : '4'}
                    </div>
                    <div className="font-semibold text-slate-800">4. Déblocage</div>
                  </div>
                </div>
              </div>

              {/* Loan parameters summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-1.5">
                  <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Bénéficiaire</span>
                  <div className="font-bold text-slate-900 text-sm">
                    {selectedLoan.client_name || (selectedLoan.first_name ? `${selectedLoan.first_name || ''} ${selectedLoan.last_name || ''}`.trim() : 'Client')}
                  </div>
                  <div className="text-slate-600">{selectedLoan.client_email || selectedLoan.user_email}</div>
                  <div className="text-slate-500 text-[11px]">Compte : {selectedLoan.account_id || selectedLoan.user_id}</div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-1.5">
                  <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">Conditions Financières</span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Montant :</span>
                    <span className="font-mono font-bold text-slate-900">{Number(selectedLoan.amount || 0).toLocaleString('fr-CA')} CAD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Durée :</span>
                    <span className="font-semibold text-slate-800">{selectedLoan.duration_months} mois</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taux fixe :</span>
                    <span className="font-semibold text-slate-800">{selectedLoan.rate || selectedLoan.interest_rate || 3.0} %</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-700 font-medium">Mensualité :</span>
                    <span className="font-mono font-bold text-blue-700">
                      {Number(selectedLoan.monthly_payment || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} CAD
                    </span>
                  </div>
                </div>
              </div>

              {/* SIGNED PARAMETERS SECTION */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-[#0f2b5c]" />
                    Paramètres de Crédit Signés par l'Emprunteur
                  </h4>
                  {selectedLoan.contract_signed ? (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Signé & Validé
                    </span>
                  ) : (
                    <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> En attente de signature
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  L'accord préalable requiert la signature formelle des paramètres de crédit par l'emprunteur avant tout versement des fonds par la trésorerie.
                </p>

                {/* View document actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleContractSigned(selectedLoan)}
                    className="text-xs h-9 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    {selectedLoan.contract_signed ? (
                      <>
                        <X className="w-3.5 h-3.5 mr-1.5 text-rose-500" /> Marquer comme non signé
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Marquer comme signé
                      </>
                    )}
                  </Button>

                  {selectedLoan.contract_signed_url && (
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        try {
                          const urls = JSON.parse(selectedLoan.contract_signed_url);
                          if (Array.isArray(urls)) {
                            return urls.map((url, i) => (
                              <Button
                                key={i}
                                type="button"
                                size="sm"
                                onClick={() => setPreviewDocModal({ open: true, url, title: `Document signé ${i + 1} / ${urls.length}` })}
                                className="text-xs h-9 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0f2b5c] border border-blue-200 font-semibold gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#0f2b5c]" />
                                Visualiser doc {i + 1}
                              </Button>
                            ));
                          }
                        } catch (e) {
                          // Fallback to single URL
                          return (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setPreviewDocModal({ open: true, url: selectedLoan.contract_signed_url, title: "Document signé du client" })}
                              className="text-xs h-9 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0f2b5c] border border-blue-200 font-semibold gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#0f2b5c]" />
                              Visualiser le document signé
                            </Button>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* PDF Documents Preview Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openDocumentModal(selectedLoan, 'conditions')}
                  className="text-xs h-9 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 flex-1"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                  Conditions Générales (PDF)
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openDocumentModal(selectedLoan, 'parameters')}
                  className="text-xs h-9 rounded-xl border-slate-200 text-[#0f2b5c] hover:bg-blue-50/50 flex-1"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5 text-[#0f2b5c]" />
                  Paramètres de Crédit (PDF)
                </Button>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(selectedLoan.id)}
                  className="text-xs h-9 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Supprimer le dossier
                </Button>

                <div className="flex items-center gap-2">
                  {(selectedLoan.status === 'pending' || selectedLoan.status === 'processing') && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(selectedLoan, 'rejected')}
                        className="text-xs h-9 border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        Rejeter
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(selectedLoan, 'approved')}
                        className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        Approuver le dossier
                      </Button>
                    </>
                  )}

                  {selectedLoan.status === 'approved' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(selectedLoan, 'rejected')}
                        className="text-xs h-9 border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        Rejeter
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(selectedLoan, 'funded')}
                        className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        Débloquer les fonds ({Number(selectedLoan.amount || 0).toLocaleString('fr-CA')} CAD)
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DOCUMENT VIEWER MODAL */}
      <LoanDocumentViewerModal
        open={docModalOpen}
        onOpenChange={setDocModalOpen}
        type={docModalType}
        loanData={pdfData}
      />

      {/* MODAL DE PRÉVISUALISATION DU DOCUMENT SIGNÉ REÇU DU CLIENT */}
      <Dialog open={!!previewDocModal?.open} onOpenChange={(open) => !open && setPreviewDocModal(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-[#0f2b5c]" />
              {previewDocModal?.title || "Document signé du client"}
            </DialogTitle>
            {previewDocModal?.url && (
              <div className="flex items-center gap-2">
                <a
                  href={previewDocModal.url}
                  download={`document_signe_${selectedLoan?.id || 'pret'}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger
                </a>
                <a
                  href={previewDocModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-xs font-semibold text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Plein écran
                </a>
              </div>
            )}
          </DialogHeader>

          <div className="py-3">
            {previewDocModal?.url ? (
              previewDocModal.url.startsWith('data:application/pdf') || previewDocModal.url.endsWith('.pdf') ? (
                <iframe
                  src={previewDocModal.url}
                  className="w-full h-[65vh] rounded-2xl border border-slate-200 shadow-inner"
                  title="Aperçu du PDF"
                />
              ) : (
                <div className="w-full flex items-center justify-center p-2 bg-slate-50 rounded-2xl border border-slate-200 min-h-[50vh]">
                  <img
                    src={previewDocModal.url}
                    alt="Aperçu du document signé"
                    className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-xs"
                  />
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
