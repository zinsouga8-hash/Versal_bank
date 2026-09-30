import React, { useEffect, useState } from 'react';
import { 
  fetchEmailLogsPaginated,
  deleteEmailLog, 
  fetchClientsPaginated, 
  fetchBankSettings, 
  saveBankSettings 
} from '../../lib/supabaseBankService';
import { BankSetting, ClientAccount } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Mail, RefreshCw, Send, CheckCircle2, 
  Trash2, Eye, ShieldCheck, Sparkles, FileText, SendHorizontal,
  Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { sendAutomaticEmail, EmailType } from '../../lib/emailService';

interface SentEmailRecord {
  id: string;
  recipient: string;
  recipientName?: string;
  type: EmailType;
  subject: string;
  title: string;
  contentLines: string[];
  html: string;
  status: string;
  createdAt: number;
}

export default function AdminEmails() {
  const [emails, setEmails] = useState<SentEmailRecord[]>([]);
  const [clients, setClients] = useState<(ClientAccount & { id: string })[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<SentEmailRecord | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'dispatch' | 'templates' | 'history' | 'config'>('dispatch');
  const [supportEmail, setSupportEmail] = useState('support@versalpac.com');
  const [adminNotificationEmail, setAdminNotificationEmail] = useState('contact@versalpac.com');

  // History search, filter & pagination state
  const [emailSearch, setEmailSearch] = useState('');
  const [emailTypeFilter, setEmailTypeFilter] = useState('all');
  const [emailPage, setEmailPage] = useState(1);
  const [emailPageSize] = useState(15);
  const [emailTotal, setEmailTotal] = useState(0);
  const [emailTotalPages, setEmailTotalPages] = useState(1);

  // Direct dispatch form
  const [targetClientId, setTargetClientId] = useState<string>('');
  const [customSubject, setCustomSubject] = useState('');
  const [customTitle, setCustomTitle] = useState('Notification Officielle VersalBank');
  const [customMessage, setCustomMessage] = useState('');
  const [sendingCustom, setSendingCustom] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<Record<string, string>>({
    tpl_account_received: "Votre dossier d'ouverture de compte a bien été réceptionné par nos services.",
    tpl_account_created: "Votre compte bancaire a été ouvert. Vos identifiants d'accès provisoires sont joints.",
    tpl_account_approved: "Votre compte a été certifié conforme par le département de sécurité bancaire.",
    tpl_account_activated: "Votre compte et vos codes de sécurité (CAT / COT) sont désormais pleinement opérationnels.",
    tpl_card_activated: "Votre carte bancaire internationale a été activée et est prête à l'emploi.",
    tpl_movement_update: "Une nouvelle opération financière a été traitée avec succès sur votre compte.",
    tpl_loan_received: "Votre demande de financement a fait l'objet d'un accord favorable de notre commission.",
  });
  const [savingTemplates, setSavingTemplates] = useState(false);

  const fetchEmailData = async (
    targetPage = emailPage,
    targetSearch = emailSearch,
    targetType = emailTypeFilter
  ) => {
    setLoading(true);
    try {
      const res = await fetchEmailLogsPaginated({
        page: targetPage,
        pageSize: emailPageSize,
        search: targetSearch,
        type: targetType,
      });

      if (Array.isArray(res.data)) {
        setEmails(res.data);
      }
      setEmailTotal(res.total);
      setEmailTotalPages(res.totalPages);
      setEmailPage(res.page);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialSettings = async () => {
    try {
      const s = await fetchBankSettings();
      if (s) {
        setSupportEmail(s.support_email || 'support@versalpac.com');
        setAdminNotificationEmail(s.admin_email || 'contact@versalpac.com');
        if (s.email_templates) {
          setTemplates(prev => ({ ...prev, ...s.email_templates }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Lazy-load client list only when dispatch tab is opened
  const loadDispatchClients = async () => {
    if (clients.length > 0 || loadingClients) return;
    setLoadingClients(true);
    try {
      const res = await fetchClientsPaginated({ pageSize: 50 });
      const cList = Array.isArray(res?.data) ? res.data : [];
      setClients(cList);
      if (cList.length > 0 && !targetClientId) {
        setTargetClientId(cList[0].id);
      }
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchInitialSettings();
    if (activeSubTab === 'history') {
      fetchEmailData(1, emailSearch, emailTypeFilter);
    } else if (activeSubTab === 'dispatch') {
      loadDispatchClients();
    }
  }, [activeSubTab]);

  const handleSubTabChange = (tab: 'dispatch' | 'templates' | 'history' | 'config') => {
    setActiveSubTab(tab);
    if (tab === 'history') {
      fetchEmailData(1, emailSearch, emailTypeFilter);
    } else if (tab === 'dispatch') {
      loadDispatchClients();
    }
  };

  const handleHistorySearchChange = (val: string) => {
    setEmailSearch(val);
    setEmailPage(1);
    fetchEmailData(1, val, emailTypeFilter);
  };

  const handleHistoryTypeChange = (typeVal: string) => {
    setEmailTypeFilter(typeVal);
    setEmailPage(1);
    fetchEmailData(1, emailSearch, typeVal);
  };

  const handleHistoryPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= emailTotalPages && newPage !== emailPage) {
      setEmailPage(newPage);
      fetchEmailData(newPage, emailSearch, emailTypeFilter);
    }
  };

  const handleSendCustomEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClient = clients.find(c => c.id === targetClientId);
    if (!targetClient || !targetClient.user_email) {
      toast.error("Veuillez sélectionner un destinataire valide.");
      return;
    }

    if (!customSubject.trim() || !customMessage.trim()) {
      toast.error("Veuillez renseigner l'objet et le corps du message.");
      return;
    }

    setSendingCustom(true);
    try {
      const lines = customMessage.split('\n').filter(l => l.trim().length > 0);
      await sendAutomaticEmail({
        to: targetClient.user_email,
        recipientName: `${targetClient.first_name} ${targetClient.last_name}`,
        type: 'ACCOUNT_ACTIVATED',
        subject: customSubject.trim(),
        title: customTitle.trim(),
        contentLines: [
          `Cher(e) ${targetClient.first_name} ${targetClient.last_name},`,
          ...lines,
          `Numéro de compte : ${targetClient.account_number || 'En attente'}`,
          `Code CAT : ${targetClient.cat_code || 'N/A'} • Code COT : ${targetClient.cot_code || 'N/A'}`
        ],
        badgeText: 'Communication Sécurisée'
      });

      toast.success(`Courriel officiel transmis avec succès à ${targetClient.user_email}.`);
      setCustomSubject('');
      setCustomMessage('');
      fetchEmailData();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'envoi du message.");
    } finally {
      setSendingCustom(false);
    }
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      const cur = await fetchBankSettings();
      await saveBankSettings({ ...cur, ...templates });
      toast.success("Modèles de courriels automatiques enregistrés avec succès.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement des modèles.");
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingTemplates(true);
    try {
      const cur = await fetchBankSettings();
      await saveBankSettings({ ...cur, support_email: supportEmail, admin_email: adminNotificationEmail });
      toast.success("Adresses email de la plateforme mises à jour avec succès.");
      fetchInitialSettings();
    } catch (e) {
      toast.error("Erreur de sauvegarde des adresses email.");
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleDeleteEmail = async (id: string) => {
    try {
      await deleteEmailLog(id);
      setEmails(prev => prev.filter(e => e.id !== id));
      toast.success("Enregistrement retiré du journal.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression.");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Mail className="w-6 h-6 text-[#0f2b5c]" />
            Emails & Identifiants Sécurisés
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Envoi d'identifiants, transmission des codes CAT/COT, configuration des modèles automatiques et traçabilité des courriels.
          </p>
        </div>

        <Button onClick={() => activeSubTab === 'history' ? fetchEmailData(1, emailSearch, emailTypeFilter) : fetchInitialSettings()} variant="outline" size="sm" className="border-slate-200">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
        </Button>
      </div>

      {/* Sub tabs pills */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleSubTabChange('dispatch')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeSubTab === 'dispatch'
              ? 'bg-[#0f2b5c] text-white shadow-xs font-semibold'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <SendHorizontal className="w-3.5 h-3.5 inline mr-1.5" />
          Envoi direct aux clients
        </button>

        <button
          onClick={() => handleSubTabChange('templates')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeSubTab === 'templates'
              ? 'bg-[#0f2b5c] text-white shadow-xs font-semibold'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 inline mr-1.5" />
          Modèles d'emails automatiques
        </button>

        <button
          onClick={() => handleSubTabChange('config')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeSubTab === 'config'
              ? 'bg-[#0f2b5c] text-white shadow-xs font-semibold'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Mail className="w-3.5 h-3.5 inline mr-1.5" />
          Configuration Service Client
        </button>
        <button
          onClick={() => handleSubTabChange('history')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeSubTab === 'history'
              ? 'bg-[#0f2b5c] text-white shadow-xs font-semibold'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
          Journal d'envoi ({emailTotal || emails.length})
        </button>
      </div>

      {/* VIEW 1: Direct dispatch */}
      {activeSubTab === 'dispatch' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-3xl space-y-6">
          <h3 className="font-serif font-bold text-lg text-slate-900">
            Transmettre un Email Officiel ou des Identifiants Bancaires
          </h3>

          <form onSubmit={handleSendCustomEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Sélectionner le Client Destinataire</Label>
              <Select value={targetClientId} onValueChange={setTargetClientId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Choisir un compte client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.first_name} {c.last_name} ({c.user_email}) — Compte: {c.account_number || 'N/A'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Objet du Courriel</Label>
              <Input
                placeholder="ex: VersalBank — Vos identifiants de compte et certificat d'activation"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Titre Principal dans le Message</Label>
              <Input
                placeholder="ex: Activation de votre Espace Bancaire Sécurisé"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Corps du Message & Instructions</Label>
              <Textarea
                placeholder="Saisissez ici les instructions personnalisées pour le client. Les coordonnées bancaires et codes de sécurité (CAT / COT) seront automatiquement rattachés en bas de page."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
                className="text-xs"
                required
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={sendingCustom} className="bg-[#0f2b5c] hover:bg-[#0a1e40] text-white">
                {sendingCustom ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Expédier le courriel au client
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 2: Templates editor */}
      {activeSubTab === 'templates' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-lg text-slate-900">
              Modèles de Notifications Automatiques
            </h3>
            <Button
              onClick={handleSaveTemplates}
              disabled={savingTemplates}
              className="bg-[#0f2b5c] hover:bg-[#0a1e40] text-white"
            >
              {savingTemplates ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Enregistrer tous les modèles
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">1. Réception de demande d'ouverture</Label>
              <Textarea
                value={templates.tpl_account_received}
                onChange={(e) => setTemplates({ ...templates, tpl_account_received: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">2. Compte créé (Identifiant + mot de passe)</Label>
              <Textarea
                value={templates.tpl_account_created}
                onChange={(e) => setTemplates({ ...templates, tpl_account_created: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">3. Compte approuvé & validé</Label>
              <Textarea
                value={templates.tpl_account_approved}
                onChange={(e) => setTemplates({ ...templates, tpl_account_approved: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">4. Compte activé (RIB, CAT, COT)</Label>
              <Textarea
                value={templates.tpl_account_activated}
                onChange={(e) => setTemplates({ ...templates, tpl_account_activated: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">5. Carte bancaire activée</Label>
              <Textarea
                value={templates.tpl_card_activated}
                onChange={(e) => setTemplates({ ...templates, tpl_card_activated: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">6. Transaction / Mouvement financier</Label>
              <Textarea
                value={templates.tpl_movement_update}
                onChange={(e) => setTemplates({ ...templates, tpl_movement_update: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs text-slate-700 font-semibold">7. Accord de principe de financement / Prêt</Label>
              <Textarea
                value={templates.tpl_loan_received}
                onChange={(e) => setTemplates({ ...templates, tpl_loan_received: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'config' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#0f2b5c]" />
              Configuration et séparation stricte des adresses email
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              La plateforme utilise deux adresses distinctes selon le rôle et les destinataires.
            </p>
          </div>

          <div className="space-y-6 max-w-xl">
            <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <Label htmlFor="supportEmail" className="font-bold text-slate-800">
                  1. Expéditeur des notifications automatiques aux clients
                </Label>
              </div>
              <p className="text-xs text-slate-500">
                Utilisée comme expéditeur pour toutes les notifications automatiques destinées aux clients (OTP, crédits, débits, virements, cartes, alertes de sécurité).
              </p>
              <Input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@versalpac.com"
                className="bg-white font-mono text-sm"
              />
            </div>

            <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <Label htmlFor="adminNotificationEmail" className="font-bold text-slate-800">
                  2. Destinataire des alertes administratives
                </Label>
              </div>
              <p className="text-xs text-slate-500">
                Utilisée exclusivement pour recevoir les notifications nécessitant une intervention de l'administrateur (nouveau compte, nouveau virement, nouveau dépôt, nouvelle carte, nouveau prêt). Ne reçoit jamais les alertes personnelles des clients.
              </p>
              <Input
                id="adminNotificationEmail"
                type="email"
                value={adminNotificationEmail}
                onChange={(e) => setAdminNotificationEmail(e.target.value)}
                placeholder="contact@versalpac.com"
                className="bg-white font-mono text-sm"
              />
            </div>
            
            <Button
              onClick={handleSaveConfig}
              disabled={savingTemplates}
              className="bg-[#0f2b5c] hover:bg-[#1a3a75] text-white"
            >
              {savingTemplates ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sauvegarde...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Enregistrer la configuration</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* VIEW 3: Sent emails history */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="Rechercher par destinataire, objet, titre..."
                value={emailSearch}
                onChange={(e) => handleHistorySearchChange(e.target.value)}
                className="pl-9 text-xs rounded-xl bg-white border-slate-200 h-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500 whitespace-nowrap">Type :</Label>
              <Select value={emailTypeFilter} onValueChange={handleHistoryTypeChange}>
                <SelectTrigger className="h-10 text-xs bg-white rounded-xl border-slate-200 min-w-[180px]">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="account_received">Dossier reçu</SelectItem>
                  <SelectItem value="account_created">Compte créé</SelectItem>
                  <SelectItem value="account_approved">Compte approuvé</SelectItem>
                  <SelectItem value="account_activated">Compte activé</SelectItem>
                  <SelectItem value="card_activated">Carte activée</SelectItem>
                  <SelectItem value="movement_update">Mouvement / Transaction</SelectItem>
                  <SelectItem value="loan_received">Dossier de prêt</SelectItem>
                  <SelectItem value="notification">Notification générale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-200">
                  <TableHead className="text-xs font-semibold text-slate-600">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Destinataire</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Objet & Titre</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Type de notification</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0f2b5c]" />
                    </TableCell>
                  </TableRow>
                ) : emails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-slate-500">
                      Aucun courriel ne correspond à votre recherche.
                    </TableCell>
                  </TableRow>
                ) : (
                  emails.map((record) => (
                    <TableRow key={record.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell>
                        <div className="text-xs text-slate-600">
                          {format(new Date(record.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-semibold text-xs text-slate-900">{record.recipient}</div>
                        {record.recipientName && (
                          <div className="text-[11px] text-slate-400">{record.recipientName}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-medium text-slate-800">{record.subject}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-sm">{record.title}</div>
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {record.type}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedEmail(record)}
                            className="text-xs h-8 text-[#0f2b5c] hover:bg-blue-50 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Aperçu
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteEmail(record.id)}
                            className="text-xs h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-500 order-2 sm:order-1 font-medium">
              Affichage {emailTotal === 0 ? 0 : (emailPage - 1) * emailPageSize + 1} à {Math.min(emailPage * emailPageSize, emailTotal)} sur {emailTotal} courriel{emailTotal > 1 ? 's' : ''}
            </div>

            <div className="flex items-center gap-1.5 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                disabled={emailPage <= 1 || loading}
                onClick={() => handleHistoryPageChange(emailPage - 1)}
                className="h-8 px-2.5 text-xs rounded-lg border-slate-200 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Précédent
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, emailTotalPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (emailTotalPages > 5 && emailPage > 3) {
                    pNum = emailPage - 3 + i;
                    if (pNum > emailTotalPages) pNum = emailTotalPages - (4 - i);
                  }
                  if (pNum < 1) pNum = 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => handleHistoryPageChange(pNum)}
                      disabled={loading}
                      className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        emailPage === pNum
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
                disabled={emailPage >= emailTotalPages || loading}
                onClick={() => handleHistoryPageChange(emailPage + 1)}
                className="h-8 px-2.5 text-xs rounded-lg border-slate-200 cursor-pointer"
              >
                Suivant <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">
              Aperçu du Courriel Transmis
            </DialogTitle>
          </DialogHeader>

          {selectedEmail && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-1">
                <div><span className="font-semibold">Destinataire :</span> {selectedEmail.recipient}</div>
                <div><span className="font-semibold">Objet :</span> {selectedEmail.subject}</div>
                <div><span className="font-semibold">Date d'émission :</span> {format(new Date(selectedEmail.createdAt), 'dd MMMM yyyy HH:mm:ss', { locale: fr })}</div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <iframe
                  title="email-preview"
                  srcDoc={selectedEmail.html}
                  className="w-full h-96 rounded border-0"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
