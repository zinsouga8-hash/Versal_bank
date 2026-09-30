import { getBankSupportEmail } from '../lib/supabaseBankService';
import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getClientProfileByEmailOrId, subscribeToBankData } from '../lib/supabaseBankService';
import { 
  Landmark, Loader2, CheckCircle2, XCircle, Copy, Check, 
  ShieldCheck, Headphones, LogOut, Clock, UserCheck, KeyRound, Lock, Eye, EyeOff
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import BankMonogram from '../components/public/BankMonogram';
import { ClientAccount } from '../types';

export default function PendingFile() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);

  useEffect(() => {
    const fetchAccount = async () => {
      const email = user?.email || 
        localStorage.getItem('versalbank_client_email') || 
        sessionStorage.getItem('versalbank_reg_email') || '';
      const uid = user?.uid || (user as any)?.id;
      
      let data = await getClientProfileByEmailOrId(email || uid);

      // Merge with stored credentials if available
      const lastCredsRaw = sessionStorage.getItem('versalbank_last_credentials') || localStorage.getItem('versalbank_last_account');
      if (lastCredsRaw) {
        try {
          const parsed = JSON.parse(lastCredsRaw);
          data = data ? { ...parsed, ...data } : parsed;
        } catch (_) {}
      }

      if (data && (data.account_number || data.first_name || data.client_id)) {
        setAccount(data);
        setStatus(data.status || 'pending');
        if (data.admin_note) setAdminNote(data.admin_note);
      } else {
        navigate('/ouverture-de-compte');
      }
      setLoading(false);
    };

    fetchAccount();
    const unsubscribe = subscribeToBankData(() => {
      fetchAccount();
    });

    return unsubscribe;
  }, [user, navigate]);

  const copyToClipboard = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copié dans le presse-papiers`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const copyAllCredentials = () => {
    if (!account) return;
    const summary = [
      `=== VERSALBANK - IDENTIFIANTS & COORDONNÉES BANCAIRES ===`,
      `Titulaire du Compte : ${account.first_name || ''} ${account.last_name || ''}`.trim(),
      `Identifiant Client (ID) : ${account.client_id || ''}`,
      `Courriel : ${account.user_email || user?.email || ''}`,
      account.portal_password ? `Mot de passe Portail : ${account.portal_password}` : null,
      account.pin ? `Code PIN Secret (Virements) : ${account.pin}` : null,
      `Numéro de Compte : ${account.account_number || ''}`,
      `IBAN International : ${account.iban || ''}`,
      account.cat_code ? `Code CAT : ${account.cat_code}` : null,
      account.cot_code ? `Code COT : ${account.cot_code}` : null,
      `Devise : ${account.currency || 'CAD'}`,
      `Statut du dossier : En cours d'analyse (En attente d'approbation par l'administration)`,
      `========================================================`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(summary);
    setCopiedKey('all');
    toast.success("Tous vos identifiants bancaires ont été copiés dans le presse-papiers");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('versalbank_pin_unlocked');
    sessionStorage.removeItem('versalbank_pending_otp');
    try {
      await logout();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    window.location.href = '/login';
  };

  if (authLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#faf7f0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0f2b5c]" />
      </div>
    );
  }

  if (status === 'approved') {
    return <Navigate to="/portail" />;
  }

  return (
    <div className="min-h-screen bg-[#faf7f0] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-[#eee8dd] text-left">
        {/* Header Branding */}
        <div className="flex items-center justify-between border-b border-[#eee8dd] pb-6 mb-6">
          <div className="flex items-center gap-3">
            <BankMonogram className="w-9 h-9" />
            <div>
              <span className="font-heading font-serif font-bold text-xl text-[#1a1a1a]">
                VersalBank
              </span>
              <p className="text-xs text-[#8a857e]">Banque Privée & Internationale</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            Analyse en cours
          </span>
        </div>

        {status === 'pending' && (
          <div className="space-y-6">
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h1 className="font-serif font-bold text-lg text-amber-950">
                    Dossier d'ouverture en cours d'analyse
                  </h1>
                  <p className="text-xs sm:text-sm text-amber-900/80 mt-1 leading-relaxed">
                    Votre dossier d'ouverture de compte est actuellement en cours d'examen par notre service conformité. 
                    Veuillez noter et copier vos coordonnées et identifiants bancaires ci-dessous. <strong>L'accès à votre tableau de bord sera débloqué dès l'approbation définitive par l'administrateur.</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Account Information Copyable Grid */}
            <div className="bg-[#faf7f0] rounded-2xl p-5 border border-[#eee8dd] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#555] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Vos Coordonnées & Identifiants Bancaires
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSensitive(!showSensitive)}
                    className="text-[11px] text-[#0f2b5c] hover:underline flex items-center gap-1 font-medium"
                  >
                    {showSensitive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSensitive ? 'Masquer codes secrets' : 'Afficher codes secrets'}</span>
                  </button>
                  <span className="text-[11px] text-[#8a857e]">· Cliquez pour copier</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Client ID */}
                <div className="bg-white p-3 rounded-xl border border-[#eee8dd] flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Identifiant Client (ID)</p>
                    <p className="text-xs font-mono font-bold text-[#1a1a1a] truncate">
                      {account?.client_id || 'AUR-2026-EN-COURS'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(account?.client_id || '', 'client_id', 'Identifiant Client')}
                    className="p-1.5 rounded-lg hover:bg-[#faf7f0] text-[#0f2b5c] transition-colors"
                    title="Copier"
                  >
                    {copiedKey === 'client_id' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Account Number */}
                <div className="bg-white p-3 rounded-xl border border-[#eee8dd] flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Numéro de Compte</p>
                    <p className="text-xs font-mono font-bold text-[#1a1a1a] truncate">
                      {account?.account_number || 'Attribution en cours'}
                    </p>
                  </div>
                  {account?.account_number && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(account.account_number || '', 'account_number', 'Numéro de Compte')}
                      className="p-1.5 rounded-lg hover:bg-[#faf7f0] text-[#0f2b5c] transition-colors"
                      title="Copier"
                    >
                      {copiedKey === 'account_number' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {/* IBAN */}
                <div className="bg-white p-3 rounded-xl border border-[#eee8dd] flex items-center justify-between sm:col-span-2">
                  <div className="truncate pr-2">
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">IBAN International</p>
                    <p className="text-xs font-mono font-bold text-[#1a1a1a] truncate">
                      {account?.iban || 'Attribution en cours'}
                    </p>
                  </div>
                  {account?.iban && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(account.iban || '', 'iban', 'IBAN')}
                      className="p-1.5 rounded-lg hover:bg-[#faf7f0] text-[#0f2b5c] transition-colors"
                      title="Copier"
                    >
                      {copiedKey === 'iban' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {/* Titulaire */}
                <div className="bg-white p-3 rounded-xl border border-[#eee8dd] flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Titulaire du Compte</p>
                    <p className="text-xs font-bold text-[#1a1a1a] truncate">
                      {account?.first_name} {account?.last_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${account?.first_name || ''} ${account?.last_name || ''}`.trim(), 'holder', 'Titulaire')}
                    className="p-1.5 rounded-lg hover:bg-[#faf7f0] text-[#0f2b5c] transition-colors"
                    title="Copier"
                  >
                    {copiedKey === 'holder' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Courriel */}
                <div className="bg-white p-3 rounded-xl border border-[#eee8dd] flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Courriel Enregistré</p>
                    <p className="text-xs text-[#1a1a1a] font-medium truncate">
                      {account?.user_email || user?.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(account?.user_email || user?.email || '', 'email', 'Courriel')}
                    className="p-1.5 rounded-lg hover:bg-[#faf7f0] text-[#0f2b5c] transition-colors"
                    title="Copier"
                  >
                    {copiedKey === 'email' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Mot de passe Portail */}
                {account?.portal_password && (
                  <div className="bg-white p-3 rounded-xl border border-[#eee8dd] flex items-center justify-between">
                    <div className="truncate pr-2">
                      <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Mot de passe Portail</p>
                      <p className="text-xs font-mono font-bold text-[#1a1a1a] truncate">
                        {showSensitive ? account.portal_password : '••••••••••••'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(account.portal_password || '', 'password', 'Mot de passe')}
                      className="p-1.5 rounded-lg hover:bg-[#faf7f0] text-[#0f2b5c] transition-colors"
                      title="Copier"
                    >
                      {copiedKey === 'password' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {/* Code PIN Secret */}
                {account?.pin && (
                  <div className="bg-white p-3 rounded-xl border border-[#eee8dd] flex items-center justify-between">
                    <div className="truncate pr-2">
                      <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Code PIN Secret (Virements)</p>
                      <p className="text-xs font-mono font-bold text-[#1a1a1a] truncate">
                        {showSensitive ? account.pin : '••••'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(account.pin || '', 'pin', 'Code PIN')}
                      className="p-1.5 rounded-lg hover:bg-[#faf7f0] text-[#0f2b5c] transition-colors"
                      title="Copier"
                    >
                      {copiedKey === 'pin' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {/* Devise */}
                <div className="bg-white p-3 rounded-xl border border-[#eee8dd] flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Devise du Compte</p>
                    <p className="text-xs font-bold text-[#1a1a1a] truncate">
                      {account?.currency || 'CAD'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bouton copier tout */}
              <div className="pt-2 border-t border-[#eee8dd]">
                <button
                  type="button"
                  onClick={copyAllCredentials}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#f0ede6] border border-[#d8d2c4] text-xs font-bold text-[#0f2b5c] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {copiedKey === 'all' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Tous les identifiants ont été copiés !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copier tous mes identifiants bancaires</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Note d'attente d'approbation admin */}
            <div className="p-4 rounded-2xl bg-[#faf8f5] border border-[#eee8dd] text-xs text-[#555] space-y-2">
              <div className="flex items-center gap-2 text-[#0f2b5c] font-bold">
                <UserCheck className="w-4 h-4" />
                <span>En attente de l'approbation de l'administration</span>
              </div>
              <p className="leading-relaxed">
                Dès que votre conseiller financier ou le service conformité aura validé votre dossier d'ouverture, votre compte sera immédiatement actif. Vous pourrez alors vous connecter sur votre espace client avec votre identifiant ou courriel et votre mot de passe.
              </p>
            </div>

            {/* Actions footer */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl w-full sm:w-1/2 flex items-center justify-center gap-2 border-[#0f2b5c] text-[#0f2b5c] hover:bg-[#0f2b5c]/5"
                onClick={() => {
                  window.location.href = `mailto:${getBankSupportEmail()}?subject=Assistance%20dossier%20en%20cours%20-%20VersalBank`;
                }}
              >
                <Headphones className="w-4 h-4" />
                Service Client
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl w-full sm:w-1/2 flex items-center justify-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </Button>
            </div>
          </div>
        )}

        {status === 'rejected' && (
          <div className="space-y-6 text-center">
            <XCircle className="w-16 h-16 text-rose-600 mx-auto" />
            <h1 className="font-heading font-serif text-2xl font-bold text-rose-700">
              Dossier refusé
            </h1>
            <p className="text-xs sm:text-sm text-[#555] leading-relaxed">
              Malheureusement, nous ne pouvons pas donner suite à votre demande d'ouverture de compte chez VersalBank.
            </p>
            {adminNote && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-xl text-xs sm:text-sm text-left">
                <strong>Motif de conformité :</strong> {adminNote}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="rounded-xl w-full"
              onClick={handleLogout}
            >
              Déconnexion
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
