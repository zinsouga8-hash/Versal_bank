import React, { useEffect, useState, useRef } from 'react';
import { 
  fetchClientsPaginatedFromSupabase,
  fetchClientDetailedProfile,
  fetchClientDocumentsOnDemand,
  fetchClientTransactionsOnDemand,
  fetchClientCardsOnDemand,
  fetchClientLoansOnDemand,
  saveClientToSupabase, 
  deleteClientFromSupabase,
  saveMovementToSupabase,
  saveTransactionToSupabase,
  subscribeToBankData
} from '../../lib/supabaseBankService';
import { ClientAccount, Currency } from '../../types';
import { useAuth, SUPER_ADMINS } from '../../lib/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, UserCheck, UserX, Search, Shield, ShieldCheck, 
  Eye, EyeOff, Copy, KeyRound, CreditCard, Landmark, CheckCircle2, XCircle,
  Send, ExternalLink, RefreshCw, Lock, Sparkles, FileText, Trash2,
  Phone, Mail, MapPin, DollarSign, Calendar, UserCog, Download,
  ChevronLeft, ChevronRight, User, ArrowLeftRight, Banknote
} from 'lucide-react';
import { notifyAccountApproved, notifyAccountActivated, notifyAccountCredited, notifyAccountDebited, notifyAccountRejected, notifyAccountOnHold, sendAutomaticEmail } from '../../lib/emailService';

export default function AdminClients() {
  const { grantAdmin, revokeAdmin, listAdmins } = useAuth();
  const [clients, setClients] = useState<(ClientAccount & { id: string })[]>([]);
  const [adminEmails, setAdminEmails] = useState<Set<string>>(new Set(SUPER_ADMINS));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvingClientId, setApprovingClientId] = useState<string | null>(null);

  // Server-side pagination states (Fixed 10 per page as requested)
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalClients, setTotalClients] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // Selected client for detailed modal
  const [selectedClient, setSelectedClient] = useState<(ClientAccount & { id: string }) | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingDossier, setSavingDossier] = useState(false);
  const [sendingCreds, setSendingCreds] = useState(false);

  // Sub-tabs in client dossier modal (On-demand loading)
  const [activeDossierTab, setActiveDossierTab] = useState<'compte' | 'profil' | 'documents' | 'transactions' | 'cards' | 'loans'>('compte');
  const [clientDocs, setClientDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [clientTx, setClientTx] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [clientCards, setClientCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [clientLoans, setClientLoans] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);

  // Direct balance adjustment states
  const [balanceActionAmount, setBalanceActionAmount] = useState<string>('');
  const [balanceActionMotif, setBalanceActionMotif] = useState<string>('');
  const [isAdjustingBalance, setIsAdjustingBalance] = useState<boolean>(false);

  // Form edit states for selected client
  const [editForm, setEditForm] = useState<Partial<ClientAccount>>({});
  const [showModalPassword, setShowModalPassword] = useState(true);
  const [showModalPin, setShowModalPin] = useState(true);

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<{ label: string; url: string; name?: string } | null>(null);

  const getClientDocumentsList = (client: any) => {
    if (!client) return [];
    let docs = client.documents;
    if (typeof docs === 'string') {
      try {
        docs = JSON.parse(docs);
      } catch (e) {
        docs = null;
      }
    }

    const list: { label: string; url: string; name?: string }[] = [];

    if (Array.isArray(docs)) {
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        if (!d) continue;
        const url = typeof d === 'string' ? d : (d.file_url || d.url || '');
        const label = typeof d === 'object' ? (d.label || d.name || (d.type === 'id_card' ? "Pièce d'identité" : d.type === 'proof_of_address' ? "Justificatif de domicile" : `Document #${i + 1}`)) : `Document #${i + 1}`;
        if (url) list.push({ label, url, name: typeof d === 'object' ? d.name : undefined });
      }
    } else if (docs && typeof docs === 'object') {
      for (const [key, val] of Object.entries(docs)) {
        if (!val) continue;
        const url = typeof val === 'string' ? val : (val as any).file_url || (val as any).url;
        const label = (val as any).label || (val as any).name || (key === 'id_card' ? "Pièce d'identité" : key === 'proof_of_address' ? "Justificatif de domicile" : key);
        if (url) list.push({ label, url });
      }
    }

    // Top-level properties if present
    if (client.id_card_url || client.id_card) {
      const url = client.id_card_url || client.id_card;
      if (!list.some(d => d.url === url)) {
        list.push({ label: "Pièce d'identité (Passeport / CNI)", url });
      }
    }
    if (client.proof_of_address_url || client.proof_of_address) {
      const url = client.proof_of_address_url || client.proof_of_address;
      if (!list.some(d => d.url === url)) {
        list.push({ label: "Justificatif de domicile", url });
      }
    }

    return list;
  };

  const downloadDocument = (doc: { label: string; url: string; name?: string }) => {
    try {
      const link = document.createElement('a');
      link.href = doc.url;
      link.download = doc.name || `${doc.label.replace(/\s+/g, '_')}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Téléchargement de « ${doc.label} » démarré.`);
    } catch (e) {
      console.error(e);
      window.open(doc.url, '_blank');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) {
      toast.error(`Aucun ${label} à copier.`);
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié dans le presse-papier !`);
  };

  const fetchSeqRef = useRef(0);
  const currentParamsRef = useRef({ page: 1, search: '', status: 'all' });
  currentParamsRef.current = { page, search: searchTerm, status: statusFilter };

  const fetchCounts = async () => {
    try {
      const res: any = await fetch('/api/bank/clients/counts').then(r => r.json());
      if (res?.success) {
        setCounts({
          total: res.total || 0,
          pending: res.pending || 0,
          approved: res.approved || 0,
          rejected: res.rejected || 0,
        });
      }
    } catch (_) {}
  };

  const fetchClients = async (
    isManualClick = false,
    targetPage = page,
    targetSearch = searchTerm,
    targetStatus = statusFilter
  ) => {
    const seq = ++fetchSeqRef.current;

    if (isManualClick) {
      setRefreshing(true);
    } else if (!hasLoadedRef.current) {
      setLoading(true);
    }

    try {
      const result = await fetchClientsPaginatedFromSupabase({
        page: targetPage,
        limit,
        search: targetSearch,
        status: targetStatus,
      });

      // Ignore out-of-order stale responses
      if (seq === fetchSeqRef.current) {
        if (Array.isArray(result.clients)) {
          setClients(result.clients);
        }
        setTotalClients(result.total);
        setTotalPages(result.totalPages);
        setPage(result.page);
        hasLoadedRef.current = true;
      }

      fetchCounts();

      try {
        const adminsList = await listAdmins();
        const emails = new Set<string>(SUPER_ADMINS);
        adminsList.forEach(a => emails.add(a.email.toLowerCase()));
        setAdminEmails(emails);
      } catch (adminErr) {
        console.warn("Could not load admin emails:", adminErr);
      }
    } catch (e) {
      console.error(e);
      console.warn("Erreur clients paginés", e);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchClients(false, 1, searchTerm, statusFilter);
    const unsub = subscribeToBankData(() => {
      fetchClients(
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
    fetchClients(false, 1, searchTerm, newStatus);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
    fetchClients(false, 1, val, statusFilter);
  };

  const openDossier = async (client: ClientAccount & { id: string }) => {
    setSelectedClient(client);
    setActiveDossierTab('compte');
    setClientDocs([]);
    setClientTx([]);
    setClientCards([]);
    setClientLoans([]);
    setBalanceActionAmount('');
    setBalanceActionMotif('');
    setEditForm({
      first_name: client.first_name || '',
      last_name: client.last_name || '',
      user_email: client.user_email || (client as any).email || '',
      phone: client.phone || '',
      country: client.country || '',
      city: client.city || '',
      address: client.address || '',
      postal_code: client.postal_code || '',
      nationality: client.nationality || '',
      birth_date: client.birth_date || '',
      profession: client.profession || '',
      monthly_income: client.monthly_income || '',
      employed_since: client.employed_since || '',
      client_type: client.client_type || 'particulier',
      account_number: client.account_number || `CA${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      iban: client.iban || `CA98VERSAL00${client.client_id || '9921'}01`,
      bic: (client.bic && !client.bic.endsWith('XXX')) ? client.bic : (client.bic ? client.bic.replace(/XXX$/, 'MTR') : 'VERSCA2TMTR'),
      swift_code: (client.swift_code && client.swift_code !== 'VERSCA2T' && !client.swift_code.startsWith('VERS')) 
        ? client.swift_code 
        : `SWIFT-${Math.floor(100000 + Math.random() * 900000)}`,
      cat_code: client.cat_code || `CAT-${Math.floor(100000 + Math.random() * 900000)}`,
      cot_code: client.cot_code || `COT-${Math.floor(100000 + Math.random() * 900000)}`,
      portal_password: client.portal_password || 'Versal@2025',
      pin: client.pin || '1234',
      balance: client.balance !== undefined ? client.balance : 0,
      currency: client.currency || 'CAD',
      status: client.status || 'pending',
      account_active: client.account_active === true,
      admin_note: client.admin_note || '',
    });
    setModalOpen(true);

    // On-demand load full dossier profile in background for this specific client
    try {
      const full = await fetchClientDetailedProfile(client.id);
      if (full) {
        setSelectedClient(prev => prev ? { ...prev, ...full } : null);
        setEditForm(prev => ({
          ...prev,
          ...full,
          balance: full.balance !== undefined ? full.balance : prev.balance,
          portal_password: full.portal_password || prev.portal_password,
          pin: full.pin || prev.pin,
          cat_code: full.cat_code || prev.cat_code,
          cot_code: full.cot_code || prev.cot_code,
          swift_code: full.swift_code || prev.swift_code,
        }));
      }
    } catch (_) {}
  };

  const handleDossierTabSwitch = async (tab: 'compte' | 'profil' | 'documents' | 'transactions' | 'cards' | 'loans') => {
    setActiveDossierTab(tab);
    if (!selectedClient) return;

    if (tab === 'documents' && clientDocs.length === 0) {
      setLoadingDocs(true);
      try {
        const docs = await fetchClientDocumentsOnDemand(selectedClient.id);
        setClientDocs(docs);
      } finally {
        setLoadingDocs(false);
      }
    } else if (tab === 'transactions' && clientTx.length === 0) {
      setLoadingTx(true);
      try {
        const tx = await fetchClientTransactionsOnDemand(selectedClient.id);
        setClientTx(tx);
      } finally {
        setLoadingTx(false);
      }
    } else if (tab === 'cards' && clientCards.length === 0) {
      setLoadingCards(true);
      try {
        const cards = await fetchClientCardsOnDemand(selectedClient.id);
        setClientCards(cards);
      } finally {
        setLoadingCards(false);
      }
    } else if (tab === 'loans' && clientLoans.length === 0) {
      setLoadingLoans(true);
      try {
        const loans = await fetchClientLoansOnDemand(selectedClient.id);
        setClientLoans(loans);
      } finally {
        setLoadingLoans(false);
      }
    }
  };

  const handleQuickCreditDebit = async (type: 'credit' | 'debit') => {
    if (!selectedClient) return;
    const amountNum = parseFloat(balanceActionAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }
    const currentBal = editForm.balance !== undefined ? editForm.balance : (selectedClient.balance || 0);
    if (type === 'debit' && currentBal < amountNum) {
      toast.error("Solde insuffisant pour effectuer ce débit.");
      return;
    }
    setIsAdjustingBalance(true);
    try {
      const newBal = type === 'credit' ? currentBal + amountNum : currentBal - amountNum;
      const motif = balanceActionMotif.trim() || (type === 'credit' ? 'Crédit administratif direct' : 'Débit administratif direct');
      const targetEmail = selectedClient.user_email || (selectedClient as any).email || '';
      const refCode = `ADJ-${Math.floor(100000 + Math.random() * 900000)}`;
      const clientCurrency = (editForm.currency || selectedClient.currency || 'CAD') as Currency;
      const clientFullName = `${selectedClient.first_name || ''} ${selectedClient.last_name || ''}`.trim() || 'Titulaire du compte';

      setEditForm(prev => ({ ...prev, balance: newBal }));

      await saveClientToSupabase({
        id: selectedClient.id,
        profile_id: selectedClient.profile_id || selectedClient.id,
        user_email: targetEmail,
        balance: newBal,
      });

      // 1. Save to movements (for client's "Suivi des mouvements")
      await saveMovementToSupabase({
        id: `mov_adj_${Date.now()}`,
        account_id: selectedClient.client_id || selectedClient.id,
        client_id: selectedClient.client_id || selectedClient.id,
        client_email: targetEmail,
        user_email: targetEmail,
        kind: type === 'credit' ? 'deposit' : 'withdrawal',
        direction: type === 'credit' ? 'credit' : 'debit',
        method: type === 'credit' ? 'Crédit administratif direct' : 'Débit administratif direct',
        amount: amountNum,
        currency: clientCurrency,
        beneficiary_name: clientFullName,
        motif: motif,
        description: motif,
        reference: refCode,
        status: 'completed',
        date: new Date().toISOString(),
        createdAt: Date.now(),
        created_at: new Date().toISOString(),
      });

      // 2. Save to transactions
      await saveTransactionToSupabase({
        id: `tx_adj_${Date.now()}`,
        user_id: selectedClient.id,
        user_email: targetEmail,
        type: type === 'credit' ? 'deposit' : 'withdrawal',
        direction: type === 'credit' ? 'credit' : 'debit',
        amount: amountNum,
        currency: clientCurrency,
        description: motif,
        motif: motif,
        reference: refCode,
        status: 'completed',
        date: new Date().toISOString(),
        createdAt: Date.now(),
        created_at: new Date().toISOString(),
      } as any);

      window.dispatchEvent(new Event('versalbank_update'));

      // Send automatic credit/debit email notification to the client ONLY (never to admin)
      if (targetEmail) {
        if (type === 'credit') {
          notifyAccountCredited({
            user_email: targetEmail,
            first_name: selectedClient.first_name,
            amount: amountNum,
            currency: clientCurrency,
            new_balance: newBal,
            motif,
            reference: refCode,
            date: new Date().toLocaleString('fr-CA')
          }).catch(e => console.warn("Credit email notice error:", e));
        } else {
          notifyAccountDebited({
            user_email: targetEmail,
            first_name: selectedClient.first_name,
            amount: amountNum,
            currency: clientCurrency,
            new_balance: newBal,
            motif,
            reference: refCode,
            date: new Date().toLocaleString('fr-CA')
          }).catch(e => console.warn("Debit email notice error:", e));
        }
      }

      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, balance: newBal } : c));
      setSelectedClient(prev => prev ? { ...prev, balance: newBal } : null);
      setBalanceActionAmount('');
      setBalanceActionMotif('');
      toast.success(`${type === 'credit' ? 'Crédit' : 'Débit'} de ${amountNum.toLocaleString('fr-CA')} ${clientCurrency} validé et enregistré (marqué comme Complété).`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'ajustement du solde.");
    } finally {
      setIsAdjustingBalance(false);
    }
  };

  const generateNewCat = () => {
    const code = `CAT-${Math.floor(100000 + Math.random() * 900000)}`;
    setEditForm(prev => ({ ...prev, cat_code: code }));
    toast.success(`Nouveau code CAT généré : ${code}`);
  };

  const generateNewCot = () => {
    const code = `COT-${Math.floor(100000 + Math.random() * 900000)}`;
    setEditForm(prev => ({ ...prev, cot_code: code }));
    toast.success(`Nouveau code COT généré : ${code}`);
  };

  const handleDeleteClient = async (client: ClientAccount & { id: string }) => {
    const isSuper = SUPER_ADMINS.includes(client.user_email?.toLowerCase() || '');
    if (isSuper) {
      toast.error("Impossible de supprimer le compte du Super-Administrateur.");
      return;
    }
    const confirmed = window.confirm(
      `ÊTES-VOUS SÛR de vouloir supprimer DÉFINITIVEMENT le compte bancaire de ${client.first_name} ${client.last_name} (${client.user_email}) ?\n\nCette action est irréversible et supprimera l'intégralité du dossier bancaire.`
    );
    if (!confirmed) return;

    try {
      await deleteClientFromSupabase(client.id);
      setClients(prev => prev.filter(c => c.id !== client.id));
      if (selectedClient?.id === client.id) {
        setModalOpen(false);
        setSelectedClient(null);
      }
      toast.success(`Le compte bancaire de ${client.first_name} ${client.last_name} a été supprimé avec succès.`);
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(`Erreur lors de la suppression : ${err?.message || err}`);
    }
  };

  const handleSaveDossier = async () => {
    if (!selectedClient) return;
    setSavingDossier(true);
    try {
      const oldStatus = selectedClient.status;
      const newStatus = editForm.status;
      const targetEmail = (editForm.user_email || selectedClient.user_email || '').trim().toLowerCase();

      const fullUpdate = {
        ...selectedClient,
        ...editForm,
        id: selectedClient.id,
        profile_id: selectedClient.profile_id,
        client_id: selectedClient.client_id,
        user_email: editForm.user_email || selectedClient.user_email,
        account_active: editForm.account_active !== undefined ? editForm.account_active : selectedClient.account_active,
      };

      await saveClientToSupabase(fullUpdate);

      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, ...fullUpdate } : c));
      setSelectedClient(prev => prev ? { ...prev, ...fullUpdate } : null);
      window.dispatchEvent(new Event('versalbank_update'));

      // If status changed by administrator, notify client automatically from support@versalbank.com
      if (targetEmail && oldStatus !== newStatus) {
        if (newStatus === 'approved') {
          notifyAccountApproved({
            user_email: targetEmail,
            first_name: editForm.first_name || selectedClient.first_name,
            last_name: editForm.last_name || selectedClient.last_name,
            account_number: editForm.account_number || selectedClient.account_number || 'CA8904127893',
            client_id: selectedClient.client_id,
            currency: editForm.currency || selectedClient.currency || 'CAD',
            language: selectedClient.language || 'fr'
          }).catch(err => console.warn("Approve email notice:", err));
        } else if (newStatus === 'rejected') {
          notifyAccountRejected({
            user_email: targetEmail,
            first_name: editForm.first_name || selectedClient.first_name,
            last_name: editForm.last_name || selectedClient.last_name,
            reason: editForm.admin_note || "Demande refusée par l'administration",
            language: selectedClient.language || 'fr'
          }).catch(err => console.warn("Reject email notice:", err));
        } else if (newStatus === 'on_hold') {
          notifyAccountOnHold({
            user_email: targetEmail,
            first_name: editForm.first_name || selectedClient.first_name,
            last_name: editForm.last_name || selectedClient.last_name,
            reason: editForm.admin_note || "Vérifications complémentaires requises",
            language: selectedClient.language || 'fr'
          }).catch(err => console.warn("Hold email notice:", err));
        }
      }

      toast.success("Dossier client et identifiants enregistrés avec succès dans Supabase.");
      setModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la sauvegarde du dossier.");
    } finally {
      setSavingDossier(false);
    }
  };

  const handleSendCredentialsEmail = async () => {
    if (!selectedClient || !editForm.user_email) return;
    setSendingCreds(true);
    try {
      await sendAutomaticEmail({
        to: editForm.user_email,
        recipientName: `${editForm.first_name} ${editForm.last_name}`,
        type: 'ACCOUNT_ACTIVATED',
        subject: `VersalBank — Vos identifiants de compte & codes sécurisés`,
        title: `Bienvenue chez VersalBank`,
        contentLines: [
          `Cher(e) ${editForm.first_name} ${editForm.last_name},`,
          `Votre compte bancaire international VersalBank a été configuré et certifié avec succès par nos services de conformité.`,
          `Voici le récapitulatif de vos identifiants sécurisés :`,
          `• Identifiant Client : ${selectedClient.client_id}`,
          `• Numéro de compte : ${editForm.account_number}`,
          `• Code d'Autorisation CAT : ${editForm.cat_code}`,
          `• Code de Déblocage COT : ${editForm.cot_code || 'N/A'}`,
          `• Code PIN Guichet/Portail : ${editForm.pin}`,
          `• Mot de passe du portail : ${editForm.portal_password}`,
          `Nous vous recommandons de conserver précieusement ces codes pour vos transactions futures.`,
          `Pour accéder à votre espace sécurisé, connectez-vous sur le portail avec votre identifiant ou adresse courriel.`
        ],
        actionLabel: 'Accéder à mon Espace Client',
        actionUrl: `${window.location.origin}/portail`,
        language: 'fr'
      });
      toast.success(`Identifiants et codes envoyés avec succès à ${editForm.user_email}`);
    } catch (err: any) {
      console.error("Credentials email error:", err);
      toast.error(`Erreur d'envoi de l'email : ${err?.message || err}`);
    } finally {
      setSendingCreds(false);
    }
  };

  const handleApproveQuick = async (client: ClientAccount & { id: string }) => {
    setApprovingClientId(client.id);
    try {
      const generatedSwift = `SWIFT-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedCat = `CAT-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedCot = `COT-${Math.floor(100000 + Math.random() * 900000)}`;
      const generatedPin = client.pin || `${Math.floor(1000 + Math.random() * 9000)}`;
      const cleanEmail = (client.user_email || (client as any).email || '').trim().toLowerCase();

      const approvedClient: any = {
        ...client,
        id: client.id,
        profile_id: client.profile_id || client.id,
        client_id: client.client_id || (client.account_number ? `VSL-${client.account_number.slice(-6)}` : `VSL-${Math.floor(100000 + Math.random() * 900000)}`),
        user_email: cleanEmail,
        email: cleanEmail,
        status: 'approved',
        account_active: false, // Inactif par défaut à la création/approbation
        swift_code: client.swift_code || generatedSwift,
        cat_code: client.cat_code || generatedCat,
        cot_code: client.cot_code || generatedCot,
        pin: generatedPin,
      };

      await saveClientToSupabase(approvedClient);

      setClients(prev => prev.map(c => c.id === client.id ? { 
        ...c, 
        ...approvedClient
      } : c));

      if (selectedClient && selectedClient.id === client.id) {
        setSelectedClient(prev => prev ? { ...prev, ...approvedClient } : null);
      }

      window.dispatchEvent(new Event('versalbank_update'));

      toast.success(`Dossier de ${client.first_name} ${client.last_name} approuvé en 1 clic. Le compte reste inactif par défaut jusqu'à activation dans GÉRER.`);

      if (cleanEmail) {
        notifyAccountApproved({
          user_email: cleanEmail,
          first_name: client.first_name,
          account_number: client.account_number || 'CA8904127893',
          client_id: approvedClient.client_id,
          currency: client.currency || 'CAD',
          language: client.language || 'fr'
        }).catch(err => console.warn("Email notify note:", err));
      }
    } catch (err: any) {
      console.error("Approve error:", err);
      toast.error(`Erreur lors de l'approbation : ${err?.message || err}`);
    } finally {
      setApprovingClientId(null);
    }
  };

  const handleRejectQuick = async (client: ClientAccount & { id: string }) => {
    try {
      const cleanEmail = (client.user_email || (client as any).email || '').trim().toLowerCase();
      const rejectedClient: any = {
        ...client,
        id: client.id,
        profile_id: client.profile_id || client.id,
        client_id: client.client_id,
        user_email: cleanEmail,
        email: cleanEmail,
        status: 'rejected',
        account_active: false,
        admin_note: "Demande refusée par l'administration",
      };

      await saveClientToSupabase(rejectedClient);

      setClients(prev => prev.map(c => c.id === client.id ? { 
        ...c, 
        ...rejectedClient
      } : c));

      if (selectedClient && selectedClient.id === client.id) {
        setSelectedClient(prev => prev ? { ...prev, ...rejectedClient } : null);
      }

      window.dispatchEvent(new Event('versalbank_update'));

      if (cleanEmail) {
        notifyAccountRejected({
          user_email: cleanEmail,
          first_name: client.first_name,
          last_name: client.last_name,
          reason: "Demande refusée par l'administration",
          language: client.language || 'fr'
        }).catch(err => console.warn("Reject email notice:", err));
      }

      toast.success(`Demande de ${client.first_name} ${client.last_name} refusée.`);
    } catch (err: any) {
      console.error("Reject error:", err);
      toast.error("Erreur lors du refus de la demande.");
    }
  };

  const handleToggleActiveQuick = async (client: ClientAccount & { id: string }) => {
    const isCurrentlyActive = client.account_active === true;
    const newState = !isCurrentlyActive;
    try {
      const cleanEmail = (client.user_email || (client as any).email || '').trim().toLowerCase();
      const updatedClient: any = {
        ...client,
        id: client.id,
        profile_id: client.profile_id || client.id,
        user_email: cleanEmail,
        email: cleanEmail,
        account_active: newState,
      };

      await saveClientToSupabase(updatedClient);

      setClients(prev => prev.map(c => c.id === client.id ? { 
        ...c, 
        account_active: newState 
      } : c));

      if (selectedClient && selectedClient.id === client.id) {
        setSelectedClient(prev => prev ? { ...prev, account_active: newState } : null);
      }

      window.dispatchEvent(new Event('versalbank_update'));

      toast.success(newState ? "Compte activé (Prêt pour virements)." : "Compte inactif (Statut dormant - virements bloqués).");
    } catch (err: any) {
      console.error("Toggle error:", err);
      toast.error("Erreur lors de la modification de l'état du compte.");
    }
  };

  const handleToggleAdminRole = async (client: ClientAccount & { id: string }) => {
    const isCurrentlyAdmin = adminEmails.has(client.user_email?.toLowerCase() || '');
    const clientEmail = client.user_email?.toLowerCase();
    if (!clientEmail) {
      toast.error("Cet utilisateur n'a pas d'adresse email valide.");
      return;
    }

    if (SUPER_ADMINS.includes(clientEmail)) {
      toast.error("Impossible de modifier les droits du Super-Administrateur principal.");
      return;
    }

    if (isCurrentlyAdmin) {
      const ok = await revokeAdmin(clientEmail);
      if (ok) {
        setAdminEmails(prev => {
          const next = new Set(prev);
          next.delete(clientEmail);
          return next;
        });
      }
    } else {
      const ok = await grantAdmin(clientEmail, 'admin', `Promu via gestion des clients`);
      if (ok) {
        setAdminEmails(prev => {
          const next = new Set(prev);
          next.add(clientEmail);
          return next;
        });
      }
    }
  };

  // Accurate badge counts from server counts or calculated
  const totalCount = counts.total || totalClients || clients.length;
  const pendingCount = counts.pending;
  const approvedCount = counts.approved;
  const rejectedCount = counts.rejected;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Status Tabs with Badges */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => handleStatusChange('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-[#0f2b5c] text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span>Tous les comptes</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
          }`}>
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleStatusChange('pending')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <span>Demandes en attente</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusFilter === 'pending' 
              ? 'bg-white/25 text-white' 
              : pendingCount > 0 ? 'bg-amber-500 text-white animate-pulse' : 'bg-amber-200 text-amber-900'
          }`}>
            {pendingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleStatusChange('approved')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === 'approved'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <span>Validés & Actifs</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusFilter === 'approved' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-900'
          }`}>
            {approvedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleStatusChange('rejected')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === 'rejected'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
          }`}
        >
          <span>Suspendus / Rejetés</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusFilter === 'rejected' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-900'
          }`}>
            {rejectedCount}
          </span>
        </button>
      </div>

      {/* Pending Accounts Alert Banner */}
      {pendingCount > 0 && statusFilter !== 'pending' && (
        <div className="p-3 sm:p-4 bg-amber-50/90 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-950">
                {pendingCount} demande{pendingCount > 1 ? 's' : ''} de création de compte en attente de vérification
              </p>
              <p className="text-[11px] text-amber-800">
                Examinez les dossiers clients, consultez les justificatifs KYC et approuvez ou refusez chaque demande.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleStatusChange('pending')}
            className="bg-amber-800 hover:bg-amber-900 text-white text-xs h-8 px-3.5 rounded-xl font-medium shrink-0 cursor-pointer"
          >
            Voir les demandes en attente
          </Button>
        </div>
      )}

      {/* Top action / search bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              placeholder="Rechercher par nom, courriel, identifiant client, compte..." 
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 text-sm h-10 rounded-xl"
            />
          </div>
          <div className="w-full sm:w-56">
            <Select value={statusFilter} onValueChange={(val) => handleStatusChange(val)}>
              <SelectTrigger className="bg-slate-50 border-slate-200 text-xs sm:text-sm h-10 rounded-xl">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts ({totalCount})</SelectItem>
                <SelectItem value="pending">En attente / Demandes ({pendingCount})</SelectItem>
                <SelectItem value="approved">Validés / Actifs ({approvedCount})</SelectItem>
                <SelectItem value="rejected">Rejetés / Suspendus ({rejectedCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchClients(true, page, searchTerm, statusFilter)} 
          disabled={refreshing}
          className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0 h-10 rounded-xl cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-[#0f2b5c]' : ''}`} /> 
          {refreshing ? 'Actualisation...' : 'Actualiser'}
        </Button>
      </div>

      {/* Main clients rendering: Mobile Cards on phone (<sm), Table on desktop (>=sm) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#0f2b5c]" />
          <p className="text-sm font-medium">Chargement des dossiers clients...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-sm font-medium text-slate-600">Aucun dossier client ne correspond à votre recherche.</p>
          <p className="text-xs text-slate-400 mt-1">Modifiez vos critères de recherche ou réinitialisez les filtres.</p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW (Clean responsive cards for phones without horizontal scrolling) */}
          <div className="block sm:hidden space-y-3">
            {clients.map((client) => {
              const isAdminUser = adminEmails.has(client.user_email?.toLowerCase() || '');
              const isSuper = SUPER_ADMINS.includes(client.user_email?.toLowerCase() || '');

              return (
                <div 
                  key={client.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>{client.first_name} {client.last_name}</span>
                        {isSuper ? (
                          <span className="bg-[#0f2b5c]/10 text-[#0f2b5c] text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-[#0f2b5c]/20">
                            Super-Admin
                          </span>
                        ) : isAdminUser ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-emerald-200">
                            Admin
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-[220px]">
                        {client.user_email}
                      </div>
                      <div className="text-[11px] font-mono text-[#0f2b5c] font-semibold mt-0.5">
                        ID: {client.client_id || 'VSL-2026'} • Cpt: {client.account_number}
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      client.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : client.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {client.status === 'approved' ? 'Validé' : client.status === 'pending' ? 'En attente' : 'Rejeté'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium">Solde certifié :</span>
                    <span className="font-mono font-bold text-slate-900 text-sm solde-banque">
                      {(client.balance || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} {client.currency || 'CAD'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <Button 
                      size="sm" 
                      onClick={() => openDossier(client)}
                      className="w-full bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white text-xs h-9 rounded-xl font-medium cursor-pointer flex items-center justify-center gap-1"
                    >
                      <UserCog className="w-3.5 h-3.5" /> Gérer
                    </Button>

                    {client.status === 'pending' ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <Button 
                          size="sm" 
                          disabled={approvingClientId === client.id}
                          onClick={() => handleApproveQuick(client)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-xl font-semibold cursor-pointer shadow-xs"
                          title="Approuver la demande en 1 clic"
                        >
                          {approvingClientId === client.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                          )}
                          Approuver
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRejectQuick(client)}
                          className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs h-9 px-2.5 rounded-xl font-medium cursor-pointer"
                          title="Refuser la demande"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleToggleActiveQuick(client)}
                        className={`w-full text-xs h-9 rounded-xl font-medium cursor-pointer ${
                          client.account_active ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {client.account_active ? 'Suspendre' : 'Activer'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (Full data density on tablet & desktop) */}
          <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Client / Identité</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Identifiant / Compte</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Codes CAT & COT</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Solde</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const isAdminUser = adminEmails.has(client.user_email?.toLowerCase() || '');
                  const isSuper = SUPER_ADMINS.includes(client.user_email?.toLowerCase() || '');

                  return (
                    <TableRow key={client.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                              <span>{client.first_name} {client.last_name}</span>
                              {isSuper ? (
                                <span className="bg-[#0f2b5c]/10 text-[#0f2b5c] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#0f2b5c]/20">
                                  Super-Admin
                                </span>
                              ) : isAdminUser ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                  Admin
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-500 font-normal">
                              {client.user_email}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-mono font-semibold text-[#0f2b5c]">
                          {client.client_id || 'VSL-2026'}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {client.account_number}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-mono">
                          <span className="text-slate-400">CAT: </span>
                          <span className="font-semibold text-slate-700">{client.cat_code || 'Non généré'}</span>
                        </div>
                        <div className="text-xs font-mono">
                          <span className="text-slate-400">COT: </span>
                          <span className="font-semibold text-slate-700">{client.cot_code || 'Non généré'}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="font-mono font-bold text-slate-900 text-sm solde-banque">
                          {(client.balance || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 ml-1">
                          {client.currency || 'CAD'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            client.status === 'approved' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : client.status === 'pending' 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {client.status === 'approved' ? 'Validé' : client.status === 'pending' ? 'En attente' : 'Rejeté'}
                          </span>
                          {!client.account_active && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                              Suspendu
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openDossier(client)}
                            className="text-xs h-8 bg-[#0f2b5c]/5 border-[#0f2b5c]/20 text-[#0f2b5c] hover:bg-[#0f2b5c]/15 font-semibold cursor-pointer flex items-center gap-1"
                          >
                            <UserCog className="w-3.5 h-3.5" /> Gérer
                          </Button>

                          {client.status === 'pending' ? (
                            <>
                              <Button 
                                size="sm" 
                                disabled={approvingClientId === client.id}
                                onClick={() => handleApproveQuick(client)}
                                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer font-semibold shadow-xs flex items-center"
                                title="Approuver la demande en 1 clic sans ouvrir le dossier"
                              >
                                {approvingClientId === client.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                                )}
                                Approuver
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRejectQuick(client)}
                                className="text-xs h-8 border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer font-medium"
                                title="Refuser la demande"
                              >
                                <UserX className="w-3.5 h-3.5 mr-1" /> Refuser
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleToggleActiveQuick(client)}
                              className={`text-xs h-8 px-2.5 rounded-lg font-medium cursor-pointer ${
                                client.account_active === true 
                                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50' 
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={client.account_active === true ? "Suspendre l'activité du compte (statut dormant)" : "Activer le compte"}
                            >
                              {client.account_active === true ? 'Suspendre' : 'Activer'}
                            </Button>
                          )}

                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteClient(client)}
                            className="text-xs h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer p-2"
                            title="Supprimer définitivement"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 bg-white border border-slate-200 rounded-2xl shadow-xs mt-3">
            <div className="text-xs text-slate-500">
              Affichage de <span className="font-semibold text-slate-900">{totalClients === 0 ? 0 : (page - 1) * limit + 1}</span> à <span className="font-semibold text-slate-900">{Math.min(page * limit, totalClients)}</span> sur <span className="font-semibold text-slate-900">{totalClients}</span> comptes clients
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => {
                  const prev = Math.max(1, page - 1);
                  setPage(prev);
                  fetchClients(false, prev, searchTerm, statusFilter);
                }}
                className="text-xs h-8 px-2.5 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
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
                      onClick={() => {
                        setPage(pNum);
                        fetchClients(false, pNum, searchTerm, statusFilter);
                      }}
                      disabled={loading}
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
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const next = Math.min(totalPages, page + 1);
                  setPage(next);
                  fetchClients(false, next, searchTerm, statusFilter);
                }}
                className="text-xs h-8 px-2.5 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Suivant <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* DETAILED CLIENT DOSSIER & ACTIONS MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg sm:text-xl font-serif font-bold text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-[#0f2b5c]" />
                <span>Gérer le dossier bancaire : {selectedClient?.first_name} {selectedClient?.last_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  editForm.status === 'approved' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : editForm.status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {editForm.status === 'approved' ? 'Compte Validé' : editForm.status === 'pending' ? 'En Attente' : 'Rejeté'}
                </span>
                <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700">
                  {selectedClient?.client_id}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-6 pt-2">
              {/* Top Quick Actions Bar */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                {/* Approve / Reject buttons if pending */}
                {selectedClient.status === 'pending' ? (
                  <>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        setEditForm(prev => ({ ...prev, status: 'approved' }));
                        handleApproveQuick({ ...selectedClient, ...editForm, status: 'approved' });
                        setModalOpen(false);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-xl font-semibold cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1" /> Approuver la demande
                    </Button>

                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={async () => {
                        setEditForm(prev => ({ ...prev, status: 'rejected', account_active: false }));
                        await handleRejectQuick(selectedClient);
                        setModalOpen(false);
                      }}
                      className="border-rose-300 text-rose-600 hover:bg-rose-50 text-xs h-9 rounded-xl font-medium cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5 mr-1" /> Refuser la demande
                    </Button>
                  </>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const newActive = !editForm.account_active;
                      setEditForm(prev => ({ ...prev, account_active: newActive }));
                      handleToggleActiveQuick(selectedClient);
                    }}
                    className={`text-xs h-9 rounded-xl font-medium cursor-pointer ${
                      editForm.account_active ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {editForm.account_active ? <UserX className="w-3.5 h-3.5 mr-1" /> : <UserCheck className="w-3.5 h-3.5 mr-1" />}
                    {editForm.account_active ? 'Suspendre le compte' : 'Activer le compte'}
                  </Button>
                )}

                <Button 
                  size="sm" 
                  onClick={handleSendCredentialsEmail} 
                  disabled={sendingCreds}
                  className="bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white text-xs h-9 rounded-xl font-medium cursor-pointer"
                >
                  {sendingCreds ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                  Envoyer identifiants par courriel
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleToggleAdminRole(selectedClient)}
                  className="text-xs h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 mr-1 text-[#0f2b5c]" />
                  {adminEmails.has(selectedClient.user_email?.toLowerCase() || '') ? 'Révoquer droits Admin' : 'Accorder statut Admin'}
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDeleteClient(selectedClient)}
                  className="text-xs h-9 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 ml-auto cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                </Button>
              </div>

              {/* DOSSIER SUB-TABS NAVIGATION (Chargement à la demande) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => handleDossierTabSwitch('compte')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    activeDossierTab === 'compte'
                      ? 'bg-[#0f2b5c] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Compte & Sécurité</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDossierTabSwitch('profil')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    activeDossierTab === 'profil'
                      ? 'bg-[#0f2b5c] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Profil & Coordonnées</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDossierTabSwitch('documents')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    activeDossierTab === 'documents'
                      ? 'bg-[#0f2b5c] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Documents Justificatifs</span>
                  {loadingDocs && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleDossierTabSwitch('transactions')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    activeDossierTab === 'transactions'
                      ? 'bg-[#0f2b5c] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Transactions</span>
                  {loadingTx && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleDossierTabSwitch('cards')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    activeDossierTab === 'cards'
                      ? 'bg-[#0f2b5c] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Cartes</span>
                  {loadingCards && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleDossierTabSwitch('loans')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    activeDossierTab === 'loans'
                      ? 'bg-[#0f2b5c] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Prêts</span>
                  {loadingLoans && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                </button>
              </div>

              {/* TAB 1: COMPTE & SÉCURITÉ */}
              {activeDossierTab === 'compte' && (
                <div className="space-y-6">
                  {/* ACTION DIRECTE SUR LE SOLDE (Créditer / Débiter avec mouvement) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[#0f2b5c]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0f2b5c]">
                          Action Directe sur le Solde & Mouvements
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        Solde actuel : <span className="solde-banque">{(editForm.balance ?? 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })}</span> {editForm.currency || 'CAD'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
                      <div className="sm:col-span-4">
                        <Label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Montant ({editForm.currency || 'CAD'})
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 5000.00"
                          value={balanceActionAmount}
                          onChange={(e) => setBalanceActionAmount(e.target.value)}
                          className="bg-white h-9 rounded-xl font-mono text-sm"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <Label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Motif / Libellé officiel du mouvement
                        </Label>
                        <Input
                          type="text"
                          placeholder="Ex: Dépôt certifié, Virement reçu..."
                          value={balanceActionMotif}
                          onChange={(e) => setBalanceActionMotif(e.target.value)}
                          className="bg-white h-9 rounded-xl text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3 flex items-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleQuickCreditDebit('credit')}
                          disabled={isAdjustingBalance || !balanceActionAmount}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-xl font-semibold cursor-pointer"
                        >
                          {isAdjustingBalance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '+ Créditer'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickCreditDebit('debit')}
                          disabled={isAdjustingBalance || !balanceActionAmount}
                          className="flex-1 border-rose-300 text-rose-600 hover:bg-rose-50 text-xs h-9 rounded-xl font-semibold cursor-pointer"
                        >
                          {isAdjustingBalance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '- Débiter'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Highlighted Client Access Credentials (Password & PIN Display) */}
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-800" />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-950">
                          Identifiants d'Accès Sécurisés (Portail Client)
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-800 font-medium bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                        Consultation Administration
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Mot de passe du portail</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {showModalPassword ? (editForm.portal_password || 'Non défini') : '••••••••••••'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setShowModalPassword(!showModalPassword)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title={showModalPassword ? 'Masquer' : 'Afficher'}
                          >
                            {showModalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(editForm.portal_password || '', 'Mot de passe')}
                            className="p-1.5 text-slate-400 hover:text-[#0f2b5c] rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Copier le mot de passe"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Code PIN secret (6 chiffres)</span>
                          <span className="font-mono font-bold text-slate-900 text-sm tracking-wider">
                            {showModalPin ? (editForm.pin || '••••••') : '••••••'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setShowModalPin(!showModalPin)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title={showModalPin ? 'Masquer' : 'Afficher'}
                          >
                            {showModalPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(editForm.pin || '', 'Code PIN')}
                            className="p-1.5 text-slate-400 hover:text-[#0f2b5c] rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Copier le PIN"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Security Configuration */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f2b5c] flex items-center gap-1.5">
                      <Landmark className="w-4 h-4" /> Paramètres Financiers & Codes de Sécurité
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Solde Certifié ({editForm.currency || 'CAD'})</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editForm.balance ?? 0}
                          onChange={(e) => setEditForm(prev => ({ ...prev, balance: parseFloat(e.target.value) || 0 }))}
                          className="mt-1 font-mono font-bold text-base h-10 rounded-xl bg-slate-50"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Devise Principale</Label>
                        <Select 
                          value={editForm.currency || 'CAD'} 
                          onValueChange={(val: Currency) => setEditForm(prev => ({ ...prev, currency: val }))}
                        >
                          <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CAD">CAD ($ - Dollar Canadien)</SelectItem>
                            <SelectItem value="USD">USD ($ - Dollar US)</SelectItem>
                            <SelectItem value="EUR">EUR (€ - Euro)</SelectItem>
                            <SelectItem value="GBP">GBP (£ - Livre Sterling)</SelectItem>
                            <SelectItem value="CHF">CHF (Franc Suisse)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Statut du Dossier</Label>
                        <Select 
                          value={editForm.status || 'pending'} 
                          onValueChange={(val: any) => setEditForm(prev => ({ ...prev, status: val }))}
                        >
                          <SelectTrigger className="mt-1 h-10 rounded-xl bg-slate-50 text-sm font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="approved">Validé & Opérationnel</SelectItem>
                            <SelectItem value="pending">En attente d'approbation</SelectItem>
                            <SelectItem value="rejected">Rejeté / Non conforme</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* STATUT DU COMPTE (ACTIVATION / DÉSACTIVATION COMPTE DORMANT) */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                      editForm.account_active 
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                        : 'bg-rose-50/80 border-rose-200 text-rose-950'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            editForm.account_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {editForm.account_active ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                STATUT DU COMPTE
                              </h4>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                editForm.account_active 
                                  ? 'bg-emerald-200 text-emerald-800' 
                                  : 'bg-rose-200 text-rose-800'
                              }`}>
                                {editForm.account_active ? 'ACTIF' : 'INACTIF (DORMANT)'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {editForm.account_active 
                                ? 'Le compte est opérationnel. Le client est autorisé à émettre des virements (vérification PIN, SWIFT, CAT, COT).' 
                                : 'Le compte est inactif / dormant. Toute tentative d\'envoi de fonds dans l\'onglet virement sera immédiatement bloquée.'}
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={async () => {
                            const newActive = !editForm.account_active;
                            setEditForm(prev => ({ ...prev, account_active: newActive }));
                            if (selectedClient) {
                              const updated = {
                                ...selectedClient,
                                ...editForm,
                                id: selectedClient.id,
                                profile_id: selectedClient.profile_id || selectedClient.id,
                                user_email: selectedClient.user_email || editForm.user_email,
                                account_active: newActive,
                              };
                              await saveClientToSupabase(updated);
                              setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, account_active: newActive } : c));
                              setSelectedClient(prev => prev ? { ...prev, account_active: newActive } : null);
                              window.dispatchEvent(new Event('versalbank_update'));
                              toast.success(newActive ? "Compte activé avec succès !" : "Compte désactivé (passé en statut dormant) !");
                            }
                          }}
                          className={`shrink-0 text-xs font-bold h-10 px-4 rounded-xl cursor-pointer shadow-xs ${
                            editForm.account_active
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {editForm.account_active ? (
                            <>
                              <UserX className="w-4 h-4 mr-1.5" />
                              Désactiver le compte (Rendre dormant)
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4 mr-1.5" />
                              Activer le compte
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Codes Grid (SWIFT, CAT & COT - Visible Uniquement Admin) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-xs font-semibold text-slate-700">Code SWIFT (Sécurité)</Label>
                          <div className="flex items-center gap-1.5">
                            <button 
                              type="button" 
                              onClick={() => copyToClipboard(editForm.swift_code || '', 'Code SWIFT')}
                              className="text-[10px] text-slate-500 hover:text-slate-900 font-semibold cursor-pointer"
                            >
                              Copier
                            </button>
                            <span className="text-slate-300">·</span>
                            <button 
                              type="button" 
                              onClick={() => setEditForm(prev => ({ ...prev, swift_code: `SWIFT-${Math.floor(100000 + Math.random() * 900000)}` }))}
                              className="text-[10px] text-[#0f2b5c] hover:underline font-semibold cursor-pointer"
                            >
                              Régénérer
                            </button>
                          </div>
                        </div>
                        <Input 
                          value={editForm.swift_code || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, swift_code: e.target.value }))}
                          className="font-mono text-sm h-9 bg-white"
                          placeholder="SWIFT-XXXXXX"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Généré à la création, requis lors du virement</p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-xs font-semibold text-slate-700">Code CAT (Autorisation)</Label>
                          <div className="flex items-center gap-1.5">
                            <button 
                              type="button" 
                              onClick={() => copyToClipboard(editForm.cat_code || '', 'Code CAT')}
                              className="text-[10px] text-slate-500 hover:text-slate-900 font-semibold cursor-pointer"
                            >
                              Copier
                            </button>
                            <span className="text-slate-300">·</span>
                            <button 
                              type="button" 
                              onClick={generateNewCat}
                              className="text-[10px] text-[#0f2b5c] hover:underline font-semibold cursor-pointer"
                            >
                              Régénérer
                            </button>
                          </div>
                        </div>
                        <Input 
                          value={editForm.cat_code || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, cat_code: e.target.value }))}
                          className="font-mono text-sm h-9 bg-white"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Autorisation des transferts bancaires</p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-xs font-semibold text-slate-700">Code COT (Déblocage)</Label>
                          <div className="flex items-center gap-1.5">
                            <button 
                              type="button" 
                              onClick={() => copyToClipboard(editForm.cot_code || '', 'Code COT')}
                              className="text-[10px] text-slate-500 hover:text-slate-900 font-semibold cursor-pointer"
                            >
                              Copier
                            </button>
                            <span className="text-slate-300">·</span>
                            <button 
                              type="button" 
                              onClick={generateNewCot}
                              className="text-[10px] text-[#0f2b5c] hover:underline font-semibold cursor-pointer"
                            >
                              Régénérer
                            </button>
                          </div>
                        </div>
                        <Input 
                          value={editForm.cot_code || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, cot_code: e.target.value }))}
                          className="font-mono text-sm h-9 bg-white"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Conformité et déblocage final</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Modifier le Mot de passe portail</Label>
                        <Input 
                          type="text"
                          value={editForm.portal_password || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, portal_password: e.target.value }))}
                          className="font-mono text-sm h-10 rounded-xl bg-slate-50"
                          placeholder="Nouveau mot de passe"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Modifier le Code PIN (6 chiffres)</Label>
                        <Input 
                          type="text" 
                          maxLength={6}
                          value={editForm.pin || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, pin: e.target.value }))}
                          className="font-mono text-sm h-10 rounded-xl bg-slate-50"
                          placeholder="6 chiffres"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section Admin Notes */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <Label className="text-xs font-semibold text-slate-700">Note interne administrative (Confidentielle)</Label>
                    <Textarea 
                      rows={3}
                      value={editForm.admin_note || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, admin_note: e.target.value }))}
                      placeholder="Notes de conformité FINTRAC, statut des vérifications, détails du client..."
                      className="rounded-xl text-sm"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: PROFIL & COORDONNÉES */}
              {activeDossierTab === 'profil' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f2b5c] flex items-center gap-1.5">
                      <User className="w-4 h-4" /> État Civil & Identité
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-600">Prénom</Label>
                        <Input 
                          value={editForm.first_name || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Nom de famille</Label>
                        <Input 
                          value={editForm.last_name || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Courriel</Label>
                        <Input 
                          value={editForm.user_email || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, user_email: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Téléphone</Label>
                        <Input 
                          value={editForm.phone || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Nationalité</Label>
                        <Input 
                          value={editForm.nationality || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, nationality: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Date de naissance</Label>
                        <Input 
                          type="date"
                          value={editForm.birth_date || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, birth_date: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f2b5c] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" /> Adresse & Résidence
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-600">Adresse postale</Label>
                        <Input 
                          value={editForm.address || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Code postal</Label>
                        <Input 
                          value={editForm.postal_code || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, postal_code: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Ville</Label>
                        <Input 
                          value={editForm.city || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Pays de résidence</Label>
                        <Input 
                          value={editForm.country || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f2b5c] flex items-center gap-1.5">
                      <UserCog className="w-4 h-4" /> Situation Professionnelle & Profil
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-600">Profession / Métier</Label>
                        <Input 
                          value={editForm.profession || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, profession: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Revenu mensuel / annuel</Label>
                        <Input 
                          value={editForm.monthly_income || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, monthly_income: e.target.value }))}
                          className="h-10 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Type de compte</Label>
                        <Select
                          value={editForm.client_type || 'particulier'}
                          onValueChange={(val) => setEditForm(prev => ({ ...prev, client_type: val }))}
                        >
                          <SelectTrigger className="h-10 rounded-xl bg-white text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="particulier">Compte Particulier</SelectItem>
                            <SelectItem value="professionnel">Compte Professionnel / Entreprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DOCUMENTS JUSTIFICATIFS (KYC - Chargé à la demande) */}
              {activeDossierTab === 'documents' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f2b5c] flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Documents Justificatifs & KYC (Chargés à la demande)
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setLoadingDocs(true);
                        try {
                          const docs = await fetchClientDocumentsOnDemand(selectedClient.id);
                          setClientDocs(docs);
                        } finally {
                          setLoadingDocs(false);
                        }
                      }}
                      className="text-xs h-7 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${loadingDocs ? 'animate-spin' : ''}`} /> Actualiser les documents
                    </Button>
                  </div>

                  {loadingDocs ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#0f2b5c]" />
                      <p className="text-xs font-medium">Chargement des documents de ce client uniquement...</p>
                    </div>
                  ) : (() => {
                    const fallbackDocs = getClientDocumentsList(selectedClient);
                    const combined = clientDocs.length > 0 ? clientDocs : fallbackDocs;

                    if (combined.length === 0) {
                      return (
                        <div className="text-xs text-slate-500 bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center italic">
                          Aucun document justificatif (CNI/Passeport ou justificatif de domicile) soumis pour ce compte.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {combined.map((doc, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-800 truncate" title={doc.label || doc.name}>
                                {doc.label || doc.name || `Document #${idx + 1}`}
                              </p>
                              {doc.name && doc.name !== doc.label && (
                                <p className="text-[10px] text-slate-500 truncate" title={doc.name}>
                                  {doc.name}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewDoc(doc)}
                                className="h-8 px-2.5 rounded-lg border-slate-300 text-[#0f2b5c] bg-white hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                title="Visualiser le document"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Voir</span>
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => downloadDocument(doc)}
                                className="h-8 px-2.5 rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                title="Télécharger sur votre appareil"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 4: TRANSACTIONS (Chargé à la demande) */}
              {activeDossierTab === 'transactions' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f2b5c] flex items-center gap-1.5">
                      <ArrowLeftRight className="w-4 h-4" /> Historique des Transactions de ce Client
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setLoadingTx(true);
                        try {
                          const tx = await fetchClientTransactionsOnDemand(selectedClient.id);
                          setClientTx(tx);
                        } finally {
                          setLoadingTx(false);
                        }
                      }}
                      className="text-xs h-7 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${loadingTx ? 'animate-spin' : ''}`} /> Actualiser
                    </Button>
                  </div>

                  {loadingTx ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#0f2b5c]" />
                      <p className="text-xs font-medium">Chargement des transactions de ce client...</p>
                    </div>
                  ) : clientTx.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center italic">
                      Aucune transaction enregistrée pour ce client pour le moment.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50 sticky top-0">
                          <TableRow>
                            <TableHead className="text-xs font-semibold">Date</TableHead>
                            <TableHead className="text-xs font-semibold">Description / Motif</TableHead>
                            <TableHead className="text-xs font-semibold">Référence</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Montant</TableHead>
                            <TableHead className="text-xs font-semibold">Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientTx.map((tx, idx) => (
                            <TableRow key={tx.id || idx} className="hover:bg-slate-50">
                              <TableCell className="text-xs font-mono text-slate-500 whitespace-nowrap">
                                {tx.date ? new Date(tx.date).toLocaleDateString('fr-CA') : '—'}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-slate-900">
                                {tx.description || tx.motif || 'Mouvement bancaire'}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-slate-500">
                                {tx.reference || tx.id}
                              </TableCell>
                              <TableCell className={`text-xs font-mono font-bold text-right whitespace-nowrap ${
                                tx.direction === 'credit' ? 'text-emerald-700' : 'text-slate-900'
                              }`}>
                                {tx.direction === 'credit' ? '+' : '-'} {(Number(tx.amount) || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} {tx.currency || 'CAD'}
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  tx.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {tx.status || 'complété'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: CARTES (Chargé à la demande) */}
              {activeDossierTab === 'cards' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f2b5c] flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" /> Cartes Bancaires de ce Client
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setLoadingCards(true);
                        try {
                          const cards = await fetchClientCardsOnDemand(selectedClient.id);
                          setClientCards(cards);
                        } finally {
                          setLoadingCards(false);
                        }
                      }}
                      className="text-xs h-7 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${loadingCards ? 'animate-spin' : ''}`} /> Actualiser
                    </Button>
                  </div>

                  {loadingCards ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#0f2b5c]" />
                      <p className="text-xs font-medium">Chargement des cartes de ce client...</p>
                    </div>
                  ) : clientCards.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center italic">
                      Aucune carte bancaire attribuée à ce client.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {clientCards.map((card) => (
                        <div key={card.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#0f2b5c] uppercase">{card.brand || 'VISA'} • {card.card_type || 'Gold'}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              card.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {card.status === 'active' ? 'Active' : 'Bloquée'}
                            </span>
                          </div>
                          <div className="font-mono font-bold text-sm tracking-wider text-slate-900">
                            {card.card_number || '•••• •••• •••• ••••'}
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                            <span>Exp : {card.expiry_date || card.expiry || '10/29'}</span>
                            <span>Plafond : {Number(card.daily_limit || 3000).toLocaleString('fr-CA')} CAD/jour</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: PRÊTS (Chargé à la demande) */}
              {activeDossierTab === 'loans' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f2b5c] flex items-center gap-1.5">
                      <Banknote className="w-4 h-4" /> Demandes de Financement / Prêts de ce Client
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setLoadingLoans(true);
                        try {
                          const loans = await fetchClientLoansOnDemand(selectedClient.id);
                          setClientLoans(loans);
                        } finally {
                          setLoadingLoans(false);
                        }
                      }}
                      className="text-xs h-7 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${loadingLoans ? 'animate-spin' : ''}`} /> Actualiser
                    </Button>
                  </div>

                  {loadingLoans ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#0f2b5c]" />
                      <p className="text-xs font-medium">Chargement des demandes de prêt de ce client...</p>
                    </div>
                  ) : clientLoans.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center italic">
                      Aucune demande de prêt enregistrée pour ce client.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {clientLoans.map((loan) => (
                        <div key={loan.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                          <div>
                            <div className="text-xs font-bold text-slate-900">{loan.project || loan.purpose || 'Financement personnel'}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Durée : {loan.duration_months || 24} mois • Taux : {loan.interest_rate || 2.5}%
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold font-mono text-slate-900">
                              {(Number(loan.amount) || 0).toLocaleString('fr-CA')} CAD
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              loan.status === 'funded' || loan.status === 'approved' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : loan.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {loan.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Modal Actions */}
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
                  type="button" 
                  onClick={handleSaveDossier}
                  disabled={savingDossier}
                  className="bg-[#0f2b5c] hover:bg-[#0f2b5c]/90 text-white rounded-xl text-xs h-10 px-6 font-semibold cursor-pointer"
                >
                  {savingDossier ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Enregistrer les modifications
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE VISUALISATION PLEIN ÉCRAN DOCUMENT KYC */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-6 bg-white rounded-3xl border border-slate-200 shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <DialogTitle className="text-base font-bold text-[#0f2b5c] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0f2b5c]" />
                {previewDoc?.label || 'Document justificatif'}
              </DialogTitle>
              {previewDoc?.name && previewDoc.name !== previewDoc.label && (
                <p className="text-xs text-slate-500 mt-0.5">{previewDoc.name}</p>
              )}
            </div>

            <div className="flex items-center gap-2 pr-6">
              {previewDoc && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => downloadDocument(previewDoc)}
                    className="h-8 rounded-lg text-xs gap-1.5 font-medium border-slate-300 hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(previewDoc.url, '_blank')}
                    className="h-8 rounded-lg text-xs gap-1.5 font-medium border-slate-300 hover:bg-slate-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Nouvel onglet
                  </Button>
                </>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4 flex items-center justify-center min-h-[400px] bg-slate-900/5 rounded-2xl border border-slate-200/80 p-2">
            {previewDoc && (
              previewDoc.url.startsWith('data:application/pdf') || previewDoc.url.endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.label}
                  className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
                />
              ) : previewDoc.url.startsWith('data:image/') || /\.(jpe?g|png|webp|gif|svg)$/i.test(previewDoc.url) ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.label}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-xs"
                />
              ) : (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.label}
                  className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
