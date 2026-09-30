import { getBankSupportEmail } from './supabaseBankService';
import { logSentEmail } from './supabaseBankService';

export type LanguageCode = 'fr' | 'en';

export type EmailType = 
  | 'WELCOME'
  | 'ACCOUNT_SUBMITTED' 
  | 'ACCOUNT_APPROVED' 
  | 'ACCOUNT_REJECTED'
  | 'ACCOUNT_ON_HOLD'
  | 'ACCOUNT_ACTIVATED' 
  | 'CARD_ACTIVATED' 
  | 'CARD_ORDERED'
  | 'CARD_STATUS'
  | 'CARD_FROZEN'
  | 'TRANSFER_SUBMITTED' 
  | 'TRANSFER_STATUS' 
  | 'TRANSACTION_EXECUTED'
  | 'LOAN_SUBMITTED' 
  | 'LOAN_STATUS'
  | 'SECURITY_ALERT'
  | 'SUPPORT_TICKET'
  | 'OTP_CODE';

export interface EmailPayload {
  to: string;
  recipientName?: string;
  type: EmailType;
  subject: string;
  title: string;
  contentLines: string[];
  actionLabel?: string;
  actionUrl?: string;
  badgeText?: string;
  language?: LanguageCode;
  metadata?: Record<string, any>;
  notifyAdmin?: boolean;
}

// ----------------------------------------------------------------------------
// AUTHORITATIVE EMAIL ROLES & SEPARATION
// ----------------------------------------------------------------------------
// A. Adresse expéditrice des notifications automatiques destinées aux clients
export const CLIENT_NOTIFICATIONS_SENDER_EMAIL = 'support@versalbank.com';
export const DEFAULT_SENDER_EMAIL = (import.meta.env.VITE_SENDER_EMAIL as string) || 'support@versalbank.com';
export const OFFICIAL_SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string) || getBankSupportEmail() || 'support@versalbank.com';

// B. Adresse de l'administrateur (destinataire exclusif des alertes nécessitant intervention)
export const ADMIN_NOTIFICATION_RECIPIENT_EMAIL = 'contact@versalbank.com';
export const ADMIN_NOTIFICATION_EMAIL = (import.meta.env.VITE_ADMIN_ALERT_EMAIL as string) || 'contact@versalbank.com';

// Sliding anti-duplicate cache (10 seconds window)
const recentDispatches = new Map<string, number>();

/**
 * Generates high-end Canadian banking HTML email with responsive styling
 */
export function generateEmailHtml(payload: EmailPayload): string {
  const isEn = payload.language === 'en';
  const locale = isEn ? 'en-CA' : 'fr-CA';
  const dateStr = new Date().toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const linesHtml = payload.contentLines
    .map(line => `<p style="margin: 0 0 14px 0; line-height: 1.6; color: #334155; font-size: 15px;">${line}</p>`)
    .join('');

  const actionButton = payload.actionUrl && payload.actionLabel ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${payload.actionUrl}" style="background: linear-gradient(135deg, #1d4ed8, #0f2b5c); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 9999px; display: inline-block; letter-spacing: 0.5px;">
        ${payload.actionLabel}
      </a>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${payload.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a1324; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a1324; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f2b5c; padding: 32px 40px; text-align: center; border-bottom: 3px solid #2563eb;">
              <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: 2px; margin: 0; font-family: 'Bodoni Moda', serif, Georgia;">VERSALBANK</h1>
              <p style="color: #93c5fd; font-size: 12px; margin: 6px 0 0 0; letter-spacing: 1px; text-transform: uppercase;">
                ${isEn ? 'Regulated Canadian Bank • Toronto' : 'Banque Canadienne Réglementée • Toronto'}
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #0f2b5c; font-size: 20px; font-weight: 700; margin: 0 0 20px 0;">${payload.title}</h2>
              <div style="background-color: #f8fafc; border-left: 4px solid #0f2b5c; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
                <p style="margin: 0; color: #64748b; font-size: 13px;">${isEn ? 'Issuing Date' : 'Date d\'émission'} : <strong>${dateStr}</strong></p>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">${isEn ? 'Recipient' : 'Destinataire'} : <strong>${payload.to}</strong></p>
              </div>
              
              ${linesHtml}
              ${actionButton}

              <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
                <p style="margin: 0 0 4px 0;">${isEn ? 'Operations & Compliance Division,' : 'L\'Équipe des Opérations & Conformité,'}</p>
                <p style="margin: 0; font-weight: 600; color: #0f172a;">VersalBank Banque Canadienne</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #2563eb;">
                  <a href="mailto:${DEFAULT_SENDER_EMAIL}" style="color: #2563eb; text-decoration: none;">${DEFAULT_SENDER_EMAIL}</a>
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 24px 40px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 8px 0;">VersalBank Banque Canadienne Inc. • Siège social : Toronto, Ontario, Canada.</p>
              <p style="margin: 0 0 8px 0;">${isEn ? 'Regulated by OSFI / BSIF • CDIC / SADC Member • FINTRAC: M20341567' : 'Régulé par le BSIF / OSFI • Membre SADC / CDIC • Inscrit FINTRAC : M20341567'}</p>
              <p style="margin: 0; color: #94a3b8;">${isEn ? `This confidential communication is intended solely for the named recipient. Official support: ${DEFAULT_SENDER_EMAIL}.` : `Ce message confidentiel est destiné exclusivement au destinataire désigné. Support officiel : ${DEFAULT_SENDER_EMAIL}.`}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send an automated transactional email via Resend API & persist audit log
 * Strictly prevents duplicates and preserves exact separation between client and admin
 */
export async function sendAutomaticEmail(payload: EmailPayload): Promise<boolean> {
  const cleanTo = payload.to.trim().toLowerCase();
  const dedupKey = `${cleanTo}:::${payload.subject.trim()}:::${payload.type}`;
  const now = Date.now();
  const lastDispatched = recentDispatches.get(dedupKey);

  // Anti-duplicate protection: Ignore identical dispatches within 8 seconds
  if (lastDispatched && now - lastDispatched < 8000) {
    console.info(`[VersalBank Anti-Duplicate] Throttled identical email to ${cleanTo} (${payload.subject})`);
    return true;
  }
  recentDispatches.set(dedupKey, now);

  if (recentDispatches.size > 300) {
    for (const [k, v] of recentDispatches.entries()) {
      if (now - v > 60000) recentDispatches.delete(k);
    }
  }

  const emailId = `EML-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const msgId = `MSG-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const html = generateEmailHtml(payload);
  const plainBody = `${payload.title}\n\n${payload.contentLines.join('\n\n')}\n\nVersalBank Banque Canadienne Réglementée\nFINTRAC M20341567 • OSFI / BSIF • ${DEFAULT_SENDER_EMAIL}`;

  // 1. Audit Log in Supabase Bank Service (non-blocking)
  try {
    await logSentEmail({
      id: emailId,
      recipient: payload.to,
      recipientName: payload.recipientName || '',
      type: payload.type,
      subject: payload.subject,
      title: payload.title,
      contentLines: payload.contentLines,
      html: html,
      status: 'delivered',
      language: payload.language || 'fr',
      metadata: payload.metadata || {},
      createdAt: Date.now()
    });
  } catch (auditErr) {
    console.warn("[VersalBank Audit Notice] SentEmails log note:", auditErr);
  }

  // 2. Log into ClientMessages if destined to a client account
  if (cleanTo !== ADMIN_NOTIFICATION_RECIPIENT_EMAIL.toLowerCase()) {
    try {
      const rawMessages = localStorage.getItem('versalbank_client_messages') || '[]';
      const parsed = JSON.parse(rawMessages);
      parsed.unshift({
        id: msgId,
        client_email: payload.to,
        subject: payload.subject,
        body: payload.contentLines.join('\n\n'),
        html: html,
        type: payload.type,
        read: false,
        createdAt: Date.now()
      });
      localStorage.setItem('versalbank_client_messages', JSON.stringify(parsed.slice(0, 100)));
    } catch (msgErr) {
      console.warn("[VersalBank Portal Notice] ClientMessages note:", msgErr);
    }
  }

  // 3. Dispatch through Resend Backend Endpoint (/api/send-email)
  // Expéditeur des notifications clients : support@versalbank.com
  // Destinataire : payload.to
  // contact@versalbank.com is NEVER automatically added in CC or BCC
  try {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiBase}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        html: html,
        text: plainBody,
        from: `VersalBank Support <${DEFAULT_SENDER_EMAIL}>`,
        reply_to: DEFAULT_SENDER_EMAIL,
        replyTo: DEFAULT_SENDER_EMAIL,
        notifyAdmin: false,
        adminTitle: payload.subject,
      }),
    });

    const data = await res.json();
    console.info(`[VersalBank Email Dispatch] To ${payload.to}:`, data);
  } catch (apiErr) {
    console.warn("[VersalBank Email Dispatch] Notice:", apiErr);
  }

  // 4. Broadcast event so UI components can reflect instant notification
  try {
    window.dispatchEvent(new CustomEvent('versalbank_email_dispatched', {
      detail: {
        to: payload.to,
        subject: payload.subject,
        type: payload.type,
        metadata: payload.metadata || {}
      }
    }));
  } catch (_) {}

  return true;
}

/**
 * Dispatch an administrative alert notification to bank management
 * Destinataire exclusif : contact@versalbank.com
 * Expéditeur : support@versalbank.com
 * Uniquement lorsqu'une action ou une demande nécessite l'intervention de l'administrateur
 */
export async function notifyAdminCopy(
  subject: string, 
  title: string, 
  contentLines: string[], 
  metadata?: Record<string, any>
) {
  try {
    await sendAutomaticEmail({
      to: ADMIN_NOTIFICATION_RECIPIENT_EMAIL, // contact@versalbank.com
      recipientName: 'Direction & Administration VersalBank',
      type: 'ACCOUNT_ACTIVATED',
      subject: `[ALERTE ADMIN] ${subject}`,
      title: title,
      contentLines: [
        `Notification administrative nécessitant une intervention dans le tableau de bord VersalBank :`,
        ...contentLines
      ],
      actionLabel: "Accéder au Panneau d'Administration",
      actionUrl: '/administration',
      metadata: metadata || {},
      notifyAdmin: false // Avoid recursion
    });
  } catch (err) {
    console.warn("[VersalBank Admin Notify] Notice:", err);
  }
}

// ============================================================================
// BILINGUAL HIGH-LEVEL BANKING EVENT TRIGGERS
// ============================================================================

/**
 * 1. CODE OTP LORS DE L'INSCRIPTION
 * Expéditeur : support@versalbank.com -> adresse email du client
 * L'administrateur ne reçoit JAMAIS le code OTP (pas de CC, pas de BCC, pas de copie)
 */
export async function notifyOtpSent(recipientEmail: string, otpCode: string, language: LanguageCode = 'fr') {
  const isEn = language === 'en';
  return sendAutomaticEmail({
    to: recipientEmail,
    type: 'OTP_CODE',
    subject: isEn ? `VERSALBANK — Your Security Passcode (${otpCode})` : `VERSALBANK — Votre code de sécurité OTP (${otpCode})`,
    title: isEn ? 'One-Time Security Verification' : 'Code de vérification d\'accès sécurisé',
    contentLines: isEn ? [
      `Hello,`,
      `Here is your one-time verification passcode (OTP) for your VersalBank registration / verification:`,
      `<div style="text-align: center; margin: 24px 0;"><span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f2b5c; background: #edf3fa; padding: 12px 28px; border-radius: 12px; border: 2px dashed #0f2b5c; display: inline-block;">${otpCode}</span></div>`,
      `This code is strictly confidential and valid for 15 minutes. Never share this passcode with anyone. If you did not initiate this request, please contact our support.`
    ] : [
      `Bonjour,`,
      `Voici votre code d'authentification à usage unique (OTP) pour confirmer votre opération ou inscription VersalBank :`,
      `<div style="text-align: center; margin: 24px 0;"><span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f2b5c; background: #edf3fa; padding: 12px 28px; border-radius: 12px; border: 2px dashed #0f2b5c; display: inline-block;">${otpCode}</span></div>`,
      `Ce code est strictement confidentiel et valable 15 minutes. Aucun collaborateur de VersalBank ne vous demandera votre code OTP.`
    ],
    language,
    metadata: { otp: otpCode },
    notifyAdmin: false // Strictly false: admin does NOT receive OTP codes
  });
}

/**
 * 2. DEMANDE DE CRÉATION DE COMPTE (Soumission du formulaire)
 * Client : support@versalbank.com -> client (demande enregistrée, dossier reçu, en cours de traitement)
 * Admin : -> contact@versalbank.com (notification de nouvelle demande nécessitant examen)
 */
export async function notifyAccountSubmitted(client: { 
  user_email: string; 
  first_name?: string; 
  last_name?: string; 
  client_id?: string;
  language?: LanguageCode;
}) {
  const isEn = client.language === 'en';
  const name = `${client.first_name || ''} ${client.last_name || ''}`.trim() || (isEn ? 'Valued Customer' : 'Client Privé');

  const subject = isEn
    ? 'VERSALBANK — Welcome! Account Application Received'
    : 'VERSALBANK — Bienvenue ! Réception de votre demande d\'ouverture';

  const title = isEn
    ? 'Your VersalBank Account Application is Under Review'
    : 'Votre demande d\'ouverture de compte a été reçue';

  const contentLines = isEn ? [
    `Hello <strong>${name}</strong>,`,
    `Welcome to VersalBank Canada. We confirm the receipt of your account opening application under file reference: <strong>${client.client_id || 'Pending'}</strong>.`,
    `Our compliance and verification division is auditing your submission in accordance with Canadian OSFI / FINTRAC guidelines.`,
    `Standard processing takes between 12 and 24 business hours. You will receive an instant confirmation email once your account is unlocked.`
  ] : [
    `Bonjour <strong>${name}</strong>,`,
    `Bienvenue au sein de VersalBank Canada. Nous confirmons la bonne réception de votre dossier d'ouverture de compte sous la référence : <strong>${client.client_id || 'En cours'}</strong>.`,
    `Nos analystes et le service de conformité examinent vos informations conformément aux directives bancaires canadiennes (FINTRAC / BSIF).`,
    `Le délai moyen de traitement est de 12 à 24 heures ouvrées. Vous recevrez une notification par email dès que votre compte sera actif.`
  ];

  // 1. Client notification (support@versalbank.com -> client)
  const promise = sendAutomaticEmail({
    to: client.user_email,
    recipientName: name,
    type: 'ACCOUNT_SUBMITTED',
    subject,
    title,
    contentLines,
    language: client.language || 'fr',
    actionLabel: isEn ? 'Track My Application' : 'Suivre mon dossier',
    actionUrl: '/dossier-en-cours',
    metadata: { client_id: client.client_id },
    notifyAdmin: false
  });

  // 2. Admin alert (-> contact@versalbank.com)
  notifyAdminCopy(
    `Nouvelle demande de création de compte (${client.client_id || client.user_email})`,
    "Nouveau dossier d'adhésion client à auditer",
    [
      `Un nouveau client vient de soumettre une demande officielle de création de compte :`,
      `• Titulaire : <strong>${name}</strong>`,
      `• Adresse email : <strong>${client.user_email}</strong>`,
      `• Identifiant dossier : <strong>${client.client_id || 'En cours'}</strong>`,
      `• Action requise : Rendez-vous dans le tableau de bord administrateur (Clients) pour auditer le dossier et approuver l'ouverture.`
    ],
    { client_id: client.client_id, user_email: client.user_email }
  );

  return promise;
}

/**
 * 3. ALERTE DE SÉCURITÉ LORS DE LA CONNEXION D'UN CLIENT
 * Expéditeur : support@versalbank.com -> client uniquement
 * L'administrateur ne reçoit JAMAIS cette alerte (aucun email à contact@versalbank.com, aucun CC/BCC)
 */
export async function notifySecurityAlert(data: {
  user_email: string;
  first_name?: string;
  alert_type: 'new_device' | 'pin_changed' | 'password_changed' | 'failed_attempts';
  ip_address?: string;
  device_name?: string;
  language?: LanguageCode;
}) {
  const isEn = data.language === 'en';
  const alertTitles = {
    new_device: isEn ? 'New Sign-in Detected' : 'Nouvelle connexion détectée',
    pin_changed: isEn ? 'Security PIN Modified' : 'Code PIN de sécurité modifié',
    password_changed: isEn ? 'Portal Password Changed' : 'Mot de passe modifié',
    failed_attempts: isEn ? 'Multiple Failed Login Attempts' : 'Tentatives d\'accès infructueuses'
  };

  const subject = isEn
    ? `VERSALBANK — Security Alert: ${alertTitles[data.alert_type]}`
    : `VERSALBANK — Alerte de sécurité : ${alertTitles[data.alert_type]}`;

  const contentLines = isEn ? [
    `Hello <strong>${data.first_name || 'Valued Customer'}</strong>,`,
    `We noticed a security event related to your VersalBank online banking profile:`,
    `• <strong>Event:</strong> ${alertTitles[data.alert_type]}`,
    `• <strong>Device:</strong> ${data.device_name || 'Web Browser'}`,
    `• <strong>IP Address:</strong> ${data.ip_address || 'Protected IP'}`,
    `• <strong>Timestamp:</strong> ${new Date().toLocaleString('en-CA')}`,
    `If you initiated this action, no further action is required. If you did NOT initiate this, please freeze your cards and contact our 24/7 security desk immediately at <a href="mailto:${DEFAULT_SENDER_EMAIL}">${DEFAULT_SENDER_EMAIL}</a>.`
  ] : [
    `Bonjour <strong>${data.first_name || 'Client(e)'}</strong>,`,
    `Un événement de sécurité concernant votre espace client VersalBank vient d'être détecté :`,
    `• <strong>Événement :</strong> ${alertTitles[data.alert_type]}`,
    `• <strong>Appareil / Navigateur :</strong> ${data.device_name || 'Navigateur Web'}`,
    `• <strong>Adresse IP :</strong> ${data.ip_address || 'IP Chiffrée'}`,
    `• <strong>Date & Heure :</strong> ${new Date().toLocaleString('fr-CA')}`,
    `Si vous êtes à l'origine de cette action, vous pouvez ignorer cet email. Dans le cas contraire, bloquez immédiatement vos cartes depuis votre espace ou contactez notre cellule sécurité à <a href="mailto:${DEFAULT_SENDER_EMAIL}">${DEFAULT_SENDER_EMAIL}</a>.`
  ];

  // Strictly sent to CLIENT only. Admin does NOT receive user login alerts.
  return sendAutomaticEmail({
    to: data.user_email,
    type: 'SECURITY_ALERT',
    subject,
    title: isEn ? 'VersalBank Security Notification' : 'Avis de sécurité bancaire VersalBank',
    contentLines,
    language: data.language || 'fr',
    actionLabel: isEn ? 'Open Security Center' : 'Vérifier mon compte',
    actionUrl: '/portail',
    metadata: { alert_type: data.alert_type },
    notifyAdmin: false
  });
}

export interface AccountCreditDebitParams {
  user_email: string;
  first_name?: string;
  amount: number;
  currency: string;
  new_balance?: number;
  motif?: string;
  reference?: string;
  date?: string;
  language?: LanguageCode;
}

/**
 * 4. CRÉDIT EFFECTUÉ PAR L'ADMINISTRATEUR
 * Expéditeur : support@versalbank.com -> client uniquement
 * L'administrateur ne reçoit pas de copie automatique
 */
export async function notifyAdminCreditExecuted(data: AccountCreditDebitParams) {
  const isEn = data.language === 'en';
  const formattedAmount = `${data.amount.toLocaleString(isEn ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2 })} ${data.currency}`;
  const formattedBalance = data.new_balance !== undefined 
    ? `${data.new_balance.toLocaleString(isEn ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2 })} ${data.currency}`
    : undefined;
  const dateStr = data.date || new Date().toLocaleString(isEn ? 'en-CA' : 'fr-CA');

  const subject = isEn 
    ? `VERSALBANK — Account Credit Notice (+${formattedAmount})` 
    : `VERSALBANK — Avis de crédit sur votre compte (+${formattedAmount})`;
  const title = isEn 
    ? 'Official Notice of Account Credit' 
    : 'Avis officiel d\'opération : Crédit bancaire';

  const contentLines = isEn ? [
    `Hello <strong>${data.first_name || 'Valued Customer'}</strong>,`,
    `An administrative credit has been executed on your VersalBank account:`,
    `• <strong>Amount Credited:</strong> <strong style="color: #16a34a; font-size: 16px;">+${formattedAmount}</strong>`,
    `• <strong>Date of Operation:</strong> ${dateStr}`,
    data.motif ? `• <strong>Description / Motif:</strong> ${data.motif}` : '',
    data.reference ? `• <strong>Operation Reference:</strong> ${data.reference}` : '',
    formattedBalance ? `• <strong>New Available Balance:</strong> <strong style="color: #0f2b5c;">${formattedBalance}</strong>` : '',
    `• <strong>Status:</strong> Completed & Credited.`,
    `These funds are immediately available for all transactions and card operations.`
  ].filter(Boolean) : [
    `Bonjour <strong>${data.first_name || 'Client(e)'}</strong>,`,
    `Nous vous confirmons qu'un crédit a été effectué avec succès sur votre compte VersalBank par nos services :`,
    `• <strong>Montant crédité :</strong> <strong style="color: #16a34a; font-size: 16px;">+${formattedAmount}</strong>`,
    `• <strong>Date de l'opération :</strong> ${dateStr}`,
    data.motif ? `• <strong>Motif / Libellé :</strong> ${data.motif}` : '',
    data.reference ? `• <strong>Référence de l'opération :</strong> ${data.reference}` : '',
    formattedBalance ? `• <strong>Nouveau solde disponible :</strong> <strong style="color: #0f2b5c;">${formattedBalance}</strong>` : '',
    `• <strong>Statut :</strong> Traitée et comptabilisée.`,
    `Ces fonds sont immédiatement disponibles sur votre compte et utilisables pour l'ensemble de vos opérations.`
  ].filter(Boolean);

  return sendAutomaticEmail({
    to: data.user_email,
    type: 'TRANSACTION_EXECUTED',
    subject,
    title,
    contentLines,
    language: data.language || 'fr',
    actionLabel: isEn ? 'View My Balance' : 'Consulter mon solde',
    actionUrl: '/espace/tableau-de-bord',
    metadata: { type: 'admin_credit', amount: data.amount, currency: data.currency, reference: data.reference },
    notifyAdmin: false // Strictly no copy to admin
  });
}

export const notifyAccountCredited = notifyAdminCreditExecuted;

/**
 * 5. DÉBIT EFFECTUÉ PAR L'ADMINISTRATEUR
 * Expéditeur : support@versalbank.com -> client uniquement
 * Aucune copie automatique à contact@versalbank.com
 */
export async function notifyAdminDebitExecuted(data: AccountCreditDebitParams) {
  const isEn = data.language === 'en';
  const formattedAmount = `${data.amount.toLocaleString(isEn ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2 })} ${data.currency}`;
  const formattedBalance = data.new_balance !== undefined 
    ? `${data.new_balance.toLocaleString(isEn ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2 })} ${data.currency}`
    : undefined;
  const dateStr = data.date || new Date().toLocaleString(isEn ? 'en-CA' : 'fr-CA');

  const subject = isEn 
    ? `VERSALBANK — Account Debit Notice (-${formattedAmount})` 
    : `VERSALBANK — Avis de débit sur votre compte (-${formattedAmount})`;
  const title = isEn 
    ? 'Official Notice of Account Debit' 
    : 'Avis officiel d\'opération : Débit bancaire';

  const contentLines = isEn ? [
    `Hello <strong>${data.first_name || 'Valued Customer'}</strong>,`,
    `An administrative debit has been executed on your VersalBank account:`,
    `• <strong>Amount Debited:</strong> <strong style="color: #dc2626; font-size: 16px;">-${formattedAmount}</strong>`,
    `• <strong>Date of Operation:</strong> ${dateStr}`,
    data.motif ? `• <strong>Description / Motif:</strong> ${data.motif}` : '',
    data.reference ? `• <strong>Operation Reference:</strong> ${data.reference}` : '',
    formattedBalance ? `• <strong>New Available Balance:</strong> <strong style="color: #0f2b5c;">${formattedBalance}</strong>` : '',
    `• <strong>Status:</strong> Processed & Debited.`
  ].filter(Boolean) : [
    `Bonjour <strong>${data.first_name || 'Client(e)'}</strong>,`,
    `Nous vous informons qu'un débit a été effectué sur votre compte bancaire VersalBank :`,
    `• <strong>Montant débité :</strong> <strong style="color: #dc2626; font-size: 16px;">-${formattedAmount}</strong>`,
    `• <strong>Date de l'opération :</strong> ${dateStr}`,
    data.motif ? `• <strong>Motif / Libellé :</strong> ${data.motif}` : '',
    data.reference ? `• <strong>Référence de l'opération :</strong> ${data.reference}` : '',
    formattedBalance ? `• <strong>Nouveau solde disponible :</strong> <strong style="color: #0f2b5c;">${formattedBalance}</strong>` : '',
    `• <strong>Statut :</strong> Traitée et comptabilisée.`
  ].filter(Boolean);

  return sendAutomaticEmail({
    to: data.user_email,
    type: 'TRANSACTION_EXECUTED',
    subject,
    title,
    contentLines,
    language: data.language || 'fr',
    actionLabel: isEn ? 'View My Balance' : 'Consulter mon solde',
    actionUrl: '/espace/tableau-de-bord',
    metadata: { type: 'admin_debit', amount: data.amount, currency: data.currency, reference: data.reference },
    notifyAdmin: false // Strictly no copy to admin
  });
}

export const notifyAccountDebited = notifyAdminDebitExecuted;

/**
 * 6. DEMANDE DE TRANSFERT
 * Client : support@versalbank.com -> client (demande bien reçue, en cours de traitement)
 * Admin : -> contact@versalbank.com (intervention nécessaire sur le tableau de bord)
 */
export async function notifyTransferSubmitted(
  clientOrData: any,
  transferOrUndefined?: any
) {
  let client: { user_email: string; first_name?: string; language?: LanguageCode };
  let transfer: {
    id?: string;
    reference: string;
    amount: number;
    currency: string;
    recipient_name: string;
    carrier_name?: string;
    motif?: string;
  };

  if (transferOrUndefined) {
    client = clientOrData;
    transfer = transferOrUndefined;
  } else {
    client = {
      user_email: clientOrData.user_email,
      first_name: clientOrData.first_name,
      language: clientOrData.language,
    };
    transfer = {
      id: clientOrData.id,
      reference: clientOrData.reference || `TRF-${Date.now()}`,
      amount: clientOrData.amount,
      currency: clientOrData.currency,
      recipient_name: clientOrData.recipient_name,
      carrier_name: clientOrData.carrier_name,
      motif: clientOrData.motif,
    };
  }

  const isEn = client.language === 'en';
  const formattedAmount = `${transfer.amount.toLocaleString(isEn ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2 })} ${transfer.currency}`;

  // 1. Email au client (support@versalbank.com -> client)
  const clientPromise = sendAutomaticEmail({
    to: client.user_email,
    type: 'TRANSFER_SUBMITTED',
    subject: isEn 
      ? `VERSALBANK — Transfer Request Received (${formattedAmount})` 
      : `VERSALBANK — Demande de virement enregistrée (${formattedAmount})`,
    title: isEn ? 'Your Transfer Order is Being Processed' : 'Votre demande de virement a bien été reçue',
    contentLines: isEn ? [
      `Hello <strong>${client.first_name || 'Valued Customer'}</strong>,`,
      `We confirm the receipt of your wire transfer order:`,
      `• <strong>Amount:</strong> <strong style="color: #0f2b5c;">${formattedAmount}</strong>`,
      `• <strong>Beneficiary:</strong> <strong>${transfer.recipient_name}</strong>`,
      transfer.carrier_name ? `• <strong>Network / Method:</strong> ${transfer.carrier_name}` : '',
      `• <strong>Reference:</strong> <strong>${transfer.reference}</strong>`,
      `• <strong>Status:</strong> Processing / Pending administrative review.`,
      `Your request is being reviewed by our banking operations desk. You will receive an instant notification once the transfer is finalized.`
    ].filter(Boolean) : [
      `Bonjour <strong>${client.first_name || 'Client(e)'}</strong>,`,
      `Nous vous confirmons la bonne réception de votre demande de virement bancaire :`,
      `• <strong>Montant :</strong> <strong style="color: #0f2b5c;">${formattedAmount}</strong>`,
      `• <strong>Bénéficiaire :</strong> <strong>${transfer.recipient_name}</strong>`,
      transfer.carrier_name ? `• <strong>Réseau / Méthode :</strong> ${transfer.carrier_name}` : '',
      `• <strong>Référence officielle :</strong> <strong>${transfer.reference}</strong>`,
      `• <strong>Statut :</strong> En cours de traitement par notre service des opérations.`,
      `Votre ordre est actuellement pris en charge par notre service de compensation. Vous recevrez une notification par email dès confirmation de son exécution définitive.`
    ].filter(Boolean),
    language: client.language || 'fr',
    actionLabel: isEn ? 'Track Transfer' : 'Suivre mon virement',
    actionUrl: '/espace/tableau-de-bord',
    metadata: { reference: transfer.reference, amount: transfer.amount },
    notifyAdmin: false
  });

  // 2. Email à l'administrateur (-> contact@versalbank.com)
  notifyAdminCopy(
    `Nouvelle demande de transfert - ${transfer.reference} (${formattedAmount})`,
    "Nouvelle demande de virement nécessitant une intervention",
    [
      `Un client vient de soumettre une nouvelle demande de virement bancaire nécessitant votre arbitrage dans le tableau de bord :`,
      `• Client : <strong>${client.user_email}</strong>`,
      `• Montant : <strong style="color: #0f2b5c;">${formattedAmount}</strong>`,
      `• Bénéficiaire : <strong>${transfer.recipient_name}</strong>`,
      transfer.carrier_name ? `• Méthode : <strong>${transfer.carrier_name}</strong>` : '',
      `• Référence : <strong>${transfer.reference}</strong>`,
      `• Action requise : Connectez-vous au tableau de bord pour approuver, rejeter ou mettre en attente ce virement.`
    ].filter(Boolean),
    { reference: transfer.reference, client_email: client.user_email, amount: transfer.amount }
  );

  return clientPromise;
}

/**
 * 7. DEMANDE DE DÉPÔT / APPROVISIONNEMENT
 * Client : support@versalbank.com -> client (demande reçue, en cours de traitement)
 * Admin : -> contact@versalbank.com (intervention nécessaire sur le tableau de bord)
 */
export async function notifyDepositSubmitted(
  clientOrData: any,
  depositOrUndefined?: any
) {
  let client: { user_email: string; first_name?: string; language?: LanguageCode };
  let deposit: {
    id?: string;
    reference?: string;
    amount: number;
    currency: string;
    channel_name: string;
    motif?: string;
  };

  if (depositOrUndefined) {
    client = clientOrData;
    deposit = depositOrUndefined;
  } else {
    client = {
      user_email: clientOrData.user_email,
      first_name: clientOrData.first_name,
      language: clientOrData.language,
    };
    deposit = {
      id: clientOrData.id,
      reference: clientOrData.reference,
      amount: clientOrData.amount,
      currency: clientOrData.currency,
      channel_name: clientOrData.channel_name || clientOrData.channel || 'Virement bancaire / Carte',
      motif: clientOrData.motif,
    };
  }

  const isEn = client.language === 'en';
  const formattedAmount = `${deposit.amount.toLocaleString(isEn ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2 })} ${deposit.currency}`;

  // 1. Email au client (support@versalbank.com -> client)
  const clientPromise = sendAutomaticEmail({
    to: client.user_email,
    type: 'TRANSACTION_EXECUTED',
    subject: isEn 
      ? `VERSALBANK — Deposit Request Received (${formattedAmount})` 
      : `VERSALBANK — Demande de dépôt enregistrée (${formattedAmount})`,
    title: isEn ? 'Your Funding Request is Being Processed' : 'Votre demande de dépôt a bien été reçue',
    contentLines: isEn ? [
      `Hello <strong>${client.first_name || 'Valued Customer'}</strong>,`,
      `We have received your funding / deposit request:`,
      `• <strong>Amount:</strong> <strong style="color: #0f2b5c;">${formattedAmount}</strong>`,
      `• <strong>Channel / Method:</strong> <strong>${deposit.channel_name}</strong>`,
      deposit.reference ? `• <strong>Reference:</strong> <strong>${deposit.reference}</strong>` : '',
      `• <strong>Status:</strong> In review / Under validation.`,
      `Our treasury department is verifying receipt of funds. Your account will be credited as soon as the funds are cleared.`
    ].filter(Boolean) : [
      `Bonjour <strong>${client.first_name || 'Client(e)'}</strong>,`,
      `Nous vous confirmons la bonne réception de votre demande de dépôt / approvisionnement :`,
      `• <strong>Montant :</strong> <strong style="color: #0f2b5c;">${formattedAmount}</strong>`,
      `• <strong>Canal / Méthode :</strong> <strong>${deposit.channel_name}</strong>`,
      deposit.reference ? `• <strong>Référence de l'opération :</strong> <strong>${deposit.reference}</strong>` : '',
      `• <strong>Statut :</strong> En cours de traitement par notre service de trésorerie.`,
      `Notre service financier procède à la vérification de la réception des fonds. Votre solde sera crédité automatiquement dès confirmation du règlement.`
    ].filter(Boolean),
    language: client.language || 'fr',
    actionLabel: isEn ? 'View Banking Portal' : 'Accéder à mon espace',
    actionUrl: '/espace/tableau-de-bord',
    metadata: { reference: deposit.reference, amount: deposit.amount, channel: deposit.channel_name },
    notifyAdmin: false
  });

  // 2. Email à l'administrateur (-> contact@versalbank.com)
  notifyAdminCopy(
    `Nouvelle demande de dépôt - ${deposit.channel_name} (${formattedAmount})`,
    "Nouvelle demande d'approvisionnement nécessitant validation",
    [
      `Un client vient de soumettre une nouvelle demande de dépôt / recharge de compte :`,
      `• Client : <strong>${client.user_email}</strong>`,
      `• Montant : <strong style="color: #0f2b5c;">${formattedAmount}</strong>`,
      `• Canal de paiement : <strong>${deposit.channel_name}</strong>`,
      deposit.reference ? `• Référence : <strong>${deposit.reference}</strong>` : '',
      `• Action requise : Rendez-vous dans le tableau de bord administrateur (Mouvements) pour valider et créditer ce dépôt une fois les fonds reçus.`
    ].filter(Boolean),
    { client_email: client.user_email, amount: deposit.amount, channel: deposit.channel_name }
  );

  return clientPromise;
}

/**
 * 8. DEMANDE DE CARTE BANCAIRE
 * Client : support@versalbank.com -> client (confirmation de réception et statut)
 * Admin : -> contact@versalbank.com (nouvelle demande de carte nécessitant son intervention)
 */
export async function notifyCardOrdered(client: {
  user_email: string;
  first_name?: string;
  last_name?: string;
  client_id?: string;
  language?: LanguageCode;
}, card: {
  tier: string;
  card_number: string;
  is_virtual?: boolean;
  network?: string;
}) {
  const isEn = client.language === 'en';
  const maskedCard = card.card_number.length > 4 ? `•••• •••• •••• ${card.card_number.slice(-4)}` : card.card_number;
  const cardTierUpper = card.tier.toUpperCase();

  // 1. Email au client (support@versalbank.com -> client)
  const clientPromise = sendAutomaticEmail({
    to: client.user_email,
    type: 'CARD_ORDERED',
    subject: isEn 
      ? `VERSALBANK — Card Request Registered (${cardTierUpper})` 
      : `VERSALBANK — Confirmation de votre demande de carte (${cardTierUpper})`,
    title: isEn ? 'Your Card Request Has Been Received' : 'Votre demande de carte bancaire est enregistrée',
    contentLines: isEn ? [
      `Hello <strong>${client.first_name || 'Valued Customer'}</strong>,`,
      `We have received your new card request:`,
      `• <strong>Card Tier:</strong> <strong>${cardTierUpper}</strong>`,
      `• <strong>Network:</strong> ${card.network || 'Visa International'}`,
      `• <strong>Card Number:</strong> ${maskedCard}`,
      `• <strong>Status:</strong> Pending administrative approval.`,
      `Your card request has been submitted to the card operations department. You will receive an instant email notification once the card is approved and activated.`
    ] : [
      `Bonjour <strong>${client.first_name || 'Client(e)'}</strong>,`,
      `Nous confirmons l'enregistrement de votre demande de carte bancaire :`,
      `• <strong>Gamme de carte :</strong> <strong>${cardTierUpper}</strong>`,
      `• <strong>Réseau :</strong> ${card.network || 'Visa International'}`,
      `• <strong>Numéro de carte :</strong> ${maskedCard}`,
      `• <strong>Statut :</strong> En attente d'approbation par l'administration.`,
      `Votre demande est actuellement en cours d'examen par notre service monétique. Vous recevrez un courriel dès que la carte sera approuvée et prête à l'utilisation.`
    ],
    language: client.language || 'fr',
    actionLabel: isEn ? 'View My Cards' : 'Consulter mes cartes',
    actionUrl: '/espace/cartes',
    metadata: { card_tier: card.tier, card_number: maskedCard },
    notifyAdmin: false
  });

  // 2. Email à l'administrateur (-> contact@versalbank.com)
  notifyAdminCopy(
    `Nouvelle demande de carte (${cardTierUpper} - ${client.user_email})`,
    "Nouvelle demande de carte bancaire à traiter",
    [
      `Un client a soumis une nouvelle demande de carte bancaire nécessitant votre validation :`,
      `• Client : <strong>${client.user_email}</strong> (${client.first_name || ''} ${client.last_name || ''})`,
      `• Gamme : <strong>${cardTierUpper}</strong>`,
      `• Numéro généré : <strong>${maskedCard}</strong>`,
      `• Action requise : Rendez-vous dans le panneau Cartes pour approuver, activer ou débloquer la carte.`
    ],
    { client_email: client.user_email, card_tier: card.tier }
  );

  return clientPromise;
}

/**
 * 8b. DEMANDE D'EXPÉDITION DE CARTE PHYSIQUE
 * Client : confirmation d'expédition avec adresse
 * Admin : -> contact@versalbank.com pour traitement logistique
 */
export async function notifyCardShippingRequested(params: {
  user_email: string;
  first_name?: string;
  last_name?: string;
  client_id?: string;
  card_number: string;
  card_type?: string;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  shipping_phone: string;
  language?: LanguageCode;
}) {
  const isEn = params.language === 'en';
  const maskedCard = params.card_number.length > 4
    ? `•••• ${params.card_number.slice(-4)}`
    : params.card_number;

  const clientName = `${params.first_name || ''} ${params.last_name || ''}`.trim() || params.shipping_name;

  // 1. Notification au client (support@versalbank.com -> client)
  const clientPromise = sendAutomaticEmail({
    to: params.user_email,
    recipientName: clientName,
    type: 'CARD_STATUS',
    subject: isEn
      ? `VERSALBANK — Physical Card Delivery Order (${maskedCard})`
      : `VERSALBANK — Confirmation d'expédition de votre carte physique (${maskedCard})`,
    title: isEn
      ? 'Your Physical Debit/Credit Card Shipment is Scheduled'
      : 'Votre carte bancaire est en cours de préparation logistique',
    contentLines: isEn ? [
      `Hello <strong>${clientName}</strong>,`,
      `We have received your physical card delivery request for your card ending in <strong>${maskedCard}</strong>.`,
      `<strong>Delivery Address Confirmed:</strong>`,
      `${params.shipping_name}`,
      `${params.shipping_address}`,
      `${params.shipping_postal_code} ${params.shipping_city}, ${params.shipping_country}`,
      `Contact phone for courier: <strong>${params.shipping_phone}</strong>`,
      `Your card will be manufactured and shipped via secure courier service with international tracking. You will receive progress updates directly in your portal.`
    ] : [
      `Bonjour <strong>${clientName}</strong>,`,
      `Nous confirmons l'enregistrement de votre demande d'expédition pour votre carte bancaire se terminant par <strong>${maskedCard}</strong>.`,
      `<strong>Adresse de livraison enregistrée :</strong>`,
      `${params.shipping_name}`,
      `${params.shipping_address}`,
      `${params.shipping_postal_code} ${params.shipping_city}, ${params.shipping_country}`,
      `Téléphone de contact pour le transporteur : <strong>${params.shipping_phone}</strong>`,
      `Votre carte physique entre immédiatement en fabrication sécurisée avant son expédition par transporteur agréé avec numéro de suivi international.`
    ],
    language: params.language || 'fr',
    actionLabel: isEn ? 'Track Delivery' : 'Suivre ma livraison',
    actionUrl: '/espace/cartes',
    metadata: { card_number: maskedCard, address: params.shipping_address },
    notifyAdmin: false
  });

  // 2. Notification à l'administration (-> contact@versalbank.com)
  notifyAdminCopy(
    `Demande de livraison de carte (${maskedCard} - ${clientName})`,
    "Nouvelle demande d'expédition de carte physique à traiter",
    [
      `Un client a validé une demande de livraison de carte bancaire physique à domicile :`,
      `• Client : <strong>${clientName}</strong> (${params.user_email})`,
      `• Identifiant : <strong>${params.client_id || 'N/A'}</strong>`,
      `• Carte : <strong>${params.card_type || 'Visa'} (${maskedCard})</strong>`,
      `• Destinataire : <strong>${params.shipping_name}</strong>`,
      `• Adresse complète : <strong>${params.shipping_address}, ${params.shipping_postal_code} ${params.shipping_city} (${params.shipping_country})</strong>`,
      `• Téléphone : <strong>${params.shipping_phone}</strong>`,
    ],
    { client_id: params.client_id, user_email: params.user_email, card_number: maskedCard }
  );

  return clientPromise;
}

/**
 * 8c. DEMANDE DE NOUVELLE CARTE (Enregistrement de commande de carte)
 * Client : confirmation de demande enregistrée (support@versalbank.com -> client)
 * Admin : alerte administrative (-> contact@versalbank.com)
 */
export async function notifyCardRequested(data: {
  user_email: string;
  first_name?: string;
  last_name?: string;
  card_type: string;
  card_number: string;
  language?: LanguageCode;
}) {
  return notifyCardOrdered(
    {
      user_email: data.user_email,
      first_name: data.first_name,
      last_name: data.last_name,
      language: data.language,
    },
    {
      tier: data.card_type,
      card_number: data.card_number,
    }
  );
}

/**
 * 9. DEMANDE DE PRÊT / FINANCEMENT
 * Client : support@versalbank.com -> client (confirmation automatique et en cours de traitement)
 * Admin : -> contact@versalbank.com (nouvelle demande de prêt/financement à instruire)
 */
export async function notifyLoanSubmitted(client: { 
  user_email: string; 
  first_name?: string;
  language?: LanguageCode;
}, loan: { 
  id: string; 
  amount: number; 
  currency: string; 
  duration_months: number;
  project?: string;
}) {
  const isEn = client.language === 'en';
  const name = client.first_name || (isEn ? 'Valued Customer' : 'Client(e)');

  // 1. Email au client (support@versalbank.com -> client)
  const clientPromise = sendAutomaticEmail({
    to: client.user_email,
    type: 'LOAN_SUBMITTED',
    subject: isEn
      ? `VERSALBANK — Financing Application Received (${loan.amount.toLocaleString()} ${loan.currency})`
      : `VERSALBANK — Demande de financement enregistrée (${loan.amount.toLocaleString()} ${loan.currency})`,
    title: isEn ? 'Financing Request Under Credit Committee Review' : 'Votre demande de financement est en cours d\'examen',
    contentLines: isEn ? [
      `Hello <strong>${name}</strong>,`,
      `We have received your loan application for <strong>${loan.amount.toLocaleString()} ${loan.currency}</strong> over <strong>${loan.duration_months} months</strong> (Fixed Rate 3.00%).`,
      loan.project ? `• <strong>Project:</strong> ${loan.project}` : '',
      `• <strong>Application Reference:</strong> ${loan.id}`,
      `Our credit committee is auditing your borrowing capacity. You will receive a decision within 24 to 48 business hours.`
    ].filter(Boolean) : [
      `Bonjour <strong>${name}</strong>,`,
      `Votre demande de prêt d'un montant de <strong>${loan.amount.toLocaleString()} ${loan.currency}</strong> sur <strong>${loan.duration_months} mois</strong> (taux fixe préférentiel 3.00%) a bien été enregistrée.`,
      loan.project ? `• <strong>Projet :</strong> ${loan.project}` : '',
      `• <strong>Dossier n° :</strong> ${loan.id}`,
      `Notre comité des crédits analyse votre capacité d'emprunt. Une décision vous sera notifiée sous 24 à 48 heures ouvrées.`
    ].filter(Boolean),
    language: client.language || 'fr',
    actionLabel: isEn ? 'Track Financing File' : 'Suivre mon financement',
    actionUrl: '/espace/financement',
    metadata: { loan_id: loan.id, amount: loan.amount },
    notifyAdmin: false
  });

  // 2. Email à l'administrateur (-> contact@versalbank.com)
  notifyAdminCopy(
    `Demande de prêt soumise (${loan.amount.toLocaleString()} ${loan.currency})`,
    "Nouveau dossier de crédit client à instruire",
    [
      `Un client a soumis une nouvelle demande de prêt/financement :`,
      `• Client : <strong>${client.user_email}</strong>`,
      `• Montant : <strong>${loan.amount.toLocaleString()} ${loan.currency}</strong>`,
      `• Durée : <strong>${loan.duration_months} mois</strong>`,
      loan.project ? `• Projet : <strong>${loan.project}</strong>` : '',
      `• Référence dossier : <strong>${loan.id}</strong>`,
      `• Action requise : Rendez-vous dans le panneau Crédits pour analyser les pièces et émettre un accord de principe ou un refus.`
    ].filter(Boolean),
    { loan_id: loan.id, user_email: client.user_email }
  );

  return clientPromise;
}

// ============================================================================
// ACTIONS DE L'ADMINISTRATEUR SUR LES DEMANDES (Notifie UNIQUEMENT le client)
// support@versalbank.com -> client (Pas de copie automatique à l'administrateur)
// ============================================================================

/**
 * 10a. Compte Approuvé
 * support@versalbank.com -> client
 */
export async function notifyAccountApproved(client: { 
  user_email: string; 
  first_name?: string; 
  last_name?: string; 
  account_number?: string;
  client_id?: string;
  currency?: string;
  language?: LanguageCode;
}) {
  const isEn = client.language === 'en';
  const name = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';

  return sendAutomaticEmail({
    to: client.user_email,
    recipientName: name,
    type: 'ACCOUNT_APPROVED',
    subject: isEn ? 'VERSALBANK — Account Approved & Activated' : 'VERSALBANK — Compte bancaire approuvé et actif',
    title: isEn ? 'Your VersalBank Account is Now Active' : 'Votre compte bancaire VersalBank est désormais actif',
    contentLines: isEn ? [
      `Hello <strong>${name}</strong>,`,
      `We are pleased to inform you that your banking application has been successfully verified and approved by administration.`,
      `Your official VersalBank account number is: <strong>${client.account_number || '4400-8921-7700'}</strong> (Transit: 004 / 09823).`,
      `Your account is fully operational for deposits, transfers, and card orders.`
    ] : [
      `Bonjour <strong>${name}</strong>,`,
      `Nous avons le plaisir de vous informer que votre dossier d'ouverture de compte a été validé et approuvé par notre direction.`,
      `Votre numéro de compte VersalBank est : <strong>${client.account_number || '4400-8921-7700'}</strong> (Transit Institution : 004 / 09823).`,
      `Vos fonctionnalités de virement, approvisionnement et commande de cartes sont immédiatement opérationnelles.`
    ],
    language: client.language || 'fr',
    actionLabel: isEn ? 'Access Online Banking' : 'Accéder à mon espace sécurisé',
    actionUrl: '/portail',
    metadata: { account_number: client.account_number },
    notifyAdmin: false
  });
}

/**
 * 10b. Demande de Compte Refusée / Rejetée
 * support@versalbank.com -> client
 */
export async function notifyAccountRejected(client: { 
  user_email: string; 
  first_name?: string; 
  last_name?: string; 
  reason?: string;
  language?: LanguageCode;
}) {
  const isEn = client.language === 'en';
  const name = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';

  return sendAutomaticEmail({
    to: client.user_email,
    recipientName: name,
    type: 'ACCOUNT_REJECTED',
    subject: isEn ? 'VERSALBANK — Account Application Status Update' : 'VERSALBANK — Notification concernant votre demande de compte',
    title: isEn ? 'Notice Regarding Your Account Application' : 'Décision relative à votre demande d\'ouverture de compte',
    contentLines: isEn ? [
      `Hello <strong>${name}</strong>,`,
      `Following the review of your file by our compliance committee, we regret to inform you that we are unable to open your account at this time.`,
      client.reason ? `• Reason: <em>${client.reason}</em>` : '',
      `If you have additional documentation or require further assistance, please contact our support team at <a href="mailto:${DEFAULT_SENDER_EMAIL}">${DEFAULT_SENDER_EMAIL}</a>.`
    ].filter(Boolean) : [
      `Bonjour <strong>${name}</strong>,`,
      `Après examen approfondi de votre dossier par notre service de conformité, nous avons le regret de vous informer que votre demande d'ouverture de compte n'a pas pu être validée.`,
      client.reason ? `• Motif : <em>${client.reason}</em>` : '',
      `Pour toute question ou si vous souhaitez apporter des éléments complémentaires à votre dossier, vous pouvez contacter notre assistance à <a href="mailto:${DEFAULT_SENDER_EMAIL}">${DEFAULT_SENDER_EMAIL}</a>.`
    ].filter(Boolean),
    language: client.language || 'fr',
    actionLabel: isEn ? 'Contact Support' : 'Contacter le support',
    actionUrl: '/contact',
    metadata: { status: 'rejected' },
    notifyAdmin: false
  });
}

/**
 * 10c. Demande de Compte Mise en Attente
 * support@versalbank.com -> client
 */
export async function notifyAccountOnHold(client: { 
  user_email: string; 
  first_name?: string; 
  last_name?: string; 
  reason?: string;
  language?: LanguageCode;
}) {
  const isEn = client.language === 'en';
  const name = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';

  return sendAutomaticEmail({
    to: client.user_email,
    recipientName: name,
    type: 'ACCOUNT_ON_HOLD',
    subject: isEn ? 'VERSALBANK — Account Application Placed on Hold' : 'VERSALBANK — Votre demande de compte est en attente',
    title: isEn ? 'Additional Verification Required' : 'Dossier maintenu en attente de vérification',
    contentLines: isEn ? [
      `Hello <strong>${name}</strong>,`,
      `Your account opening application has been placed on hold pending additional verification by our compliance officers.`,
      client.reason ? `• Notice: <em>${client.reason}</em>` : '',
      `Please ensure all submitted identity and residency documents are valid and readable. Our team will contact you if additional documents are needed.`
    ].filter(Boolean) : [
      `Bonjour <strong>${name}</strong>,`,
      `Votre dossier d'ouverture de compte VersalBank a été temporairement placé <strong style="color: #d97706;">en attente</strong> par notre cellule d'analyse.`,
      client.reason ? `• Précision : <em>${client.reason}</em>` : '',
      `Nos équipes procèdent à des vérifications complémentaires d'usage. Vous serez informé(e) dès reprise du traitement de votre dossier.`
    ].filter(Boolean),
    language: client.language || 'fr',
    actionLabel: isEn ? 'Track My Application' : 'Suivre mon dossier',
    actionUrl: '/dossier-en-cours',
    metadata: { status: 'on_hold' },
    notifyAdmin: false
  });
}

/**
 * 11. Activation de compte et transmission d'identifiants
 * support@versalbank.com -> client
 */
export async function notifyAccountActivated(client: { user_email: string; first_name?: string; last_name?: string }) {
  return sendAutomaticEmail({
    to: client.user_email,
    recipientName: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
    type: 'ACCOUNT_ACTIVATED',
    subject: "VERSALBANK — Confirmation d'activation de vos services",
    title: 'Vos services bancaires sont pleinement opérationnels',
    contentLines: [
      `Bonjour ${client.first_name || 'Client(e)'},`,
      `Toutes les sécurités et autorisations d'accès pour votre compte VersalBank sont désormais actives.`,
      `Vous pouvez effectuer des opérations de virement, d'approvisionnement et demander vos cartes bancaires en ligne en toute sécurité.`
    ],
    actionLabel: 'Ouvrir ma session',
    actionUrl: '/portail',
    notifyAdmin: false
  });
}

/**
 * 12. Prêt Approuvé
 * support@versalbank.com -> client
 */
export async function notifyLoanApproved(
  client: { user_email: string; first_name?: string }, 
  loan: { id?: string; amount: number; currency: string; duration_months?: number; rate?: number; monthly_payment?: number }
) {
  const loanId = loan.id || 'LOAN-APP';
  const loanRate = loan.rate ?? 3.0;
  const loanDuration = loan.duration_months ?? 24;
  const loanMonthly = loan.monthly_payment ?? Math.round((loan.amount / loanDuration) * (1 + (loanRate / 100)));

  return sendAutomaticEmail({
    to: client.user_email,
    type: 'LOAN_STATUS',
    subject: `VERSALBANK — Demande de financement acceptée (${loan.amount.toLocaleString()} ${loan.currency})`,
    title: 'Votre demande de financement a été acceptée par le comité de crédit',
    contentLines: [
      `Bonjour ${client.first_name || 'Client(e)'},`,
      `Nous avons le plaisir de vous informer que votre demande de financement a été <strong style="color: #16a34a;">APPROUVÉE</strong> par notre comité de crédit.`,
      `<strong>Récapitulatif du prêt :</strong>`,
      `• Montant accordé : <strong>${loan.amount.toLocaleString()} ${loan.currency}</strong>`,
      `• Taux annuel fixe : <strong>${loanRate.toFixed(2)} %</strong>`,
      `• Durée : <strong>${loanDuration} mois</strong>`,
      `• Mensualité constante : <strong>${loanMonthly.toLocaleString()} ${loan.currency} / mois</strong>`,
      `Veuillez vous connecter à votre portail pour télécharger les <strong>Paramètres de crédit</strong>, les signer et les transmettre afin que les fonds soient débloqués sur votre compte.`
    ],
    actionLabel: 'Accéder aux paramètres de crédit',
    actionUrl: '/espace/financement',
    metadata: { loan_id: loanId, status: 'approved' },
    notifyAdmin: false
  });
}

/**
 * 13. Prêt Débloqué / Financé
 * support@versalbank.com -> client
 */
export async function notifyLoanFunded(
  client: { user_email: string; first_name?: string }, 
  loan: { id?: string; amount: number; currency: string; duration_months?: number; rate?: number }
) {
  const loanId = loan.id || 'LOAN-FUND';
  const loanRate = loan.rate ?? 3.0;
  const loanDuration = loan.duration_months ?? 24;

  return sendAutomaticEmail({
    to: client.user_email,
    type: 'LOAN_STATUS',
    subject: `VERSALBANK — Déblocage de fonds — Prêt approuvé (${loan.amount.toLocaleString()} ${loan.currency})`,
    title: 'Déblocage de fonds — Vos fonds sont disponibles',
    contentLines: [
      `Bonjour ${client.first_name || 'Client(e)'},`,
      `Nous vous confirmons que votre prêt a été définitivement approuvé par la direction de la trésorerie.`,
      `La somme de <strong style="color: #16a34a; font-size: 16px;">${loan.amount.toLocaleString()} ${loan.currency}</strong> a été créditée sur votre compte bancaire et est désormais pleinement disponible.`,
      `• Montant débloqué : <strong>${loan.amount.toLocaleString()} ${loan.currency}</strong>`,
      `• Taux annuel fixe : <strong>${loanRate.toFixed(2)} %</strong>`,
      `• Durée : <strong>${loanDuration} mois</strong>`
    ],
    actionLabel: 'Consulter mon solde',
    actionUrl: '/espace/tableau-de-bord',
    metadata: { loan_id: loanId, status: 'funded' },
    notifyAdmin: false
  });
}

/**
 * 14. Prêt Refusé / Rejeté
 * support@versalbank.com -> client
 */
export async function notifyLoanRejected(
  client: { user_email: string; first_name?: string }, 
  loan: { id?: string; amount: number; currency: string; reason?: string }
) {
  const loanId = loan.id || 'LOAN-REJ';
  return sendAutomaticEmail({
    to: client.user_email,
    type: 'LOAN_STATUS',
    subject: `VERSALBANK — Dossier de financement — Mise à jour`,
    title: 'Information concernant votre demande de prêt',
    contentLines: [
      `Bonjour ${client.first_name || 'Client(e)'},`,
      `Votre demande de financement d'un montant de <strong>${loan.amount.toLocaleString()} ${loan.currency}</strong> n'a pas pu être approuvée par le comité de crédit.`,
      loan.reason ? `• Motif indiqué : <em>${loan.reason}</em>` : '',
      `Rapprochez-vous de votre conseiller ou du service client à <a href="mailto:${DEFAULT_SENDER_EMAIL}">${DEFAULT_SENDER_EMAIL}</a> pour plus d'informations et explorer d'autres solutions d'accompagnement.`
    ].filter(Boolean),
    actionLabel: 'Contacter le service client',
    actionUrl: '/contact',
    metadata: { loan_id: loanId, status: 'rejected' },
    notifyAdmin: false
  });
}

/**
 * 14b. Prêt Mis en attente / En cours d'analyse
 * support@versalbank.com -> client uniquement
 */
export async function notifyLoanPending(
  client: { user_email: string; first_name?: string; language?: LanguageCode }, 
  loan: { id?: string; amount: number; currency: string; reason?: string }
) {
  const isEn = client.language === 'en';
  const name = client.first_name || (isEn ? 'Valued Customer' : 'Client(e)');
  const loanId = loan.id || 'LOAN-PEND';
  const formattedAmount = `${loan.amount.toLocaleString(isEn ? 'en-CA' : 'fr-CA')} ${loan.currency}`;

  return sendAutomaticEmail({
    to: client.user_email,
    type: 'LOAN_STATUS',
    subject: isEn 
      ? `VERSALBANK — Loan Application Under Review (${formattedAmount})` 
      : `VERSALBANK — Dossier de prêt en attente de vérification (${formattedAmount})`,
    title: isEn ? 'Financing Request Under Analysis' : 'Dossier de financement maintenu en analyse',
    contentLines: isEn ? [
      `Hello <strong>${name}</strong>,`,
      `Your loan application (Ref: <strong>${loanId}</strong>) for <strong>${formattedAmount}</strong> has been placed <strong style="color: #d97706;">on hold</strong> for further credit assessment.`,
      loan.reason ? `• Notice: <em>${loan.reason}</em>` : '',
      `Our credit committee will review your file shortly. You will be notified automatically of any update.`
    ].filter(Boolean) : [
      `Bonjour <strong>${name}</strong>,`,
      `Votre dossier de prêt (Réf : <strong>${loanId}</strong>) d'un montant de <strong>${formattedAmount}</strong> est actuellement placé <strong style="color: #d97706;">en attente</strong> pour analyse complémentaire par notre comité de crédit.`,
      loan.reason ? `• Précision : <em>${loan.reason}</em>` : '',
      `Nos analystes examinent les pièces de votre dossier. Vous recevrez une notification dès qu'une décision aura été arrêtée.`
    ].filter(Boolean),
    language: client.language || 'fr',
    actionLabel: isEn ? 'Track Financing File' : 'Suivre mon financement',
    actionUrl: '/espace/financement',
    metadata: { loan_id: loanId, status: 'pending' },
    notifyAdmin: false
  });
}

/**
 * 15. Mise à jour de statut de mouvement / virement
 * Statuts gérés : Approuvé (completed), Rejeté/Refusé (rejected/failed), Mis en attente (pending)
 * support@versalbank.com -> client uniquement
 */
export async function notifyMovementStatusUpdated(
  client: { user_email: string; first_name?: string }, 
  movement: { id: string; amount: number; currency: string; type: string; status: string; recipient_name?: string }
) {
  const isCompleted = movement.status === 'completed';
  const isRejected = movement.status === 'rejected' || movement.status === 'failed' || movement.status === 'cancelled';
  const isPending = movement.status === 'pending';

  let subject = `VERSALBANK — Mise à jour de votre opération #${movement.id}`;
  let title = 'Information sur votre opération bancaire';
  let contentLines: string[] = [];

  const formattedAmount = `${movement.amount.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} ${movement.currency || 'CAD'}`;
  const greeting = client.first_name ? `Bonjour ${client.first_name},` : 'Bonjour,';

  if (isCompleted) {
    subject = `VERSALBANK — Virement validé et exécuté (${formattedAmount})`;
    title = 'Ordre de virement validé avec succès';
    contentLines = [
      greeting,
      `Nous avons le plaisir de vous confirmer que votre ordre de virement <strong>#${movement.id}</strong> d'un montant de <strong>${formattedAmount}</strong> a été validé et approuvé par l'administration.`,
      movement.recipient_name ? `• Bénéficiaire : <strong>${movement.recipient_name}</strong>` : '',
      `• Statut : <strong style="color: #16a34a;">Validé & Exécuté</strong>`,
      `L'ordre a été transmis aux réseaux interbancaires pour compensation immédiate. Les fonds ont été définitivement comptabilisés.`,
      `Vous pouvez télécharger votre bordereau de transfert directement depuis votre espace client.`
    ].filter(Boolean);
  } else if (isRejected) {
    subject = `VERSALBANK — Avis de rejet de virement (${formattedAmount})`;
    title = 'Ordre de virement rejeté — Fonds recrédités';
    contentLines = [
      greeting,
      `Nous vous informons que votre ordre de virement <strong>#${movement.id}</strong> d'un montant de <strong>${formattedAmount}</strong> a été <strong style="color: #dc2626;">rejeté par l'administration</strong>.`,
      `• Statut : <strong style="color: #dc2626;">Rejeté / Annulé</strong>`,
      `Le montant de <strong>${formattedAmount}</strong> a été automatiquement recrédité sur votre solde disponible.`,
      `Pour toute précision concernant ce refus ou pour reformuler une demande conforme, veuillez contacter l'assistance à <a href="mailto:${DEFAULT_SENDER_EMAIL}">${DEFAULT_SENDER_EMAIL}</a>.`
    ];
  } else if (isPending) {
    subject = `VERSALBANK — Virement maintenu en attente (${formattedAmount})`;
    title = 'Virement en attente de vérification';
    contentLines = [
      greeting,
      `Votre ordre de virement <strong>#${movement.id}</strong> d'un montant de <strong>${formattedAmount}</strong> est actuellement <strong style="color: #d97706;">maintenu en attente de validation</strong> par nos services de conformité FINTRAC.`,
      `• Statut : <strong style="color: #d97706;">En attente de vérification</strong>`,
      `Notre équipe procède aux contrôles d'usage préalables au débouclage de l'opération. Vous serez notifié(e) dès qu'un arbitrage définitif aura été posé.`,
      `Aucune action supplémentaire n'est requise de votre part pour l'instant.`
    ];
  } else {
    contentLines = [
      greeting,
      `Votre opération <strong>#${movement.id}</strong> d'un montant de <strong>${formattedAmount}</strong> a fait l'objet d'un changement de statut : <strong>${movement.status}</strong>.`
    ];
  }

  return sendAutomaticEmail({
    to: client.user_email,
    type: 'TRANSFER_STATUS',
    subject,
    title,
    contentLines,
    actionLabel: 'Accéder à mon espace client',
    actionUrl: '/espace/tableau-de-bord',
    metadata: { movement_id: movement.id, status: movement.status },
    notifyAdmin: false
  });
}

/**
 * 16. Statut de Carte Bancaire (Activée, Déverrouillée, Verrouillée)
 * support@versalbank.com -> client uniquement
 */
export async function notifyCardStatus(data: {
  user_email: string;
  first_name?: string;
  card_type: string;
  card_number: string;
  action: 'activated' | 'frozen' | 'unfrozen' | 'ordered' | 'approved';
  language?: LanguageCode;
}) {
  const isEn = data.language === 'en';
  const masked = `•••• •••• •••• ${data.card_number.slice(-4)}`;

  const actionLabelsFr: Record<string, string> = {
    approved: 'Demande de carte approuvée',
    activated: 'Carte activée avec succès',
    frozen: 'Carte temporairement verrouillée',
    unfrozen: 'Carte déverrouillée et active',
    ordered: 'Demande de carte enregistrée'
  };

  const actionLabelsEn: Record<string, string> = {
    approved: 'Card request approved',
    activated: 'Card successfully activated',
    frozen: 'Card temporarily frozen',
    unfrozen: 'Card unlocked and active',
    ordered: 'Card request registered'
  };

  const statusText = isEn ? actionLabelsEn[data.action] : actionLabelsFr[data.action];

  return sendAutomaticEmail({
    to: data.user_email,
    type: 'CARD_STATUS',
    subject: `VERSALBANK — ${statusText} (${data.card_type.toUpperCase()})`,
    title: isEn ? 'Card Security & Operations Update' : 'Mise à jour de votre carte bancaire',
    contentLines: isEn ? [
      `Hello <strong>${data.first_name || 'Valued Customer'}</strong>,`,
      `Your card <strong>${data.card_type.toUpperCase()}</strong> (${masked}) has been updated:`,
      `• <strong>Current Status:</strong> ${statusText}`,
      `• <strong>Network:</strong> Visa International`,
      `You can manage spending limits and card settings at any time from your online portal.`
    ] : [
      `Bonjour <strong>${data.first_name || 'Client(e)'}</strong>,`,
      `Votre carte bancaire <strong>${data.card_type.toUpperCase()}</strong> (${masked}) a fait l'objet d'une mise à jour :`,
      `• <strong>Statut actuel :</strong> ${statusText}`,
      `• <strong>Réseau :</strong> Visa International`,
      `Vous pouvez gérer vos plafonds de paiement et paramètres de sécurité à tout moment depuis votre espace client.`
    ],
    language: data.language || 'fr',
    actionLabel: isEn ? 'Manage My Cards' : 'Gérer mes cartes',
    actionUrl: '/espace/cartes',
    metadata: { card_number: masked, action: data.action },
    notifyAdmin: false
  });
}

/**
 * 17. Raccourci Activation de Carte
 */
export async function notifyCardActivated(
  client: { user_email: string; first_name?: string }, 
  card: { card_number: string; card_type: string; currency?: string }
) {
  return notifyCardStatus({
    user_email: client.user_email,
    first_name: client.first_name,
    card_type: card.card_type,
    card_number: card.card_number,
    action: 'activated',
  });
}

/**
 * 18. Notification Générique de Transaction Exécutée
 * support@versalbank.com -> client uniquement
 */
export async function notifyTransactionExecuted(data: {
  user_email: string;
  first_name?: string;
  transaction_type: 'transfer' | 'deposit' | 'withdrawal' | 'card_payment' | 'loan_disbursement';
  amount: number;
  currency: string;
  new_balance?: number;
  recipient_name?: string;
  reference?: string;
  language?: LanguageCode;
}) {
  const isEn = data.language === 'en';
  const typeLabelsFr: Record<string, string> = {
    transfer: 'Virement bancaire émis',
    deposit: 'Dépôt / Approvisionnement crédité',
    withdrawal: 'Retrait de fonds',
    card_payment: 'Paiement par carte bancaire',
    loan_disbursement: 'Déblocage de prêt accordé'
  };

  const typeLabelsEn: Record<string, string> = {
    transfer: 'Outgoing Bank Transfer',
    deposit: 'Deposit / Funding Credited',
    withdrawal: 'Funds Withdrawal',
    card_payment: 'Card Transaction Payment',
    loan_disbursement: 'Loan Capital Disbursement'
  };

  const opLabel = isEn ? (typeLabelsEn[data.transaction_type] || 'Transaction') : (typeLabelsFr[data.transaction_type] || 'Opération');
  const formattedAmount = `${data.amount.toLocaleString(isEn ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2 })} ${data.currency}`;
  const formattedBalance = data.new_balance !== undefined 
    ? `${data.new_balance.toLocaleString(isEn ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2 })} ${data.currency}`
    : 'Mis à jour';

  const subject = isEn
    ? `VERSALBANK — Transaction Notice: ${opLabel} (${formattedAmount})`
    : `VERSALBANK — Avis d'opération : ${opLabel} (${formattedAmount})`;

  const contentLines = isEn ? [
    `Hello <strong>${data.first_name || 'Valued Customer'}</strong>,`,
    `A new transaction has been registered on your VersalBank account:`,
    `• <strong>Type:</strong> ${opLabel}`,
    `• <strong>Amount:</strong> <strong style="color: #0f2b5c;">${formattedAmount}</strong>`,
    data.recipient_name ? `• <strong>Beneficiary:</strong> ${data.recipient_name}` : '',
    data.reference ? `• <strong>Reference:</strong> ${data.reference}` : '',
    `• <strong>Updated Account Balance:</strong> <strong style="color: #16a34a;">${formattedBalance}</strong>`,
    `• <strong>Status:</strong> Executed & Confirmed.`
  ].filter(Boolean) : [
    `Bonjour <strong>${data.first_name || 'Client(e)'}</strong>,`,
    `Une opération vient d'être enregistrée sur votre compte bancaire VersalBank :`,
    `• <strong>Nature :</strong> ${opLabel}`,
    `• <strong>Montant :</strong> <strong style="color: #0f2b5c;">${formattedAmount}</strong>`,
    data.recipient_name ? `• <strong>Bénéficiaire / Émetteur :</strong> ${data.recipient_name}` : '',
    data.reference ? `• <strong>Référence officielle :</strong> ${data.reference}` : '',
    `• <strong>Nouveau solde disponible :</strong> <strong style="color: #16a34a;">${formattedBalance}</strong>`,
    `• <strong>Statut :</strong> Traitée et comptabilisée avec succès.`
  ].filter(Boolean);

  // Client notification only: no forwarding to admin inbox
  return sendAutomaticEmail({
    to: data.user_email,
    type: 'TRANSACTION_EXECUTED',
    subject,
    title: isEn ? 'Real-Time Transaction Confirmation' : 'Confirmation d\'opération en temps réel',
    contentLines,
    language: data.language || 'fr',
    actionLabel: isEn ? 'View Banking Dashboard' : 'Consulter mon tableau de bord',
    actionUrl: '/espace/tableau-de-bord',
    metadata: {
      amount: data.amount,
      currency: data.currency,
      type: data.transaction_type,
      reference: data.reference,
    },
    notifyAdmin: false
  });
}
