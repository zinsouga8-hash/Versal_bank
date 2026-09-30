import React, { useEffect, useState, useRef } from 'react';
import {  Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import {  useAuth } from '../../lib/AuthContext';
import { 
  LayoutDashboard,
  Send,
  Download,
  CreditCard,
  Banknote,
  User as UserIcon,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Headphones,
  Globe,
  ChevronDown,
  Info,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import {  useI18n } from '../../lib/i18n';
import {  useTheme } from '../../lib/ThemeContext';
import {  motion, AnimatePresence } from 'framer-motion';
import ClientInboxDialog from './ClientInboxDialog';
import ContactSupportModal from './ContactSupportModal';
import BankMonogram from '../public/BankMonogram';
import {  ClientAccount } from '../../types';
import {  getClientProfileByEmailOrId, subscribeToBankData } from '../../lib/supabaseBankService';
import {  supabase } from '../../lib/supabase';

export default function PortalLayout() {
  const { user, loading, isAdmin, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, isDark, toggleTheme } = useTheme();
  const location = useLocation();

  const [account, setAccount] = useState<(ClientAccount & { id: string }) | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check pin unlock
  const isUnlocked = sessionStorage.getItem('versalbank_pin_unlocked') === 'true';

  // Load account from Supabase Banking service
  const loadAccount = async () => {
    if (!user) return;
    const identifier = user.email || user.uid || user.id;
    const client = await getClientProfileByEmailOrId(identifier);
    if (client) {
      setAccount(client);
    }
  };

  useEffect(() => {
    loadAccount();
    const unsub = subscribeToBankData(() => {
      loadAccount();
    });
    return () => unsub();
  }, [user]);

  // Click outside to close user dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setUserMenuOpen(false);
  }, [location.pathname]);

  if (!loading && isAdmin) {
    return <Navigate to="/administration" />;
  }

  if (!isUnlocked) {
    return <Navigate to="/portail" />;
  }

  const navItems = [
    { path: '/espace/tableau-de-bord', label: t('nav_dashboard'), icon: LayoutDashboard },
    { path: '/espace/virement', label: t('nav_transfer'), icon: Send },
    { path: '/espace/approvisionnement', label: t('nav_funding'), icon: Download },
    { path: '/espace/cartes', label: t('nav_cards'), icon: CreditCard },
    { path: '/espace/financement', label: t('nav_financing'), icon: Banknote },
  ];

  const initials = account
    ? `${account.first_name?.[0] || ''}${account.last_name?.[0] || ''}`.toUpperCase()
    : (user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'VB');
  const fullName = account
    ? `${account.first_name || ''} ${account.last_name || ''}`.trim()
    : user?.displayName || 'Client Privé';
  const clientId = account?.client_id || 'VSL-2026-837300';

  const handleLogout = async () => {
    sessionStorage.removeItem('versalbank_pin_unlocked');
    sessionStorage.removeItem('versalbank_pending_otp');
    localStorage.removeItem('versalbank_custom_user');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    await logout();
    window.location.href = '/portail';
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col font-sans text-[#1a1a1a]">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#eee8dd] shadow-xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-[#0f2b5c] hover:bg-[#faf7f0] rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          {/* Brand Logo & Name */}
          <Link to="/espace/tableau-de-bord" className="flex items-center gap-2 sm:gap-3 shrink-0">
            <BankMonogram className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-heading font-serif font-bold text-lg sm:text-xl tracking-tight text-[#1a1a1a] whitespace-nowrap">
                  VersalBank
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  FINTRAC
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.18em] font-semibold text-[#0f2b5c] whitespace-nowrap">
                {lang === 'en' ? 'Canadian Bank' : 'Banque Canadienne'}
              </p>
            </div>
          </Link>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Service Client Button (Desktop only) */}
            <a
              href="mailto:contact@versalbank.com"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border border-[#0f2b5c] text-[#0f2b5c] hover:bg-[#0f2b5c]/5 text-[11px] sm:text-xs font-semibold tracking-wide transition-colors cursor-pointer"
              title={lang === 'en' ? 'Contact customer service: contact@versalbank.com' : 'Contacter le service client : contact@versalbank.com'}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{lang === 'en' ? 'CUSTOMER SERVICE' : 'SERVICE CLIENT'}</span>
            </a>

            {/* Client Inbox Notifications (Bell) */}
            <ClientInboxDialog />

            {/* User Avatar Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 sm:gap-2 p-1 sm:px-2.5 sm:py-1 rounded-full hover:bg-[#faf7f0] border border-transparent hover:border-[#eee8dd] transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#0f2b5c] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {initials}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-semibold text-[#1a1a1a] leading-tight truncate max-w-[120px]">
                    {fullName}
                  </p>
                  <p className="text-[10px] font-mono text-[#8a857e] leading-tight truncate">
                    {clientId}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#8a857e]" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#eee8dd] p-2 z-50 overflow-hidden"
                  >
                    <div className="p-3 bg-[#faf7f0] rounded-xl mb-1 border border-[#eee8dd]/60">
                      <p className="text-[11px] font-semibold text-[#8a857e] uppercase tracking-wider">
                        {lang === 'en' ? 'Certified Account' : 'Compte Certifié'}
                      </p>
                      <p className="text-xs font-medium text-[#1a1a1a] truncate mt-0.5">
                        {user?.email}
                      </p>
                      <p className="text-[10px] font-mono text-[#0f2b5c] font-semibold mt-0.5">
                        {clientId}
                      </p>
                    </div>

                    <Link
                      to="/espace/profil"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#444] hover:bg-[#faf7f0] hover:text-[#0f2b5c] transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-[#8a857e]" />
                      {lang === 'en' ? 'My Profile' : 'Mon Profil'}
                    </Link>

                    <Link
                      to="/espace/a-propos"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#444] hover:bg-[#faf7f0] hover:text-[#0f2b5c] transition-colors"
                    >
                      <Info className="w-4 h-4 text-[#8a857e]" />
                      {lang === 'en' ? 'About Institution' : "À propos de l'institution"}
                    </Link>

                    <a
                      href="mailto:contact@versalbank.com"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#444] hover:bg-[#faf7f0] hover:text-[#0f2b5c] transition-colors text-left cursor-pointer"
                    >
                      <Headphones className="w-4 h-4 text-[#8a857e]" />
                      {lang === 'en' ? 'Customer Support' : 'Service Client'}
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        toggleTheme();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-[#444] hover:bg-[#faf7f0] hover:text-[#0f2b5c] transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#0f2b5c]" />}
                        <span>{lang === 'en' ? 'Theme:' : 'Thème :'} {isDark ? (lang === 'en' ? 'Dark' : 'Sombre') : (lang === 'en' ? 'Light' : 'Clair')}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600">
                        {lang === 'en' ? '1 click' : '1 clic'}
                      </span>
                    </button>

                    {isAdmin && (
                      <Link
                        to="/administration"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#0f2b5c] bg-[#0f2b5c]/5 hover:bg-[#0f2b5c]/10 transition-colors"
                      >
                        <ShieldAlert className="w-4 h-4 text-[#0f2b5c]" />
                        {lang === 'en' ? 'Admin Console' : 'Console Administration'}
                      </Link>
                    )}

                    <div className="h-px bg-[#eee8dd] my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      {t('nav_logout')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile Sub-Row: Service Client */}
        <div className="sm:hidden border-t border-[#eee8dd] bg-[#faf8f5] px-3 py-1.5 flex items-center justify-end gap-2">
          <a
            href="mailto:contact@versalbank.com"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0f2b5c] text-[#0f2b5c] bg-white text-[10px] font-bold tracking-wide shadow-2xs cursor-pointer hover:bg-[#0f2b5c]/5 transition-colors"
            title={lang === 'en' ? 'Contact customer service: contact@versalbank.com' : 'Contacter le service client : contact@versalbank.com'}
          >
            <Headphones className="w-3 h-3 text-[#0f2b5c]" />
            <span>{lang === 'en' ? 'CUSTOMER SERVICE' : 'SERVICE CLIENT'}</span>
          </a>
        </div>
      </header>

      {/* Main Content Area: Centered, fits screen without zooming */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Docked Bottom Navigation Bar (Visible on ALL devices: Mobile, Tablet & Desktop - Exactly 5 items) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e2dcce] shadow-[0_-4px_25px_rgba(0,0,0,0.06)] pb-safe">
        <div className="max-w-xl sm:max-w-2xl mx-auto px-1 sm:px-4 py-2 grid grid-cols-5 gap-0">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all overflow-hidden ${
                  isActive
                    ? 'text-[#0f2b5c] font-bold'
                    : 'text-[#666] hover:text-[#0f2b5c] font-medium'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive ? 'bg-[#0f2b5c] text-white shadow-xs scale-105' : 'bg-transparent text-[#666]'
                  }`}
                >
                  <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[9px] sm:text-[11px] mt-1 w-full text-center truncate px-0.5">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Support Client Modal */}
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
              <div className="p-4 border-b border-[#eee8dd] flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
                <div className="flex items-center gap-2">
                  <BankMonogram className="w-8 h-8" />
                  <span className="font-serif font-bold text-lg text-[#0f2b5c]">VersalBank</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {/* 1-Click Global Theme Toggle Button in Hamburger Menu */}
              <div className="px-4 pt-3 pb-1 space-y-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  id="client-hamburger-theme-toggle"
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#faf7f0] border border-[#eee8dd] hover:border-[#0f2b5c]/40 shadow-xs cursor-pointer group transition-all"
                  title="Changer le thème en un clic"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-all ${
                      isDark ? 'bg-amber-400/20 text-amber-400' : 'bg-[#0f2b5c]/10 text-[#0f2b5c]'
                    }`}>
                      {isDark ? <Sun className="w-5 h-5 animate-spin-slow" /> : <Moon className="w-5 h-5" />}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider">
                          {lang === 'en' ? 'THEME' : 'THÈME'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDark 
                            ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50' 
                            : 'bg-blue-50 text-[#0f2b5c] border border-blue-200/60'
                        }`}>
                          {isDark ? (lang === 'en' ? 'DARK' : 'SOMBRE') : (lang === 'en' ? 'LIGHT' : 'CLAIR')}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8a857e] mt-0.5">
                        {isDark 
                          ? (lang === 'en' ? 'Click to switch to light mode' : 'Cliquer pour passer en mode clair')
                          : (lang === 'en' ? 'Click to switch to dark mode' : 'Cliquer pour passer en mode sombre')
                        }
                      </p>
                    </div>
                  </div>

                  {/* Visual switch toggle */}
                  <div className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                    isDark ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}>
                    <div className="w-5 h-5 rounded-full bg-white shadow-xs flex items-center justify-center">
                      {isDark ? <Moon className="w-3 h-3 text-blue-600" /> : <Sun className="w-3 h-3 text-amber-500" />}
                    </div>
                  </div>
                </button>

                {/* 1-Click Language Switcher Row */}
                <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#faf7f0] border border-[#eee8dd]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#0f2b5c]/10 text-[#0f2b5c]">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider">
                        {lang === 'en' ? 'LANGUAGE' : 'LANGUE'}
                      </span>
                      <p className="text-[10px] text-[#8a857e] mt-0.5">
                        {lang === 'en' ? 'English selected' : 'Français sélectionné'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#eee8dd]">
                    <button
                      type="button"
                      onClick={() => setLang('fr')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        lang === 'fr' ? 'bg-[#0f2b5c] text-white' : 'text-[#8a857e] hover:text-[#1a1a1a]'
                      }`}
                    >
                      FR
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        lang === 'en' ? 'bg-[#0f2b5c] text-white' : 'text-[#8a857e] hover:text-[#1a1a1a]'
                      }`}
                    >
                      EN
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 grid grid-cols-3 gap-3">
                {/* Direct 1-Click Tile in the Hamburger Grid */}
                <button 
                  type="button" 
                  onClick={toggleTheme} 
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 transition-all text-center cursor-pointer"
                >
                  {isDark ? <Sun className="w-6 h-6 text-amber-400" /> : <Moon className="w-6 h-6 text-[#0f2b5c]" />}
                  <span className="text-[10px] font-bold text-gray-700 leading-tight">
                    {isDark ? (lang === 'en' ? 'Light' : 'Clair') : (lang === 'en' ? 'Dark' : 'Sombre')}
                  </span>
                </button>
                <Link to="/espace/tableau-de-bord" onClick={() => setMobileMenuOpen(false)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 transition-all text-center">
                  <LayoutDashboard className="w-6 h-6 text-[#0f2b5c]" />
                  <span className="text-[10px] font-medium text-gray-700 leading-tight">{t('nav_dashboard')}</span>
                </Link>
                <Link to="/espace/virement" onClick={() => setMobileMenuOpen(false)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 transition-all text-center">
                  <Send className="w-6 h-6 text-[#0f2b5c]" />
                  <span className="text-[10px] font-medium text-gray-700 leading-tight">{t('nav_transfer')}</span>
                </Link>
                <Link to="/espace/approvisionnement" onClick={() => setMobileMenuOpen(false)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 transition-all text-center">
                  <Download className="w-6 h-6 text-[#0f2b5c]" />
                  <span className="text-[10px] font-medium text-gray-700 leading-tight">{t('nav_funding')}</span>
                </Link>
                <Link to="/espace/cartes" onClick={() => setMobileMenuOpen(false)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 transition-all text-center">
                  <CreditCard className="w-6 h-6 text-[#0f2b5c]" />
                  <span className="text-[10px] font-medium text-gray-700 leading-tight">{t('nav_cards')}</span>
                </Link>
                <Link to="/espace/financement" onClick={() => setMobileMenuOpen(false)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 transition-all text-center">
                  <Banknote className="w-6 h-6 text-[#0f2b5c]" />
                  <span className="text-[10px] font-medium text-gray-700 leading-tight">{t('nav_financing')}</span>
                </Link>
                <Link to="/espace/profil" onClick={() => setMobileMenuOpen(false)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 transition-all text-center">
                  <UserIcon className="w-6 h-6 text-[#0f2b5c]" />
                  <span className="text-[10px] font-medium text-gray-700 leading-tight">{t('nav_profile')}</span>
                </Link>
                <Link to="/espace/a-propos" onClick={() => setMobileMenuOpen(false)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 transition-all text-center">
                  <Info className="w-6 h-6 text-[#0f2b5c]" />
                  <span className="text-[10px] font-medium text-gray-700 leading-tight">{t('nav_about')}</span>
                </Link>
                <a href="mailto:contact@versalbank.com" onClick={() => setMobileMenuOpen(false)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 transition-all text-center cursor-pointer">
                  <Headphones className="w-6 h-6 text-[#0f2b5c]" />
                  <span className="text-[10px] font-medium text-gray-700 leading-tight">{t('nav_support')}</span>
                </a>
                <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 hover:border-red-300 hover:bg-red-100 transition-all text-center cursor-pointer">
                  <LogOut className="w-6 h-6 text-red-600" />
                  <span className="text-[10px] font-medium text-red-700 leading-tight">{t('nav_logout')}</span>
                </button>
              </div>

              <div className="flex-1 p-4 space-y-2">
                {isAdmin && (
                  <>
                    <div className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-3 px-2">Administration</div>
                    <Link to="/administration" className="flex items-center gap-3 p-3 rounded-xl bg-[#0f2b5c]/5 text-[#0f2b5c] text-sm font-semibold">
                      <ShieldAlert className="w-5 h-5" /> Console Admin
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <ContactSupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        accountNumber={account?.account_number || ''}
      />
    </div>
  );
}
