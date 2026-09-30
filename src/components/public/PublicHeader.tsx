import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Globe, ShieldAlert, Menu, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useI18n } from '../../lib/i18n';
import { BankEmblem } from './BankLogo';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu';

export function BankLogo() {
  const { lang } = useI18n();
  return (
    <Link to="/" className="flex items-center gap-3 group select-none">
      <BankEmblem className="w-10 h-10 shrink-0 drop-shadow-xs" />
      <div className="flex flex-col">
        <span className="font-heading font-serif text-[19px] leading-tight text-[#0f2b5c] tracking-tight font-bold">
          VersalBank
        </span>
        <span className="text-[9px] uppercase tracking-[0.24em] font-semibold text-[#627592]">
          {lang === 'en' ? 'Canadian Bank' : 'Banque Canadienne'}
        </span>
      </div>
    </Link>
  );
}

export default function PublicHeader() {
  const location = useLocation();
  const { user, isAdmin, loading } = useAuth();
  const { lang, setLang, t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAboutPage = location.pathname === '/a-propos';

  return (
    <header className="sticky top-0 z-50 w-full bg-[#fcfbf9]/95 backdrop-blur-md border-b border-[#e8e2d8] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Logo */}
        <BankLogo />

        {/* Navigation Desktop */}
        <nav className="hidden lg:flex items-center gap-7 text-[13.5px] text-[#4a4742] font-normal">
          <Link
            to="/#metiers"
            onClick={() => {
              if (location.pathname === '/') {
                document.getElementById('metiers')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="hover:text-[#0f2b5c] transition-colors font-medium"
          >
            {t('nav_wealth_management')}
          </Link>
          <Link
            to="/#metiers"
            onClick={() => {
              if (location.pathname === '/') {
                document.getElementById('metiers')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="hover:text-[#0f2b5c] transition-colors font-medium"
          >
            {t('nav_corporate_finance')}
          </Link>
          <Link
            to="/#metiers"
            onClick={() => {
              if (location.pathname === '/') {
                document.getElementById('metiers')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="hover:text-[#0f2b5c] transition-colors font-medium"
          >
            {t('nav_digital_solutions')}
          </Link>
          <Link
            to="/a-propos"
            className={`transition-all font-medium ${
              isAboutPage
                ? 'bg-[#edf3fa] text-[#0f2b5c] px-3.5 py-1.5 rounded-full shadow-xs'
                : 'hover:text-[#0f2b5c]'
            }`}
          >
            {t('nav_about')}
          </Link>
        </nav>

        {/* Actions à droite */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Sélecteur de langue */}
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton={true}
              className="flex items-center gap-1.5 text-xs text-[#555] hover:text-[#0f2b5c] px-2.5 py-1.5 rounded-full hover:bg-[#edf3fa] transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-[#627592]" />
              <span className="font-medium">{lang === 'en' ? 'English' : 'Français'}</span>
              <ChevronDown className="w-3 h-3 text-[#627592]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32 bg-white rounded-xl shadow-lg border border-[#dce5f2]">
              <DropdownMenuItem
                onClick={() => setLang('fr')}
                className={`text-xs cursor-pointer ${lang === 'fr' ? 'font-semibold text-[#0f2b5c]' : ''}`}
              >
                Français
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLang('en')}
                className={`text-xs cursor-pointer ${lang === 'en' ? 'font-semibold text-[#0f2b5c]' : ''}`}
              >
                English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bouton Admin si présent */}
          {!loading && user && isAdmin && (
            <Link
              to="/administration"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-[#0f2b5c] border border-[#0f2b5c]/30 hover:bg-blue-100/70 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{t('admin_console')}</span>
            </Link>
          )}

          {/* Bouton Portail Client */}
          {!loading && !isAdmin && (
            <Link
              to={user ? '/portail' : '/login'}
              className="text-[13.5px] font-medium text-[#4a4742] hover:text-[#0f2b5c] px-3.5 py-2 rounded-full hover:bg-[#edf3fa] transition-colors"
            >
              {user ? t('my_portal') : t('customer_portal')}
            </Link>
          )}

          {/* Bouton Ouvrir un compte */}
          {!isAdmin && (
            <Link
              to={user ? '/portail' : '/register'}
              className="inline-flex items-center justify-center text-[13.5px] font-semibold bg-[#0f2b5c] hover:bg-[#0a1e40] text-white px-5 py-2 rounded-full shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
            >
              {t('open_account')}
            </Link>
          )}
        </div>

        {/* Bouton Hamburger Mobile */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#4a4742] hover:text-[#0f2b5c] rounded-lg"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Menu mobile déroulant */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#fcfbf9] border-b border-[#e8e2d8] px-6 py-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-3 text-sm font-medium text-[#4a4742]">
            <Link
              to="/#metiers"
              onClick={() => {
                setMobileMenuOpen(false);
                if (location.pathname === '/') {
                  document.getElementById('metiers')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="py-1 hover:text-[#0f2b5c]"
            >
              {t('nav_wealth_management')}
            </Link>
            <Link
              to="/#metiers"
              onClick={() => {
                setMobileMenuOpen(false);
                if (location.pathname === '/') {
                  document.getElementById('metiers')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="py-1 hover:text-[#0f2b5c]"
            >
              {t('nav_corporate_finance')}
            </Link>
            <Link
              to="/#metiers"
              onClick={() => {
                setMobileMenuOpen(false);
                if (location.pathname === '/') {
                  document.getElementById('metiers')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="py-1 hover:text-[#0f2b5c]"
            >
              {t('nav_digital_solutions')}
            </Link>
            <Link
              to="/a-propos"
              onClick={() => setMobileMenuOpen(false)}
              className={`py-1 ${isAboutPage ? 'text-[#0f2b5c] font-semibold' : 'hover:text-[#0f2b5c]'}`}
            >
              {t('nav_about')}
            </Link>
          </div>

          <div className="pt-3 border-t border-[#eee8dd] flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{lang === 'en' ? 'Language' : 'Langue'}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setLang('fr')}
                  className={`px-2 py-0.5 rounded ${lang === 'fr' ? 'bg-[#0f2b5c] text-white font-semibold' : 'bg-[#edf3fa] text-[#0f2b5c]'}`}
                >
                  FR
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`px-2 py-0.5 rounded ${lang === 'en' ? 'bg-[#0f2b5c] text-white font-semibold' : 'bg-[#edf3fa] text-[#0f2b5c]'}`}
                >
                  EN
                </button>
              </div>
            </div>

            {isAdmin ? (
              <Link
                to="/administration"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-full text-sm font-semibold bg-blue-50 text-[#0f2b5c] border border-[#0f2b5c]/30"
              >
                {t('admin_console')}
              </Link>
            ) : (
              <>
                <Link
                  to={user ? '/portail' : '/login'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-full text-sm font-medium bg-[#edf3fa] text-[#0f2b5c]"
                >
                  {user ? t('my_portal') : t('customer_portal')}
                </Link>
                <Link
                  to={user ? '/portail' : '/register'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-full text-sm font-semibold bg-[#0f2b5c] text-white shadow-sm"
                >
                  {t('open_account')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
