import React, { useEffect, useState } from 'react';
import { 
  fetchBankSettings, 
  fetchLoanContractTemplate, 
  saveLoanContractTemplate, 
  fetchClientsPaginated 
} from '../../lib/supabaseBankService';
import { BankSetting, ClientAccount } from '../../types';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { Loader2, FileText, Save, Sparkles, Eye, Download, Printer, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DEFAULT_CONTRACT_TEMPLATE = `CONTRAT OFFICIEL D'OFFRE DE CRÉDIT ET D'OUVERTURE DE PRÊT

ENTRE LES SOUSSIGNÉS :
La banque : {{BANK_NAME}} ({{LEGAL_NAME}}), établissement de crédit et banque internationale de premier ordre, dont le siège social est sis à {{HEAD_OFFICE}}, ci-après dénommée « LE PRÊTEUR ».

ET :
L'Emprunteur : {{CLIENT_NAME}}, né(e) le {{CLIENT_BIRTH}}, titulaire du compte N° {{ACCOUNT_NUMBER}}, demeurant à {{CLIENT_ADDRESS}}, ci-après dénommé « L'EMPRUNTEUR ».

ARTICLE 1 - OBJET DU CONTRAT ET CARACTÉRISTIQUES DU FINANCEMENT
Le Prêteur consent à l'Emprunteur, qui accepte sous les clauses et conditions du présent contrat, un prêt aux conditions suivantes :
• Montant principal du prêt : {{AMOUNT}}
• Durée totale de remboursement : {{DURATION}} mois
• Taux Annuel Effectif Global (TAEG) fixe : {{RATE}} %
• Montant de l'échéance mensuelle fixe : {{MONTHLY_PAYMENT}}
• Date d'exigibilité de la première mensualité : 30 jours après mise à disposition intégrale des fonds.

ARTICLE 2 - MODALITÉS DE MISE À DISPOSITION DES FONDS
Les fonds alloués seront immédiatement crédités sur le compte courant bancaire de l'Emprunteur tenu par le Prêteur ou virés sur les coordonnées bancaires certifiées par le client dès validation des conditions suspensives de sécurité.

ARTICLE 3 - REMBOURSEMENT ANTICIPÉ & FACILITÉS
L'Emprunteur dispose à tout moment de la faculté de rembourser sans pénalité la totalité ou une partie du capital restant dû par simple notification auprès du service clientèle.

ARTICLE 4 - DISPOSITIONS LÉGALES & SIGNATURES
Fait et consigné électroniquement à Toronto, le {{DATE}}, sous scellé numérique de sécurité bancaire certifié conforme.

Pour l'Institution Bancaire {{BANK_NAME}} :
Direction des Engagements et du Crédit
[Cachet et Signature Électronique Certifiés]

Pour l'Emprunteur :
Mention manuscrite « Bon pour accord et acceptation sans réserve »
[Scellé Numérique Client]`;

export default function AdminLoanContract() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState('');
  const [clients, setClients] = useState<(ClientAccount & { id: string })[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [simAmount, setSimAmount] = useState<number>(25000);
  const [simDuration, setSimDuration] = useState<number>(48);
  const [simRate, setSimRate] = useState<number>(2.90);
  const [settings, setSettings] = useState<Partial<BankSetting>>({});

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const s = await fetchBankSettings();
        if (s) {
          setSettings(s);
          if (s.loan_rate_default) setSimRate(s.loan_rate_default);
        }
        const tpl = await fetchLoanContractTemplate();
        setTemplate(tpl || DEFAULT_CONTRACT_TEMPLATE);

        const res = await fetchClientsPaginated({ pageSize: 10 });
        const cList = Array.isArray(res?.data) ? res.data : [];
        setClients(cList);
        if (cList.length > 0) setSelectedClientId(cList[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      await saveLoanContractTemplate(template);
      toast.success("Modèle de contrat de prêt enregistré avec succès.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement du contrat.");
    } finally {
      setSaving(false);
    }
  };

  // Calculate monthly payment
  const monthlyRate = (simRate / 100) / 12;
  const calculatedPayment = monthlyRate > 0 && simDuration > 0
    ? (simAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -simDuration))
    : simAmount / (simDuration || 1);

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

  // Replace tags for preview
  const generatePreview = () => {
    let text = template;
    const clientName = selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : 'Jean Dupont';
    const clientBirth = selectedClient?.birth_date || '15/05/1985';
    const clientAddress = selectedClient ? `${selectedClient.address}, ${selectedClient.city} (${selectedClient.country})` : '124 Rue Royale, Montréal';
    const clientEmail = selectedClient?.user_email || 'client@exemple.com';
    const accNumber = selectedClient?.account_number || 'CA89-9823-8821-01';

    text = text.replaceAll('{{BANK_NAME}}', settings.bank_name || 'VersalBank');
    text = text.replaceAll('{{LEGAL_NAME}}', settings.legal_name || 'VersalBank Inc.');
    text = text.replaceAll('{{HEAD_OFFICE}}', settings.head_office || 'Toronto, Ontario, Canada');
    text = text.replaceAll('{{CLIENT_NAME}}', clientName);
    text = text.replaceAll('{{CLIENT_EMAIL}}', clientEmail);
    text = text.replaceAll('{{CLIENT_BIRTH}}', clientBirth);
    text = text.replaceAll('{{CLIENT_ADDRESS}}', clientAddress);
    text = text.replaceAll('{{ACCOUNT_NUMBER}}', accNumber);
    text = text.replaceAll('{{AMOUNT}}', `${simAmount.toLocaleString('fr-FR')} CAD`);
    text = text.replaceAll('{{DURATION}}', `${simDuration}`);
    text = text.replaceAll('{{RATE}}', `${simRate.toFixed(2)}`);
    text = text.replaceAll('{{MONTHLY_PAYMENT}}', `${calculatedPayment.toFixed(2)} CAD`);
    text = text.replaceAll('{{DATE}}', format(new Date(), 'dd MMMM yyyy', { locale: fr }));

    return text;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#0f2b5c]" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#0f2b5c]" />
            Générateur & Modèle de Contrat de Prêt (IA)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Personnalisez le contrat juridique type de financement bancaire et générez des offres de prêt personnalisées instantanément.
          </p>
        </div>
        <Button 
          onClick={handleSaveTemplate}
          disabled={saving}
          className="bg-[#0f2b5c] hover:bg-[#0a1e40] text-white font-medium shadow-sm transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer le modèle officiel
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Editor & Dynamic variables */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0f2b5c]" />
                Éditeur de Modèle Juridique
              </h3>
              <span className="text-xs text-slate-400">Supporte les balises de fusion</span>
            </div>

            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={18}
              className="font-mono text-xs leading-relaxed text-slate-800 bg-slate-50/50 border-slate-200"
            />

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-700">Variables dynamiques disponibles :</span>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                {['{{BANK_NAME}}', '{{LEGAL_NAME}}', '{{HEAD_OFFICE}}', '{{CLIENT_NAME}}', '{{CLIENT_BIRTH}}', '{{CLIENT_ADDRESS}}', '{{ACCOUNT_NUMBER}}', '{{AMOUNT}}', '{{DURATION}}', '{{RATE}}', '{{MONTHLY_PAYMENT}}', '{{DATE}}'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTemplate(prev => prev + ' ' + tag)}
                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-900 transition-colors border border-slate-200"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Test parameters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h4 className="font-semibold text-slate-900 text-sm">Simulateur d'Aperçu pour un Client</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-600">Sélectionner un client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Choisir un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.first_name} {c.last_name} ({c.user_email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-600">Montant du prêt (CAD)</Label>
                <Input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-600">Durée (Mois)</Label>
                <Input
                  type="number"
                  value={simDuration}
                  onChange={(e) => setSimDuration(parseInt(e.target.value) || 12)}
                  className="mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-600">Taux d'intérêt fixe (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={simRate}
                  onChange={(e) => setSimRate(parseFloat(e.target.value) || 0)}
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>

            <div className="bg-blue-50/60 rounded-xl p-3 flex items-center justify-between text-xs text-blue-950">
              <span>Mensualité calculée automatiquement :</span>
              <span className="font-mono font-bold text-sm text-[#0f2b5c]">{calculatedPayment.toFixed(2)} CAD / mois</span>
            </div>
          </div>
        </div>

        {/* Right: Realistic contract preview document */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-md sticky top-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Eye className="w-4 h-4 text-[#0f2b5c]" />
                <span className="font-semibold text-sm">Aperçu Réel du Document Contractuel</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="text-xs border-slate-200 h-8"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Imprimer / PDF
              </Button>
            </div>

            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-6 font-serif text-slate-800 text-xs leading-relaxed whitespace-pre-wrap max-h-[640px] overflow-y-auto">
              {generatePreview()}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Document cryptographiquement certifié
              </span>
              <span>Norme ISO-20022</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
