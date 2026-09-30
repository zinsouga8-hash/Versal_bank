import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { getClientProfileByEmailOrId, saveClientToSupabase } from '../lib/supabaseBankService';
import { ClientAccount } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { useI18n } from '../lib/i18n';
import {
  Shield,
  KeyRound,
  Lock,
  User,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  Smartphone,
  History,
  Headphones,
  Save,
  Loader2,
  Globe,
} from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const { lang, setLang, t } = useI18n();
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');

  // PIN Form
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchAccount = async () => {
      try {
        const email = user.email || '';
        const uid = user.uid || (user as any)?.id;
        const acc = await getClientProfileByEmailOrId(email || uid);
        if (acc) {
          setAccount(acc);
          setFirstName(acc.first_name || '');
          setLastName(acc.last_name || '');
          setPhone(acc.phone || '+1 514 892 4012');
          setAddress(acc.address || '1250 Boulevard René-Lévesque Ouest');
          setCity(acc.city || 'Montréal');
          setPostalCode(acc.postal_code || 'H3B 4W8');
          setCountry(acc.country || 'Canada');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAccount();
  }, [user]);

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingInfo(true);
    try {
      if (account) {
        const updated = {
          ...account,
          first_name: firstName,
          last_name: lastName,
          phone,
          address,
          city,
          postal_code: postalCode,
          country,
        };
        await saveClientToSupabase(updated);
        setAccount(updated);
      }
      toast.success(lang === 'en' ? 'Personal information updated successfully.' : 'Vos informations personnelles ont été mises à jour.');
    } catch (e) {
      console.error(e);
      toast.error(lang === 'en' ? 'Error updating personal information.' : 'Erreur lors de la mise à jour de vos informations.');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPin.length < 4 || newPin.length > 6) {
      toast.error(lang === 'en' ? 'PIN code must be between 4 and 6 digits.' : 'Le code PIN doit comporter 4 à 6 chiffres.');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error(lang === 'en' ? 'New PIN codes do not match.' : 'Les nouveaux codes PIN ne correspondent pas.');
      return;
    }
    if (account?.pin && account.pin !== currentPin) {
      toast.error(lang === 'en' ? 'Current PIN code is incorrect.' : 'Code PIN actuel incorrect.');
      return;
    }

    setSavingPin(true);
    try {
      if (account) {
        const updated = {
          ...account,
          pin: newPin,
        };
        await saveClientToSupabase(updated);
        setAccount(updated);
      }
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      toast.success(lang === 'en' ? 'Security PIN updated successfully.' : 'Code PIN de sécurité mis à jour avec succès.');
    } catch (e) {
      console.error(e);
      toast.error(lang === 'en' ? 'Error updating PIN code.' : 'Erreur lors de la modification du code PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0f2b5c]" />
      </div>
    );
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'VB';

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">

      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0f2b5c] mb-1">
          {lang === 'en' ? 'Account Management' : 'Gestion du compte'}
        </p>
        <h1 className="font-heading font-serif text-3xl sm:text-4xl text-[#1a1a1a] font-normal">
          {lang === 'en' ? 'Profile & Security' : 'Profil & Sécurité'}
        </h1>
      </div>

      {/* Identity Card Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#eee8dd] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#131720] text-blue-300 flex items-center justify-center font-serif font-bold text-2xl border border-[#232936] shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-serif text-xl font-bold text-[#1a1a1a]">
                {firstName} {lastName}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> {lang === 'en' ? 'ACTIVE' : 'ACTIF'}
              </span>
            </div>
            <p className="font-mono text-xs text-[#8a857e] mt-1">
              {lang === 'en' ? 'Client ID' : 'ID Client'} : {account?.client_id || 'VSL-2026-837300'} · {user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => window.location.href = 'mailto:contact@versalbank.com'}
            variant="outline"
            className="rounded-xl border-[#eee8dd] text-xs h-10 gap-2"
          >
            <Headphones className="w-4 h-4 text-[#0f2b5c]" />
            {lang === 'en' ? 'Dedicated Advisor' : 'Mon conseiller dédié'}
          </Button>
        </div>
      </div>

      {/* Language Switcher Card */}
      <div className="bg-white rounded-3xl p-6 border border-[#eee8dd] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0f2b5c]/10 text-[#0f2b5c] flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#1a1a1a]">
              {lang === 'en' ? 'Display Language' : 'Langue d’affichage'}
            </h3>
            <p className="text-xs text-[#8a857e]">
              {lang === 'en' ? 'Choose your preferred language across all portal pages' : 'Choisissez votre langue préférée pour toutes les pages du portail'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            variant={lang === 'fr' ? 'default' : 'outline'}
            onClick={() => setLang('fr')}
            className={`text-xs h-9 px-4 rounded-xl font-bold ${lang === 'fr' ? 'bg-[#0f2b5c] text-white' : 'border-[#eee8dd] text-[#555]'}`}
          >
            Français (FR)
          </Button>
          <Button
            size="sm"
            variant={lang === 'en' ? 'default' : 'outline'}
            onClick={() => setLang('en')}
            className={`text-xs h-9 px-4 rounded-xl font-bold ${lang === 'en' ? 'bg-[#0f2b5c] text-white' : 'border-[#eee8dd] text-[#555]'}`}
          >
            English (EN)
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-[#eee8dd] gap-6">
        <button
          onClick={() => setActiveTab('info')}
          className={`pb-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'info'
              ? 'border-[#0f2b5c] text-[#0f2b5c]'
              : 'border-transparent text-[#8a857e] hover:text-[#1a1a1a]'
          }`}
        >
          {lang === 'en' ? 'Personal Information' : 'Informations personnelles'}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'security'
              ? 'border-[#0f2b5c] text-[#0f2b5c]'
              : 'border-transparent text-[#8a857e] hover:text-[#1a1a1a]'
          }`}
        >
          {lang === 'en' ? 'Security & Authorization Codes' : 'Sécurité & Codes d’autorisation'}
        </button>
      </div>

      {/* TAB 1: Informations Personnelles */}
      {activeTab === 'info' && (
        <form onSubmit={handleUpdateInfo} className="bg-white rounded-3xl p-6 sm:p-8 border border-[#eee8dd] shadow-xs space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'First Name' : 'Prénom'}</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="rounded-xl h-11 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Last Name' : 'Nom'}</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="rounded-xl h-11 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Email Address (Identifier)' : 'Adresse électronique (identifiant)'}</Label>
              <Input
                readOnly
                value={user?.email || ''}
                className="rounded-xl h-11 text-sm bg-[#faf8f5] text-[#8a857e]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Mobile Phone' : 'Numéro de téléphone mobile'}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-xl h-11 text-sm"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Residential Address' : 'Adresse postale de résidence'}</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="rounded-xl h-11 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'City' : 'Ville'}</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="rounded-xl h-11 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Postal Code' : 'Code postal'}</Label>
                <Input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="rounded-xl h-11 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Country' : 'Pays'}</Label>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="rounded-xl h-11 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              disabled={savingInfo}
              className="h-11 px-6 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs font-semibold gap-2 shadow-sm"
            >
              {savingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {lang === 'en' ? 'Save Changes' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: Sécurité du compte */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Note de confidentialité & Sécurité des codes d'autorisation */}
          <div className="bg-[#faf8f5] rounded-3xl p-6 sm:p-7 border border-[#eee8dd] shadow-xs flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-heading font-serif text-base font-bold text-[#1a1a1a]">
                {lang === 'en' ? 'Banking Authorization Codes Confidentiality' : 'Confidentialité des codes d\'autorisation bancaire'}
              </h3>
              <p className="text-xs text-[#666] leading-relaxed">
                {lang === 'en'
                  ? 'In compliance with high financial security standards and banking compliance requirements, authorization and release codes (CAT Code and COT Code) are never displayed in open access on your profile. They are strictly administered by the bank and transmitted confidentially by your dedicated advisor or compliance department during transactions requiring authorization.'
                  : 'Conformément aux normes de haute sécurité financière et aux exigences de conformité bancaire, les codes de validation et de déblocage (Code CAT et Code COT) ne sont jamais affichés en libre accès sur votre profil. Ils sont strictement administrés par la banque et vous sont transmis de manière confidentielle par votre conseiller dédié ou le service de conformité lors de chaque opération requérant une autorisation.'}
              </p>
            </div>
          </div>

          {/* Modifier le Code PIN */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#eee8dd] shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#eee8dd]">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-serif text-lg font-bold text-[#1a1a1a]">
                  {lang === 'en' ? 'Personal PIN Code' : 'Code PIN personnel'}
                </h3>
                <p className="text-xs text-[#8a857e]">
                  {lang === 'en' ? 'Confidential secret code required to initiate and authorize transactions' : 'Code secret confidentiel requis pour initier et sécuriser vos transactions'}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdatePin} className="space-y-4 pt-2 max-w-md">
              {account?.pin && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Current PIN Code' : 'Code PIN actuel'}</Label>
                  <Input
                    type="password"
                    maxLength={6}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    placeholder="••••••"
                    className="font-mono rounded-xl h-11 tracking-widest text-center"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'New PIN (4-6 digits)' : 'Nouveau PIN (4-6 chiffres)'}</Label>
                  <Input
                    type="password"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="••••••"
                    className="font-mono rounded-xl h-11 tracking-widest text-center"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1a1a1a]">{lang === 'en' ? 'Confirm PIN' : 'Confirmer le PIN'}</Label>
                  <Input
                    type="password"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="••••••"
                    className="font-mono rounded-xl h-11 tracking-widest text-center"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={savingPin}
                className="h-11 px-5 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs font-semibold gap-2"
              >
                {savingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {lang === 'en' ? 'Update PIN Code' : 'Mettre à jour le code PIN'}
              </Button>
            </form>
          </div>

          {/* Sessions Actives & Sécurité */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#eee8dd] shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#eee8dd]">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-serif text-lg font-bold text-[#1a1a1a]">
                  {lang === 'en' ? 'Active Session & Compliance' : 'Session active et conformité'}
                </h3>
                <p className="text-xs text-[#8a857e]">
                  {lang === 'en' ? 'End-to-end encryption compliant with TLS 1.3 standards' : 'Chiffrement de bout en bout conforme aux normes TLS 1.3'}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#555]">
              <div className="p-3 bg-[#faf8f5] rounded-xl border border-[#eee8dd] flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#1a1a1a]">{lang === 'en' ? 'Certified Current Session' : 'Session actuelle certifiée'}</p>
                  <p className="text-[11px] text-[#8a857e]">{lang === 'en' ? 'Web Browser · Protected IP · SSL Connection' : 'Navigateur Web · IP Protégée · Connexion SSL'}</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {lang === 'en' ? 'Online' : 'En ligne'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
