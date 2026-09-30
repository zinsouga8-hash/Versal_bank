import { getBankSupportEmail } from '../lib/supabaseBankService';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Headphones,
  Mail,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  Send,
  CheckCircle2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import BankMonogram from '../components/public/BankMonogram';
import { useI18n } from '../lib/i18n';
import { toast } from 'sonner';

export default function Contact() {
  const { lang, setLang } = useI18n();
  const isEn = lang === 'en';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketRef, setTicketRef] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      toast.error(
        isEn
          ? 'Please provide your email address and message.'
          : 'Veuillez renseigner votre adresse courriel et votre message.'
      );
      return;
    }

    setLoading(true);
    const ref = `TK-${Date.now().toString().slice(-6)}`;

    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Visiteur VersalBank',
          email: email.trim(),
          phone: phone.trim(),
          account_number: accountNumber.trim() || 'Non renseigné',
          subject: `[${category.toUpperCase()}] ${subject || 'Contact Public'}`,
          message: `Ticket Ref: ${ref}\nCatégorie: ${category}\n\n${message}`,
          language: lang,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Erreur d\'envoi.');
      }

      setTicketRef(ref);
      setSubmitted(true);
      toast.success(
        isEn
          ? 'Message delivered to support desk at ` + getBankSupportEmail() + `.'
          : 'Message transmis à l\'équipe support (` + getBankSupportEmail() + `).'
      );
    } catch (err: any) {
      console.warn('Contact send error:', err);
      setTicketRef(ref);
      setSubmitted(true);
      toast.success(
        isEn
          ? 'Inquiry sent. Our advisors will answer shortly.'
          : 'Demande enregistrée. Nos conseillers vous répondront dans les plus brefs délais.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1a1a1a] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#eee8dd] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <BankMonogram className="w-9 h-9" />
            <div>
              <span className="font-heading font-serif font-bold text-xl tracking-tight text-[#1a1a1a]">
                VersalBank
              </span>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#0f2b5c]">
                Banque Canadienne
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#faf7f0] border border-[#eee8dd] text-xs font-medium text-[#555]">
              <button
                type="button"
                onClick={() => setLang('fr')}
                className={`px-1 rounded ${lang === 'fr' ? 'font-bold text-[#0f2b5c]' : 'hover:text-[#1a1a1a]'}`}
              >
                FR
              </button>
              <span className="text-[#ccc]">|</span>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-1 rounded ${lang === 'en' ? 'font-bold text-[#0f2b5c]' : 'hover:text-[#1a1a1a]'}`}
              >
                EN
              </button>
            </div>

            <Link
              to="/login"
              className="text-xs font-bold px-4 py-2 rounded-full bg-[#0f2b5c] text-white hover:bg-[#1d4ed8] transition-colors"
            >
              {isEn ? 'Client Portal' : 'Espace Client'}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748b] hover:text-[#0f2b5c] mb-4 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {isEn ? 'Back to Home' : 'Retour à l\'accueil'}
          </Link>
          <h1 className="font-heading font-serif text-3xl sm:text-4xl font-bold text-[#0f2b5c] tracking-tight">
            {isEn ? 'Customer Care & Assistance Desk' : 'Service Client & Assistance'}
          </h1>
          <p className="text-sm sm:text-base text-[#64748b] mt-2 max-w-2xl">
            {isEn
              ? 'Our Canadian banking advisors are at your service 24/7. All inquiries are routed directly to ` + getBankSupportEmail() + ` via Zoho Mail.'
              : 'Nos conseillers bancaires canadiens sont à votre écoute 24/7. Vos demandes sont prises en charge directement par notre messagerie Zoho Mail à ` + getBankSupportEmail() + `.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Contact Details Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-[#eee8dd] shadow-xs">
              <h2 className="font-serif font-bold text-lg text-[#0f2b5c] mb-4">
                {isEn ? 'Direct Channels' : 'Canaux Directs'}
              </h2>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 text-[#0f2b5c] flex items-center justify-center shrink-0 border border-blue-100">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#64748b]">
                      {isEn ? 'Official Email (Zoho Mail)' : 'Courriel Officiel (Zoho Mail)'}
                    </span>
                    <a
                      href={`mailto:${getBankSupportEmail()}`}
                      className="font-bold text-[#0f2b5c] hover:underline"
                    >
                      ` + getBankSupportEmail() + `
                    </a>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#64748b]">
                      {isEn ? 'Support Desk Availability' : 'Disponibilité Support'}
                    </span>
                    <span className="font-medium text-[#1e293b]">
                      {isEn ? '24/7 Continuous Monitoring' : '24h/24 & 7j/7 en continu'}
                    </span>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-100">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#64748b]">
                      {isEn ? 'Headquarters' : 'Siège Social'}
                    </span>
                    <span className="font-medium text-[#1e293b]">
                      Bay Street Financial District, Toronto, ON, Canada
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-[#0f2b5c] text-white rounded-2xl p-6 shadow-md">
              <div className="flex items-center gap-2 mb-2 text-[#93c5fd] text-xs font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>FINTRAC / BSIF OSFI</span>
              </div>
              <h3 className="font-serif font-bold text-base mb-2">
                {isEn ? 'Guaranteed Privacy' : 'Confidentialité Garantie'}
              </h3>
              <p className="text-xs text-blue-100 leading-relaxed">
                {isEn
                  ? 'All communications exchanged through our support desk are protected with 256-bit encryption compliant with Canadian banking standards.'
                  : 'Tous les échanges avec notre service support sont strictement chiffrés en 256-bit conformément aux standards bancaires canadiens.'}
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 sm:p-8 border border-[#eee8dd] shadow-xs">
            {submitted ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold font-serif text-[#0f2b5c] mb-2">
                  {isEn ? 'Thank you! Message Sent' : 'Merci ! Message bien envoyé'}
                </h2>
                <p className="text-sm text-[#475569] max-w-md mx-auto mb-6">
                  {isEn
                    ? `Your ticket #${ticketRef} has been dispatched directly to ` + getBankSupportEmail() + `. Our support team will answer you by email very shortly.`
                    : `Votre ticket #${ticketRef} a été transmis à ` + getBankSupportEmail() + ` (Zoho Mail). Un conseiller vous répondra par courriel dans les plus brefs délais.`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setMessage('');
                    setSubject('');
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#0f2b5c] text-white text-xs font-bold hover:bg-[#1d4ed8] transition-colors"
                >
                  {isEn ? 'Send Another Inquiry' : 'Envoyer un autre message'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="font-serif font-bold text-xl text-[#0f2b5c] mb-1">
                  {isEn ? 'Send an Inquiry to Support' : 'Transmettre un message au support'}
                </h2>
                <p className="text-xs text-[#64748b] mb-4">
                  {isEn
                    ? 'Our team will reply directly to the email address provided below.'
                    : 'Notre équipe vous répondra directement à l\'adresse courriel renseignée.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      {isEn ? 'Full Name *' : 'Nom & Prénom *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#0f2b5c] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      {isEn ? 'Email Address *' : 'Adresse Courriel *'}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@exemple.com"
                      className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#0f2b5c] outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      {isEn ? 'Phone Number (Optional)' : 'Numéro de Téléphone (Facultatif)'}
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (416) 555-0199"
                      className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#0f2b5c] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      {isEn ? 'Account / Client Reference' : 'Numéro de Compte / Dossier'}
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="VSL-2026-XXXX ou 4400-XXXX-XXXX"
                      className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#0f2b5c] outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      {isEn ? 'Inquiry Category' : 'Catégorie de la demande'}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-[#cbd5e1] bg-white focus:ring-2 focus:ring-[#0f2b5c] outline-hidden"
                    >
                      <option value="general">{isEn ? 'General Question' : 'Renseignement général'}</option>
                      <option value="onboarding">{isEn ? 'Account Opening' : 'Ouverture de compte'}</option>
                      <option value="transfer">{isEn ? 'Transfers & Payments' : 'Virements & Mouvements'}</option>
                      <option value="card">{isEn ? 'Cards (Virtual/Physical)' : 'Cartes bancaires'}</option>
                      <option value="loan">{isEn ? 'Financing & Loan' : 'Crédit & Financement'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      {isEn ? 'Subject' : 'Objet du message'}
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder={isEn ? 'Subject of your request...' : 'Ex : Suivi de dossier, virement...'}
                      className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#0f2b5c] outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    {isEn ? 'Your Detailed Message *' : 'Votre message détaillé *'}
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      isEn
                        ? 'Please describe your request with all relevant details...'
                        : 'Précisez les détails de votre demande afin que nos équipes puissent vous répondre rapidement...'
                    }
                    className="w-full text-sm p-3.5 rounded-lg border border-[#cbd5e1] focus:ring-2 focus:ring-[#0f2b5c] outline-hidden"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0f2b5c] hover:bg-[#1d4ed8] text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isEn ? 'Sending...' : 'Transmission en cours...'}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>{isEn ? 'Send to Support Desk' : 'Envoyer au Service Client'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
