import { AnimatePresence, motion } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { 
  Users, ArrowLeftRight, CreditCard, Banknote, Percent, 
  UserCog, Landmark, FileText, Mail, ShieldAlert, Settings, 
  LogOut, ArrowLeft, Globe, Shield, ChevronDown, Menu, X, ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';

import AdminClients from '../components/admin/AdminClients';
import AdminMovements from '../components/admin/AdminMovements';
import AdminCards from '../components/admin/AdminCards';
import AdminLoans from '../components/admin/AdminLoans';
import AdminLoanRates from '../components/admin/AdminLoanRates';
import AdminProfileChanges from '../components/admin/AdminProfileChanges';
import AdminChannels from '../components/admin/AdminChannels';
import AdminLoanContract from '../components/admin/AdminLoanContract';
import AdminEmails from '../components/admin/AdminEmails';
import AdminIpSecurity from '../components/admin/AdminIpSecurity';
import AdminSettings from '../components/admin/AdminSettings';

type AdminTab = 
  | 'clients' 
  | 'movements' 
  | 'cards' 
  | 'loans' 
  | 'loan_rates' 
  | 'profile_changes' 
  | 'channels' 
  | 'loan_contract' 
  | 'emails' 
  | 'security_ip' 
  | 'settings';

const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'clients', label: 'Comptes clients', icon: <Users className="w-4 h-4" /> },
  { id: 'movements', label: 'Dépôts & retraits', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { id: 'cards', label: 'Cartes virtuelles', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'loans', label: 'Demandes de prêt', icon: <Banknote className="w-4 h-4" /> },
  { id: 'loan_rates', label: 'Taux de prêt', icon: <Percent className="w-4 h-4" /> },
  { id: 'profile_changes', label: 'Modifications de profil', icon: <UserCog className="w-4 h-4" /> },
  { id: 'channels', label: 'Moyens de paiement', icon: <Landmark className="w-4 h-4" /> },
  { id: 'loan_contract', label: 'Contrat de prêt (IA)', icon: <FileText className="w-4 h-4" /> },
  { id: 'emails', label: 'Historique courriels', icon: <Mail className="w-4 h-4" /> },
  { id: 'security_ip', label: 'Sécurité IP', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'settings', label: 'Identité & paramètres', icon: <Settings className="w-4 h-4" /> },
];

export default function Admin() {
  const { user, isAdmin, isSuperAdmin, adminRole, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('clients');
  // Lazy-load tabs: only mount tabs that the admin has explicitly navigated to
  const [renderedTabs, setRenderedTabs] = useState<Set<AdminTab>>(() => new Set(['clients']));

  const switchTab = (tabId: AdminTab) => {
    setActiveTab(tabId);
    setRenderedTabs(prev => {
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
  };

  if (!isAdmin) return <Navigate to="/portail" />;

  const visibleTabs = TABS.filter(tab => {
    if (adminRole === 'moderator') {
      return tab.id !== 'settings';
    }
    return true;
  });

  const handleLogout = async () => {
    sessionStorage.removeItem('versalbank_pin_unlocked');
    sessionStorage.removeItem('versalbank_pending_otp');
    localStorage.removeItem('versalbank_custom_user');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Signout note:", e);
    }
    await logout();
    window.location.href = '/login';
  };

  const currentTabObj = visibleTabs.find(t => t.id === activeTab) || visibleTabs[0];

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="sm:hidden p-1.5 -ml-1 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0f2b5c]/10 border border-[#0f2b5c]/25 items-center justify-center text-[#0f2b5c] shadow-xs shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-serif font-bold text-base sm:text-lg text-slate-900 leading-none flex items-center gap-1.5 sm:gap-2">
                <span className="truncate">VersalBank</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  isSuperAdmin 
                    ? 'bg-[#0f2b5c]/15 text-[#0f2b5c] border border-[#0f2b5c]/30' 
                    : adminRole === 'moderator' 
                    ? 'bg-blue-100 text-blue-900 border border-blue-200' 
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}>
                  {isSuperAdmin ? 'Super-Admin' : adminRole === 'moderator' ? 'Modérateur' : 'Admin'}
                </span>
              </div>
              <div className="text-[9px] sm:text-[10px] font-semibold tracking-wider sm:tracking-widest text-[#0f2b5c] uppercase leading-none mt-1 truncate">
                CONSOLE ADMINISTRATION
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* User identity (hidden on very small phones) */}
            {user?.email && (
              <span className="hidden lg:inline-flex text-xs text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 truncate max-w-[180px]">
                {user.email}
              </span>
            )}

            {/* Site Public Link */}
            <Button 
              variant="outline" 
              size="sm" 
              asChild 
              className="text-xs h-8 px-2 sm:px-3 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Link to="/">
                <Globe className="w-3.5 h-3.5 sm:mr-1.5" /> 
                <span className="hidden sm:inline">Site public</span>
              </Link>
            </Button>

            {/* Logout button */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout} 
              className="text-xs h-8 px-2 sm:px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 sm:mr-1.5" /> 
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Page Title & Subtitle */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-slate-900 tracking-tight">
            Administration bancaire
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-4xl">
            Validation des dossiers, activation des comptes, codes CAT / COT, monétique, crédits, sécurité IP et paramètres.
          </p>
        </div>


        {/* Horizontal Navigation Bar (Visible on tablet/desktop only) */}
        <div className="hidden sm:block w-full overflow-x-auto no-scrollbar pb-1 pt-1 sm:mx-0 sm:px-0">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 min-w-max p-1.5 bg-slate-200/60 rounded-2xl border border-slate-200/80">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[#0f2b5c] text-white font-semibold shadow-xs'
                      : 'bg-white/80 text-slate-700 hover:bg-white hover:text-slate-900 border border-slate-200/60'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-[#0f2b5c]'}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab View Canvas with 0ms Switching & Preserved DOM */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs min-h-[500px] overflow-hidden p-3 sm:p-6">
          <div style={{ display: activeTab === 'clients' ? 'block' : 'none' }}>
            {renderedTabs.has('clients') && <AdminClients />}
          </div>
          <div style={{ display: activeTab === 'movements' ? 'block' : 'none' }}>
            {renderedTabs.has('movements') && <AdminMovements />}
          </div>
          <div style={{ display: activeTab === 'cards' ? 'block' : 'none' }}>
            {renderedTabs.has('cards') && <AdminCards />}
          </div>
          <div style={{ display: activeTab === 'loans' ? 'block' : 'none' }}>
            {renderedTabs.has('loans') && <AdminLoans />}
          </div>
          <div style={{ display: activeTab === 'loan_rates' ? 'block' : 'none' }}>
            {renderedTabs.has('loan_rates') && <AdminLoanRates />}
          </div>
          <div style={{ display: activeTab === 'profile_changes' ? 'block' : 'none' }}>
            {renderedTabs.has('profile_changes') && <AdminProfileChanges />}
          </div>
          <div style={{ display: activeTab === 'channels' ? 'block' : 'none' }}>
            {renderedTabs.has('channels') && <AdminChannels />}
          </div>
          <div style={{ display: activeTab === 'loan_contract' ? 'block' : 'none' }}>
            {renderedTabs.has('loan_contract') && <AdminLoanContract />}
          </div>
          <div style={{ display: activeTab === 'emails' ? 'block' : 'none' }}>
            {renderedTabs.has('emails') && <AdminEmails />}
          </div>
          <div style={{ display: activeTab === 'security_ip' ? 'block' : 'none' }}>
            {renderedTabs.has('security_ip') && <AdminIpSecurity />}
          </div>
          <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
            {renderedTabs.has('settings') && <AdminSettings />}
          </div>
        </div>
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-0 z-50 flex"
          >
            <div className="w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-y-auto relative z-50">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-8 h-8 text-[#0f2b5c]" />
                  <span className="font-bold text-lg text-[#0f2b5c]">Admin</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>
              <div className="flex-1 p-4 space-y-2">
                <div className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-3 px-2">Navigation Administrateur</div>
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { switchTab(tab.id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${
                      activeTab === tab.id ? 'bg-[#0f2b5c] text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
                
                <div className="h-px bg-slate-200 my-4" />
                <Link to="/" className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 text-sm font-medium text-slate-700">
                  <Globe className="w-5 h-5 text-slate-400" /> Site public
                </Link>
                <Link to="/portail" className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 text-sm font-medium text-slate-700">
                  <UserCog className="w-5 h-5 text-slate-400" /> Portail Client
                </Link>
              </div>
              <div className="p-4 border-t border-slate-200 sticky bottom-0 bg-white">
                <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 text-red-600 font-semibold hover:bg-red-100">
                  <LogOut className="w-4 h-4" /> Déconnexion
                </button>
              </div>
            </div>
            <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </div>
  );
}
