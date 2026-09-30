import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { saveClientToSupabase, getClientProfileByEmailOrId, registerClientApplication } from '../lib/supabaseBankService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { notifyAccountSubmitted } from '../lib/emailService';
import { 
  UploadCloud, CheckCircle2, Eye, EyeOff, FileText, 
  Trash2, RefreshCw, FileCheck, ShieldAlert, Loader2, ArrowRight, ArrowLeft, Copy, ShieldCheck, Home, Check, LogOut
} from 'lucide-react';
import { ALL_COUNTRIES, WORLD_COUNTRIES, CountryData } from '../data/countriesAndCities';
import SearchableSelect, { SearchableOption } from '../components/ui/SearchableSelect';
import PinInput from '../components/ui/PinInput';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import LanguageSelector from '../components/common/LanguageSelector';
import BankMonogram from '../components/public/BankMonogram';

export interface UploadedDoc {
  id: string;
  category: 'id_document' | 'proof_of_address';
  title: string;
  name: string;
  size: string;
  type: string;
  dataUrl: string;
  uploadedAt: number;
}

export default function OpenAccount() {
  const { user, logout, setCustomUser } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyToClipboard = (text: string, key: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedKey(key);
        toast.success(`${label} copié !`);
        setTimeout(() => setCopiedKey(null), 2000);
      });
    }
  };
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // File input refs for native file explorer trigger
  const idInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const handleCancelAndLogout = async () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('versalbank_client_email');
      localStorage.removeItem('versalbank_google_auth');
      localStorage.removeItem('versalbank_custom_user');
      await logout();
      toast.info(lang === 'en' ? "You have been logged out." : "Vous avez été déconnecté.");
      navigate('/login');
    } catch (e) {
      navigate('/login');
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
    nationality: '',
    email: '',
    client_type: 'Particulier',
    currency: 'CAD',
    country: 'Canada',
    city: 'Montréal',
    address: '',
    postal_code: '',
    phone_prefix: '+1',
    phone: '',
    job_status: 'Salarié(e)',
    job_title: '',
    monthly_income: '2 501 - 6 000',
    job_duration: '3 ans',
    portal_password: '',
    pin: '',
    consent_1: false,
    consent_2: false,
    consent_3: false,
    privacy_accepted: false,
    security_charter_accepted: false,
    accuracy_certified: false,
    age_confirmed: false,
  });

  const isSubmittingRef = useRef(false);

  // Uploaded documents state
  const [uploadedDocs, setUploadedDocs] = useState<{
    id_document?: UploadedDoc;
    proof_of_address?: UploadedDoc;
  }>({});

  const [dragOverId, setDragOverId] = useState(false);
  const [dragOverProof, setDragOverProof] = useState(false);

  const isGoogleUser = Boolean(
    (user as any)?.app_metadata?.provider === 'google' || 
    (user as any)?.identities?.some((id: any) => id.provider === 'google') || 
    user?.providerData?.some(p => p?.providerId === 'google.com') ||
    sessionStorage.getItem('versalbank_google_auth')
  );

  // Auto redirect if user already has an approved account or pending file
  useEffect(() => {
    async function checkExistingClient() {
      let emailToCheck = user?.email || 
        sessionStorage.getItem('versalbank_client_email') || 
        sessionStorage.getItem('versalbank_reg_email') || 
        localStorage.getItem('versalbank_client_email');
      
      if (!emailToCheck) {
        try {
          const rawCustom = localStorage.getItem('versalbank_custom_user');
          if (rawCustom) {
            const parsed = JSON.parse(rawCustom);
            if (parsed?.email) emailToCheck = parsed.email;
          }
        } catch (_) {}
      }

      if (emailToCheck) {
        try {
          const profile = await getClientProfileByEmailOrId(emailToCheck);
          if (profile) {
            if (profile.status === 'approved') {
              navigate('/portail');
              return;
            } else if (profile.status === 'pending' && profile.terms_accepted === true && (profile.first_name || profile.last_name || profile.account_number)) {
              // Only redirect to /dossier-en-cours if the official adhesion form was already completed
              navigate('/dossier-en-cours');
              return;
            }
          }
        } catch (err) {
          console.warn('Check existing client notice:', err);
        }
      }
    }
    checkExistingClient();
  }, [user, navigate, lang]);

  useEffect(() => {
    const userEmail = user?.email || sessionStorage.getItem('versalbank_reg_email') || '';
    if (userEmail) {
      setFormData(prev => ({ ...prev, email: userEmail }));
    }
    const regPassword = sessionStorage.getItem('versalbank_reg_password') || '';
    if (regPassword) {
      setFormData(prev => ({ ...prev, portal_password: regPassword }));
    }
    if (user?.displayName) {
      const parts = user.displayName.trim().split(' ');
      setFormData(prev => ({
        ...prev,
        first_name: prev.first_name || (parts[0] || ''),
        last_name: prev.last_name || (parts.slice(1).join(' ') || ''),
      }));
    }
  }, [user]);

  // Derived current country object
  const currentCountry = ALL_COUNTRIES.find(
    c => c.name.toLowerCase() === (formData.country || '').toLowerCase()
  ) || ALL_COUNTRIES.find(c => c.name === 'Canada');

  // Country options for SearchableSelect
  const countryOptions: SearchableOption[] = ALL_COUNTRIES.map(c => ({
    label: c.name,
    value: c.name,
    sub: c.prefix,
    icon: c.flag
  }));

  // City options based on current selected country
  const cityOptions: SearchableOption[] = (currentCountry?.cities || []).map(city => ({
    label: city,
    value: city,
  }));

  const handleCountryChange = (selectedCountryName: string) => {
    const found = ALL_COUNTRIES.find(
      c => c.name.toLowerCase() === selectedCountryName.toLowerCase()
    );
    if (found) {
      setFormData(prev => ({
        ...prev,
        country: found.name,
        phone_prefix: found.prefix,
        city: found.cities.length > 0 ? found.cities[0] : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, country: selectedCountryName }));
    }
  };

  const handleCityChange = (cityName: string) => {
    setFormData(prev => ({ ...prev, city: cityName }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleConsentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: checked };
      if (name === 'privacy_accepted') updated.consent_1 = checked;
      if (name === 'security_charter_accepted') updated.consent_2 = checked;
      if (name === 'accuracy_certified' || name === 'age_confirmed') {
        const acc = name === 'accuracy_certified' ? checked : prev.accuracy_certified;
        const age = name === 'age_confirmed' ? checked : prev.age_confirmed;
        updated.consent_3 = Boolean(acc && age);
      }
      return updated;
    });
  };

  const handleSelect = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePinChange = (index: number, val: string) => {
    if (val.length > 1) return;
    const clean = val.replace(/\D/g, '');
    const newPin = (formData.pin || '      ').split('');
    newPin[index] = clean || ' ';
    setFormData(prev => ({ ...prev, pin: newPin.join('').trimEnd() }));
  };

  // Helper format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  // Native File Upload Processor
  const processUploadedFile = (file: File, category: 'id_document' | 'proof_of_address') => {
    if (!file) return;
    
    // Check max size 15MB
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Le fichier dépasse la limite maximale autorisée de 15 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const title = category === 'id_document' ? "Pièce d'identité" : "Justificatif de domicile";
      
      const newDoc: UploadedDoc = {
        id: `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        category,
        title,
        name: file.name,
        size: formatSize(file.size),
        type: file.type || 'application/octet-stream',
        dataUrl,
        uploadedAt: Date.now()
      };

      setUploadedDocs(prev => ({
        ...prev,
        [category]: newDoc
      }));

      toast.success(`${title} chargée avec succès : ${file.name}`);
    };

    reader.onerror = () => {
      toast.error("Erreur lors de la lecture du document.");
    };

    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, category: 'id_document' | 'proof_of_address') => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file, category);
    }
  };

  const removeDoc = (category: 'id_document' | 'proof_of_address') => {
    setUploadedDocs(prev => {
      const copy = { ...prev };
      delete copy[category];
      return copy;
    });
    toast.info("Document supprimé.");
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, category: 'id_document' | 'proof_of_address') => {
    e.preventDefault();
    if (category === 'id_document') setDragOverId(false);
    if (category === 'proof_of_address') setDragOverProof(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file, category);
    }
  };

  // Submit Application
  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Anti-double submission guard
    if (loading || isSubmittingRef.current) {
      return;
    }

    const targetEmail = user?.email || formData.email || sessionStorage.getItem('versalbank_reg_email') || '';
    if (!targetEmail || !targetEmail.includes('@')) {
      toast.error("Veuillez renseigner une adresse courriel valide.");
      return;
    }

    // 2. Validate all 4 legal consents
    const hasPrivacy = Boolean(formData.privacy_accepted || formData.consent_1);
    const hasSecurity = Boolean(formData.security_charter_accepted || formData.consent_2);
    const hasAccuracy = Boolean(formData.accuracy_certified || formData.consent_3);
    const hasAge = Boolean(formData.age_confirmed || formData.consent_3);

    if (!hasPrivacy || !hasSecurity || !hasAccuracy || !hasAge) {
      toast.error("Veuillez valider l'ensemble des 4 consentements & déclarations légales obligatoires.");
      return;
    }

    const chosenPassword = formData.portal_password || sessionStorage.getItem('versalbank_reg_password');
    if (!chosenPassword || chosenPassword.length < 6) {
      toast.error("Veuillez définir un mot de passe d'au moins 6 caractères pour votre portail.");
      return;
    }

    const cleanPin = (formData.pin || '').replace(/\s/g, '');
    if (cleanPin.length !== 6) {
      toast.error("Le code PIN secret doit comporter exactement 6 chiffres.");
      return;
    }

    // Verify KYC upload recommendation
    const docsList = Object.values(uploadedDocs).filter(Boolean) as UploadedDoc[];
    if (docsList.length === 0) {
      toast.warning("Veuillez joindre au moins une pièce d'identité pour examen immédiat.");
    }

    // Format documents as clean serializable array for JSONB storage
    const formattedDocs = docsList.map((doc, idx) => {
      const docUrl = doc.dataUrl || (doc as any).url || (doc as any).file_url || '';
      const fallbackLabel = doc.category === 'proof_of_address' 
        ? 'Justificatif de domicile' 
        : 'Pièce d’identité (CNI / Passeport)';
      return {
        name: doc.name || doc.title || `Document_${idx + 1}`,
        label: doc.title || doc.name || fallbackLabel,
        type: doc.type || doc.category || 'identity',
        category: doc.category || 'id_document',
        url: docUrl,
        file_url: docUrl,
        dataUrl: docUrl,
        size: doc.size || 0,
        uploaded_at: new Date().toISOString()
      };
    });

    setLoading(true);
    isSubmittingRef.current = true;

    try {
      const cleanEmail = targetEmail.trim().toLowerCase();
      const currentYear = new Date().getFullYear();
      const clientId = `VSL-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`;
      const profileId = (user?.uid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.uid)) 
        ? user.uid 
        : crypto.randomUUID();
      const accountId = crypto.randomUUID();
      
      const fullPhone = `${formData.phone_prefix} ${formData.phone}`.trim();
      const accountNumber = `00${Math.floor(10000000 + Math.random() * 90000000)}`;
      const iban = `CA12VERS0001${accountNumber}`;
      const swiftCode = `SWIFT-${Math.floor(100000 + Math.random() * 900000)}`;
      const catCode = `CAT-${Math.floor(100000 + Math.random() * 900000)}`;
      const cotCode = `COT-${Math.floor(100000 + Math.random() * 900000)}`;

      const registrationPayload = {
        id: profileId,
        profile_id: profileId,
        account_id: accountId,
        client_id: clientId,
        email: cleanEmail,
        user_email: cleanEmail,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: fullPhone,
        pin: cleanPin,
        portal_password: chosenPassword,
        birth_date: formData.birth_date || null,
        nationality: formData.nationality || 'Canadienne',
        country: formData.country || 'Canada',
        city: formData.city || '',
        address: formData.address || '',
        postal_code: formData.postal_code || '',
        profession: formData.job_title || '',
        job_title: formData.job_title || '',
        annual_income: formData.monthly_income || '',
        monthly_income: formData.monthly_income || '',
        employment_status: formData.job_status || '',
        employed_since: formData.job_duration || '',
        client_type: formData.client_type || 'Particulier',
        documents: formattedDocs,
        account_number: accountNumber,
        iban: iban,
        bic: 'VERSCA2TMTR',
        swift_code: swiftCode,
        cat_code: catCode,
        cot_code: cotCode,
        balance: 0.00,
        currency: formData.currency || 'CAD',
        status: 'pending',
        account_active: false,
        role: 'client',
        language: lang || (localStorage.getItem('versalbank_lang') as any) || 'fr',
        is_admin: false,
        terms_accepted: true,
        privacy_accepted: true,
        security_charter_accepted: true,
        accuracy_certified: true,
        age_confirmed: true,
        consent_1: true,
        consent_2: true,
        consent_3: true,
      };

      // 3. Centralized registration call (with automatic duplicate protection and server service role write)
      const regRes = await registerClientApplication(registrationPayload);

      if (!regRes.success) {
        if (regRes.code === 'EMAIL_ALREADY_EXISTS') {
          toast.error("Un compte bancaire actif existe déjà avec cette adresse courriel. Veuillez vous connecter.", {
            action: {
              label: "Se connecter",
              onClick: () => navigate('/login')
            }
          });
          return;
        }

        if (regRes.code === 'NETWORK_ERROR' || regRes.code === 'TIMEOUT') {
          toast.error("Problème temporaire de connexion avec le serveur. Vos données restent conservées dans le formulaire. Veuillez réessayer.");
          return;
        }

        throw new Error(regRes.error || "Impossible d'enregistrer votre demande.");
      }

      const activeClient = regRes.client || registrationPayload;
      const actualClientId = activeClient.client_id || clientId;
      const actualAccountNum = activeClient.account_number || accountNumber;
      const actualIban = activeClient.iban || iban;

      // 4. Send email receipt to client in background
      notifyAccountSubmitted({
        user_email: cleanEmail,
        first_name: formData.first_name,
        last_name: formData.last_name,
        client_id: actualClientId
      }).catch((err) => console.warn("Email confirmation notice:", err));

      const credentials = {
        client_id: actualClientId,
        email: cleanEmail,
        user_email: cleanEmail,
        portal_password: chosenPassword,
        pin: cleanPin,
        first_name: formData.first_name,
        last_name: formData.last_name,
        account_number: actualAccountNum,
        iban: actualIban,
        swift_code: activeClient.swift_code || swiftCode,
        cat_code: activeClient.cat_code || catCode,
        cot_code: activeClient.cot_code || cotCode,
        currency: formData.currency,
        status: 'pending' as const,
        account_active: false,
      };

      sessionStorage.setItem('versalbank_last_credentials', JSON.stringify(credentials));
      localStorage.setItem('versalbank_client_email', cleanEmail);
      localStorage.setItem('versalbank_last_account', JSON.stringify(credentials));

      // Clean up temporary registration drafts
      sessionStorage.removeItem('versalbank_pending_otp');
      sessionStorage.removeItem('versalbank_reg_password');

      // Activate user session
      setCustomUser({
        id: activeClient.id || profileId,
        uid: activeClient.id || profileId,
        email: cleanEmail,
        displayName: `${formData.first_name} ${formData.last_name}`.trim(),
        providerData: [{ providerId: 'password' }],
      });

      toast.success(
        regRes.alreadyPending 
          ? "Votre dossier a été actualisé et est en cours d'examen par notre équipe !" 
          : "Demande d'ouverture soumise avec succès à l'administration !"
      );
      
      // Direct navigation to "analyse en cours" page
      navigate('/dossier-en-cours');
    } catch (e: any) {
      console.error("[OpenAccount Registration Error]", {
        timestamp: new Date().toISOString(),
        error: e,
        message: e?.message,
      });
      toast.error(e?.message || "Erreur lors de la transmission de votre dossier.");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col items-center py-6 sm:py-10 px-4 sm:px-6">
      {/* Hidden Native File Inputs */}
      <input
        type="file"
        ref={idInputRef}
        onChange={(e) => handleFileInputChange(e, 'id_document')}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
      />
      <input
        type="file"
        ref={proofInputRef}
        onChange={(e) => handleFileInputChange(e, 'proof_of_address')}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
      />

      <div className="w-full max-w-4xl space-y-6 sm:space-y-8">
        {/* Top bar with back button, brand, cancel/logout, and language selector */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-[#eee8dd] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#0f2b5c] hover:text-[#0a1e40] bg-white px-3.5 py-2 rounded-full border border-[#eee8dd] shadow-xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'Back to Home' : "Retour à l'accueil"}</span>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f2b5c] hover:text-[#0a1e40] bg-white px-3.5 py-2 rounded-full border border-[#eee8dd] shadow-xs transition-colors"
            >
              <span>{lang === 'en' ? 'Already a client? Sign in' : "Déjà client ? Se connecter"}</span>
            </Link>
            <button
              type="button"
              onClick={handleCancelAndLogout}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 rounded-full border border-rose-200 shadow-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>{lang === 'en' ? 'Log Out' : "Déconnexion"}</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <BankMonogram className="w-8 h-8 shrink-0" />
            <LanguageSelector />
          </div>
        </div>

        {isSubmitted && createdCredentials ? (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#eee8dd] shadow-xs max-w-2xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="font-heading font-serif text-xl sm:text-2xl font-bold text-[#1a1a1a]">
                Félicitations, votre demande a été soumise avec succès !
              </h2>
              <p className="text-sm text-[#8a857e]">
                Vos identifiants ont été générés. Veuillez les noter précieusement avant de quitter cette page.
              </p>
            </div>

            <div className="bg-[#faf8f5] rounded-2xl p-5 border border-[#e2dcce] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2dcce]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#555] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0f2b5c]" />
                  Vos identifiants de connexion
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Identifiant Client (ID)</p>
                    <p className="text-sm font-mono font-bold text-[#1a1a1a]">{createdCredentials.client_id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdCredentials.client_id, 'client_id', 'Identifiant Client')}
                    className="p-2 rounded-xl bg-white border border-[#e2dcce] hover:bg-[#f0ede6] text-[#0f2b5c] transition-colors"
                  >
                    {copiedKey === 'client_id' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Courriel Enregistré</p>
                    <p className="text-sm font-mono font-bold text-[#1a1a1a]">{createdCredentials.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdCredentials.email, 'email', 'Courriel')}
                    className="p-2 rounded-xl bg-white border border-[#e2dcce] hover:bg-[#f0ede6] text-[#0f2b5c] transition-colors"
                  >
                    {copiedKey === 'email' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Mot de passe Portail</p>
                    <p className="text-sm font-mono font-bold text-[#1a1a1a]">{createdCredentials.portal_password}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdCredentials.portal_password, 'password', 'Mot de passe')}
                    className="p-2 rounded-xl bg-white border border-[#e2dcce] hover:bg-[#f0ede6] text-[#0f2b5c] transition-colors"
                  >
                    {copiedKey === 'password' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[#8a857e] uppercase font-semibold">Code PIN Secret (Virements)</p>
                    <p className="text-sm font-mono font-bold text-[#1a1a1a]">{createdCredentials.pin}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdCredentials.pin, 'pin', 'Code PIN')}
                    className="p-2 rounded-xl bg-white border border-[#e2dcce] hover:bg-[#f0ede6] text-[#0f2b5c] transition-colors"
                  >
                    {copiedKey === 'pin' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={() => navigate('/portail')}
                className="w-full bg-[#0f2b5c] hover:bg-[#0a1e40] text-white rounded-xl h-12 flex items-center justify-center gap-2"
              >
                Accéder à mon portail
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/')}
                className="w-full border-[#0f2b5c] text-[#0f2b5c] hover:bg-[#0f2b5c]/5 rounded-xl h-12 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Retourner à l'accueil
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center sm:text-left space-y-2 mb-4 sm:mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('oa_badge')}</span>
              </div>
              <h1 className="font-heading font-serif text-2xl sm:text-4xl font-bold text-[#1a1a1a]">
                {t('oa_title')}
              </h1>
              <p className="text-xs sm:text-sm text-[#8a857e]">
                {t('oa_subtitle')}
              </p>
            </div>

        <form onSubmit={submitForm} className="space-y-6">
          {/* 1. Identité */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#eee8dd] shadow-xs">
            <h2 className="font-heading font-serif text-lg sm:text-xl font-bold text-[#1a1a1a] mb-6">
              {t('oa_sec1_title')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_first_name')}
                </Label>
                <Input name="first_name" value={formData.first_name} onChange={handleChange} required className="rounded-xl bg-[#faf8f5] text-base sm:text-sm" placeholder="ex : Alexandre" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_last_name')}
                </Label>
                <Input name="last_name" value={formData.last_name} onChange={handleChange} required className="rounded-xl bg-[#faf8f5] text-base sm:text-sm" placeholder="ex : Martin" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_birth_date')}
                </Label>
                <Input name="birth_date" type="date" value={formData.birth_date} onChange={handleChange} required className="rounded-xl bg-[#faf8f5] text-base sm:text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_nationality')}
                </Label>
                <Input name="nationality" value={formData.nationality} onChange={handleChange} required placeholder="ex : Canadienne, Française..." className="rounded-xl bg-[#faf8f5] text-base sm:text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_account_email')}
                </Label>
                <Input name="email" type="email" value={formData.email} disabled className="rounded-xl bg-[#f0ede6] text-[#8a857e] font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_client_type')}
                </Label>
                <Select value={formData.client_type} onValueChange={(v) => handleSelect('client_type', v)}>
                  <SelectTrigger className="rounded-xl bg-[#faf8f5] text-base sm:text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Particulier">{t('oa_type_personal')}</SelectItem>
                    <SelectItem value="Professionnel">{t('oa_type_pro')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_primary_currency')}
                </Label>
                <Select value={formData.currency} onValueChange={(v) => handleSelect('currency', v)}>
                  <SelectTrigger className="rounded-xl bg-[#faf8f5] text-base sm:text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">$ CA — Dollar canadien (CAD)</SelectItem>
                    <SelectItem value="EUR">€ — Euro (EUR)</SelectItem>
                    <SelectItem value="USD">$ US — Dollar américain (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 2. Résidence & contact (Pays du monde entier + Villes synchronisées + Recherche/Défilement) */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#eee8dd] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
              <div>
                <h2 className="font-heading font-serif text-lg sm:text-xl font-bold text-[#1a1a1a]">
                  {t('oa_sec2_title')}
                </h2>
                <p className="text-xs text-[#8a857e] mt-1">
                  {t('oa_sec2_sub')}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#faf8f5] border border-[#eee8dd] text-[#8a857e] font-mono self-start sm:self-auto">
                {ALL_COUNTRIES.length} {t('oa_country_avail')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Country Select (All countries in the world) */}
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_country')}
                </Label>
                <SearchableSelect
                  id="open-account-country"
                  placeholder={lang === 'en' ? 'Search or scroll a country...' : 'Rechercher ou faire défiler un pays...'}
                  value={formData.country}
                  onChange={handleCountryChange}
                  options={countryOptions}
                />
              </div>

              {/* City Select (Auto-filtered for the selected country) */}
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_city')} ({cityOptions.length} {lang === 'en' ? 'suggested cities' : 'villes suggérées'} {formData.country})
                </Label>
                <SearchableSelect
                  id="open-account-city"
                  placeholder={lang === 'en' ? 'Choose or type a city...' : 'Choisir ou saisir une ville...'}
                  value={formData.city}
                  onChange={handleCityChange}
                  options={cityOptions}
                  allowCustomInput={true}
                />
              </div>

              {/* Full Address */}
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_address')}
                </Label>
                <Input name="address" value={formData.address} onChange={handleChange} required placeholder="ex : 124 Boulevard René-Lévesque Ouest" className="rounded-xl bg-[#faf8f5] text-base sm:text-sm" />
              </div>

              {/* Postal Code */}
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_postal_code')}
                </Label>
                <Input name="postal_code" value={formData.postal_code} onChange={handleChange} required placeholder="ex : H3B 1R8 ou 01BP45" className="rounded-xl bg-[#faf8f5] text-base sm:text-sm" />
              </div>

              {/* Phone with Auto Country Prefix */}
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_phone')}
                </Label>
                <div className="flex gap-2">
                  <div className="w-24 px-3 py-2.5 rounded-xl bg-[#f0ede6] text-center font-mono font-bold text-sm text-[#1a1a1a] flex items-center justify-center border border-[#e8e4dc]">
                    {formData.phone_prefix || '+00'}
                  </div>
                  <Input 
                    name="phone" 
                    type="tel" 
                    value={formData.phone} 
                    onChange={handleChange} 
                    required 
                    placeholder="Numéro sans l'indicatif (ex: 612345678)" 
                    className="flex-1 rounded-xl bg-[#faf8f5] text-base sm:text-sm" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Situation professionnelle */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#eee8dd] shadow-xs">
            <h2 className="font-heading font-serif text-lg sm:text-xl font-bold text-[#1a1a1a] mb-6">
              {t('oa_sec3_title')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_job_status')}
                </Label>
                <Select value={formData.job_status} onValueChange={(v) => handleSelect('job_status', v)}>
                  <SelectTrigger className="rounded-xl bg-[#faf8f5] text-base sm:text-sm"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Salarié(e)">{lang === 'en' ? 'Private Sector Employee' : 'Salarié(e) du secteur privé'}</SelectItem>
                    <SelectItem value="Fonctionnaire">{lang === 'en' ? 'Civil Servant / Public Sector' : 'Fonctionnaire / Service public'}</SelectItem>
                    <SelectItem value="Indépendant">{lang === 'en' ? 'Self-Employed / Entrepreneur' : 'Indépendant / Dirigeant / Entrepreneur'}</SelectItem>
                    <SelectItem value="Profession libérale">{lang === 'en' ? 'Liberal Profession (Doctor, Lawyer)' : 'Profession libérale (Médecin, Avocat...)'}</SelectItem>
                    <SelectItem value="Retraité(e)">{lang === 'en' ? 'Retired' : 'Retraité(e)'}</SelectItem>
                    <SelectItem value="Étudiant(e)">{lang === 'en' ? 'Student' : 'Étudiant(e)'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_job_title')}
                </Label>
                <Input name="job_title" value={formData.job_title} onChange={handleChange} required placeholder="ex : Cadre commercial, Ingénieur..." className="rounded-xl bg-[#faf8f5] text-base sm:text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_monthly_income')}
                </Label>
                <Select value={formData.monthly_income} onValueChange={(v) => handleSelect('monthly_income', v)}>
                  <SelectTrigger className="rounded-xl bg-[#faf8f5] text-base sm:text-sm"><SelectValue placeholder="Sélectionner une tranche" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0 - 2 500">{lang === 'en' ? 'Under 2,500' : 'Moins de 2 500'} {formData.currency}</SelectItem>
                    <SelectItem value="2 501 - 6 000">2 501 – 6 000 {formData.currency}</SelectItem>
                    <SelectItem value="6 001 - 10 000">6 001 – 10 000 {formData.currency}</SelectItem>
                    <SelectItem value="10 001 - 25 000">10 001 – 25 000 {formData.currency}</SelectItem>
                    <SelectItem value="Plus de 25 000">{lang === 'en' ? 'Over 25,000' : 'Plus de 25 000'} {formData.currency}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_job_duration')}
                </Label>
                <Select value={formData.job_duration} onValueChange={(v) => handleSelect('job_duration', v)}>
                  <SelectTrigger className="rounded-xl bg-[#faf8f5] text-base sm:text-sm"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Moins de 6 mois">{lang === 'en' ? 'Less than 6 months' : 'Moins de 6 mois'}</SelectItem>
                    <SelectItem value="1 à 2 ans">{lang === 'en' ? '1 to 2 years' : '1 à 2 ans'}</SelectItem>
                    <SelectItem value="3 ans">{lang === 'en' ? '3 years' : '3 ans'}</SelectItem>
                    <SelectItem value="5 ans">{lang === 'en' ? '5 years' : '5 ans'}</SelectItem>
                    <SelectItem value="Plus de 10 ans">{lang === 'en' ? 'More than 10 years' : 'Plus de 10 ans'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 4. Justificatifs légaux obligatoires (Boutons cliquables déclenchant directement l'explorateur de fichiers) */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#eee8dd] shadow-xs space-y-6">
            <div>
              <h2 className="font-heading font-serif text-lg sm:text-xl font-bold text-[#1a1a1a]">
                {t('oa_sec4_title')}
              </h2>
              <p className="text-xs text-[#8a857e] mt-1">
                {t('oa_sec4_sub')}
              </p>
            </div>

            <div className="space-y-4">
              {/* Document 1: Pièce d'identité */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragOverId(true); }}
                onDragLeave={() => setDragOverId(false)}
                onDrop={(e) => handleDrop(e, 'id_document')}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                  uploadedDocs.id_document
                    ? 'bg-emerald-50/50 border-emerald-300'
                    : dragOverId
                    ? 'bg-blue-50 border-[#0f2b5c]'
                    : 'bg-[#faf8f5] border-[#eee8dd] hover:border-[#0f2b5c]/50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      uploadedDocs.id_document 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-white text-[#0f2b5c] border border-[#eee8dd]'
                    }`}>
                      {uploadedDocs.id_document ? <FileCheck className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#1a1a1a]">
                          {t('oa_doc1_title')}
                        </span>
                        {uploadedDocs.id_document && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> {t('oa_doc_ready')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8a857e] mt-0.5">
                        {t('oa_doc1_desc')}
                      </p>

                      {uploadedDocs.id_document && (
                        <div className="mt-2 flex items-center gap-2 text-xs font-mono text-emerald-800 bg-emerald-100/60 py-1 px-2.5 rounded-lg w-fit">
                          <span className="truncate max-w-[180px] sm:max-w-xs">{uploadedDocs.id_document.name}</span>
                          <span>•</span>
                          <span>{uploadedDocs.id_document.size}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    {uploadedDocs.id_document ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => idInputRef.current?.click()}
                          className="h-9 px-3 rounded-xl text-xs gap-1.5 border-slate-300"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{t('oa_replace')}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDoc('id_document')}
                          className="h-9 px-2 text-red-600 hover:bg-red-50 rounded-xl text-xs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => idInputRef.current?.click()}
                        className="h-10 px-4 sm:px-5 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs font-semibold gap-2 shadow-xs transition-all"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>{t('oa_upload_doc')}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Document 2: Justificatif de domicile */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragOverProof(true); }}
                onDragLeave={() => setDragOverProof(false)}
                onDrop={(e) => handleDrop(e, 'proof_of_address')}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                  uploadedDocs.proof_of_address
                    ? 'bg-emerald-50/50 border-emerald-300'
                    : dragOverProof
                    ? 'bg-blue-50 border-[#0f2b5c]'
                    : 'bg-[#faf8f5] border-[#eee8dd] hover:border-[#0f2b5c]/50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      uploadedDocs.proof_of_address 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-white text-[#0f2b5c] border border-[#eee8dd]'
                    }`}>
                      {uploadedDocs.proof_of_address ? <FileCheck className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#1a1a1a]">
                          {t('oa_doc2_title')}
                        </span>
                        {uploadedDocs.proof_of_address && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> {t('oa_doc_ready')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8a857e] mt-0.5">
                        {t('oa_doc2_desc')}
                      </p>

                      {uploadedDocs.proof_of_address && (
                        <div className="mt-2 flex items-center gap-2 text-xs font-mono text-emerald-800 bg-emerald-100/60 py-1 px-2.5 rounded-lg w-fit">
                          <span className="truncate max-w-[180px] sm:max-w-xs">{uploadedDocs.proof_of_address.name}</span>
                          <span>•</span>
                          <span>{uploadedDocs.proof_of_address.size}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    {uploadedDocs.proof_of_address ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => proofInputRef.current?.click()}
                          className="h-9 px-3 rounded-xl text-xs gap-1.5 border-slate-300"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{t('oa_replace')}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDoc('proof_of_address')}
                          className="h-9 px-2 text-red-600 hover:bg-red-50 rounded-xl text-xs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => proofInputRef.current?.click()}
                        className="h-10 px-4 sm:px-5 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs font-semibold gap-2 shadow-xs transition-all"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>{t('oa_upload_doc')}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Accès sécurisés */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#eee8dd] shadow-xs space-y-6">
            <h2 className="font-heading font-serif text-lg sm:text-xl font-bold text-[#1a1a1a]">
              {t('oa_sec5_title')}
            </h2>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                  {t('oa_set_password')}
                </Label>
                {formData.portal_password && (
                  <span className="text-[11px] text-emerald-600 font-medium">Mot de passe renseigné</span>
                )}
              </div>
              <div className="relative">
                <Input 
                  name="portal_password" 
                  type={showPassword ? 'text' : 'password'} 
                  value={formData.portal_password} 
                  onChange={handleChange} 
                  required
                  placeholder="8 caractères minimum"
                  className="rounded-xl bg-[#faf8f5] pr-10 text-base sm:text-sm" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a857e]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl bg-[#faf8f5] border border-[#eee8dd] text-center space-y-4">
              <p className="text-[11px] uppercase font-bold tracking-wider text-[#0f2b5c]">
                {t('oa_set_pin')}
              </p>
              <div className="flex justify-center">
                <PinInput
                  length={6}
                  value={formData.pin}
                  onChange={(newPin) => setFormData(prev => ({ ...prev, pin: newPin }))}
                  mask
                  autoFocus={false}
                />
              </div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a857e]">
                {t('oa_pin_confidential')}
              </p>
            </div>
          </div>

          {/* 6. Consentements */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#eee8dd] shadow-xs space-y-4">
            <h2 className="font-heading font-serif text-lg sm:text-xl font-bold text-[#1a1a1a] mb-4">
              {t('oa_sec6_title')}
            </h2>
            
            {/* 1. Politique de confidentialité */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center pt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  name="privacy_accepted" 
                  checked={formData.privacy_accepted || formData.consent_1} 
                  onChange={handleConsentChange} 
                  className="peer sr-only" 
                />
                <div className="w-5 h-5 rounded-md border border-[#d2cec5] peer-checked:bg-[#0f2b5c] peer-checked:border-[#0f2b5c] flex items-center justify-center transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
                </div>
              </div>
              <span className="text-xs text-[#666] leading-relaxed group-hover:text-[#1a1a1a] transition-colors">
                {t('oa_consent_privacy')}
              </span>
            </label>

            {/* 2. Charte de sécurité bancaire */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center pt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  name="security_charter_accepted" 
                  checked={formData.security_charter_accepted || formData.consent_2} 
                  onChange={handleConsentChange} 
                  className="peer sr-only" 
                />
                <div className="w-5 h-5 rounded-md border border-[#d2cec5] peer-checked:bg-[#0f2b5c] peer-checked:border-[#0f2b5c] flex items-center justify-center transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
                </div>
              </div>
              <span className="text-xs text-[#666] leading-relaxed group-hover:text-[#1a1a1a] transition-colors">
                {t('oa_consent_security')}
              </span>
            </label>

            {/* 3. Certification sur l'honneur de l'exactitude */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center pt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  name="accuracy_certified" 
                  checked={formData.accuracy_certified || formData.consent_3} 
                  onChange={handleConsentChange} 
                  className="peer sr-only" 
                />
                <div className="w-5 h-5 rounded-md border border-[#d2cec5] peer-checked:bg-[#0f2b5c] peer-checked:border-[#0f2b5c] flex items-center justify-center transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
                </div>
              </div>
              <span className="text-xs text-[#666] leading-relaxed group-hover:text-[#1a1a1a] transition-colors">
                {t('oa_consent_accuracy')}
              </span>
            </label>

            {/* 4. Majorité légale 18+ */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center pt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  name="age_confirmed" 
                  checked={formData.age_confirmed || formData.consent_3} 
                  onChange={handleConsentChange} 
                  className="peer sr-only" 
                />
                <div className="w-5 h-5 rounded-md border border-[#d2cec5] peer-checked:bg-[#0f2b5c] peer-checked:border-[#0f2b5c] flex items-center justify-center transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
                </div>
              </div>
              <span className="text-xs text-[#666] leading-relaxed group-hover:text-[#1a1a1a] transition-colors">
                {t('oa_consent_age')}
              </span>
            </label>
          </div>

          {/* Submission Button */}
          <Button 
            type="submit" 
            disabled={loading} 
            className="w-full h-14 rounded-2xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white font-semibold text-sm gap-2 shadow-sm transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('oa_submitting')}</span>
              </>
            ) : (
              <>
                <span>{t('oa_submit_btn')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
        </>
        )}
      </div>
    </div>
  );
}
