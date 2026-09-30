import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { AdminRecord } from '../types';
import { toast } from 'sonner';

export interface AuthUser {
  id: string;
  uid: string;
  email?: string;
  displayName?: string;
  user_metadata?: Record<string, any>;
  providerData?: any[];
}

export interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminRole: 'superadmin' | 'admin' | 'moderator' | null;
  loading: boolean;
  grantAdmin: (email: string, role?: 'admin' | 'moderator', notes?: string) => Promise<boolean>;
  revokeAdmin: (email: string) => Promise<boolean>;
  listAdmins: () => Promise<AdminRecord[]>;
  checkIsAdmin: (email: string) => Promise<boolean>;
  refreshAdminStatus: () => Promise<boolean>;
  setCustomUser: (user: any) => void;
  logout: () => Promise<void>;
}

export const SUPER_ADMINS = ['contact@versalpac.com', 'contact@versalbank.com', 'zinsouga8@gmail.com'];

// Administrator privilege management directly synchronized with Supabase 'profiles'

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isSuperAdmin: false,
  adminRole: null,
  loading: true,
  grantAdmin: async () => false,
  revokeAdmin: async () => false,
  listAdmins: async () => [],
  checkIsAdmin: async () => false,
  refreshAdminStatus: async () => false,
  setCustomUser: () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<'superadmin' | 'admin' | 'moderator' | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Verification helper for any email directly in Supabase profiles
  const checkIsAdmin = async (targetEmail: string): Promise<boolean> => {
    if (!targetEmail) return false;
    const emailNorm = targetEmail.trim().toLowerCase();
    if (SUPER_ADMINS.includes(emailNorm)) return true;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, is_admin')
          .eq('email', emailNorm)
          .maybeSingle();

        if (!error && data && (data.is_admin === true || data.role === 'admin' || data.role === 'superadmin')) {
          return true;
        }
      } catch (err) {
        console.warn('Note checking admin status for', emailNorm, err);
      }
    }
    return false;
  };

  // Grant administrator privileges directly in Supabase table 'profiles'
  const grantAdmin = async (
    targetEmail: string, 
    role: 'admin' | 'moderator' = 'admin', 
    notes: string = ''
  ): Promise<boolean> => {
    if (!targetEmail || !targetEmail.includes('@')) {
      toast.error("Veuillez saisir une adresse courriel valide.");
      return false;
    }

    const emailNorm = targetEmail.trim().toLowerCase();

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            email: emailNorm,
            client_id: `VSL-ADM-${Math.floor(1000 + Math.random() * 9000)}`,
            role: role,
            is_admin: true,
            admin_note: notes.trim() || undefined,
            updated_at: new Date().toISOString()
          }, { onConflict: 'email' });

        if (error) {
          console.error("Erreur d'attribution du rôle admin dans Supabase:", error);
          toast.error(`Erreur Supabase ${error.code || ''}: ${error.message}`);
          return false;
        }
      }

      toast.success(`Le rôle ${role.toUpperCase()} a été accordé directement dans Supabase pour ${emailNorm}`);
      return true;
    } catch (e: any) {
      console.error("Grant admin error:", e);
      toast.error("Échec lors de l'enregistrement de l'administrateur.");
      return false;
    }
  };

  // Revoke administrator privileges directly in Supabase table 'profiles'
  const revokeAdmin = async (targetEmail: string): Promise<boolean> => {
    const emailNorm = targetEmail.trim().toLowerCase();
    if (SUPER_ADMINS.includes(emailNorm)) {
      toast.error("Impossible de révoquer un Super-Administrateur racine.");
      return false;
    }

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('profiles')
          .update({
            role: 'client',
            is_admin: false,
            updated_at: new Date().toISOString()
          })
          .eq('email', emailNorm);

        if (error) {
          toast.error(`Erreur Supabase: ${error.message}`);
          return false;
        }
      }

      toast.success(`Droits révoqués dans Supabase pour ${emailNorm}`);
      return true;
    } catch (e: any) {
      toast.error("Échec lors de la révocation.");
      return false;
    }
  };

  // List administrators directly from Supabase 'profiles' table
  const listAdmins = async (): Promise<AdminRecord[]> => {
    const adminMap = new Map<string, AdminRecord>();

    // Super Admins
    SUPER_ADMINS.forEach(email => {
      adminMap.set(email.toLowerCase(), {
        email: email.toLowerCase(),
        role: 'superadmin',
        addedAt: 1704067200000,
        addedBy: 'Architecture VersalBank',
        notes: "Super-Administrateur d'origine",
      });
    });

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email, role, is_admin, created_at, full_name, admin_note')
          .or('is_admin.eq.true,role.eq.admin,role.eq.superadmin,role.eq.moderator');

        if (!error && Array.isArray(data)) {
          data.forEach(d => {
            if (d.email && !adminMap.has(d.email.toLowerCase())) {
              adminMap.set(d.email.toLowerCase(), {
                email: d.email.toLowerCase(),
                role: d.role || 'admin',
                addedAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
                addedBy: 'Base de données Supabase',
                notes: d.admin_note || undefined,
              });
            }
          });
        }
      } catch (err) {
        console.warn('Error listing admins from Supabase:', err);
      }
    }

    return Array.from(adminMap.values()).sort((a, b) => {
      if (a.role === 'superadmin') return -1;
      if (b.role === 'superadmin') return 1;
      return b.addedAt - a.addedAt;
    });
  };

  // Force-refresh current user admin status directly from Supabase
  const refreshAdminStatus = async (): Promise<boolean> => {
    if (!user?.email) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setAdminRole(null);
      return false;
    }

    const emailNorm = user.email.trim().toLowerCase();
    const isSuper = SUPER_ADMINS.includes(emailNorm);
    setIsSuperAdmin(isSuper);

    if (isSuper) {
      setIsAdmin(true);
      setAdminRole('superadmin');
      return true;
    }

    const hasAdminRight = await checkIsAdmin(emailNorm);
    setIsAdmin(hasAdminRight);
    setAdminRole(hasAdminRight ? 'admin' : null);
    return hasAdminRight;
  };

  useEffect(() => {
    let mounted = true;

    // Direct database validation on startup: No reliance on localStorage
    const initAuth = async () => {
      try {
        // 1. Check Supabase Auth Session
        if (isSupabaseConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && mounted) {
            const cleanEmail = (session.user.email || '').trim().toLowerCase();
            
            // Query Supabase profiles table directly for live record
            const { data: prof } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', cleanEmail)
              .maybeSingle();

            const isSuper = SUPER_ADMINS.includes(cleanEmail);
            const isAdm = isSuper || (prof?.is_admin === true) || (prof?.role === 'admin') || (prof?.role === 'superadmin');

            const formattedUser: AuthUser = {
              id: session.user.id,
              uid: session.user.id,
              email: cleanEmail,
              displayName: prof?.full_name || session.user.user_metadata?.full_name || cleanEmail.split('@')[0],
              user_metadata: session.user.user_metadata,
              providerData: [{ providerId: 'supabase' }],
            };

            setUser(formattedUser);
            setIsSuperAdmin(isSuper);
            setIsAdmin(isAdm);
            setAdminRole(isSuper ? 'superadmin' : (isAdm ? 'admin' : null));
            setLoading(false);
            return;
          }
        }

        // 2. Check tab session identifier and verify DIRECTLY with Supabase profiles table
        const sessionEmail = sessionStorage.getItem('versalbank_active_email');
        if (sessionEmail && mounted && isSupabaseConfigured) {
          const cleanEmail = sessionEmail.trim().toLowerCase();
          const { data: prof, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`email.ilike.${cleanEmail},client_id.eq.${sessionEmail},account_number.eq.${sessionEmail}`)
            .maybeSingle();

          if (!error && prof) {
            const userEmail = (prof.email || cleanEmail).toLowerCase();
            const isSuper = SUPER_ADMINS.includes(userEmail);
            const isAdm = isSuper || (prof.is_admin === true) || (prof.role === 'admin') || (prof.role === 'superadmin');

            const formattedUser: AuthUser = {
              id: prof.id || 'usr_' + userEmail,
              uid: prof.id || 'usr_' + userEmail,
              email: userEmail,
              displayName: prof.full_name || `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || userEmail.split('@')[0],
              providerData: [{ providerId: 'portal' }],
            };

            setUser(formattedUser);
            setIsSuperAdmin(isSuper);
            setIsAdmin(isAdm);
            setAdminRole(isSuper ? 'superadmin' : (isAdm ? 'admin' : null));
            setLoading(false);
            return;
          } else {
            // Profile does not exist in Supabase! Clear stale session
            sessionStorage.removeItem('versalbank_active_email');
          }
        }
      } catch (e) {
        console.warn('Direct Supabase auth initialization note:', e);
      }

      if (mounted) {
        setUser(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminRole(null);
        setLoading(false);
      }
    };

    initAuth();

    // Listen to Supabase Auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.user) {
        const cleanEmail = (session.user.email || '').trim().toLowerCase();
        const isSuper = SUPER_ADMINS.includes(cleanEmail);
        const adm = await checkIsAdmin(cleanEmail);

        const formattedUser: AuthUser = {
          id: session.user.id,
          uid: session.user.id,
          email: cleanEmail,
          displayName: session.user.user_metadata?.full_name || cleanEmail.split('@')[0],
          user_metadata: session.user.user_metadata,
          providerData: [{ providerId: 'supabase' }],
        };

        setUser(formattedUser);
        setIsSuperAdmin(isSuper);
        setIsAdmin(adm || isSuper);
        setAdminRole(isSuper ? 'superadmin' : (adm ? 'admin' : null));
      } else if (event === 'SIGNED_OUT') {
        const activeEmail = sessionStorage.getItem('versalbank_active_email');
        if (!activeEmail) {
          setUser(null);
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setAdminRole(null);
        }
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const setCustomUser = (customUser: any) => {
    if (customUser) {
      const cleanEmail = (customUser.email || '').trim().toLowerCase();
      // Store identifier only in current tab session memory, never in permanent localStorage
      if (cleanEmail) {
        sessionStorage.setItem('versalbank_active_email', cleanEmail);
      }
      const formattedUser: AuthUser = {
        id: customUser.uid || customUser.id || 'custom_' + cleanEmail,
        uid: customUser.uid || customUser.id || 'custom_' + cleanEmail,
        email: cleanEmail,
        displayName: customUser.displayName || cleanEmail.split('@')[0],
        user_metadata: customUser.user_metadata,
        providerData: customUser.providerData || [{ providerId: 'custom' }],
      };
      setUser(formattedUser);

      if (cleanEmail) {
        const isSuper = SUPER_ADMINS.includes(cleanEmail);
        setIsSuperAdmin(isSuper);
        checkIsAdmin(cleanEmail).then((adm) => {
          setIsAdmin(adm || isSuper);
          setAdminRole(isSuper ? 'superadmin' : (adm ? 'admin' : null));
        });
      }
    } else {
      sessionStorage.removeItem('versalbank_active_email');
      setUser(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setAdminRole(null);
    }
  };

  const logout = async () => {
    sessionStorage.removeItem('versalbank_active_email');
    sessionStorage.removeItem('versalbank_pin_unlocked');
    sessionStorage.removeItem('versalbank_pending_otp');
    localStorage.removeItem('versalbank_custom_user');
    localStorage.removeItem('versalbank_admins_registry');
    localStorage.removeItem('versalbank_pin_unlocked_time');

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Supabase signOut error:", e);
    }

    setUser(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setAdminRole(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isSuperAdmin,
        adminRole,
        loading,
        grantAdmin,
        revokeAdmin,
        listAdmins,
        checkIsAdmin,
        refreshAdminStatus,
        setCustomUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
