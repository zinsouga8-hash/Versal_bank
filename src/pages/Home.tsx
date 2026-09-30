import { getBankSupportEmail } from '../lib/supabaseBankService';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Globe,
  Gem,
  Landmark,
  Cpu,
  Fingerprint,
  Headphones,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useI18n } from '../lib/i18n';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import BankMonogram from '../components/public/BankMonogram';

export default function Home() {
  const { user, loading, isAdmin } = useAuth();
  const { t, lang } = useI18n();
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col font-sans text-[#1a1a1a]">
      {/* En-tête Navigation */}
      <PublicHeader />

      <main className="flex-1">
        {/* Section Hero Principale (Capture 54) */}
        <section className="pt-14 pb-20 px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Colonne Gauche : Titre, Intro, CTA & Chiffres Clés */}
            <div className="lg:col-span-7 space-y-8">
              {/* Badge d'ancrage institutionnel */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#0f2b5c]/25 bg-[#0f2b5c]/5 text-[#0f2b5c] text-[11px] font-semibold tracking-widest uppercase">
                <Globe className="w-3.5 h-3.5" />
                <span>{t('hero_badge')}</span>
              </div>

              {/* Grand Titre */}
              <h1 className="font-heading font-serif text-4xl sm:text-5xl lg:text-6xl text-[#0f2b5c] font-normal leading-[1.12] tracking-tight">
                {t('hero_title')}
              </h1>

              {/* Sous-titre */}
              <p className="text-base sm:text-lg text-[#555] leading-relaxed max-w-xl font-normal">
                {t('hero_subtitle')}
              </p>

              {/* Boutons d'action */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {isAdmin ? (
                  <Link
                    to="/administration"
                    className="inline-flex items-center justify-center gap-2 bg-[#0f2b5c] hover:bg-[#0a1e40] text-white px-7 py-3.5 rounded-full text-sm font-semibold shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <span>{t('access_admin_console')}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to={user ? '/portail' : '/register'}
                      className="inline-flex items-center justify-center gap-1.5 bg-[#0f2b5c] hover:bg-[#0a1e40] text-white px-7 py-3.5 rounded-full text-sm font-medium shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
                    >
                      <span>{t('open_my_account')}</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>

                    <Link
                      to={user ? '/portail' : '/login'}
                      className="inline-flex items-center justify-center bg-[#edf3fa] hover:bg-[#dce6f5] text-[#0f2b5c] px-7 py-3.5 rounded-full text-sm font-medium transition-colors"
                    >
                      {t('access_my_portal')}
                    </Link>
                  </>
                )}
              </div>

              {/* Chiffres Clés sous le Hero */}
              <div className="pt-8 border-t border-[#eee8dd] grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <p className="font-heading font-serif text-2xl sm:text-3xl text-[#0f2b5c] font-semibold">
                    {lang === 'en' ? 'CA$12.6B' : '12,6 Md $CA'}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#8a857e] mt-1">
                    {t('assets_under_management') || "D'actifs sous gestion"}
                  </p>
                </div>
                <div>
                  <p className="font-heading font-serif text-2xl sm:text-3xl text-[#0f2b5c] font-semibold">
                    13
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#8a857e] mt-1">
                    {t('countries_served') || 'Pays desservis'}
                  </p>
                </div>
                <div>
                  <p className="font-heading font-serif text-2xl sm:text-3xl text-[#0f2b5c] font-semibold">
                    21 500
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#8a857e] mt-1">
                    {t('private_clients') || 'Clients privés'}
                  </p>
                </div>
                <div>
                  <p className="font-heading font-serif text-2xl sm:text-3xl text-[#0f2b5c] font-semibold">
                    99,98 %
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#8a857e] mt-1">
                    {t('portal_availability') || 'Disponibilité du portail'}
                  </p>
                </div>
              </div>
            </div>

            {/* Colonne Droite : Carte institutionnelle prestige (Capture 54) */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-10 shadow-xs flex flex-col justify-between space-y-8 transition-all hover:shadow-md">
                {/* Monogramme et citation */}
                <div className="text-center space-y-5">
                  <BankMonogram className="w-16 h-16 mx-auto" />
                  <blockquote className="font-heading font-serif italic text-xl sm:text-2xl text-[#1a1a1a] leading-snug px-2">
                    {t('institutional_quote') || '« Une architecture bancaire pensée comme un actif : sobre, souveraine, mesurable. »'}
                  </blockquote>
                </div>

                {/* 3 Badges de réassurance */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] text-xs text-[#0f2b5c]">
                    <ShieldCheck className="w-4 h-4 text-[#0f2b5c] shrink-0" />
                    <span className="font-semibold">{t('fintrac_certified') || 'Espace Sécurisé FINTRAC'}</span>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] text-xs text-[#0f2b5c]">
                    <Fingerprint className="w-4 h-4 text-[#0f2b5c] shrink-0" />
                    <span className="font-semibold">{t('pin_validation_label') || 'Double validation NIP'}</span>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] text-xs text-[#0f2b5c]">
                    <Globe className="w-4 h-4 text-[#0f2b5c] shrink-0" />
                    <span className="font-semibold">{t('provinces_territories_label') || '13 provinces & territoires'}</span>
                  </div>
                </div>

                {/* Bouton Service Client */}
                <button
                  type="button"
                  onClick={() => window.location.href = 'mailto:` + getBankSupportEmail() + `'}
                  className="w-full py-3 px-4 rounded-full border border-[#0f2b5c]/30 hover:bg-[#0f2b5c]/5 text-[#0f2b5c] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Headphones className="w-4 h-4" />
                  <span>{t('customer_service') || 'SERVICE CLIENT'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section : Trois métiers, une exigence (Capture 55) */}
        <section id="metiers" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto scroll-mt-24">
          <h2 className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-normal mb-10">
            {t('three_professions_title') || 'Trois métiers, une exigence'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Carte 1 : Gestion de patrimoine */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-10 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                  <Gem className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-serif text-2xl text-[#0f2b5c] font-normal">
                  {t('nav_wealth_management') || 'Gestion de patrimoine'}
                </h3>
                <p className="text-sm text-[#666] leading-relaxed">
                  {t('wealth_management_desc') || "Allocation sur mesure, mandats discrétionnaires, immobilier et actifs numériques, sous supervision d'un banquier dédié."}
                </p>
              </div>
            </div>

            {/* Carte 2 : Financement d'entreprise */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-10 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-serif text-2xl text-[#0f2b5c] font-normal">
                  {t('nav_corporate_finance') || "Financement d'entreprise"}
                </h3>
                <p className="text-sm text-[#666] leading-relaxed">
                  {t('corporate_finance_desc') || "Crédits d'exploitation, acquisitions, affacturage et lignes de trésorerie assortis de taux compris entre 1 % et 2 %."}
                </p>
              </div>
            </div>

            {/* Carte 3 : Solutions numériques */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-10 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-serif text-2xl text-[#0f2b5c] font-normal">
                  {t('nav_digital_solutions') || 'Solutions numériques'}
                </h3>
                <p className="text-sm text-[#666] leading-relaxed">
                  {t('digital_solutions_desc') || "Cartes virtuelles instantanées, corridors de transfert mondiaux, règlement crypto USDT et BTC, suivi en temps réel."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section : Une ouverture de compte en quatre temps (Capture 56) */}
        <section className="py-12 pb-24 px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-12 lg:p-14 shadow-xs">
            <h2 className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-normal mb-12">
              {t('four_steps_title') || 'Une ouverture de compte en quatre temps'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
              {/* Étape 01 */}
              <div className="space-y-3">
                <p className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-bold">
                  01
                </p>
                <h3 className="font-heading font-serif text-lg sm:text-xl text-[#0f2b5c] font-normal">
                  {t('step_1_title') || 'Renseignez votre dossier'}
                </h3>
                <p className="text-xs sm:text-sm text-[#666] leading-relaxed">
                  {t('step_1_desc') || 'Identité, résidence, situation professionnelle et justificatifs légaux.'}
                </p>
              </div>

              {/* Étape 02 */}
              <div className="space-y-3">
                <p className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-bold">
                  02
                </p>
                <h3 className="font-heading font-serif text-lg sm:text-xl text-[#0f2b5c] font-normal">
                  {t('step_2_title') || 'Définissez vos accès'}
                </h3>
                <p className="text-xs sm:text-sm text-[#666] leading-relaxed">
                  {t('step_2_desc') || 'Mot de passe du portail et code PIN à 6 chiffres.'}
                </p>
              </div>

              {/* Étape 03 */}
              <div className="space-y-3">
                <p className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-bold">
                  03
                </p>
                <h3 className="font-heading font-serif text-lg sm:text-xl text-[#0f2b5c] font-normal">
                  {t('step_3_title') || 'Vérification conformité'}
                </h3>
                <p className="text-xs sm:text-sm text-[#666] leading-relaxed">
                  {t('step_3_desc') || 'Un administrateur examine et approuve votre demande.'}
                </p>
              </div>

              {/* Étape 04 */}
              <div className="space-y-3">
                <p className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-bold">
                  04
                </p>
                <h3 className="font-heading font-serif text-lg sm:text-xl text-[#0f2b5c] font-normal">
                  {t('step_4_title') || 'Accédez à votre tableau de bord'}
                </h3>
                <p className="text-xs sm:text-sm text-[#666] leading-relaxed">
                  {t('step_4_desc') || 'Identifiant client ou email, mot de passe, puis code PIN.'}
                </p>
              </div>
            </div>

            {/* Bouton CTA final */}
            <div className="pt-2">
              <Link
                to={isAdmin ? '/administration' : (user ? '/portail' : '/register')}
                className="inline-flex items-center justify-center bg-[#0f2b5c] hover:bg-[#0a1e40] text-white px-7 py-3 rounded-full text-sm font-semibold shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
              >
                {isAdmin ? t('access_admin_console') : (t('open_account') || 'Ouvrir un compte')}
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Pied de page */}
      <PublicFooter />

      {/* Boîte de dialogue du service client */}
    </div>
  );
}
