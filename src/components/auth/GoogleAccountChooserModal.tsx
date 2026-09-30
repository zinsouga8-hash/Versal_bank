import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { User, Plus, ArrowRight, ShieldCheck, Check, Mail } from 'lucide-react';
import { toast } from 'sonner';

export interface GoogleSavedAccount {
  email: string;
  name: string;
  avatar?: string;
  lastUsed?: number;
}

interface GoogleAccountChooserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountSelected: (account: { email: string; name: string }) => void;
}

const DEFAULT_KNOWN_ACCOUNTS: GoogleSavedAccount[] = [
  {
    email: 'zinsouga8@gmail.com',
    name: 'Gaël Zinsou',
    lastUsed: Date.now(),
  },
];

export default function GoogleAccountChooserModal({
  open,
  onOpenChange,
  onAccountSelected,
}: GoogleAccountChooserModalProps) {
  const [accounts, setAccounts] = useState<GoogleSavedAccount[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);

  // Load known Google accounts from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('versalbank_known_google_accounts');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAccounts(parsed);
          return;
        }
      }
      // Also check if any existing client email or auth user exists
      const existingClientEmail = localStorage.getItem('versalbank_client_email') || sessionStorage.getItem('versalbank_reg_email');
      if (existingClientEmail && existingClientEmail.includes('@gmail.com')) {
        const initial = [
          {
            email: existingClientEmail,
            name: existingClientEmail.split('@')[0].replace(/[._]/g, ' '),
            lastUsed: Date.now(),
          },
          ...DEFAULT_KNOWN_ACCOUNTS.filter(a => a.email.toLowerCase() !== existingClientEmail.toLowerCase()),
        ];
        setAccounts(initial);
        localStorage.setItem('versalbank_known_google_accounts', JSON.stringify(initial));
        return;
      }
      setAccounts(DEFAULT_KNOWN_ACCOUNTS);
      localStorage.setItem('versalbank_known_google_accounts', JSON.stringify(DEFAULT_KNOWN_ACCOUNTS));
    } catch {
      setAccounts(DEFAULT_KNOWN_ACCOUNTS);
    }
  }, [open]);

  const handleSelectAccount = (account: GoogleSavedAccount) => {
    setLoading(true);
    // Update last used
    try {
      const updated = [
        { ...account, lastUsed: Date.now() },
        ...accounts.filter(a => a.email.toLowerCase() !== account.email.toLowerCase()),
      ];
      localStorage.setItem('versalbank_known_google_accounts', JSON.stringify(updated));
    } catch {}

    setTimeout(() => {
      setLoading(false);
      onOpenChange(false);
      onAccountSelected({ email: account.email, name: account.name });
    }, 400);
  };

  const handleAddCustomAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = customEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Veuillez saisir une adresse courriel Google valide.');
      return;
    }

    const calculatedName = customName.trim() || cleanEmail.split('@')[0].replace(/[._]/g, ' ');
    const newAcc: GoogleSavedAccount = {
      email: cleanEmail,
      name: calculatedName,
      lastUsed: Date.now(),
    };

    try {
      const updated = [newAcc, ...accounts.filter(a => a.email.toLowerCase() !== cleanEmail)];
      localStorage.setItem('versalbank_known_google_accounts', JSON.stringify(updated));
      setAccounts(updated);
    } catch {}

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onOpenChange(false);
      onAccountSelected({ email: cleanEmail, name: calculatedName });
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200">
        <DialogHeader className="flex flex-col items-center text-center pb-2">
          {/* Official Google G Logo */}
          <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900">
            Choisir un compte
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            pour poursuivre vers <span className="font-semibold text-slate-800">VersalBank</span>
          </DialogDescription>
        </DialogHeader>

        {!showCustomInput ? (
          <div className="space-y-2.5 mt-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
              Comptes Gmail enregistrés sur cet appareil
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {accounts.map((acc) => {
                const initial = acc.name ? acc.name.charAt(0).toUpperCase() : acc.email.charAt(0).toUpperCase();
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectAccount(acc)}
                    disabled={loading}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200/90 hover:border-[#0f2b5c]/40 hover:bg-slate-50/80 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0f2b5c] to-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs flex-shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate group-hover:text-[#0f2b5c] transition-colors">
                          {acc.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{acc.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#0f2b5c] group-hover:text-white transition-all flex-shrink-0">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-all cursor-pointer mt-2"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <span>Utiliser un autre compte Google</span>
            </button>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center leading-relaxed">
              Pour continuer, Google partagera votre nom, adresse courriel et préférences de langue avec VersalBank.
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddCustomAccount} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Adresse courriel Google</Label>
              <Input
                type="email"
                required
                placeholder="votre.nom@gmail.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="mt-1.5 h-11 rounded-xl border-slate-200"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Nom & Prénom (optionnel)</Label>
              <Input
                type="text"
                placeholder="Ex. Gaël Zinsou"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="mt-1.5 h-11 rounded-xl border-slate-200"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCustomInput(false)}
                className="flex-1 h-11 rounded-xl"
              >
                Retour
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-11 rounded-xl bg-[#0f2b5c] hover:bg-[#1a428a] text-white font-medium"
              >
                Continuer
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
