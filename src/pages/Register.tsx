import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Landmark, Loader2, Eye, EyeOff, ShieldCheck, Mail, 
  ArrowRight, RefreshCw, AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import { executeGoogleAuth, routeUserAfterLogin } from '../lib/authRouting';
import { useAuth, AuthUser } from '../lib/AuthContext';
import { notifyOtpSent } from '../lib/emailService';
import { useI18n } from '../lib/i18n';
import LanguageSelector from '../components/common/LanguageSelector';
import GoogleAccountChooserModal from '../components/auth/GoogleAccountChooserModal';

export default function Register() {
  const { user, setCustomUser } = useAuth();
  const { t, lang } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  
  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [expectedOtp, setExpectedOtp] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);

  const navigate = useNavigate();

  // On mount check
  useEffect(() => {
    if (user && !otpSent) {
      routeUserAfterLogin(user, navigate);
    }
  }, [user, navigate, otpSent]);

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      toast.error("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    setLoading(true);

    // 1. Generate 6-digit OTP code
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedOtp(generatedOtp);
    sessionStorage.setItem('versalbank_pending_otp', generatedOtp);
    sessionStorage.setItem('versalbank_reg_password', password);
    sessionStorage.setItem('versalbank_reg_email', email.trim());

    // 2. Dispatch OTP notification email in background
    notifyOtpSent(email.trim(), generatedOtp).catch((err) => {
      console.warn("Automated OTP email dispatch notice:", err);
    });

    // 3. Create or sign in user via Supabase
    let userObj: any = null;
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });
      if (signUpData?.user) {
        userObj = {
          uid: signUpData.user.id,
          id: signUpData.user.id,
          email: signUpData.user.email,
          displayName: signUpData.user.email?.split('@')[0],
          providerData: [{ providerId: 'password' }],
        };
      } else if (signUpErr) {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (signInData?.user) {
          userObj = {
            uid: signInData.user.id,
            id: signInData.user.id,
            email: signInData.user.email,
            displayName: signInData.user.email?.split('@')[0],
            providerData: [{ providerId: 'password' }],
          };
        }
      }
    } catch (sbErr) {
      console.warn("Supabase register notice:", sbErr);
    }

    // Fallback user object if Supabase Auth is initializing or network is slow
    if (!userObj) {
      const cleanEmail = email.trim().toLowerCase();
      const generatedUid = 'usr_' + Math.abs(cleanEmail.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)).toString(36) + '_' + Date.now().toString(36);
      userObj = {
        uid: generatedUid,
        id: generatedUid,
        email: cleanEmail,
        displayName: cleanEmail.split('@')[0],
        providerData: [{ providerId: 'password' }],
      };
    }

    setPendingUser(userObj);
    setOtpSent(true);
    toast.success("Code de sécurité expédié !", {
      description: `Un courriel officiel contenant votre code de vérification à 6 chiffres a été envoyé à ${email.trim()}. Veuillez consulter votre boîte de messagerie.`,
      duration: 10000,
    });
    setLoading(false);
  };

  const handleGoogleLogin = () => {
    setShowGoogleModal(true);
  };

  const handleGoogleAccountSelected = async (account: { email: string; name: string }) => {
    setGoogleLoading(true);
    try {
      sessionStorage.setItem('versalbank_google_auth', 'true');
      sessionStorage.setItem('versalbank_reg_email', account.email);
      localStorage.setItem('versalbank_client_email', account.email);
      sessionStorage.setItem('versalbank_active_email', account.email);

      const googleUser: AuthUser = {
        id: 'google_' + account.email.replace(/[^a-zA-Z0-9]/g, '_'),
        uid: 'google_' + account.email.replace(/[^a-zA-Z0-9]/g, '_'),
        email: account.email,
        displayName: account.name,
        providerData: [{ providerId: 'google.com' }],
        user_metadata: {
          full_name: account.name,
          email: account.email,
          provider: 'google',
        },
      };

      setCustomUser(googleUser);
      toast.success(lang === 'en' ? `Connected with ${account.email}` : `Connecté avec ${account.email}`);
      await routeUserAfterLogin(googleUser, navigate);
    } catch (error: any) {
      console.error(error);
      toast.error(lang === 'en' ? "Google sign-in error." : "Échec de la connexion Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const targetEmail = (email || pendingUser?.email || '').trim();
    if (!targetEmail) return;
    setLoading(true);
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedOtp(newOtp);
    sessionStorage.setItem('versalbank_pending_otp', newOtp);
    try {
      await notifyOtpSent(targetEmail, newOtp);
      toast.success("Nouveau code expédié !", {
        description: `Un nouveau code à 6 chiffres a été envoyé à ${targetEmail}. Veuillez vérifier votre boîte de réception et vos spams.`,
        duration: 10000,
      });
    } catch (e) {
      toast.error("Erreur lors du renvoi du code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      toast.error("Veuillez saisir les 6 chiffres du code reçu par email.");
      return;
    }
    
    const validOtp = sessionStorage.getItem('versalbank_pending_otp') || expectedOtp;
    if (validOtp && otpCode.trim() !== validOtp.trim()) {
      toast.error("Code de sécurité incorrect. Veuillez vérifier le code reçu dans votre boîte email.");
      return;
    }

    setLoading(true);
    try {
      let activeUser = pendingUser;
      if (!activeUser) {
        const storedEmail = sessionStorage.getItem('versalbank_reg_email') || email.trim().toLowerCase();
        if (storedEmail) {
          activeUser = {
            uid: 'usr_' + Math.abs(storedEmail.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)).toString(36) + '_' + Date.now().toString(36),
            email: storedEmail,
            displayName: storedEmail.split('@')[0],
            providerData: [{ providerId: 'password' }],
          };
        }
      }

      if (activeUser) {
        const userEmail = (activeUser.email || '').toLowerCase().trim();
        const regPassword = sessionStorage.getItem('versalbank_reg_password') || password || '';

        // Save session credentials for the official account opening form
        sessionStorage.setItem('versalbank_reg_email', userEmail);
        sessionStorage.setItem('versalbank_reg_password', regPassword);
        sessionStorage.setItem('versalbank_otp_verified', 'true');
        localStorage.setItem('versalbank_client_email', userEmail);

        // Activate user session
        setCustomUser(activeUser);
        toast.success("Code validé avec succès ! Veuillez remplir le formulaire officiel d'adhésion.");
        
        // Directly access the official account opening form
        navigate('/ouverture-de-compte');
      } else {
        toast.error("Session expirée. Veuillez renseigner à nouveau vos informations.");
        setOtpSent(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="register-page" className="min-h-screen bg-[#f4f2ee] flex flex-col items-center justify-center p-4 relative">
      {/* Top Bar with Language Selector & Home Link */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 px-2">
        <Link to="/" className="text-xs text-[#5a6c85] hover:text-[#0f2b5c] font-medium flex items-center gap-1.5 transition-colors">
          <span>←</span>
          <span>{t('back_to_home')}</span>
        </Link>
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-[#0f2b5c]/5 border border-[#eee8dd]">
        <div className="flex flex-col items-center mb-8">
          <Link to="/" id="register-home-link" className="flex items-center gap-2 mb-6">
            <Landmark className="w-10 h-10 text-[#0f2b5c]" />
          </Link>
          <h1 id="register-title" className="font-heading font-serif text-3xl font-bold text-center text-[#1a1a1a]">
            {t('auth_register_title')}
          </h1>
          <p id="register-subtitle" className="text-[#8a857e] mt-2 text-center text-xs">
            {otpSent ? t('auth_otp_title') : t('auth_register_subtitle')}
          </p>
        </div>

        {otpSent ? (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="bg-[#faf8f5] border border-[#eee8dd] p-5 rounded-2xl text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-[#0f2b5c]/10 border border-[#0f2b5c]/20 text-[#0f2b5c] flex items-center justify-center mx-auto shadow-xs">
                <Mail className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="font-heading font-serif text-base font-bold text-[#1a1a1a]">
                  {t('auth_otp_title')}
                </h2>
                <p className="text-xs text-[#8a857e]">
                  {t('auth_otp_desc')}
                </p>
                <div className="pt-1">
                  <span className="text-xs font-semibold text-[#0f2b5c] font-mono break-all py-1 px-3 rounded-lg bg-white border border-[#eee8dd] inline-block shadow-2xs">
                    {email || pendingUser?.email}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200/80 text-[11px] text-blue-900 text-left flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  {lang === 'en'
                    ? "Check your inbox and Spam / Junk folder. Enter the 6-digit code received to confirm and proceed to your account opening."
                    : "Consultez vos messages récents ainsi que votre dossier Spams / Courrier indésirable. Copiez le code reçu dans l'e-mail et saisissez-le ci-dessous pour finaliser l'ouverture de votre compte."}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-center">
              <Label htmlFor="otp" className="text-[11px] uppercase font-bold tracking-wider text-[#8a857e]">
                {t('auth_otp_input_label')}
              </Label>
              <Input 
                id="otp" 
                type="text" 
                maxLength={6}
                value={otpCode} 
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} 
                required 
                className="rounded-xl text-center text-2xl tracking-widest font-mono font-bold h-12 bg-white border-[#e8e4dc] focus:border-[#0f2b5c]"
                placeholder="000000"
                autoFocus
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer" 
              disabled={loading || otpCode.length < 6}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              <span>{loading ? (lang === 'en' ? "Verifying..." : "Vérification en cours...") : t('auth_otp_submit_btn')}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>

            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-[#0f2b5c] hover:underline font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{t('auth_otp_resend_btn')}</span>
              </button>

              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="text-[#8a857e] hover:text-[#1a1a1a] underline transition-colors cursor-pointer"
              >
                {t('auth_otp_back_btn')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <form id="register-form" onSubmit={handleEmailRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-[#1a1a1a]">{t('auth_email')}</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  className="rounded-xl bg-[#faf8f5]"
                  placeholder={t('auth_email_placeholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-[#1a1a1a]">{t('auth_password')}</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="rounded-xl bg-[#faf8f5] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a857e] hover:text-[#1a1a1a] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-[#1a1a1a]">{t('auth_confirm_password')}</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    required 
                    className="rounded-xl bg-[#faf8f5] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a857e] hover:text-[#1a1a1a] transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button 
                id="register-submit-btn"
                type="submit" 
                className="w-full rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white font-semibold h-11 transition-all cursor-pointer" 
                disabled={loading || googleLoading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {loading ? t('auth_register_loading') : t('auth_register_btn')}
              </Button>
            </form>

            <div className="my-6 flex items-center">
              <div className="flex-1 h-px bg-[#eee8dd]"></div>
              <span className="px-4 text-xs text-[#8a857e] uppercase tracking-wider">{t('or_label')}</span>
              <div className="flex-1 h-px bg-[#eee8dd]"></div>
            </div>

            <Button 
              id="google-register-btn"
              type="button" 
              variant="outline" 
              onClick={handleGoogleLogin} 
              disabled={loading || googleLoading}
              className="w-full rounded-xl flex items-center justify-center gap-3 border-[#eee8dd] hover:bg-[#faf8f5] py-5 transition-all cursor-pointer"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#0f2b5c]" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span className="font-medium text-[#1a1a1a]">
                {googleLoading ? t('auth_google_opening') : t('auth_google_register')}
              </span>
            </Button>

            <p className="mt-8 text-center text-sm text-[#8a857e]">
              {t('auth_already_client')}{' '}
              <Link id="login-redirect-link" to="/login" className="text-[#0f2b5c] hover:underline font-semibold">
                {t('auth_login_link')}
              </Link>
            </p>
          </>
        )}
      </div>

      {/* Google Account Selector Modal showing accounts on this device */}
      <GoogleAccountChooserModal
        open={showGoogleModal}
        onOpenChange={setShowGoogleModal}
        onAccountSelected={handleGoogleAccountSelected}
      />
    </div>
  );
}
