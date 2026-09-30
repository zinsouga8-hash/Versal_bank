import { getBankSupportEmail } from '../../lib/supabaseBankService';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Download, Printer, CheckCircle, ShieldCheck, X } from 'lucide-react';
import { BankEmblem } from '../public/BankLogo';
import { downloadLoanConditionsPdf, downloadLoanParametersPdf, LoanPdfData } from '../../lib/loanPdfGenerator';

interface LoanDocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'conditions' | 'parameters' | null;
  loanData: LoanPdfData | null;
  canAccept?: boolean;
  onAcceptConditions?: () => void;
}

export default function LoanDocumentViewerModal({
  open,
  onOpenChange,
  type,
  loanData,
  canAccept,
  onAcceptConditions,
}: LoanDocumentViewerModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [consentChecked, setConsentChecked] = useState(false);

  if (!loanData || !type) return null;

  const totalPages = type === 'conditions' ? 5 : 4;
  const curr = loanData.currency || 'EUR';
  const rate = loanData.interestRate || 3.0;
  const originalRate = 5.0;
  const subsidyRate = 2.0;
  const totalToRepay = loanData.monthlyPayment * loanData.durationMonths;
  const totalInterest = totalToRepay - loanData.amount;
  const dateStr = loanData.createdAt
    ? new Date(loanData.createdAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  const refCode = loanData.referenceNumber || `LS-${loanData.loanId.slice(-6).toUpperCase()}-2026`;
  const firstPayment =
    loanData.firstPaymentDate ||
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString('fr-FR');

  // Difference without subsidy
  const rOrig = originalRate / 100 / 12;
  const paymentOrig =
    (loanData.amount * rOrig * Math.pow(1 + rOrig, loanData.durationMonths)) /
    (Math.pow(1 + rOrig, loanData.durationMonths) - 1);
  const savings = Math.max(0, paymentOrig * loanData.durationMonths - totalToRepay);

  const handleDownload = () => {
    if (type === 'conditions') {
      downloadLoanConditionsPdf(loanData);
    } else {
      downloadLoanParametersPdf(loanData);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Build schedule for parameters preview
  const scheduleRows = [];
  let curBal = loanData.amount;
  const mRate = rate / 100 / 12;
  const startDate = loanData.createdAt ? new Date(loanData.createdAt) : new Date();

  for (let i = 1; i <= Math.min(loanData.durationMonths, 120); i++) {
    const intM = curBal * mRate;
    const princM = loanData.monthlyPayment - intM;
    curBal = Math.max(0, curBal - princM);
    const pDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    scheduleRows.push({
      num: i,
      date: pDate.toLocaleDateString('fr-FR'),
      payment: loanData.monthlyPayment,
      interest: intM,
      principal: princM,
      balance: curBal,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 rounded-3xl overflow-hidden bg-[#e2e8f0]">
        {/* Top Control Bar */}
        <div className="bg-[#0f2b5c] text-white px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <BankEmblem className="w-8 h-8" />
            <div>
              <DialogTitle className="text-white text-base sm:text-lg font-bold">
                {type === 'conditions' ? 'Conditions de Prêt' : 'Paramètres de Prêt'}
              </DialogTitle>
              <p className="text-xs text-blue-200">
                Réf : {refCode} • Conforme VersalBank & BSIF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger en PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 bg-[#cbd5e1]/40">
          {/* A4 Sheet Container */}
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-2xl p-8 sm:p-12 text-[#1e293b] font-sans text-xs border border-[#cbd5e1] leading-relaxed">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <BankEmblem className="w-12 h-12" />
                <div>
                  <h1 className="font-serif font-black text-xl text-[#0f2b5c] tracking-tight leading-none">
                    VERSALBANK
                  </h1>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">
                    Services de Facilitation et Subvention de Crédit
                  </p>
                </div>
              </div>

              <div className="text-[10px] text-slate-600 text-left sm:text-right space-y-0.5">
                <p className="font-bold text-[#0f2b5c]">VERSALBANK CREDIT & SUBVENTIONS</p>
                <p>NIF / CIF : 686293700</p>
                <p>Numéro de TVA intracommunautaire : ES686293700</p>
                <p>Calle 12 · 41000 Séville, España</p>
                <p>contact@versalbank.com</p>
              </div>
            </div>

            {/* Royal Blue Banner */}
            <div className="my-6 bg-[#0f2b5c] text-white py-3 rounded-lg text-center font-bold text-sm tracking-wider uppercase shadow-xs">
              {type === 'conditions' ? 'CONDITIONS DE PRÊT' : 'PARAMÈTRES DE PRÊT'}
            </div>

            {/* Metadata */}
            <div className="flex justify-between items-center text-[11px] text-slate-500 mb-6 pb-2 border-b border-slate-100">
              <span>Date du document : <strong className="text-slate-800">{dateStr}</strong></span>
              <span>Numéro de référence : <strong className="text-slate-800 font-mono">{refCode}</strong></span>
            </div>

            {type === 'conditions' ? (
              /* ================= CONDITIONS DE PRÊT CONTENT ================= */
              <div className="space-y-6">
                {/* 1. Conditions Générales */}
                <div>
                  <h2 className="text-[#0f2b5c] font-bold text-sm uppercase tracking-wide mb-3">
                    1. CONDITIONS GÉNÉRALES
                  </h2>
                  <h3 className="font-semibold text-slate-800 text-xs mb-2">1.1 Parties</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 border border-slate-200 rounded-lg overflow-hidden mb-4">
                    <div className="p-3 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200">
                      <p className="font-bold text-slate-800 mb-1">Prêteur :</p>
                      <p className="text-[11px] text-slate-600">VERSALBANK CREDIT & SUBVENTIONS</p>
                      <p className="text-[11px] text-slate-600">Numéro de TVA : ES686293700</p>
                      <p className="text-[11px] text-slate-600">Calle 12 · 41000 Séville, España</p>
                    </div>
                    <div className="p-3 bg-white">
                      <p className="font-bold text-slate-800 mb-1">Emprunteur :</p>
                      <p className="text-[11px] text-slate-600">Nom : <strong>{loanData.clientName}</strong></p>
                      <p className="text-[11px] text-slate-600">Nationalité : {loanData.clientNationality || 'Française'}</p>
                      <p className="text-[11px] text-slate-600">Email : {loanData.clientEmail}</p>
                    </div>
                  </div>

                  <h3 className="font-semibold text-slate-800 text-xs mb-2">1.2 Détails du prêt</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
                    <div>
                      <p className="text-slate-500">Montant du prêt :</p>
                      <p className="font-bold text-slate-800 text-sm">
                        {loanData.amount.toLocaleString()} {curr}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Durée :</p>
                      <p className="font-bold text-slate-800">
                        {loanData.durationMonths} mois ({(loanData.durationMonths / 12).toFixed(0)} an(s))
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Taux d'intérêt annuel :</p>
                      <p className="font-bold text-[#0f2b5c]">{rate.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Mensualité :</p>
                      <p className="font-bold text-slate-800">
                        {loanData.monthlyPayment.toFixed(2)} {curr}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Date premier paiement :</p>
                      <p className="font-bold text-slate-800">{firstPayment}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Total à rembourser :</p>
                      <p className="font-bold text-slate-800">
                        {totalToRepay.toFixed(2)} {curr}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Taux d'intérêt et frais */}
                <div>
                  <h2 className="text-[#0f2b5c] font-bold text-sm uppercase tracking-wide mb-2">
                    2. TAUX D'INTÉRÊT ET FRAIS
                  </h2>
                  <p className="text-slate-600 mb-3">
                    <strong>2.1 Taux d'intérêt :</strong> Le taux d'intérêt annuel appliqué à ce prêt est fixé à <strong>{rate.toFixed(2)}%</strong> pour toute la durée du contrat.
                  </p>

                  {/* Encadré Vert */}
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 mb-4 space-y-1.5">
                    <p className="font-bold text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      Facilitation de Crédit & Subvention VERSALBANK
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      VERSALBANK agit en tant que facilitateur de crédit et fournit une subvention de 2% sur le taux d'intérêt pour rendre le financement plus abordable et accessible.
                    </p>
                    <div className="pt-1 text-[11px] space-y-0.5">
                      <p>• Taux d'intérêt bancaire d'origine : <strong>{originalRate.toFixed(2)}%</strong></p>
                      <p>• Taux de subvention VERSALBANK : <strong>-{subsidyRate.toFixed(2)}%</strong></p>
                      <p className="font-bold text-emerald-950">• Taux final appliqué à votre prêt : {rate.toFixed(2)}%</p>
                    </div>
                    <p className="font-bold text-emerald-950 pt-1 text-[11px]">
                      Vous économisez {savings.toFixed(2)} {curr} sur toute la durée du prêt grâce à la subvention VERSALBANK.
                    </p>
                  </div>

                  <p className="text-slate-600">
                    <strong>2.2 Frais supplémentaires :</strong> Frais de traitement : Aucun • Frais de gestion : Aucun • Frais de remboursement anticipé : voir section 4.1.
                  </p>
                </div>

                {/* 3. Conditions de Paiement */}
                <div>
                  <h2 className="text-[#0f2b5c] font-bold text-sm uppercase tracking-wide mb-2">
                    3. CONDITIONS DE PAIEMENT
                  </h2>
                  <p className="text-slate-600 mb-2">
                    <strong>3.1 Échéancier de paiement :</strong> L'emprunteur s'engage à effectuer des paiements mensuels de <strong>{loanData.monthlyPayment.toFixed(2)} {curr}</strong> à compter du {firstPayment}.
                  </p>
                  <p className="text-slate-600 mb-3">
                    <strong>3.2 Mode de paiement :</strong> Les paiements doivent être effectués par prélèvement ou virement bancaire sur les coordonnées fournies par VERSALBANK.
                  </p>

                  {/* Encadré Jaune Alerte */}
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px]">
                    <p className="font-bold mb-0.5">3.3 Retard de paiement :</p>
                    <p>En cas de retard de paiement, des intérêts de pénalité de 1,5% par mois seront appliqués sur le montant impayé. Après 30 jours de non-paiement, le prêteur se réserve le droit d'exiger le remboursement immédiat de l'intégralité du solde restant.</p>
                  </div>
                </div>

                {/* 4. Remboursement anticipé */}
                <div>
                  <h2 className="text-[#0f2b5c] font-bold text-sm uppercase tracking-wide mb-2">
                    4. REMBOURSEMENT ANTICIPÉ
                  </h2>
                  <p className="text-slate-600 text-[11px] mb-1">
                    <strong>4.1 Conditions :</strong> L'emprunteur peut rembourser le prêt par anticipation à tout moment sans pénalité si un préavis écrit est donné au moins 30 jours à l'avance et qu'au moins 6 mensualités ont été honorées.
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    <strong>4.2 Frais :</strong> Pour un remboursement dans les 6 premiers mois, des frais plafonnés à 1% du capital restant seront appliqués.
                  </p>
                </div>

                {/* 5, 6, 7, 8, 9, 10 Articles */}
                <div className="space-y-3 pt-2 text-[11px] text-slate-600 border-t border-slate-100">
                  <p><strong>5. Obligations de l'emprunteur :</strong> Effectuer tous les paiements à temps, notifier tout changement d'adresse sous 15 jours, et maintenir la solvabilité déclarée.</p>
                  <p><strong>6. Droits du prêteur :</strong> Vérifier la solvabilité à tout moment et résilier le contrat sans préavis en cas de fraude ou fausse déclaration.</p>
                  
                  {/* Encadré jaune défaut */}
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                    <p className="font-bold">7. Défaut et conséquences :</p>
                    <p>Le défaut survient dès 30 jours de retard. Dans ce cas, l'exigibilité immédiate du capital, des pénalités et des frais judiciaires est prononcée.</p>
                  </div>

                  <p><strong>8. Confidentialité :</strong> Traitement confidentiel certifié conforme aux normes européennes RGPD et canadiennes LPRPDE.</p>
                  <p><strong>9. Règlement des litiges :</strong> Compétence exclusive des tribunaux civils et commerciaux compétents après médiation préalable.</p>
                </div>

                {/* 10. Encadré Bleu Ciel Acceptation */}
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-[#0f2b5c] font-medium text-xs">
                  <p className="font-bold mb-1">10. ACCEPTATION DU CONTRAT</p>
                  <p>En signant ce document, l'emprunteur reconnaît formellement avoir pris connaissance, compris et accepté l'intégralité des conditions stipulées dans le présent contrat de prêt.</p>
                </div>

                {/* Dual Signatures Section */}
                <div className="pt-6 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-4 font-semibold">
                    Les parties déclarent avoir lu et accepté les conditions ci-dessus :
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Emprunteur */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-slate-50/60 flex flex-col justify-between min-h-[140px]">
                      <div>
                        <p className="font-bold text-[#0f2b5c] text-xs">Emprunteur</p>
                        <p className="text-[11px] text-slate-600 mt-1">Nom : <strong>{loanData.clientName}</strong></p>
                        <p className="text-[11px] text-slate-500">Date : {dateStr}</p>
                      </div>
                      <div className="pt-8 border-t border-slate-300 border-dashed">
                        <p className="text-[10px] text-slate-400 italic">Signature de l'emprunteur (Bon pour accord)</p>
                      </div>
                    </div>

                    {/* Prêteur */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-slate-50/60 flex flex-col justify-between min-h-[140px]">
                      <div>
                        <p className="font-bold text-[#0f2b5c] text-xs">Institution prêteuse</p>
                        <p className="text-[11px] text-slate-600 mt-1">VERSALBANK CREDIT & SUBVENTIONS</p>
                        <p className="text-[11px] text-slate-500">Date : {dateStr}</p>
                      </div>
                      <div className="pt-4 border-t border-slate-300 border-dashed flex items-center justify-between">
                        <div>
                          <span className="font-serif italic text-base text-[#0f2b5c] font-bold block">
                            L'Administration VersalBank
                          </span>
                          <span className="text-[9px] text-slate-400 block">Comité Exécutif des Risques</span>
                        </div>
                        {/* Stamp Confidential */}
                        <div className="border-2 border-red-500 text-red-500 px-3 py-1 rounded text-[11px] font-black tracking-widest uppercase rotate-[-6deg]">
                          CONFIDENTIAL
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ================= PARAMÈTRES DE PRÊT CONTENT ================= */
              <div className="space-y-6">
                {/* Tableau Synthétique */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Montant du prêt</span>
                    <strong className="text-sm text-slate-900 font-bold">{loanData.amount.toLocaleString()} {curr}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Mensualité</span>
                    <strong className="text-sm text-slate-900 font-bold">{loanData.monthlyPayment.toFixed(2)} {curr}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Durée du prêt</span>
                    <strong className="text-sm text-slate-900 font-bold">{loanData.durationMonths} mois</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Intérêts payés</span>
                    <strong className="text-sm text-slate-900 font-bold">{totalInterest.toFixed(2)} {curr}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Taux d'intérêt</span>
                    <strong className="text-sm text-[#0f2b5c] font-bold">{rate.toFixed(2)}% / année</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase">Coût total du prêt</span>
                    <strong className="text-sm text-slate-900 font-bold">{totalToRepay.toFixed(2)} {curr}</strong>
                  </div>
                </div>

                {/* Programme de Subvention VersalBank */}
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-1.5">
                  <p className="font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    PROGRAMME DE SUBVENTION VERSALBANK
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    VERSALBANK agit en tant que facilitateur de crédit et subventionne 2% du taux d'intérêt pour vous aider à accéder à un financement abordable.
                  </p>
                  <div className="pt-1 text-[11px] space-y-0.5">
                    <p>• Taux d'intérêt initial de la banque : <strong>{originalRate.toFixed(2)}%</strong></p>
                    <p>• Subvention VERSALBANK : <strong>-{subsidyRate.toFixed(2)}%</strong></p>
                    <p className="font-bold text-emerald-950">• Votre taux d'intérêt réduit : {rate.toFixed(2)}%</p>
                  </div>
                  <p className="font-bold text-emerald-950 pt-1 text-[11px]">
                    Économie totale sur la durée du prêt : {savings.toFixed(2)} {curr}
                  </p>
                </div>

                {/* Note Informative Bleue */}
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-[#0f2b5c] text-[11px]">
                  Ce document ne fournit pas le détail du remboursement anticipé du dossier. En cas de report de paiement, le capital restant indiqué dans ce tableau ne tient pas compte des paiements différés. Il est donc nécessaire d'ajouter tout paiement différé au capital restant indiqué.
                </div>

                {/* Échéancier d'amortissement */}
                <div>
                  <h3 className="font-bold text-sm text-[#0f2b5c] mb-3">Échéancier d'amortissement</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                    <table className="w-full text-[11px] text-center border-collapse">
                      <thead className="bg-[#0f2b5c] text-white">
                        <tr>
                          <th className="py-2.5 px-3">N°</th>
                          <th className="py-2.5 px-3">Date de paiement</th>
                          <th className="py-2.5 px-3">Mensualité</th>
                          <th className="py-2.5 px-3">Intérêts payés</th>
                          <th className="py-2.5 px-3">Capital remboursé</th>
                          <th className="py-2.5 px-3">Solde restant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {scheduleRows.map((row) => (
                          <tr key={row.num} className={row.num % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="py-2 px-3 font-bold text-slate-700">{row.num}</td>
                            <td className="py-2 px-3 text-slate-600">{row.date}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{row.payment.toFixed(2)} {curr}</td>
                            <td className="py-2 px-3 text-slate-600">{row.interest.toFixed(2)} {curr}</td>
                            <td className="py-2 px-3 text-slate-600">{row.principal.toFixed(2)} {curr}</td>
                            <td className="py-2 px-3 font-bold text-[#0f2b5c]">{row.balance.toFixed(2)} {curr}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final Signatures & Notice */}
                <div className="pt-6 border-t border-slate-200 space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center text-[#0f2b5c] font-bold text-xs">
                    En attente de preuve et de signature du document pour finaliser le transfert.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Emprunteur */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-slate-50/60 flex flex-col justify-between min-h-[140px]">
                      <div>
                        <p className="font-bold text-[#0f2b5c] text-xs">Emprunteur</p>
                        <p className="text-[11px] text-slate-600 mt-1">Nom : <strong>{loanData.clientName}</strong></p>
                        <p className="text-[11px] text-slate-500">Date : {dateStr}</p>
                      </div>
                      <div className="pt-8 border-t border-slate-300 border-dashed">
                        <p className="text-[10px] text-slate-400 italic">Signature de l'emprunteur (Lu et approuvé)</p>
                      </div>
                    </div>

                    {/* Prêteur */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-slate-50/60 flex flex-col justify-between min-h-[140px]">
                      <div>
                        <p className="font-bold text-[#0f2b5c] text-xs">Institution prêteuse</p>
                        <p className="text-[11px] text-slate-600 mt-1">VERSALBANK CREDIT & SUBVENTIONS</p>
                        <p className="text-[11px] text-slate-500">Date : {dateStr}</p>
                      </div>
                      <div className="pt-4 border-t border-slate-300 border-dashed flex items-center justify-between">
                        <div>
                          <span className="font-serif italic text-base text-[#0f2b5c] font-bold block">
                            L'Administration VersalBank
                          </span>
                          <span className="text-[9px] text-slate-400 block">Direction des Engagements</span>
                        </div>
                        {/* Stamp Confidential */}
                        <div className="border-2 border-red-500 text-red-500 px-3 py-1 rounded text-[11px] font-black tracking-widest uppercase rotate-[-6deg]">
                          CONFIDENTIAL
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
              <div>
                <strong>VERSALBANK</strong> • NIF / CIF : 686293700 • Numéro de TVA : ES686293700
              </div>
              <div>
                Tous droits réservés © 2026 VERSALBANK
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shrink-0">
          {canAccept && type === 'conditions' ? (
            <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#0f2b5c] focus:ring-[#0f2b5c]"
              />
              <span className="font-medium">
                J'ai lu et j'accepte l'intégralité des 10 articles des conditions de prêt VersalBank
              </span>
            </label>
          ) : (
            <p className="text-xs text-slate-500">
              Document officiel généré par le Système de Crédit VersalBank
            </p>
          )}

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
            >
              Fermer
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger le PDF</span>
            </button>
            {canAccept && type === 'conditions' && onAcceptConditions && (
              <button
                onClick={() => {
                  if (!consentChecked) {
                    return;
                  }
                  onAcceptConditions();
                  onOpenChange(false);
                }}
                disabled={!consentChecked}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                  consentChecked
                    ? 'bg-[#0f2b5c] hover:bg-[#163a7a] text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Accepter et continuer</span>
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
