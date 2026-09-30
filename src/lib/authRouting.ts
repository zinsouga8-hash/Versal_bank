import { supabase, isSupabaseConfigured } from './supabase';
import { SUPER_ADMINS, AuthUser } from './AuthContext';
import { toast } from 'sonner';
import { notifySecurityAlert } from './emailService';
import { getClientProfileByEmailOrId } from './supabaseBankService';

/**
 * Executes Google sign-in via Supabase OAuth
 */
export async function executeGoogleAuth(redirectToPath?: string): Promise<any> {
  if (!isSupabaseConfigured) {
    toast.info("Mode local : Authentification simulation.");
    return null;
  }
  try {
    sessionStorage.setItem('versalbank_google_auth', 'true');
    const redirectUrl = redirectToPath 
      ? `${window.location.origin}${redirectToPath}`
      : `${window.location.origin}/ouverture-de-compte`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        },
      },
    });
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.warn("Supabase Google Auth note:", error?.message);
    toast.error("Erreur de connexion Google. Veuillez utiliser vos identifiants par courriel.");
    return null;
  }
}

/**
 * Routes user to their appropriate destination based on their profile and admin rights:
 * - Super-Administrators / Admins -> /administration
 * - Approved clients -> /portail (PIN gate)
 * - Pending application clients -> /dossier-en-cours
 * - New clients -> /ouverture-de-compte
 */
export async function routeUserAfterLogin(user: AuthUser | any, navigate: (path: string) => void) {
  if (!user || !user.email) {
    navigate('/login');
    return;
  }

  const emailNorm = user.email.trim().toLowerCase();
  const isAdminEmail = emailNorm === 'contact@versalbank.com';

  // 1. Check if user is the official Admin
  if (isAdminEmail) {
    sessionStorage.setItem('versalbank_pin_unlocked', 'true');
    toast.success(`Bienvenue, Direction VersalBank`);
    navigate('/administration');
    return;
  }

  // 2. Client account routing via Supabase bank service (never admin)
  try {
    const clientAccount = await getClientProfileByEmailOrId(emailNorm);

    if (clientAccount) {
      if (clientAccount.status === 'approved') {
        notifySecurityAlert({
          user_email: emailNorm,
          first_name: clientAccount.first_name || user.displayName || 'Client',
          alert_type: 'new_device',
          device_name: typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile') ? 'Appareil Mobile' : 'Poste Fixe / Navigateur',
          language: clientAccount.language || 'fr',
        }).catch((err) => console.warn('Login security alert notice:', err));

        toast.success(`Ravi de vous revoir, ${clientAccount.first_name || user.displayName || 'Client'}`);
        navigate('/portail');
      } else {
        // Check if the client has actually filled and submitted the official account opening form
        const hasCompletedApplication = Boolean(
          (clientAccount.terms_accepted === true || clientAccount.form_completed === true) && 
          (clientAccount.first_name || clientAccount.last_name || clientAccount.account_number)
        );

        if (hasCompletedApplication) {
          toast.info("Votre dossier d'ouverture de compte est en cours d'analyse.");
          navigate('/dossier-en-cours');
        } else {
          toast.info("Veuillez compléter votre formulaire officiel d'adhésion.");
          navigate('/ouverture-de-compte');
        }
      }
      return;
    }
  } catch (err) {
    console.error("Error checking client account:", err);
  }

  // 3. New account needing profile creation
  toast.success("Compte vérifié. Veuillez finaliser votre dossier d'ouverture.");
  navigate('/ouverture-de-compte');
}
