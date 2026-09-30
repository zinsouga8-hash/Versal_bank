import { getBankSupportEmail } from '../lib/supabaseBankService';
import React, { useEffect } from 'react';
import {
  ShieldCheck,
  Scale,
  Globe,
  HeartHandshake,
  FileText,
  Lock,
  Cookie,
  ShieldAlert,
} from 'lucide-react';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import BankMonogram from '../components/public/BankMonogram';
import { useI18n } from '../lib/i18n';

export default function About() {
  const { lang, t } = useI18n();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col font-sans text-[#1a1a1a]">
      {/* Navigation Principale */}
      <PublicHeader />

      <main className="flex-1">
        {/* En-tête Hero À Propos */}
        <section className="pt-16 pb-20 px-6 lg:px-12 max-w-7xl mx-auto">
          {/* Badge haut */}
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#0f2b5c]/25 bg-[#0f2b5c]/5 text-[#0f2b5c] text-[11px] font-semibold tracking-widest uppercase">
              <Globe className="w-3.5 h-3.5" /> {lang === 'en' ? 'About Us' : 'À propos'}
            </span>
          </div>

          {/* Titre Principal */}
          <h1 className="font-heading font-serif text-4xl sm:text-5xl lg:text-6xl text-[#0f2b5c] font-normal leading-[1.18] max-w-4xl mb-6">
            {lang === 'en' ? (
              <>A premier financial institution, <span className="text-[#0f2b5c] font-semibold">dedicated to private wealth.</span></>
            ) : (
              <>Une institution financière de référence, <span className="text-[#0f2b5c] font-semibold">au service du patrimoine.</span></>
            )}
          </h1>

          {/* Sous-titre adapté VersalBank */}
          <p className="text-base sm:text-lg text-[#555] leading-relaxed max-w-4xl mb-14 font-normal">
            {lang === 'en'
              ? 'VersalBank Corporation is a Canadian banking and financial services institution governed by the Bank Act of Canada, built on the principle that a bank must serve both as a fortress and a workshop: a sanctuary to protect private wealth, and a laboratory to cultivate it with rigor and independence.'
              : 'VersalBank Corporation est un établissement bancaire et de services financiers régi par la Loi sur les banques du Canada, fondé sur l\'idée qu\'une banque doit être à la fois une forteresse et un atelier : un sanctuaire pour protéger les patrimoines, et un laboratoire pour les faire fructifier avec rigueur et indépendance.'}
          </p>

          {/* 4 Chiffres Clés */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 shadow-xs hover:shadow-md transition-shadow">
              <p className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-bold mb-2">
                $12.6 B CAD
              </p>
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#8a857e]">
                {lang === 'en' ? 'Assets Under Management' : 'Actifs sous gestion'}
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 shadow-xs hover:shadow-md transition-shadow">
              <p className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-bold mb-2">
                13
              </p>
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#8a857e]">
                {lang === 'en' ? 'Provinces & Territories' : 'Provinces et territoires'}
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 shadow-xs hover:shadow-md transition-shadow">
              <p className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-bold mb-2">
                21,500
              </p>
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#8a857e]">
                {lang === 'en' ? 'Clients Supported' : 'Clients accompagnés'}
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 shadow-xs hover:shadow-md transition-shadow">
              <p className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-bold mb-2">
                2004
              </p>
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#8a857e]">
                {lang === 'en' ? 'Founded' : 'Année de fondation'}
              </p>
            </div>
          </div>
        </section>

        {/* Section : Nos Piliers */}
        <section className="py-16 px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="mb-10">
            <h2 className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] mb-2 font-normal">
              {lang === 'en' ? 'Our Pillars' : 'Nos piliers'}
            </h2>
            <div className="w-12 h-0.5 bg-[#0f2b5c]/40"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pilier 1 */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-10 shadow-xs hover:shadow-md transition-shadow space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-serif text-2xl text-[#0f2b5c] font-normal">
                {lang === 'en' ? 'Sovereignty & Security' : 'Souveraineté & sécurité'}
              </h3>
              <p className="text-sm text-[#666] leading-relaxed">
                {lang === 'en'
                  ? 'Segregated custody, multi-factor PIN authentication, and complete FINTRAC / OSFI compliance.'
                  : 'Custodie ségréguée, double validation NIP et conformité intégrale FINTRAC / BSIF.'}
              </p>
            </div>

            {/* Pilier 2 */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-10 shadow-xs hover:shadow-md transition-shadow space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-serif text-2xl text-[#0f2b5c] font-normal">
                {lang === 'en' ? 'Transparency' : 'Transparence'}
              </h3>
              <p className="text-sm text-[#666] leading-relaxed">
                {lang === 'en'
                  ? 'Clear fee structures, explicit agreements, and real-time wealth portfolio reporting.'
                  : 'Frais lisibles, contrats explicites et reporting patrimonial en temps réel.'}
              </p>
            </div>

            {/* Pilier 3 */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-10 shadow-xs hover:shadow-md transition-shadow space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-serif text-2xl text-[#0f2b5c] font-normal">
                {lang === 'en' ? 'Pan-Canadian Network' : 'Réseau pancanadien'}
              </h3>
              <p className="text-sm text-[#666] leading-relaxed">
                {lang === 'en'
                  ? 'Active across all 13 provinces and territories, multi-currency accounts (CAD, USD, EUR, CHF), and cross-border corridors.'
                  : 'Présente dans les 13 provinces et territoires, gestion multi-devises (CAD, USD, EUR, CHF) et corridors transfrontaliers.'}
              </p>
            </div>

            {/* Pilier 4 */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-10 shadow-xs hover:shadow-md transition-shadow space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-serif text-2xl text-[#0f2b5c] font-normal">
                {lang === 'en' ? 'Private Advisory' : 'Relation patrimoniale'}
              </h3>
              <p className="text-sm text-[#666] leading-relaxed">
                {lang === 'en'
                  ? 'Every account holder benefits from a dedicated private wealth manager directly accessible.'
                  : 'Chaque titulaire de compte bénéficie d\'un ingénieur patrimonial dédié joignable en direct.'}
              </p>
            </div>
          </div>
        </section>

        {/* Section : Accréditations & Certifications */}
        <section className="py-16 px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-8">
            <ShieldCheck className="w-6 h-6 text-[#0f2b5c]" />
            <h2 className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-normal">
              {lang === 'en' ? 'Accreditations & Certifications' : 'Accréditations & certifications'}
            </h2>
          </div>

          <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-12 shadow-xs space-y-6">
            {(lang === 'en' ? [
              "Regulated under the Bank Act of Canada (S.C. 1991, c. 46) and supervised by the Office of the Superintendent of Financial Institutions (OSFI).",
              "Financial Transactions and Reports Analysis Centre of Canada (FINTRAC / CANAFE No. M20341567) — strictly compliant with anti-money laundering regulations.",
              "Member of the Canada Deposit Insurance Corporation (CDIC) — protecting eligible deposits up to $100,000 CAD per insured category.",
              "Financial services entity registered with Autorité des marchés financiers (AMF) Québec — file no. 24-0917.",
              "Compliant with Personal Information Protection and Electronic Documents Act (PIPEDA / LPRPDE).",
              "ISO/IEC 27001 Certified — certified information security management for financial data flows.",
              "Legally binding electronic signatures compliant with Ontario Electronic Commerce Act and Quebec Civil Code.",
              "Rigorous consumer and borrower protection standards across all Canadian provinces.",
            ] : [
              "Établissement régi par la Loi sur les banques (L.C. 1991, ch. 46) et supervisé par le Bureau du surintendant des institutions financières (BSIF / OSFI).",
              "Centre d'analyse des opérations et déclarations financières du Canada (FINTRAC / CANAFE n° M20341567) — stricte conformité à la Loi sur le recyclage des produits de la criminalité.",
              "Membre de la Société d'assurance-dépôts du Canada (SADC / CDIC) — garantie et protection des dépôts admissibles jusqu'à 100 000 $CA par catégorie assurée.",
              "Entité de services financiers déclarée auprès de l'Autorité des marchés financiers (AMF) du Québec — dossier n° 24-0917.",
              "Conformité à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE / PIPEDA).",
              "Certifié ISO/IEC 27001 — management certifié de la sécurité de l'information et des flux financiers.",
              "Signature électronique légale conforme à la Loi sur le commerce électronique de l'Ontario et au Code civil du Québec.",
              "Normes rigoureuses de protection des emprunteurs et consommateurs de produits financiers pancanadiens.",
            ]).map((item, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="w-5 h-5 rounded-full bg-[#edf3fa] flex items-center justify-center text-[#0f2b5c] shrink-0 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <p className="text-sm text-[#4a4742] leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section : Politiques & Engagements */}
        <section className="py-16 px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-8">
            <FileText className="w-6 h-6 text-[#0f2b5c]" />
            <h2 className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-normal">
              {lang === 'en' ? 'Policies & Commitments' : 'Politiques & engagements'}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Carte 1 */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 shadow-xs space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-serif text-xl sm:text-2xl text-[#0f2b5c] font-normal">
                {lang === 'en' ? 'Privacy & PIPEDA' : 'Confidentialité & LPRPDE (PIPEDA)'}
              </h3>
              <p className="text-xs sm:text-sm text-[#666] leading-relaxed">
                {lang === 'en'
                  ? `We process your personal information strictly in compliance with Canada's Personal Information Protection and Electronic Documents Act (PIPEDA). You maintain a permanent right of access, rectification, and withdrawal. Contact: `
                  : `Nous traitons vos renseignements personnels conformément à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE/PIPEDA) du Canada. Vous disposez d'un droit permanent d'accès, de rectification et de retrait. Contact : `}
                <a href={`mailto:${getBankSupportEmail()}`} className="text-[#0f2b5c] font-semibold underline underline-offset-2">
                  {getBankSupportEmail()}
                </a>.
              </p>
            </div>

            {/* Carte 2 */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 shadow-xs space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                <Cookie className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-serif text-xl sm:text-2xl text-[#0f2b5c] font-normal">
                {lang === 'en' ? 'Cookies & Session Integrity' : 'Cookies & intégrité des sessions'}
              </h3>
              <p className="text-xs sm:text-sm text-[#666] leading-relaxed">
                {lang === 'en'
                  ? 'Only strictly necessary security and authentication cookies are stored to maintain portal sessions. No advertising trackers are deployed.'
                  : 'Seuls les traceurs de sécurité et d\'authentification strictement nécessaires au portail bancaire sont déposés. Aucun cookie publicitaire tiers n\'est utilisé. Vous conservez la maîtrise totale de vos paramètres depuis votre navigateur.'}
              </p>
            </div>

            {/* Carte 3 */}
            <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 shadow-xs space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#edf3fa] border border-[#d6e3f5] flex items-center justify-center text-[#0f2b5c]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-serif text-xl sm:text-2xl text-[#0f2b5c] font-normal">
                {lang === 'en' ? 'Security & Fraud Prevention' : 'Sécurité & lutte anti-fraude'}
              </h3>
              <p className="text-xs sm:text-sm text-[#666] leading-relaxed">
                {lang === 'en'
                  ? 'AES-256 bank-grade encryption in transit and at rest, mandatory multi-factor authentication, personal security PIN verification, 24/7 continuous monitoring, and instant automated freeze upon suspicious activity.'
                  : 'Chiffrement militaire AES-256 en transit et au repos, double authentification systématique, validation des opérations par code NIP et codes de sécurité personnels, veille continue 24/7 et gel préventif immédiat en cas de comportement inhabituel.'}
              </p>
            </div>
          </div>
        </section>

        {/* Section : Termes & Conditions */}
        <section className="py-16 px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-8">
            <Scale className="w-6 h-6 text-[#0f2b5c]" />
            <h2 className="font-heading font-serif text-3xl sm:text-4xl text-[#0f2b5c] font-normal">
              {lang === 'en' ? 'Terms & Conditions' : 'Termes & conditions'}
            </h2>
          </div>

          <div className="bg-white rounded-3xl border border-[#eee8dd] p-8 sm:p-12 shadow-xs space-y-6 text-sm text-[#4a4742] leading-relaxed">
            {lang === 'en' ? (
              <>
                <p>
                  <strong className="text-[#1a1a1a]">1. Scope.</strong> These general conditions govern the relationship between VersalBank Corporation and account holders regarding banking account maintenance, payment cards, cross-border transfers, and financing solutions.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">2. Account Opening.</strong> Opening an account is subject to submission of identity and residence verification documents adhering to FINTRAC/CANAFE standards, and formal approval by VersalBank compliance.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">3. Transactions.</strong> Any outbound movement requires confirmation via the client's confidential PIN and applicable security certificate codes. Account recharges are credited following bank ledger reconciliation.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">4. Financing.</strong> Disbursement of credit capital is executed upon approval by the credit committee and electronic signing of contractual agreements and amortization schedules.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">5. Pricing & Transparency.</strong> All rate schedules are transparently displayed. Applicable transfer and currency conversion fees are presented prior to final confirmation.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">6. Liability.</strong> VersalBank ensures strict custodial custody and asset segregation. VersalBank is not liable for third-party clearing delays or incorrect account information supplied by the user.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">7. Governing Law & Jurisdiction.</strong> This contractual agreement is governed by the Bank Act of Canada and the laws of Ontario. Any dispute shall fall under the exclusive jurisdiction of the courts of Toronto, Ontario.
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong className="text-[#1a1a1a]">1. Objet.</strong> Les présentes conditions générales régissent les relations entre VersalBank Corporation et ses titulaires de compte dans le cadre des services de tenue de compte, de cartes de paiement, de transferts transfrontaliers et de solutions de financement.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">2. Ouverture de compte.</strong> L'ouverture d'un compte est conditionnée à la transmission des pièces justificatives d'identité et de résidence conformes aux normes FINTRAC/CANAFE, et à la validation souveraine du département de conformité de VersalBank.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">3. Opérations.</strong> Tout mouvement sortant requiert la validation par le code NIP confidentiel du titulaire et, le cas échéant, par les codes de confirmation sécurisés. Les approvisionnements sont crédités après rapprochement bancaire.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">4. Financement.</strong> Le déblocage des capitaux prêtés s'effectue après instruction et approbation du dossier par la direction du crédit, et signature électronique des conventions contractuelles conformément aux tableaux d'amortissement.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">5. Tarification & Transparence.</strong> Le barème tarifaire est communiqué en toute transparence. Les frais applicables aux virements et conversions de devises sont présentés avant toute validation définitive.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">6. Responsabilité.</strong> VersalBank assure la garde et la ségrégation stricte des avoirs. Elle ne peut être tenue responsable des retards imputables aux réseaux de compensation tiers ou d'erreurs dans les coordonnées fournies par l'utilisateur.
                </p>
                <p>
                  <strong className="text-[#1a1a1a]">7. Loi applicable & Juridiction.</strong> Le présent cadre contractuel est régi par la Loi sur les banques du Canada et le droit de la province de l'Ontario. Tout litige relève de la compétence exclusive des tribunaux de Toronto (Ontario).
                </p>
              </>
            )}
          </div>
        </section>

        {/* Bannière Citation Charte Institutionnelle */}
        <section className="py-16 px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="bg-white rounded-3xl border border-[#eee8dd] p-10 sm:p-16 text-center shadow-xs flex flex-col items-center">
            <div className="mb-6">
              <BankMonogram className="w-16 h-16 mx-auto" />
            </div>
            <blockquote className="font-heading font-serif text-2xl sm:text-3xl text-[#1a1a1a] max-w-3xl mb-4 font-normal italic">
              {lang === 'en'
                ? '“Protecting what matters, financing what builds.”'
                : '« Protéger ce qui compte, financer ce qui construit. »'}
            </blockquote>
            <p className="text-xs uppercase tracking-[0.24em] font-semibold text-[#8a857e]">
              — {lang === 'en' ? 'VersalBank Institutional Charter' : 'Charte institutionnelle VersalBank'}
            </p>
          </div>
        </section>
      </main>

      {/* Pied de page */}
      <PublicFooter />
    </div>
  );
}
