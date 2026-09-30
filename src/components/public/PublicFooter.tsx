import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, MessageSquare, Mail, Clock, Headphones, ShieldCheck } from 'lucide-react';
import { BankLogo } from './PublicHeader';
import { getBankSupportEmail } from '../../lib/supabaseBankService';
import { useI18n } from '../../lib/i18n';

export default function PublicFooter() {
  const [supportOpen, setSupportOpen] = useState(false);
  const supportEmail = getBankSupportEmail();
  const { lang, t } = useI18n();

  return (
    <>
      <footer className="w-full bg-[#fbfaf8] border-t border-[#e8e2d8] text-[#4a4742] pt-16 pb-12 transition-colors">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-[#eee8dd]">
            {/* Colonne 1 : Présentation & Logo */}
            <div className="md:col-span-4 space-y-6">
              <BankLogo />
              <p className="text-xs text-[#666] leading-relaxed max-w-sm">
                {lang === 'en'
                  ? 'VersalBank Corporation — Canadian private and commercial banking institution governed by the Bank Act of Canada. Head office: Financial District, Toronto, Ontario, Canada.'
                  : 'VersalBank Corporation — établissement bancaire et de services financiers régi par la Loi sur les banques du Canada. Siège social : Financial District, Toronto, Ontario, Canada.'}
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => window.location.href = `mailto:${supportEmail}`}
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-[#0f2b5c] hover:bg-[#0a1e40] text-white px-5 py-2.5 rounded-full shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Headphones className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Customer Support' : 'Service Client'}</span>
                </button>
              </div>
            </div>

            {/* Colonne 2 : Contact Toronto & Pancanadien */}
            <div className="md:col-span-4 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0f2b5c]">
                Contact
              </h4>
              <ul className="space-y-3 text-xs text-[#555]">
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#0f2b5c] shrink-0 mt-0.5" />
                  <span>100 King Street West, Suite 5600, Toronto (Ontario) M5X 1C9, Canada</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-[#0f2b5c] shrink-0" />
                  <div className="flex gap-2">
                    <a href="tel:+14168489200" className="hover:text-[#0f2b5c] transition-colors">
                      +1 (416) 848-9200
                    </a>
                    <span className="text-[#aaa]">•</span>
                    <a href="tel:+18005841290" className="hover:text-[#0f2b5c] transition-colors text-muted-foreground">
                      {lang === 'en' ? 'Toll-free +1 (800) 584-1290' : 'Sans frais +1 (800) 584-1290'}
                    </a>
                  </div>
                </li>
                <li className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-[#0f2b5c] shrink-0" />
                  <a
                    href="https://wa.me/16479458820"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#0f2b5c] transition-colors"
                  >
                    WhatsApp +1 (647) 945-8820
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#0f2b5c] shrink-0" />
                  <a
                    href={`mailto:${supportEmail}`}
                    className="hover:text-[#0f2b5c] transition-colors"
                  >
                    {supportEmail}
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#0f2b5c] shrink-0" />
                  <span>{lang === 'en' ? 'Monday – Friday, 08:30 – 18:00 (EST)' : 'Lundi – Vendredi, 08:30 – 18:00 (HNE / EST)'}</span>
                </li>
              </ul>
            </div>

            {/* Colonne 3 : Informations Légales & Certifications */}
            <div className="md:col-span-4 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0f2b5c]">
                {lang === 'en' ? 'Regulatory Framework & Security' : 'Cadre Réglementaire & Sécurité'}
              </h4>
              <p className="text-xs text-[#666] leading-relaxed">
                {lang === 'en'
                  ? 'Regulated under the Bank Act (Canada) • Supervised by OSFI • Member of Canada Deposit Insurance Corporation (CDIC).'
                  : 'Régie par la Loi sur les banques (Canada) • Supervisée par le Bureau du surintendant des institutions financières (BSIF / OSFI) • Membre de la Société d\'assurance-dépôts du Canada (SADC / CDIC).'}
              </p>
              <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-[#777]">
                <span className="inline-flex items-center gap-1 bg-[#edf3fa] text-[#0f2b5c] px-2.5 py-1 rounded-md">
                  <ShieldCheck className="w-3 h-3 text-[#0f2b5c]" /> FINTRAC M20341567
                </span>
                <span className="inline-flex items-center gap-1 bg-[#edf3fa] text-[#0f2b5c] px-2.5 py-1 rounded-md">
                  <ShieldCheck className="w-3 h-3 text-[#0f2b5c]" /> {lang === 'en' ? 'CDIC Protected' : 'SADC / CDIC Protégé'}
                </span>
                <span className="inline-flex items-center gap-1 bg-[#edf3fa] text-[#0f2b5c] px-2.5 py-1 rounded-md">
                  <ShieldCheck className="w-3 h-3 text-[#0f2b5c]" /> AMF Québec n° 24-0917
                </span>
              </div>
              <div className="pt-3">
                <Link
                  to="/administration"
                  className="text-[11px] text-[#627592] hover:text-[#0f2b5c] underline-offset-4 hover:underline transition-colors"
                >
                  {lang === 'en' ? 'Secure Admin Portal' : 'Portail Administration Sécurisée'}
                </Link>
              </div>
            </div>
          </div>

          {/* Mentions copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#8a857e] gap-4">
            <p>© 2026 VersalBank Corporation. {lang === 'en' ? 'All rights reserved.' : 'Tous droits réservés.'}</p>
            <div className="flex items-center gap-6">
              <Link to="/a-propos" className="hover:text-[#1a1a1a] transition-colors">
                {lang === 'en' ? 'Governance & Principles' : 'Gouvernance & Piliers'}
              </Link>
              <Link to="/a-propos" className="hover:text-[#1a1a1a] transition-colors">
                {lang === 'en' ? 'Terms & Conditions' : 'Termes & Conditions'}
              </Link>
              <Link to="/a-propos" className="hover:text-[#1a1a1a] transition-colors">
                {lang === 'en' ? 'Privacy Policy' : 'Politique de Confidentialité'}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
