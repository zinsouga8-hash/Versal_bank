import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { transferCarriers } from '../lib/transferCarriers';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../lib/AuthContext';
import { useI18n } from '../lib/i18n';
import { 
  getClientProfileByEmailOrId, 
  saveMovementToSupabase, 
  saveClientToSupabase 
} from '../lib/supabaseBankService';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Building2,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
} from 'lucide-react';
import { ClientAccount } from '../types';
import { notifyTransferSubmitted } from '../lib/emailService';

export default function TransferForm() {
  const { carrierId } = useParams();
  const carrier = transferCarriers.find((c) => c.id === carrierId);
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDormantModal, setShowDormantModal] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({
    amount: '',
    beneficiary_name: '',
    account_or_iban: '',
    bank_name: '',
    country: '',
    motif: '',
    email_or_phone: '',
    crypto_address: '',
  });

  // Modal Step States: 'idle' | 'pin' | 'swift' | 'cat' | 'cot' | 'processing' | 'success'
  const [securityStep, setSecurityStep] = useState<'idle' | 'pin' | 'swift' | 'cat' | 'cot' | 'processing' | 'success'>('idle');
  const [transferRefId, setTransferRefId] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [enteredSwift, setEnteredSwift] = useState('');
  const [enteredCat, setEnteredCat] = useState('');
  const [enteredCot, setEnteredCot] = useState('');

  useEffect(() => {
    if (!user) return;
    const email = user.email || '';
    const uid = user.uid || (user as any)?.id;
    getClientProfileByEmailOrId(email || uid).then((data) => {
      if (data) setAccount(data);
    });
  }, [user]);

  if (!carrier) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-[#8a857e]">{lang === 'en' ? 'Transfer method not found.' : 'Moyen de transfert introuvable.'}</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/espace/virement">{lang === 'en' ? 'Back to transfer methods' : 'Retour aux moyens de transfert'}</Link>
        </Button>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStartVerification = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(formData.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error(lang === 'en' ? 'Please enter a valid amount.' : 'Veuillez renseigner un montant valide.');
      return;
    }
    if (account && account.account_active !== true) {
      setShowDormantModal(true);
      toast.error(lang === 'en' ? "Dormant / inactive account: wire blocked. Please contact support." : "Compte dormant / inactif : virement bloqué. Veuillez contacter l'assistance.");
      return;
    }
    if (account && amountVal > account.balance) {
      toast.error(lang === 'en' ? 'Insufficient balance to execute this transaction.' : 'Solde insuffisant pour exécuter cette opération.');
      return;
    }
    // Launch security sequence starting with PIN
    setSecurityStep('pin');
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin.length < 4) {
      toast.error(lang === 'en' ? 'Please enter your security PIN code.' : 'Veuillez saisir votre code PIN de sécurité.');
      return;
    }
    // Check pin against account if set
    if (account?.pin && enteredPin !== account.pin) {
      toast.error(lang === 'en' ? 'Incorrect PIN code. Please try again.' : 'Code PIN incorrect. Veuillez réessayer.');
      return;
    }
    // Move to SWIFT step (security authorization)
    setSecurityStep('swift');
  };

  const handleSwiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredSwift.trim()) {
      toast.error(lang === 'en' ? 'Please enter your SWIFT security code.' : "Veuillez saisir votre code SWIFT de sécurisation.");
      return;
    }
    if (account?.swift_code && enteredSwift.trim().toUpperCase() !== account.swift_code.trim().toUpperCase()) {
      toast.error(lang === 'en' ? 'Invalid SWIFT security code. Contact your advisor or administration.' : "Code de sécurité SWIFT invalide. Rapprochez-vous de votre conseiller ou de l'administration.");
      return;
    }
    // Move to CAT step
    setSecurityStep('cat');
  };

  const handleCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredCat.trim()) {
      toast.error(lang === 'en' ? 'Please enter your CAT authorization code.' : "Veuillez saisir votre code CAT d'autorisation.");
      return;
    }
    if (account?.cat_code && enteredCat.trim().toUpperCase() !== account.cat_code.trim().toUpperCase()) {
      toast.error(lang === 'en' ? 'Invalid CAT authorization code. Contact your advisor.' : "Code CAT d'autorisation invalide. Rapprochez-vous de votre conseiller.");
      return;
    }

    // Move to 4th security code: COT step
    setSecurityStep('cot');
  };

  const handleCotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredCot.trim()) {
      toast.error(lang === 'en' ? 'Please enter your COT operation code.' : "Veuillez saisir votre code COT d'opération.");
      return;
    }
    if (account?.cot_code && enteredCot.trim().toUpperCase() !== account.cot_code.trim().toUpperCase()) {
      toast.error(lang === 'en' ? 'Invalid COT compliance code. Contact your advisor.' : "Code COT de conformité invalide. Rapprochez-vous de votre conseiller.");
      return;
    }

    // Finalize Transfer Execution
    setSecurityStep('processing');
    setLoading(true);

    try {
      const amountVal = parseFloat(formData.amount);
      const referenceId = `VIR-${Math.floor(10000000 + Math.random() * 90000000)}`;
      setTransferRefId(referenceId);

      await saveMovementToSupabase({
        account_id: user?.uid || (user as any)?.id || '',
        client_id: account?.client_id || '',
        client_email: user?.email || '',
        kind: 'transfer',
        direction: 'debit',
        method: carrier.name,
        amount: amountVal,
        currency: account?.currency || 'CAD',
        beneficiary_name: formData.beneficiary_name || formData.email_or_phone || (lang === 'en' ? 'Beneficiary' : 'Bénéficiaire'),
        beneficiary_country: formData.country || 'Canada',
        beneficiary_details: JSON.stringify(formData),
        motif: formData.motif || `${lang === 'en' ? 'Transfer' : 'Virement'} ${carrier.name}`,
        reference: referenceId,
        status: 'pending',
        createdAt: Date.now(),
      });

      // Deduct balance or keep pending as configured
      if (account) {
        const newBalance = Math.max(0, account.balance - amountVal);
        await saveClientToSupabase({
          ...account,
          balance: newBalance,
        });

        await notifyTransferSubmitted({
          user_email: user?.email || '',
          first_name: account.first_name || '',
          amount: amountVal,
          currency: account.currency || 'CAD',
          new_balance: newBalance,
          recipient_name: formData.beneficiary_name || formData.email_or_phone || 'Bénéficiaire',
          reference: referenceId,
          language: (account.language as any) || (lang as any) || 'fr',
        });
      } else {
        await notifyTransferSubmitted({
          user_email: user?.email || '',
          amount: amountVal,
          currency: 'CAD',
          recipient_name: formData.beneficiary_name || formData.email_or_phone || 'Bénéficiaire',
          reference: referenceId,
          language: (lang as any) || 'fr',
        });
      }

      // Transition to SUCCESS modal with animated checkmark "V"
      setSecurityStep('success');
      toast.success(lang === 'en' ? 'Transfer order validated successfully.' : 'Ordre de virement validé avec succès.');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Error executing transfer. Please try again.' : "Erreur lors de l'exécution du virement. Veuillez réessayer.");
      setSecurityStep('idle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        to="/espace/virement"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#8a857e] hover:text-[#0f2b5c] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {lang === 'en' ? 'Back to transfer methods' : 'Retour aux moyens de transfert'}
      </Link>

      {/* Main Transfer Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#eee8dd] shadow-xs space-y-6">
        <div className="flex items-center gap-4 border-b border-[#eee8dd] pb-6">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center border text-xl font-bold ${carrier.color} ${carrier.textColor}`}
          >
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-serif text-2xl font-bold text-[#1a1a1a]">
              {carrier.name}
            </h1>
            <p className="text-xs text-[#8a857e] mt-0.5">{carrier.description}</p>
          </div>
        </div>

        {/* Transfer Form */}
        <form onSubmit={handleStartVerification} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs font-semibold text-[#1a1a1a]">
              {lang === 'en' ? 'Transfer Amount' : 'Montant du transfert'} ({account?.currency || 'CAD'})
            </Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="any"
              value={formData.amount}
              onChange={handleChange}
              placeholder="Ex: 5000"
              required
              className="rounded-xl h-11 text-base font-semibold"
            />
            <p className="text-[11px] text-[#8a857e]">
              {lang === 'en' ? 'Available balance' : 'Solde disponible'} :{' '}
              <span className="font-semibold text-[#1a1a1a] solde-banque">
                {new Intl.NumberFormat(lang === 'en' ? 'en-CA' : 'fr-CA', {
                  style: 'currency',
                  currency: account?.currency || 'CAD',
                }).format(account?.balance ?? 0)}
              </span>
            </p>
          </div>

          {/* Dynamic fields based on carrier category */}
          {carrier.category === 'Crypto' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="crypto_address" className="text-xs font-semibold text-[#1a1a1a]">
                  {lang === 'en' ? 'Destination Wallet Address' : 'Adresse du portefeuille de destination'}
                </Label>
                <Input
                  id="crypto_address"
                  name="crypto_address"
                  value={formData.crypto_address}
                  onChange={handleChange}
                  placeholder={carrier.id === 'usdt' ? (lang === 'en' ? 'TRC20 Address (ex: T...)' : 'Adresse TRC20 (ex: T...)') : (lang === 'en' ? 'Bitcoin Address (ex: bc1...)' : 'Adresse Bitcoin (ex: bc1...)')}
                  required
                  className="rounded-xl h-11 text-sm font-mono"
                />
              </div>
            </>
          ) : carrier.id === 'interac' || carrier.id === 'paypal' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email_or_phone" className="text-xs font-semibold text-[#1a1a1a]">
                  {lang === 'en' ? "Recipient's Email or Phone Number" : 'Courriel ou numéro de téléphone du destinataire'}
                </Label>
                <Input
                  id="email_or_phone"
                  name="email_or_phone"
                  value={formData.email_or_phone}
                  onChange={handleChange}
                  placeholder={lang === 'en' ? 'recipient@example.com or +1 514...' : 'destinataire@exemple.com ou +1 514...'}
                  required
                  className="rounded-xl h-11 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="beneficiary_name" className="text-xs font-semibold text-[#1a1a1a]">
                  {lang === 'en' ? "Recipient's Full Name" : 'Nom et prénom du destinataire'}
                </Label>
                <Input
                  id="beneficiary_name"
                  name="beneficiary_name"
                  value={formData.beneficiary_name}
                  onChange={handleChange}
                  placeholder="Ex: Jean Dupont"
                  required
                  className="rounded-xl h-11 text-sm"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="beneficiary_name" className="text-xs font-semibold text-[#1a1a1a]">
                  {lang === 'en' ? 'Beneficiary Full Name or Company Name' : 'Nom complet du bénéficiaire ou raison sociale'}
                </Label>
                <Input
                  id="beneficiary_name"
                  name="beneficiary_name"
                  value={formData.beneficiary_name}
                  onChange={handleChange}
                  placeholder="Ex: Société Générale / Pierre Martin"
                  required
                  className="rounded-xl h-11 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="account_or_iban" className="text-xs font-semibold text-[#1a1a1a]">
                  {lang === 'en' ? 'IBAN / Bank Account Number' : 'IBAN / Numéro de compte bancaire'}
                </Label>
                <Input
                  id="account_or_iban"
                  name="account_or_iban"
                  value={formData.account_or_iban}
                  onChange={handleChange}
                  placeholder="Ex: FR76... ou 004..."
                  required
                  className="rounded-xl h-11 text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bank_name" className="text-xs font-semibold text-[#1a1a1a]">
                    {lang === 'en' ? 'Receiving Bank' : 'Banque réceptrice'}
                  </Label>
                  <Input
                    id="bank_name"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleChange}
                    placeholder="Ex: Royal Bank of Canada / BNP"
                    className="rounded-xl h-11 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-xs font-semibold text-[#1a1a1a]">
                    {lang === 'en' ? 'Destination Country' : 'Pays de destination'}
                  </Label>
                  <Input
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder={lang === 'en' ? 'Ex: Canada, France, USA, UK...' : 'Ex: Canada, France, Suisse...'}
                    className="rounded-xl h-11 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="motif" className="text-xs font-semibold text-[#1a1a1a]">
              {lang === 'en' ? 'Transfer Purpose (optional)' : 'Motif du virement (optionnel)'}
            </Label>
            <Input
              id="motif"
              name="motif"
              value={formData.motif}
              onChange={handleChange}
              placeholder={lang === 'en' ? 'Ex: Salary, service invoice, investment...' : 'Ex: Rémunération, prestation, investissement...'}
              className="rounded-xl h-11 text-sm"
            />
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-white font-medium text-sm gap-2 shadow-sm bg-[#0f2b5c] hover:bg-[#0a1e40] cursor-pointer active:scale-[0.99] transition-all"
            >
              <Lock className="w-4 h-4" />
              <span>{lang === 'en' ? 'Confirm Transfer Order' : "Confirmer l'ordre de virement"}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Dialogue Compte Dormant - Virement Bloqué */}
      <Dialog open={showDormantModal} onOpenChange={setShowDormantModal}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d8] shadow-2xl text-left">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                {lang === 'en' ? 'FINTRAC Security' : 'Sécurité FINTRAC'}
              </span>
              <h3 className="font-heading font-serif text-lg font-bold text-[#1a1a1a] mt-1">
                {lang === 'en' ? 'Dormant Account — Wire Blocked' : 'Compte dormant — Virement bloqué'}
              </h3>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 space-y-2.5 leading-relaxed">
            <p className="font-bold text-amber-950">
              {lang === 'en' ? 'Your account is currently in dormant or inactive status.' : 'Votre compte est actuellement en statut dormant ou inactif.'}
            </p>
            <p className="text-amber-900">
              {lang === 'en'
                ? 'In accordance with Canadian banking regulations and financial security protocols, external wire execution is temporarily suspended on this account.'
                : 'Conformément à la réglementation bancaire canadienne et aux protocoles de sécurité financière, toute émission de virement externe est temporairement suspendue sur ce compte.'}
            </p>
            <p className="text-amber-950 font-semibold pt-1 border-t border-amber-200">
              {lang === 'en' ? (
                <>To execute your first wire transfer and unblock operations, please contact bank administration at <span className="underline">contact@versalbank.com</span> or your financial advisor.</>
              ) : (
                <>Pour effectuer votre premier virement et débloquer vos opérations, veuillez contacter l'administration de la banque à <span className="underline">contact@versalbank.com</span> ou votre conseiller bancaire.</>
              )}
            </p>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-[#faf8f5] border border-[#eee8dd] flex items-center justify-between text-xs">
            <span className="text-[#8a857e]">{lang === 'en' ? 'Assistance & Support:' : 'Assistance & Support :'}</span>
            <a href="mailto:contact@versalbank.com" className="font-semibold text-[#0f2b5c] hover:underline">
              contact@versalbank.com
            </a>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-2">
            <a
              href="mailto:contact@versalbank.com?subject=Demande%20de%20deblocage%20de%20virement%20-%20Compte%20dormant"
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'Contact Support' : "Contacter l'assistance"}</span>
            </a>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDormantModal(false)}
              className="w-full sm:w-auto h-11 px-4 rounded-xl border-[#dce5f2] text-xs font-medium hover:bg-slate-50 cursor-pointer"
            >
              {lang === 'en' ? 'Close' : 'Fermer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* STEP 1: Code PIN Modal */}
      <Dialog open={securityStep === 'pin'} onOpenChange={(open) => !open && setSecurityStep('idle')}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#0f2b5c]/10 text-[#0f2b5c] mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <DialogTitle className="font-heading font-serif text-xl">
              {lang === 'en' ? 'Enter PIN Code' : 'Saisie du code PIN'}
            </DialogTitle>
            <p className="text-xs text-[#8a857e]">
              {lang === 'en' 
                ? 'To authorize this transaction, please enter your personal account PIN code.' 
                : 'Pour autoriser cette transaction, veuillez composer le code PIN personnel de votre compte.'}
            </p>
          </DialogHeader>

          <form onSubmit={handlePinSubmit} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Input
                type="password"
                maxLength={6}
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                placeholder="• • • • • •"
                className="text-center text-2xl tracking-[0.5em] font-mono h-12 rounded-xl"
                autoFocus
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSecurityStep('idle')}
                className="flex-1 rounded-xl"
              >
                {lang === 'en' ? 'Cancel' : 'Annuler'}
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white"
              >
                {lang === 'en' ? 'Continue' : 'Continuer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* STEP 2: Code SWIFT Modal (Sécurité Bancaire) */}
      <Dialog open={securityStep === 'swift'} onOpenChange={(open) => !open && setSecurityStep('idle')}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0f2b5c] flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <DialogTitle className="font-heading font-serif text-xl text-[#1a1a1a]">
              {lang === 'en' ? 'SWIFT Security Code Required' : 'Code SWIFT de sécurisation requis'}
            </DialogTitle>
            <p className="text-xs text-[#666] leading-relaxed">
              {lang === 'en' ? (
                <>For security and compliance purposes, please enter the <strong>SWIFT Code</strong> assigned to your bank account. This unique security code authorizes the execution of your wire.</>
              ) : (
                <>Pour des raisons de sécurité et de conformité, veuillez saisir le <strong>Code SWIFT</strong> assigné à votre compte bancaire. Ce code de sécurité unique autorise l'émission de votre virement.</>
              )}
            </p>
          </DialogHeader>

          <form onSubmit={handleSwiftSubmit} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1a1a1a]">
                {lang === 'en' ? 'SWIFT Security Code' : 'Code SWIFT de sécurisation'}
              </Label>
              <Input
                value={enteredSwift}
                onChange={(e) => setEnteredSwift(e.target.value)}
                placeholder="ex: SWIFT-123456"
                className="rounded-xl h-11 text-sm font-mono uppercase"
                autoFocus
                required
              />
              <p className="text-[11px] text-[#8a857e]">
                {lang === 'en'
                  ? 'Secured code assigned by administration upon account opening.'
                  : "Code sécurisé attribué par l'administration lors de l'ouverture du compte."}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSecurityStep('idle')}
                className="flex-1 rounded-xl"
              >
                {lang === 'en' ? 'Cancel' : 'Annuler'}
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white"
              >
                {lang === 'en' ? 'Validate SWIFT Code' : 'Valider le code SWIFT'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* STEP 3: Code CAT Modal */}
      <Dialog open={securityStep === 'cat'} onOpenChange={(open) => !open && setSecurityStep('idle')}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0f2b5c] flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <DialogTitle className="font-heading font-serif text-xl text-[#1a1a1a]">
              {lang === 'en' ? 'CAT Code Required' : 'Code CAT requis'}
            </DialogTitle>
            <p className="text-xs text-[#666] leading-relaxed">
              {lang === 'en'
                ? "Enter your CAT code (Transfer Authorization Code) to authorize this operation. If you do not have it, please contact support."
                : "Saisissez votre code CAT (Code d'Autorisation de Transfert) pour autoriser cette opération. Si vous ne le possédez pas, rapprochez-vous du support."}
            </p>
          </DialogHeader>

          <form onSubmit={handleCatSubmit} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1a1a1a]">
                {lang === 'en' ? 'Transfer Authorization Code (CAT)' : "Code d'Autorisation de Transfert (CAT)"}
              </Label>
              <Input
                value={enteredCat}
                onChange={(e) => setEnteredCat(e.target.value)}
                placeholder="ex: CAT-..."
                className="rounded-xl h-11 text-sm font-mono uppercase"
                autoFocus
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSecurityStep('idle')}
                className="flex-1 rounded-xl"
              >
                {lang === 'en' ? 'Cancel' : 'Annuler'}
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white"
              >
                {lang === 'en' ? 'Validate CAT Code' : 'Valider le code CAT'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* STEP 4: Code COT Modal (code bancaire après CAT) */}
      <Dialog open={securityStep === 'cot'} onOpenChange={(open) => !open && setSecurityStep('idle')}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <DialogTitle className="font-heading font-serif text-xl text-[#1a1a1a]">
              {lang === 'en' ? 'COT Code Required' : 'Code COT requis'}
            </DialogTitle>
            <p className="text-xs text-[#666] leading-relaxed">
              {lang === 'en' ? (
                <>Final validation step: enter your <strong>COT Code</strong> (Transfer Operation Certificate & FINTRAC Compliance) to certify the operation and definitively release fund issuance.</>
              ) : (
                <>Dernière étape de validation : saisissez votre <strong>Code COT</strong> (Certificat d'Opération de Transfert & Conformité FINTRAC) afin de certifier l'opération et débloquer définitivement l'émission des fonds.</>
              )}
            </p>
          </DialogHeader>

          <form onSubmit={handleCotSubmit} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1a1a1a]">
                {lang === 'en' ? 'COT Code (Transfer Operation Certificate)' : "Code COT (Certificat d'Opération de Transfert)"}
              </Label>
              <Input
                value={enteredCot}
                onChange={(e) => setEnteredCot(e.target.value)}
                placeholder="ex: COT-942851"
                className="rounded-xl h-11 text-sm font-mono uppercase"
                autoFocus
                required
              />
              <p className="text-[11px] text-[#8a857e]">
                {lang === 'en'
                  ? 'FINTRAC certified code assigned for direct release of your transaction.'
                  : 'Code certifié FINTRAC attribué pour le déblocage direct de votre transaction.'}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSecurityStep('idle')}
                className="flex-1 rounded-xl"
              >
                {lang === 'en' ? 'Cancel' : 'Annuler'}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {lang === 'en' ? 'Validate and execute transfer' : 'Valider et exécuter le virement'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* STEP 5: Processing & Success "V" Animation Modal */}
      <Dialog 
        open={securityStep === 'processing' || securityStep === 'success'} 
        onOpenChange={(open) => {
          if (!open && securityStep === 'success') {
            navigate('/espace/tableau-de-bord');
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 text-center space-y-5" showCloseButton={securityStep !== 'processing'}>
          {securityStep === 'processing' ? (
            <div className="py-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 text-[#0f2b5c] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#0f2b5c]" />
              </div>
              <DialogTitle className="font-heading font-serif text-xl text-[#0f2b5c]">
                {lang === 'en' ? 'FINTRAC Security & Compliance Validation in Progress...' : 'Sécurisation & validation FINTRAC en cours...'}
              </DialogTitle>
              <p className="text-xs text-[#666] max-w-xs mx-auto leading-relaxed">
                {lang === 'en'
                  ? 'Verifying security codes (CAT & COT) and submitting wire order to banking clearinghouse.'
                  : 'Vérification des codes de sécurité (CAT & COT) et transmission du virement à la compensation bancaire.'}
              </p>
            </div>
          ) : (
            <div className="py-4 space-y-5 animate-in fade-in zoom-in-95 duration-300">
              {/* Animated "V" Checkmark badge */}
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-25" />
                <div className="relative w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <svg 
                    className="w-10 h-10 text-white drop-shadow-sm transition-transform animate-in zoom-in-75 duration-300" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    strokeWidth={3.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div>
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 mb-2">
                  {lang === 'en' ? 'Pending Validation' : 'En attente de validation'}
                </span>
                <DialogTitle className="font-heading font-serif text-2xl text-[#0f2b5c]">
                  {lang === 'en' ? 'Transfer Request Submitted' : 'Demande de virement transmise'}
                </DialogTitle>
                <p className="text-xs text-[#555] mt-2 leading-relaxed max-w-sm mx-auto">
                  {lang === 'en' ? (
                    <>Your fund transfer request has been successfully submitted. The transaction is currently <strong>pending review and will be approved by administration</strong>. The amount has been deducted from your available balance.</>
                  ) : (
                    <>Votre demande d'envoi de fonds a été transmise avec succès. Le transfert est actuellement <strong>en attente et sera validé par l'administration</strong>. Le montant a été automatiquement déduit de votre solde disponible.</>
                  )}
                </p>
              </div>

              {/* Transaction Recap Card */}
              <div className="p-4 rounded-2xl bg-[#faf7f0] border border-[#eee8dd] text-left space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-[#eee8dd] pb-2">
                  <span className="text-[#8a857e]">{lang === 'en' ? 'Reference' : 'Référence'}</span>
                  <span className="font-mono font-bold text-[#0f2b5c]">{transferRefId}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#eee8dd] pb-2">
                  <span className="text-[#8a857e]">{lang === 'en' ? 'Amount Deducted' : 'Montant déduit'}</span>
                  <span className="font-bold text-[#1a1a1a] solde-banque">
                    {parseFloat(formData.amount || '0').toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2 })} {account?.currency || 'CAD'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-[#eee8dd] pb-2">
                  <span className="text-[#8a857e]">{lang === 'en' ? 'Beneficiary' : 'Bénéficiaire'}</span>
                  <span className="font-medium text-[#1a1a1a] truncate max-w-[180px]">
                    {formData.beneficiary_name || formData.email_or_phone || (lang === 'en' ? 'Beneficiary' : 'Bénéficiaire')}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[#8a857e]">{lang === 'en' ? 'Issuing Method' : "Moyen d'émission"}</span>
                  <span className="font-medium text-[#0f2b5c]">{carrier.name}</span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => navigate('/espace/tableau-de-bord')}
                  className="w-full h-11 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white font-semibold text-xs shadow-sm"
                >
                  {lang === 'en' ? 'Access My Dashboard' : 'Accéder à mon tableau de bord'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
