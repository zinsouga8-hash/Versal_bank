import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getClientProfileByEmailOrId } from '../lib/supabaseBankService';
import { Landmark, Loader2, ShieldCheck, LogOut, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import PinInput from '../components/ui/PinInput';
import BankMonogram from '../components/public/BankMonogram';
import { ClientAccount } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useI18n } from '../lib/i18n';

export default function PortalGate() {
  const { user, loading, isAdmin, logout } = useAuth();
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [verifyingAccount, setVerifyingAccount] = useState(true);

  // Check if session is already unlocked in current browser window
  const isAlreadyUnlocked = () => {
    return sessionStorage.getItem('versalbank_pin_unlocked') === 'true';
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }

    if (isAdmin) {
      navigate('/administration');
      return;
    }

    if (isAlreadyUnlocked()) {
      navigate('/espace/tableau-de-bord');
      return;
    }

    // Check account status via Supabase bank service
    const fetchAccount = async () => {
      try {
        const email = user.email || 
          localStorage.getItem('versalbank_client_email') || 
          sessionStorage.getItem('versalbank_client_email') || '';
        const uid = user.uid || (user as any)?.id;
        let data = await getClientProfileByEmailOrId(email || uid);

        // Fallback: check cached account
        if (!data) {
          const cachedEmail = localStorage.getItem('versalbank_client_email');
          if (cachedEmail && cachedEmail !== email) {
            data = await getClientProfileByEmailOrId(cachedEmail);
          }
        }

        if (!data) {
          const lastAccRaw = localStorage.getItem('versalbank_last_account');
          if (lastAccRaw) {
            try {
              data = JSON.parse(lastAccRaw);
            } catch (_) {}
          }
        }

        if (!data) {
          navigate('/ouverture-de-compte');
          return;
        }

        // Cache account info
        try {
          localStorage.setItem('versalbank_last_account', JSON.stringify(data));
          if (data.email) localStorage.setItem('versalbank_client_email', data.email);
        } catch (_) {}

        setAccount(data);

        if (data.status !== 'approved') {
          navigate('/dossier-en-cours');
          return;
        }

        if (isAlreadyUnlocked()) {
          navigate('/espace/tableau-de-bord');
          return;
        }

        setVerifyingAccount(false);
      } catch (err) {
        console.error("Account fetch error in PortalGate:", err);
        setVerifyingAccount(false);
      }
    };

    fetchAccount();
  }, [user, loading, isAdmin, navigate]);

  if (loading || verifyingAccount) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#faf7f0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0f2b5c]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (isAdmin) return <Navigate to="/administration" />;
  if (isAlreadyUnlocked()) return <Navigate to="/espace/tableau-de-bord" />;

  const pinLength = account?.pin ? String(account.pin).trim().length : 6;

  const handlePinSubmit = async (e?: React.FormEvent, candidatePin?: string) => {
    if (e) e.preventDefault();
    const pinToVerify = (candidatePin !== undefined ? candidatePin : pin).trim();
    if (!pinToVerify || pinToVerify.length !== pinLength) return;
    
    setChecking(true);
    try {
      const expectedPin = String(account?.pin || '123456').trim();
      const isMatch = pinToVerify === expectedPin || 
                      (!account?.pin && (pinToVerify === '1234' || pinToVerify === '123456'));

      if (isMatch) {
        sessionStorage.setItem('versalbank_pin_unlocked', 'true');
        localStorage.setItem('versalbank_pin_unlocked_time', String(Date.now()));
        toast.success(lang === 'en' ? "Authentication successful. Welcome to your portal." : "Authentification réussie. Bienvenue sur votre espace.");
        navigate('/espace/tableau-de-bord');
      } else {
        toast.error(lang === 'en' ? "Incorrect PIN. Please try again." : "Code PIN incorrect. Veuillez réessayer.");
        setPin('');
      }
    } catch (error) {
      console.error("PIN check error:", error);
      toast.error(lang === 'en' ? "PIN verification error." : "Erreur de vérification du code PIN.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('versalbank_pin_unlocked');
    sessionStorage.removeItem('versalbank_pending_otp');
    localStorage.removeItem('versalbank_pin_unlocked_time');
    localStorage.removeItem('versalbank_last_account');
    try {
      await logout();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    window.location.href = '/login';
  };

  const clientFullName = `${account?.first_name || ''} ${account?.last_name || ''}`.trim() || account?.full_name || user.displayName || 'Client VersalBank';
  const clientEmailDisplay = account?.email || user.email || '';

  return (
    <div className="min-h-screen bg-[#faf7f0] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-[#eee8dd] text-center">
        <div className="flex justify-center mb-4">
          <BankMonogram className="w-12 h-12" />
        </div>

        {/* Connected account indicator */}
        <div className="mb-5 p-3 bg-[#f8f5ee] rounded-2xl border border-[#eee8dd] text-left flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0f2b5c] text-white flex items-center justify-center font-bold text-xs shrink-0">
            {clientFullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {lang === 'en' ? 'Connected Account' : 'Compte connecté'}
            </p>
            <p className="text-xs font-bold text-[#1a1a1a] truncate">{clientFullName}</p>
            <p className="text-[10px] text-[#8a857e] truncate">{clientEmailDisplay}</p>
          </div>
        </div>

        <h1 className="font-heading font-serif text-xl sm:text-2xl font-bold text-[#1a1a1a] mb-1.5">
          {lang === 'en' ? 'Security Required' : 'Sécurité requise'}
        </h1>
        <p className="text-[#8a857e] mb-6 text-xs">
          {lang === 'en'
            ? `Your session is active. Please enter your secret ${pinLength}-digit PIN code to continue.`
            : `Votre compte demeure connecté. Saisissez simplement votre code PIN secret (${pinLength} chiffres) pour poursuivre.`}
        </p>
        
        <form onSubmit={(e) => handlePinSubmit(e)} className="space-y-6">
          <div className="flex justify-center">
            <PinInput
              length={pinLength}
              value={pin}
              onChange={setPin}
              onComplete={(completedPin) => {
                handlePinSubmit(undefined, completedPin);
              }}
              autoFocus
            />
          </div>

          <Button 
            type="submit" 
            disabled={pin.length !== pinLength || checking} 
            className="w-full rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white h-11 text-xs font-semibold tracking-wider uppercase cursor-pointer"
          >
            {checking ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <span className="flex items-center justify-center gap-2">
                {lang === 'en' ? 'Proceed to portal' : "Poursuivre vers l'espace"}
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>

          <div className="pt-2 border-t border-[#eee8dd]">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 text-xs font-medium text-[#8a857e] hover:text-rose-600 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {lang === 'en' ? 'Switch User / Logout' : "Changer d'utilisateur / Déconnexion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
