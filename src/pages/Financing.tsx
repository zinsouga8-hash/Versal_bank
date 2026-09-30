import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  getClientProfileByEmailOrId, 
  fetchLoansFromSupabase, 
  saveLoanToSupabase 
} from '../lib/supabaseBankService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import {
  Banknote,
  Calculator,
  FileText,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Building,
  Car,
  Hammer,
  Briefcase,
  GraduationCap,
  Wallet,
  Star,
  Download,
  Printer,
  ChevronRight,
  UploadCloud,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  AlertCircle,
  FileCheck,
  Mail,
} from 'lucide-react';
import { LoanApplication, ClientAccount, LoanProject } from '../types';
import BankMonogram from '../components/public/BankMonogram';
import LoanDocumentViewerModal from '../components/portal/LoanDocumentViewerModal';
import { LoanPdfData } from '../lib/loanPdfGenerator';
import { notifyLoanSubmitted } from '../lib/emailService';
import { useI18n } from '../lib/i18n';

interface LoanOffer {
  id: LoanProject;
  title: string;
  desc: string;
  icon: any;
  rate: string;
}

const loanOffers: LoanOffer[] = [
  {
    id: 'immobilier',
    title: 'Acquisition immobilière',
    desc: 'Immobilier neuf, ancien ou investissement locatif.',
    icon: Building,
    rate: 'À PARTIR DE 3,00 %',
  },
  {
    id: 'automobile',
    title: 'Automobile',
    desc: 'VP, flotte et véhicules d’occasion premium.',
    icon: Car,
    rate: 'À PARTIR DE 3,00 %',
  },
  {
    id: 'travaux',
    title: 'Travaux & rénovation',
    desc: 'Travaux, rénovation énergétique et extension.',
    icon: Hammer,
    rate: 'À PARTIR DE 3,00 %',
  },
  {
    id: 'entreprise',
    title: 'Développement d’entreprise',
    desc: 'Besoin en fonds de roulement, matériel, growth.',
    icon: Briefcase,
    rate: 'À PARTIR DE 3,00 %',
  },
  {
    id: 'etudes',
    title: 'Études',
    desc: 'Frais de scolarité, séjour et formation continue.',
    icon: GraduationCap,
    rate: 'À PARTIR DE 3,00 %',
  },
  {
    id: 'tresorerie',
    title: 'Trésorerie',
    desc: 'Optimisation de trésorerie et financement ponctuel.',
    icon: Wallet,
    rate: 'À PARTIR DE 3,00 %',
  },
  {
    id: 'autres',
    title: 'Autre projet',
    desc: 'Tout projet structuré sur justificatifs.',
    icon: Banknote,
    rate: 'À PARTIR DE 3,00 %',
  },
];

export default function Financing() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const [loans, setLoans] = useState<(LoanApplication & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<ClientAccount | null>(null);

  // Simulator Form State
  const [conditionsAccepted, setConditionsAccepted] = useState(false);
  const [project, setProject] = useState<LoanProject>('immobilier');
  const [projectDetails, setProjectDetails] = useState('');
  const [amount, setAmount] = useState('35000');
  const [duration, setDuration] = useState('60');
  const [submitting, setSubmitting] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  // Document Viewer Modals
  const [selectedDocLoan, setSelectedDocLoan] = useState<(LoanApplication & { id: string }) | null>(null);
  const [docType, setDocType] = useState<'conditions' | 'parameters' | null>(null);
  const [submissionSuccessModalOpen, setSubmissionSuccessModalOpen] = useState(false);

  const rate = 3.0;

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const email = user.email || '';
        const uid = user.uid || (user as any)?.id;
        const profile = await getClientProfileByEmailOrId(email || uid);
        if (profile) setAccount(profile);

        const data = await fetchLoansFromSupabase(email);
        setLoans(data as any);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // PMT formula
  const calculatePayment = (pAmount: number, pDuration: number, pRate: number) => {
    const p = pAmount;
    const n = pDuration;
    const r = pRate / 100 / 12;
    if (isNaN(p) || isNaN(n) || p <= 0 || n <= 0) return 0;
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const currentAmountNum = Math.max(500, parseFloat(amount) || 5000);
  const currentDurationNum = Math.max(3, parseInt(duration) || 60);
  const payment = calculatePayment(currentAmountNum, currentDurationNum, rate);
  const totalCreditCost = payment * currentDurationNum - currentAmountNum;

  // Generate Amortization Schedule
  const getAmortizationRows = (p: number, rAnnual: number, months: number) => {
    const r = rAnnual / 100 / 12;
    const monthly = (p * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    let remaining = p;
    const rows = [];
    for (let m = 1; m <= months; m++) {
      const interest = remaining * r;
      const principalPaid = monthly - interest;
      remaining = Math.max(0, remaining - principalPaid);
      rows.push({
        month: m,
        payment: monthly,
        interest: interest,
        principal: principalPaid,
        remaining: remaining
      });
    }
    return rows;
  };

  const handleSubmitLoan = async () => {
    if (!user || !user.email || !account) return;
    if (!conditionsAccepted) {
      toast.error('Vous devez lire et accepter les conditions de prêt avant de soumettre.');
      return;
    }
    setSubmitting(true);
    try {
      const loanData: Omit<LoanApplication, 'id'> = {
        account_id: user.uid,
        client_id: account.client_id || '',
        client_email: user.email,
        project: project,
        project_details: projectDetails.trim() || undefined,
        amount: currentAmountNum,
        duration_months: currentDurationNum,
        rate: rate,
        monthly_payment: Math.round(payment * 100) / 100,
        contract_signed: false,
        status: 'processing', // Standard VersalBank initial status
        createdAt: Date.now(),
      };

      const loanId = `loan_${Date.now()}`;
      await saveLoanToSupabase({ id: loanId, ...loanData } as any);
      const newLoan = { id: loanId, ...loanData };
      setLoans([newLoan, ...loans]);

      // Trigger automatic receipt email notification
      await notifyLoanSubmitted(
        { user_email: user.email, first_name: account.first_name },
        {
          id: loanId,
          amount: currentAmountNum,
          currency: account.currency || 'CAD',
          duration_months: currentDurationNum
        }
      );

      setSubmissionSuccessModalOpen(true);
      toast.success('Demande de financement enregistrée et transmise au comité de crédit !');
      setProjectDetails('');
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de la soumission de la demande de prêt.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignContractOverride = async (loan: LoanApplication & { id: string }, file: File) => {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        await saveLoanToSupabase({
          ...loan,
          contract_signed: true,
          contract_signed_url: base64String
        } as any);
        setLoans(
          loans.map((l) => (l.id === loan.id ? { ...l, contract_signed: true, contract_signed_url: base64String } : l))
        );
        toast.success('Paramètres de crédit signés téléversés avec succès ! En attente de déblocage des fonds.');
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du téléversement.');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: account?.currency || 'CAD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const getProjectLabel = (proj: string) => {
    if (lang === 'en') {
      switch (proj) {
        case 'immobilier':
          return 'Real Estate Acquisition';
        case 'automobile':
          return 'Automobile';
        case 'travaux':
          return 'Renovation & Works';
        case 'entreprise':
          return 'Business Development';
        case 'etudes':
          return 'Education';
        case 'tresorerie':
          return 'Working Capital / Treasury';
        default:
          return 'Other Project';
      }
    }
    switch (proj) {
      case 'immobilier':
        return 'Acquisition immobilière';
      case 'automobile':
        return 'Automobile';
      case 'travaux':
        return 'Travaux & rénovation';
      case 'entreprise':
        return 'Développement d’entreprise';
      case 'etudes':
        return 'Études';
      case 'tresorerie':
        return 'Trésorerie';
      default:
        return 'Autre projet';
    }
  };

  const amortizationRows = getAmortizationRows(currentAmountNum, rate, currentDurationNum);

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-16">
      {/* 1. Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0f2b5c] mb-1">
          {lang === 'en' ? 'Credit & Financial Engineering' : 'Crédit & Ingénierie Financière'}
        </p>
        <h1 className="font-heading font-serif text-3xl sm:text-4xl text-[#1a1a1a] font-normal">
          {lang === 'en' ? 'Financing Solutions' : 'Financement'}
        </h1>
      </div>

      {/* 2. Active Loan Dossiers */}
      {loans.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1a1a1a] flex items-center gap-2">
              <Banknote className="w-4 h-4 text-[#0f2b5c]" /> {lang === 'en' ? `My Financing Applications (${loans.length})` : `Mes dossiers de financement (${loans.length})`}
            </h2>
          </div>

          <div className="space-y-4">
            {loans.map((loan) => (
              <div
                key={loan.id}
                className="bg-white rounded-2xl p-6 border border-[#eee8dd] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[#1a1a1a]">
                      {getProjectLabel(loan.project)}
                    </h3>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      loan.status === 'funded' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      loan.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      loan.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {loan.status === 'funded' ? (lang === 'en' ? 'FUNDS DISBURSED' : 'FONDS DÉBLOQUÉS') :
                       loan.status === 'approved' ? (lang === 'en' ? 'APPROVED BY COMMITTEE' : 'APPROUVÉ PAR LE COMITÉ') :
                       loan.status === 'rejected' ? (lang === 'en' ? 'DECLINED' : 'REFUSÉ') : (lang === 'en' ? 'UNDER REVIEW' : 'EN COURS D’ÉTUDE')}
                    </span>
                  </div>

                  <p className="text-xs text-[#8a857e]">
                    {loan.duration_months} {lang === 'en' ? 'months' : 'mois'} · {lang === 'en' ? 'Fixed Rate' : 'Taux fixe'} {loan.rate.toFixed(2)} % · <strong className="text-[#1a1a1a]">{formatCurrency(loan.monthly_payment)}</strong>/{lang === 'en' ? 'mo' : 'mois'}
                  </p>

                  {loan.status === 'processing' && (
                    <p className="text-[11px] text-amber-700 bg-amber-50/70 p-2 rounded-lg border border-amber-100 max-w-xl">
                      {lang === 'en'
                        ? 'Your application is being examined by the credit committee. You will receive credit agreement terms to sign once approved.'
                        : 'Votre demande est en cours d\'examen par le comité de crédit. Vous recevrez les paramètres de crédit à signer après décision.'}
                    </p>
                  )}

                  {loan.status === 'approved' && !loan.contract_signed && (
                    <p className="text-[11px] text-blue-700 bg-blue-50/70 p-2.5 rounded-lg border border-blue-100 max-w-xl">
                      {lang === 'en'
                        ? <>Application approved! Please download your <strong>Credit Parameters</strong>, sign them, then upload up to 3 signed documents below for your funds to be disbursed.</>
                        : <>Demande acceptée ! Veuillez télécharger vos <strong>Paramètres de crédit</strong>, les signer, puis téléverser jusqu'à 3 documents signés ci-dessous pour que vos fonds soient débloqués.</>}
                    </p>
                  )}

                  {loan.status === 'approved' && loan.contract_signed && (
                    <p className="text-[11px] text-emerald-700 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-100 max-w-xl flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      {lang === 'en'
                        ? 'Signed documents received — Awaiting fund release by the treasury department.'
                        : 'Documents signés bien reçus — En attente du déblocage des fonds par la direction de la trésorerie.'}
                    </p>
                  )}

                  {loan.status === 'funded' && (
                    <p className="text-[11px] text-emerald-700 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 max-w-xl flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      {lang === 'en'
                        ? `Funds disbursed: The amount of ${formatCurrency(loan.amount)} has been credited to your available balance.`
                        : `Fonds débloqués : le montant de ${formatCurrency(loan.amount)} est crédité sur votre solde disponible.`}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <span className="font-bold text-xl text-[#1a1a1a] solde-banque">
                    {formatCurrency(loan.amount)}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedDocLoan(loan);
                        setDocType('conditions');
                      }}
                      className="rounded-xl border-[#eee8dd] text-[#1a1a1a] hover:bg-[#faf7f0] text-xs h-9 gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#0f2b5c]" />
                      {lang === 'en' ? 'Loan Conditions' : 'Conditions de prêt'}
                    </Button>

                    {/* Paramètres de crédit et Upload UNIQUEMENT après approbation par le comité */}
                    {(loan.status === 'approved' || loan.status === 'funded') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDocLoan(loan);
                          setDocType('parameters');
                        }}
                        className="rounded-xl border-[#0f2b5c]/40 bg-[#faf7f0] text-[#1a1a1a] hover:bg-[#f3ede0] text-xs h-9 gap-1.5 font-semibold"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-[#0f2b5c]" />
                        {lang === 'en' ? 'Credit Parameters' : 'Paramètres de crédit'}
                      </Button>
                    )}

                    {loan.status === 'approved' && (
                      loan.contract_signed ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold px-2.5 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Signé & reçu
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'application/pdf,image/*';
                              input.multiple = true;
                              input.onchange = async (e: any) => {
                                const files = Array.from(e.target.files) as File[];
                                if (files.length > 0) {
                                  if (files.length > 3) {
                                    toast.error('Vous pouvez sélectionner un maximum de 3 fichiers.');
                                    return;
                                  }
                                  
                                  try {
                                    const base64Strings = await Promise.all(files.map(file => {
                                      return new Promise<string>((resolve, reject) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => resolve(reader.result as string);
                                        reader.onerror = reject;
                                        reader.readAsDataURL(file);
                                      });
                                    }));
                                    
                                    const combinedString = JSON.stringify(base64Strings);
                                    
                                    await saveLoanToSupabase({
                                      ...loan,
                                      contract_signed: true,
                                      contract_signed_url: combinedString
                                    } as any);
                                    
                                    setLoans(
                                      loans.map((l) => (l.id === loan.id ? { ...l, contract_signed: true, contract_signed_url: combinedString } : l))
                                    );
                                    toast.success('Nouveaux documents signés téléversés avec succès !');
                                  } catch (err) {
                                    toast.error('Erreur lors du téléversement.');
                                  }
                                }
                              };
                              input.click();
                            }}
                            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-9 gap-1"
                          >
                            <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                            Remplacer
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'application/pdf,image/*';
                            input.multiple = true;
                            input.onchange = async (e: any) => {
                              const files = Array.from(e.target.files) as File[];
                              if (files.length > 0) {
                                if (files.length > 3) {
                                  toast.error('Vous pouvez sélectionner un maximum de 3 fichiers.');
                                  return;
                                }
                                
                                try {
                                  const base64Strings = await Promise.all(files.map(file => {
                                    return new Promise<string>((resolve, reject) => {
                                      const reader = new FileReader();
                                      reader.onloadend = () => resolve(reader.result as string);
                                      reader.onerror = reject;
                                      reader.readAsDataURL(file);
                                    });
                                  }));
                                  
                                  const combinedString = JSON.stringify(base64Strings);
                                  
                                  await saveLoanToSupabase({
                                    ...loan,
                                    contract_signed: true,
                                    contract_signed_url: combinedString
                                  } as any);
                                  
                                  setLoans(
                                    loans.map((l) => (l.id === loan.id ? { ...l, contract_signed: true, contract_signed_url: combinedString } : l))
                                  );
                                  toast.success('Paramètres de crédit signés téléversés avec succès ! En attente de déblocage des fonds.');
                                } catch (err) {
                                  toast.error('Erreur lors du téléversement.');
                                }
                              }
                            };
                            input.click();
                          }}
                          className="rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs h-9 gap-1.5 shadow-sm font-semibold"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          Téléverser documents signés (jusqu'à 3)
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Hero Section */}
      <div className="relative rounded-3xl bg-[#faf7f0] border border-[#eee8dd] p-8 sm:p-10 shadow-xs overflow-hidden space-y-6">
        <div className="max-w-2xl space-y-3 relative z-10">
          <h2 className="font-heading font-serif text-2xl sm:text-3xl text-[#1a1a1a] font-normal leading-snug">
            {lang === 'en' ? 'Bespoke financing at regulated prime rates.' : 'Des financements sur mesure, à taux administrés.'}
          </h2>
          <p className="text-xs sm:text-sm text-[#666] leading-relaxed">
            {lang === 'en'
              ? 'From real estate acquisition to corporate working capital, our credit committee structures loans tailored to your aspirations. Transparent rates, legally binding digital contracts, rapid disbursement upon approval.'
              : 'De l\'acquisition immobilière à la trésorerie d\'entreprise, nos ingénieurs financiers structurent un crédit adapté à votre projet. Taux transparents, contrat PDF à signer en ligne, déblocage rapide après validation.'}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#1a1a1a] font-medium">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#eee8dd] shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> {lang === 'en' ? 'FINTRAC Compliant' : 'Conformité FINTRAC'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#eee8dd] shadow-xs">
              <FileText className="w-3.5 h-3.5 text-[#0f2b5c]" /> {lang === 'en' ? 'PDF Agreement' : 'Contrat PDF'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#eee8dd] shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> {lang === 'en' ? 'Credit Committee' : 'Comité de crédit'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Three Stat Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
            {lang === 'en' ? 'Base Rate' : 'Taux de base'}
          </p>
          <p className="text-2xl font-heading font-bold text-[#0f2b5c] mt-1">3,00 %</p>
          <p className="text-[11px] text-[#8a857e] mt-0.5">{lang === 'en' ? 'Fixed prime rate' : 'Taux administré fixe'}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
            {lang === 'en' ? 'Starting From' : 'À partir de'}
          </p>
          <p className="text-2xl font-heading font-bold text-[#1a1a1a] mt-1">3,00 %</p>
          <p className="text-[11px] text-[#8a857e] mt-0.5">{lang === 'en' ? 'For all eligible files' : 'Pour tout dossier éligible'}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
            {lang === 'en' ? 'Duration' : 'Durée'}
          </p>
          <p className="text-2xl font-heading font-bold text-[#1a1a1a] mt-1">3 {lang === 'en' ? 'to' : 'à'} 360 {lang === 'en' ? 'months' : 'mois'}</p>
          <p className="text-[11px] text-[#8a857e] mt-0.5">{lang === 'en' ? 'Maximum flexibility' : 'Flexibilité maximale'}</p>
        </div>
      </div>

      {/* 5. Nos offres de prêt */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Our Loan Programs' : 'Nos offres de prêt'}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loanOffers.map((offer) => (
            <div
              key={offer.id}
              onClick={() => {
                setProject(offer.id);
                const formEl = document.getElementById('demande-de-pret');
                if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`group bg-white rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                project === offer.id ? 'border-[#0f2b5c] ring-2 ring-[#0f2b5c]/20 shadow-sm' : 'border-[#eee8dd] hover:border-[#0f2b5c]/50 hover:shadow-md'
              }`}
            >
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl bg-[#0f2b5c]/10 text-[#0f2b5c] flex items-center justify-center">
                  <offer.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1a1a1a] group-hover:text-[#0f2b5c] transition-colors">
                    {lang === 'en' ? getProjectLabel(offer.id) : offer.title}
                  </h3>
                  <p className="text-xs text-[#8a857e] mt-1 leading-relaxed">
                    {lang === 'en' ? (
                      offer.id === 'immobilier' ? 'New property, existing real estate or buy-to-let investment.' :
                      offer.id === 'automobile' ? 'Personal vehicles, commercial fleet, and premium pre-owned.' :
                      offer.id === 'travaux' ? 'Home improvement, energy renovation and property extension.' :
                      offer.id === 'entreprise' ? 'Working capital, capital equipment and venture growth.' :
                      offer.id === 'etudes' ? 'Tuition, overseas academic stay and continuing education.' :
                      offer.id === 'tresorerie' ? 'Liquidity optimization and structured working capital.' :
                      'Any structured loan project subject to documentation.'
                    ) : offer.desc}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#eee8dd] flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#0f2b5c] tracking-wider uppercase">
                  {lang === 'en' ? 'STARTING AT 3.00%' : offer.rate}
                </span>
                <ChevronRight className="w-4 h-4 text-[#ccc] group-hover:text-[#0f2b5c] group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Comment ça marche - 4 Steps */}
      <div className="space-y-6 pt-4">
        <h2 className="text-base font-semibold text-[#1a1a1a]">{lang === 'en' ? 'How It Works' : 'Comment ça marche'}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs space-y-2">
            <span className="font-mono font-bold text-lg text-[#0f2b5c]">01</span>
            <h4 className="font-bold text-sm text-[#1a1a1a]">{lang === 'en' ? 'Simulation' : 'Simulation'}</h4>
            <p className="text-xs text-[#8a857e] leading-relaxed">
              {lang === 'en' ? 'Amount, term and rate computed in real-time according to your criteria.' : 'Montant, durée et taux calculés instantanément selon vos critères.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs space-y-2">
            <span className="font-mono font-bold text-lg text-[#0f2b5c]">02</span>
            <h4 className="font-bold text-sm text-[#1a1a1a]">{lang === 'en' ? 'Terms & Signature' : 'Conditions & signature'}</h4>
            <p className="text-xs text-[#8a857e] leading-relaxed">
              {lang === 'en' ? 'Review credit terms and electronically submit your application.' : 'Acceptez les conditions financières puis soumettez votre dossier.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs space-y-2">
            <span className="font-mono font-bold text-lg text-[#0f2b5c]">03</span>
            <h4 className="font-bold text-sm text-[#1a1a1a]">{lang === 'en' ? 'Committee Review' : 'Avis du comité'}</h4>
            <p className="text-xs text-[#8a857e] leading-relaxed">
              {lang === 'en' ? 'Your dossier is examined within 24 to 48 hours by the credit committee.' : 'Votre demande est étudiée sous 24 à 48 heures par le comité d\'engagement.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs space-y-2">
            <span className="font-mono font-bold text-lg text-[#0f2b5c]">04</span>
            <h4 className="font-bold text-sm text-[#1a1a1a]">{lang === 'en' ? 'Disbursement' : 'Paramètres & déblocage'}</h4>
            <p className="text-xs text-[#8a857e] leading-relaxed">
              {lang === 'en' ? 'Sign and return credit parameters: funds are immediately released.' : 'Téléchargez, signez et uploadez les paramètres : les fonds sont débloqués sur votre solde.'}
            </p>
          </div>
        </div>
      </div>

      {/* 7. Témoignages */}
      <div className="space-y-6 pt-4">
        <h2 className="text-base font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Client Testimonials' : 'Ils nous ont fait confiance'}</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs space-y-3">
            <div className="flex text-amber-400 gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current" />
              ))}
            </div>
            <p className="text-xs text-[#555] italic leading-relaxed">
              {lang === 'en'
                ? '“Seamless support from initial application to disbursement. The rate was exactly as advertised with zero hidden fees.”'
                : '« Un accompagnement sans faille, du dossier au déblocage. Le taux était exactement celui annoncé, sans surprise. »'}
            </p>
            <p className="text-[11px] font-bold text-[#1a1a1a] pt-1">
              Sarah K. · {lang === 'en' ? 'Real Estate Acquisition' : 'Acquisition immobilière'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs space-y-3">
            <div className="flex text-amber-400 gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current" />
              ))}
            </div>
            <p className="text-xs text-[#555] italic leading-relaxed">
              {lang === 'en'
                ? '“Responsiveness and clarity. I was able to fund working capital without cumbersome administrative hurdles.”'
                : '« Réactivité et clarté. J’ai pu financer un besoin de trésorerie sans complexité administrative lourde. »'}
            </p>
            <p className="text-[11px] font-bold text-[#1a1a1a] pt-1">
              Marc D. · {lang === 'en' ? 'Corporate Treasury' : 'Trésorerie entreprise'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#eee8dd] shadow-xs space-y-3">
            <div className="flex text-amber-400 gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current" />
              ))}
            </div>
            <p className="text-xs text-[#555] italic leading-relaxed">
              {lang === 'en'
                ? '“The digital contract was crystal clear, signed and approved within minutes. The funds followed shortly after.”'
                : '« Le contrat PDF était limpide, signé et renvoyé en quelques minutes. Les fonds ont suivi immédiatement. »'}
            </p>
            <p className="text-[11px] font-bold text-[#1a1a1a] pt-1">
              Yasmine B. · {lang === 'en' ? 'Automobile' : 'Automobile'}
            </p>
          </div>
        </div>
      </div>

      {/* 8. Formulaire de simulation et souscription */}
      <div id="demande-de-pret" className="bg-white rounded-3xl p-6 sm:p-8 border border-[#eee8dd] shadow-xs mt-12 w-full max-w-4xl mx-auto overflow-hidden">
        <div className="border-b border-[#eee8dd] pb-4 mb-6">
          <h2 className="font-heading font-serif text-xl font-bold text-[#1a1a1a] flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#0f2b5c]" /> {lang === 'en' ? 'Apply for Financing' : 'Demander un prêt'}
          </h2>
          <p className="text-xs text-[#8a857e] mt-1">
            {lang === 'en'
              ? 'Adjust your parameters to instantly calculate monthly payments and generate your amortization schedule.'
              : 'Ajustez vos paramètres pour évaluer instantanément vos mensualités et générer votre échéancier.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start w-full">
          <div className="space-y-5 min-w-0 w-full">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{lang === 'en' ? 'Project Type' : 'Projet financé'}</Label>
              <Select value={project} onValueChange={(v) => setProject(v as LoanProject)}>
                <SelectTrigger className="rounded-xl h-11 text-sm bg-white border-[#eee8dd] w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="immobilier">{lang === 'en' ? 'Real Estate Acquisition' : 'Acquisition immobilière'}</SelectItem>
                  <SelectItem value="automobile">{lang === 'en' ? 'Automobile' : 'Automobile'}</SelectItem>
                  <SelectItem value="travaux">{lang === 'en' ? 'Renovation & Works' : 'Travaux & rénovation'}</SelectItem>
                  <SelectItem value="entreprise">{lang === 'en' ? 'Business Development' : 'Développement d’entreprise'}</SelectItem>
                  <SelectItem value="etudes">{lang === 'en' ? 'Education' : 'Études'}</SelectItem>
                  <SelectItem value="tresorerie">{lang === 'en' ? 'Working Capital / Treasury' : 'Trésorerie'}</SelectItem>
                  <SelectItem value="autres">{lang === 'en' ? 'Other Project' : 'Autre projet'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{lang === 'en' ? 'Project Details (Optional)' : 'Précisions sur le projet (facultatif)'}</Label>
              <Input
                type="text"
                placeholder={lang === 'en' ? 'E.g.: Hybrid vehicle purchase, Eco renovation...' : 'Ex. : Achat véhicule hybride, Rénovation énergétique...'}
                value={projectDetails}
                onChange={(e) => setProjectDetails(e.target.value)}
                className="rounded-xl h-11 text-sm border-[#eee8dd] w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-xs font-semibold">
                  {lang === 'en' ? 'Desired Amount' : 'Montant souhaité'} ({account?.currency || 'CAD'})
                </Label>
                <span className="text-xs font-semibold text-[#0f2b5c]">{formatCurrency(currentAmountNum)}</span>
              </div>
              <input
                type="range"
                min="500"
                max="3000000"
                step="500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0f2b5c]"
              />
              <div className="flex justify-between text-[10px] text-[#8a857e]">
                <span>500 {account?.currency || 'CAD'}</span>
                <span>3 000 000 {account?.currency || 'CAD'}</span>
              </div>
              <Input
                type="number"
                min="500"
                max="3000000"
                step="500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-xl h-11 text-sm font-semibold mt-2 border-[#eee8dd] w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-xs font-semibold">{lang === 'en' ? 'Term (months)' : 'Durée d\'amortissement (mois)'}</Label>
                <span className="text-xs font-semibold text-[#0f2b5c]">{currentDurationNum} {lang === 'en' ? 'months' : 'mois'} ({Math.round(currentDurationNum / 12 * 10) / 10} {lang === 'en' ? 'years' : 'ans'})</span>
              </div>
              <input
                type="range"
                min="3"
                max="360"
                step="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0f2b5c]"
              />
              <div className="flex justify-between text-[10px] text-[#8a857e]">
                <span>3 {lang === 'en' ? 'months' : 'mois'}</span>
                <span>360 {lang === 'en' ? 'months' : 'mois'}</span>
              </div>
              <Input
                type="number"
                min="3"
                max="360"
                step="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="rounded-xl h-11 text-sm font-semibold mt-2 border-[#eee8dd] w-full"
              />
            </div>
          </div>

          {/* Calculations Output Card */}
          <div className="bg-[#faf8f5] p-6 rounded-2xl border border-[#eee8dd] flex flex-col justify-between space-y-6 min-w-0 w-full">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#eee8dd]">
                <span className="text-xs text-[#8a857e]">{lang === 'en' ? 'Fixed Prime Rate' : 'Taux fixe administré'}</span>
                <div className="text-right">
                  <span className="font-bold text-[#0f2b5c] text-lg">{rate.toFixed(2)} %</span>
                  <p className="text-[10px] text-emerald-700 font-medium">{lang === 'en' ? 'Institutional subsidy -2.00%' : 'Bonification institutionnelle -2.00%'}</p>
                </div>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-[#eee8dd]">
                <span className="text-xs text-[#8a857e]">{lang === 'en' ? 'Estimated Monthly Payment' : 'Mensualité estimée'}</span>
                <span className="font-bold text-xl text-[#1a1a1a] solde-banque">
                  {formatCurrency(payment)}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-[#eee8dd]">
                <span className="text-xs text-[#8a857e]">{lang === 'en' ? 'Total Interest Cost' : 'Coût total des intérêts'}</span>
                <span className="font-medium text-xs text-[#1a1a1a]">
                  {formatCurrency(Math.max(0, totalCreditCost))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8a857e]">{lang === 'en' ? 'Total Amount Repaid' : 'Montant total remboursé'}</span>
                <span className="font-semibold text-xs text-[#1a1a1a]">
                  {formatCurrency(currentAmountNum + Math.max(0, totalCreditCost))}
                </span>
              </div>
            </div>

            {/* Amortization schedule toggle */}
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSchedule(!showSchedule)}
                className="w-full text-xs text-[#0f2b5c] hover:bg-white/60 flex items-center justify-center gap-1.5 h-9"
              >
                <Calculator className="w-3.5 h-3.5" />
                {showSchedule
                  ? (lang === 'en' ? 'Hide Amortization Schedule' : 'Masquer le tableau d’amortissement')
                  : (lang === 'en' ? 'View Projected Amortization Schedule' : 'Voir le tableau d’amortissement prévisionnel')}
                {showSchedule ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            </div>

            {/* Conditions feedback */}
            {conditionsAccepted ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {lang === 'en' ? 'You have reviewed and accepted the loan terms.' : 'Vous avez approuvé les conditions générales de prêt.'}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                {lang === 'en'
                  ? 'Please review and accept the loan terms before submitting your application.'
                  : 'Veuillez lire et donner votre accord sur les conditions de prêt avant de soumettre votre dossier.'}
              </div>
            )}

            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => {
                  setSelectedDocLoan({
                    id: 'DRAFT',
                    account_id: user?.uid || '',
                    client_id: account?.client_id || '',
                    client_email: user?.email || '',
                    project: project,
                    project_details: projectDetails,
                    amount: currentAmountNum,
                    duration_months: currentDurationNum,
                    rate: rate,
                    monthly_payment: Math.round(payment * 100) / 100,
                    contract_signed: false,
                    status: 'processing',
                    createdAt: Date.now(),
                  });
                  setDocType('conditions');
                }}
                className="w-full h-11 rounded-xl bg-white border border-[#eee8dd] text-[#0f2b5c] hover:bg-[#faf8f5] text-xs font-semibold gap-1.5 shadow-xs"
              >
                <FileText className="w-4 h-4" />
                {lang === 'en' ? 'Review Loan Terms' : 'Voir les conditions de prêt'}
              </Button>

              <Button
                type="button"
                onClick={handleSubmitLoan}
                disabled={submitting || payment <= 0 || !conditionsAccepted}
                className="w-full h-11 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs font-semibold gap-1.5 shadow-sm disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {lang === 'en' ? 'Submitting to Committee...' : 'Transmission au comité...'}
                  </>
                ) : (
                  <>
                    {lang === 'en' ? 'Submit Application' : 'Envoyer ma demande'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Expandable Amortization Schedule Table */}
        {showSchedule && (
          <div className="mt-8 pt-6 border-t border-[#eee8dd] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1a1a1a]">
                {lang === 'en'
                  ? `Full Projected Amortization Schedule (${currentDurationNum} monthly payments)`
                  : `Échéancier prévisionnel complet (${currentDurationNum} mensualités)`}
              </h3>
              <span className="text-xs text-[#8a857e]">
                {lang === 'en' ? 'Fixed rate' : 'Taux fixe'} : {rate.toFixed(2)} % · {lang === 'en' ? 'Payment' : 'Mensualité'} : {formatCurrency(payment)}
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto overflow-x-auto border border-[#eee8dd] rounded-2xl bg-white">
              <Table>
                <TableHeader className="bg-[#faf8f5] sticky top-0">
                  <TableRow className="border-b border-[#eee8dd]">
                    <TableHead className="text-xs text-[#1a1a1a] font-semibold w-16">{lang === 'en' ? 'Month' : 'Mois'}</TableHead>
                    <TableHead className="text-xs text-[#1a1a1a] font-semibold">{lang === 'en' ? 'Monthly Payment' : 'Mensualité'}</TableHead>
                    <TableHead className="text-xs text-[#1a1a1a] font-semibold">{lang === 'en' ? 'Principal' : 'Capital amorti'}</TableHead>
                    <TableHead className="text-xs text-[#1a1a1a] font-semibold">{lang === 'en' ? 'Interest' : 'Intérêts'}</TableHead>
                    <TableHead className="text-right text-xs text-[#1a1a1a] font-semibold">{lang === 'en' ? 'Remaining Balance' : 'Solde restant dû'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amortizationRows.map((row) => (
                    <TableRow key={row.month} className="border-b border-[#eee8dd]/50 hover:bg-[#faf7f0]/50 text-xs">
                      <TableCell className="font-mono text-[#8a857e]">#{row.month}</TableCell>
                      <TableCell className="font-medium text-[#1a1a1a]">{formatCurrency(row.payment)}</TableCell>
                      <TableCell className="text-emerald-700">{formatCurrency(row.principal)}</TableCell>
                      <TableCell className="text-[#8a857e]">{formatCurrency(row.interest)}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-[#1a1a1a]">
                        {formatCurrency(row.remaining)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* 9. Official VersalBank Loan Documents Modal */}
      <LoanDocumentViewerModal
        open={!!docType}
        onOpenChange={(open) => {
          if (!open) {
            setDocType(null);
            setSelectedDocLoan(null);
          }
        }}
        type={docType}
        loanData={
          selectedDocLoan
            ? {
                loanId: selectedDocLoan.id || 'SIM-' + Date.now().toString(36).toUpperCase(),
                referenceNumber: selectedDocLoan.id ? `LS-${selectedDocLoan.id.slice(-6).toUpperCase()}-2026` : undefined,
                amount: selectedDocLoan.amount,
                durationMonths: selectedDocLoan.duration_months,
                interestRate: selectedDocLoan.rate || 3.0,
                monthlyPayment: selectedDocLoan.monthly_payment,
                currency: account?.currency || 'EUR',
                clientName: `${account?.first_name || ''} ${account?.last_name || ''}`.trim() || user?.displayName || 'Client VersalBank',
                clientNationality: account?.nationality || 'Canadienne',
                clientEmail: selectedDocLoan.client_email || user?.email || '',
                clientAddress: account?.address ? `${account.address}, ${account.city || ''} ${account.postal_code || ''}`.trim() : '1000 Rue de la Gauchetière O, Montréal (QC)',
                createdAt: selectedDocLoan.createdAt || Date.now(),
              }
            : {
                loanId: 'SIM-' + Date.now().toString(36).toUpperCase(),
                referenceNumber: `SIM-${Date.now().toString().slice(-6)}-2026`,
                amount: currentAmountNum,
                durationMonths: currentDurationNum,
                interestRate: 3.0,
                monthlyPayment: payment,
                currency: account?.currency || 'EUR',
                clientName: `${account?.first_name || ''} ${account?.last_name || ''}`.trim() || user?.displayName || 'Client VersalBank',
                clientNationality: account?.nationality || 'Canadienne',
                clientEmail: user?.email || '',
                clientAddress: account?.address ? `${account.address}, ${account.city || ''} ${account.postal_code || ''}`.trim() : '1000 Rue de la Gauchetière O, Montréal (QC)',
                createdAt: Date.now(),
              }
        }
        canAccept={docType === 'conditions' && !conditionsAccepted}
        onAcceptConditions={() => {
          setConditionsAccepted(true);
          setDocType(null);
          toast.success(lang === 'en' ? "Loan terms accepted! You can now submit your application." : "Conditions de prêt acceptées ! Vous pouvez soumettre votre demande.");
        }}
      />

      {/* Modal Notification de soumission */}
      <Dialog open={submissionSuccessModalOpen} onOpenChange={setSubmissionSuccessModalOpen}>
        <DialogContent className="max-w-md bg-white border border-[#eee8dd] rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <DialogTitle className="font-heading font-serif text-xl sm:text-2xl text-[#1a1a1a]">
                {lang === 'en' ? 'Application Submitted Successfully!' : 'Demande transmise avec succès !'}
              </DialogTitle>
              <p className="text-xs sm:text-sm text-[#5a554e] leading-relaxed">
                {lang === 'en'
                  ? <>Your financing request was received and is currently <strong>under review</strong> by our credit committee.</>
                  : <>Votre demande de prêt a bien été reçue et est actuellement <strong>en cours de traitement</strong> par notre comité de crédit.</>}
              </p>
            </div>

            <div className="w-full bg-[#faf7f0] border border-[#eee8dd] rounded-2xl p-4 text-xs text-[#4a453e] text-left space-y-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0f2b5c] mt-1.5 shrink-0" />
                <p>
                  {lang === 'en'
                    ? <>You can track your application status at any time in the <strong>"My Financing Applications"</strong> section at the top of this page.</>
                    : <>Vous pouvez suivre l'avancement de votre dossier à tout moment en haut de cette page dans la section <strong>« Mes dossiers de financement »</strong>.</>}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0f2b5c] mt-1.5 shrink-0" />
                <p>
                  {lang === 'en'
                    ? 'For any questions regarding your application, contact our client desk:'
                    : 'Pour toute préoccupation ou question sur votre dossier, veuillez contacter notre service client par courriel :'}
                </p>
              </div>
            </div>

            <div className="w-full pt-1 space-y-2.5">
              <a
                href="mailto:contact@versalbank.com"
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all"
              >
                <Mail className="w-4 h-4 text-blue-200" />
                <span>contact@versalbank.com</span>
              </a>

              <Button
                variant="outline"
                onClick={() => {
                  setSubmissionSuccessModalOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full text-xs h-10 rounded-xl border-[#eee8dd] text-[#1a1a1a] hover:bg-[#faf7f0]"
              >
                {lang === 'en' ? 'View My Applications' : 'Accéder à mes dossiers de financement'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
