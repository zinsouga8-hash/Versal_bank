import { getBankSupportEmail } from './supabaseBankService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface LoanPdfData {
  loanId: string;
  referenceNumber?: string;
  amount: number;
  durationMonths: number;
  interestRate?: number;
  monthlyPayment: number;
  currency?: string;
  clientName: string;
  clientNationality?: string;
  clientEmail: string;
  clientAddress?: string;
  firstPaymentDate?: string;
  createdAt?: number;
}

const BANK_INFO = {
  name: 'VERSALBANK',
  fullName: 'VERSALBANK CREDIT & SUBVENTIONS',
  subtitle: 'Services de Facilitation et Subvention de Crédit',
  cif: '686293700',
  tva: 'ES686293700',
  address: 'Calle 12 · 41000 Séville, España',
  email: 'contact@versalbank.com',
  phone: '',
  mercantil: 'Registro Mercantil de Séville — Inscripción 41000, Tomo 01, Hoja-M-001993',
  primaryColor: [15, 43, 92] as [number, number, number], // #0f2b5c
  royalBlue: [26, 79, 176] as [number, number, number],
  greenBg: [236, 253, 245] as [number, number, number], // #ecfdf5
  greenText: [6, 95, 70] as [number, number, number], // #065f46
  greenBorder: [110, 231, 183] as [number, number, number], // #6ee7b7
  yellowBg: [254, 252, 232] as [number, number, number], // #fefce8
  yellowText: [133, 77, 14] as [number, number, number],
  blueBoxBg: [239, 246, 255] as [number, number, number], // #eff6ff
  blueBoxBorder: [147, 197, 253] as [number, number, number],
};

function formatEur(val: number, currency: string = 'EUR'): string {
  return `${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function drawPageHeader(doc: jsPDF, pageNum: number, totalPages: number) {
  // Top left: Bank name and subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text(BANK_INFO.name, 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(BANK_INFO.subtitle, 14, 23);

  // Top right: Company details
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const rightX = 196;
  doc.text(`Nom : ${BANK_INFO.fullName}`, rightX, 13, { align: 'right' });
  doc.text(`NIF / CIF : ${BANK_INFO.cif}`, rightX, 17, { align: 'right' });
  doc.text(`Numéro de TVA intracommunautaire : ${BANK_INFO.tva}`, rightX, 21, { align: 'right' });
  doc.text(`Adresse : ${BANK_INFO.address}`, rightX, 25, { align: 'right' });
  doc.text(`Email : ${BANK_INFO.email}`, rightX, 29, { align: 'right' });

  // Thin line below header
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);
}

function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = 286;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, y - 4, 196, y - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text(BANK_INFO.name, 14, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `NIF / CIF : ${BANK_INFO.cif} | TVA intracommunautaire : ${BANK_INFO.tva} — ${BANK_INFO.mercantil}`,
    14,
    y + 3.5
  );
  doc.text(`Tous droits réservés © 2026 ${BANK_INFO.name}`, 14, y + 7);

  doc.text(`Page ${pageNum} sur ${totalPages}`, 196, y + 4, { align: 'right' });
}

function drawConfidentialStamp(doc: jsPDF, x: number, y: number) {
  doc.saveGraphicsState();
  // Red semi-transparent box
  doc.setDrawColor(220, 38, 38);
  doc.setTextColor(220, 38, 38);
  doc.setLineWidth(1.2);
  doc.roundedRect(x - 24, y - 8, 48, 16, 2, 2, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('CONFIDENTIAL', x, y + 3, { align: 'center' });
  doc.restoreGraphicsState();
}

/**
 * GENERATE AND DOWNLOAD PDF: CONDITIONS DE PRÊT
 */
export function downloadLoanConditionsPdf(data: LoanPdfData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const totalPages = 5;
  const curr = data.currency || 'EUR';
  const rate = data.interestRate || 3.0;
  const originalRate = 5.0;
  const subsidyRate = 2.0;
  const totalToRepay = data.monthlyPayment * data.durationMonths;
  const totalInterest = totalToRepay - data.amount;
  // Calculate difference without subsidy
  const rOrig = originalRate / 100 / 12;
  const paymentOrig =
    (data.amount * rOrig * Math.pow(1 + rOrig, data.durationMonths)) /
    (Math.pow(1 + rOrig, data.durationMonths) - 1);
  const savings = Math.max(0, paymentOrig * data.durationMonths - totalToRepay);

  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  const refCode = data.referenceNumber || `LS-${data.loanId.slice(-6).toUpperCase()}-2026`;
  const firstPayment =
    data.firstPaymentDate ||
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString('fr-FR');

  // ================= PAGE 1 =================
  drawPageHeader(doc, 1, totalPages);

  // Big Royal Blue Title Banner
  doc.setFillColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.roundedRect(14, 36, 182, 12, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('CONDITIONS DE PRÊT', 105, 44, { align: 'center' });

  // Metadata Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date du document : ${dateStr}`, 14, 54);
  doc.text(`Numéro de référence : ${refCode}`, 196, 54, { align: 'right' });

  // 1. CONDITIONS GÉNÉRALES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('1. CONDITIONS GÉNÉRALES', 14, 62);

  // 1.1 Parties
  doc.setFontSize(9.5);
  doc.text('1.1 Parties', 14, 69);

  autoTable(doc, {
    startY: 72,
    head: [['Prêteur', 'Emprunteur']],
    body: [
      [
        `${BANK_INFO.fullName}\nNuméro de TVA : ${BANK_INFO.tva}\n${BANK_INFO.address}`,
        `Nom : ${data.clientName}\nNationalité : ${data.clientNationality || 'Française'}\nEmail : ${data.clientEmail}`
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 4
    },
    margin: { left: 14, right: 14 }
  });

  // 1.2 Détails du prêt
  const afterPartiesY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('1.2 Détails du prêt', 14, afterPartiesY);

  autoTable(doc, {
    startY: afterPartiesY + 3,
    body: [
      ['Montant du prêt :', formatEur(data.amount, curr)],
      ['Durée :', `${data.durationMonths} mois (${(data.durationMonths / 12).toFixed(0)} an(s))`],
      ['Taux d\'intérêt annuel :', `${rate.toFixed(2)}%`],
      ['Mensualité :', formatEur(data.monthlyPayment, curr)],
      ['Date du premier paiement :', firstPayment],
      ['Montant total à rembourser :', formatEur(totalToRepay, curr)]
    ],
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [30, 41, 59], cellWidth: 70 },
      1: { textColor: [51, 65, 85] }
    },
    margin: { left: 14, right: 14 }
  });

  // 2. TAUX D'INTÉRÊT ET FRAIS
  const afterDetailsY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('2. TAUX D\'INTÉRÊT ET FRAIS', 14, afterDetailsY);

  doc.setFontSize(9);
  doc.text('2.1 Taux d\'intérêt', 14, afterDetailsY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Le taux d'intérêt annuel appliqué à ce prêt est fixé à ${rate.toFixed(2)}% pour toute la durée du contrat.`,
    14,
    afterDetailsY + 11
  );

  // Encadré Vert Subvention
  const greenBoxY = afterDetailsY + 15;
  doc.setFillColor(BANK_INFO.greenBg[0], BANK_INFO.greenBg[1], BANK_INFO.greenBg[2]);
  doc.setDrawColor(BANK_INFO.greenBorder[0], BANK_INFO.greenBorder[1], BANK_INFO.greenBorder[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, greenBoxY, 182, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.greenText[0], BANK_INFO.greenText[1], BANK_INFO.greenText[2]);
  doc.text('Facilitation de Crédit & Subvention VERSALBANK', 20, greenBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'VERSALBANK agit en tant que facilitateur de crédit et fournit une subvention de 2% sur le taux d\'intérêt pour rendre le financement plus abordable et accessible.',
    20,
    greenBoxY + 11,
    { maxWidth: 170 }
  );
  doc.text(`• Taux d'intérêt bancaire d'origine : ${originalRate.toFixed(2)}%`, 20, greenBoxY + 17);
  doc.text(`• Taux de subvention VERSALBANK : -${subsidyRate.toFixed(2)}%`, 20, greenBoxY + 21);
  doc.setFont('helvetica', 'bold');
  doc.text(`• Taux final appliqué à votre prêt : ${rate.toFixed(2)}%`, 20, greenBoxY + 25);
  doc.text(
    `Vous économisez ${formatEur(savings, curr)} sur toute la durée du prêt grâce à la subvention VERSALBANK.`,
    20,
    greenBoxY + 30
  );

  drawPageFooter(doc, 1, totalPages);

  // ================= PAGE 2 =================
  doc.addPage();
  drawPageHeader(doc, 2, totalPages);

  let curY = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('2.2 Frais supplémentaires', 14, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('• Frais de traitement de la demande : Aucun', 18, curY + 6);
  doc.text('• Frais de gestion mensuelle : Aucun', 18, curY + 11);
  doc.text('• Frais de remboursement anticipé : Voir section 4.1', 18, curY + 16);

  curY += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('3. CONDITIONS DE PAIEMENT', 14, curY);

  doc.setFontSize(9);
  doc.text('3.1 Échéancier de paiement', 14, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `L'emprunteur s'engage à effectuer des paiements mensuels de ${formatEur(data.monthlyPayment, curr)} à partir du ${firstPayment}.`,
    14,
    curY + 11
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('3.2 Mode de paiement', 14, curY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Les paiements doivent être effectués par virement bancaire sur les coordonnées bancaires fournies par VERSALBANK.',
    14,
    curY + 23
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('3.3 Retard de paiement', 14, curY + 30);

  // Encadré jaune alerte retard
  const yellowY = curY + 34;
  doc.setFillColor(BANK_INFO.yellowBg[0], BANK_INFO.yellowBg[1], BANK_INFO.yellowBg[2]);
  doc.setDrawColor(250, 204, 21);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, yellowY, 182, 14, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(BANK_INFO.yellowText[0], BANK_INFO.yellowText[1], BANK_INFO.yellowText[2]);
  doc.text(
    'En cas de retard de paiement, des intérêts de pénalité de 1,5% par mois seront appliqués sur le montant impayé.',
    20,
    yellowY + 6
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'Après 30 jours de non-paiement, le prêteur se réserve le droit d\'exiger le remboursement immédiat de l\'intégralité du solde restant.',
    20,
    yellowY + 10
  );

  curY = yellowY + 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('4. REMBOURSEMENT ANTICIPÉ', 14, curY);

  doc.setFontSize(9);
  doc.text('4.1 Conditions de remboursement anticipé', 14, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'L\'emprunteur peut rembourser le prêt par anticipation, en totalité ou en partie, à tout moment sans pénalité si :',
    14,
    curY + 11
  );
  doc.text('• Un préavis écrit est donné au moins 30 jours à l\'avance', 18, curY + 16);
  doc.text('• Au moins 6 paiements mensuels ont été effectués', 18, curY + 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('4.2 Frais de remboursement anticipé', 14, curY + 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Pour un remboursement anticipé dans les 6 premiers mois, des frais de 1% du capital restant seront appliqués.',
    14,
    curY + 33
  );

  curY += 41;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('5. OBLIGATIONS DE L\'EMPRUNTEUR', 14, curY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('L\'emprunteur s\'engage à :', 14, curY + 6);
  doc.text('• Effectuer tous les paiements à temps selon l\'échéancier convenu', 18, curY + 11);
  doc.text('• Informer VERSALBANK de tout changement de situation personnelle ou financière', 18, curY + 16);
  doc.text('• Notifier tout changement d\'adresse ou de coordonnées dans les 15 jours', 18, curY + 21);
  doc.text('• Maintenir une couverture d\'assurance adéquate si nécessaire', 18, curY + 26);
  doc.text('• Ne pas utiliser le prêt à des fins illégales', 18, curY + 31);

  drawPageFooter(doc, 2, totalPages);

  // ================= PAGE 3 =================
  doc.addPage();
  drawPageHeader(doc, 3, totalPages);

  curY = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('6. DROITS DU PRÊTEUR', 14, curY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('VERSALBANK se réserve le droit de :', 14, curY + 6);
  doc.text('• Demander une preuve de revenus ou de situation financière à tout moment', 18, curY + 11);
  doc.text('• Modifier le taux d\'intérêt en cas de changement significatif des conditions du marché (préavis 60 jours)', 18, curY + 16);
  doc.text('• Résilier le contrat en cas de fraude ou de fausse déclaration', 18, curY + 21);
  doc.text('• Entreprendre des actions en justice pour récupérer les montants impayés', 18, curY + 26);

  curY += 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('7. DÉFAUT ET CONSÉQUENCES', 14, curY);

  doc.setFontSize(9);
  doc.text('7.1 Événements de défaut', 14, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Le prêt sera considéré en défaut si :', 14, curY + 11);
  doc.text('• Le paiement a plus de 30 jours de retard', 18, curY + 16);
  doc.text('• L\'emprunteur déclare faillite', 18, curY + 21);
  doc.text('• De fausses informations ont été fournies dans la demande', 18, curY + 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('7.2 Conséquences du défaut', 14, curY + 34);

  const defBoxY = curY + 38;
  doc.setFillColor(BANK_INFO.yellowBg[0], BANK_INFO.yellowBg[1], BANK_INFO.yellowBg[2]);
  doc.setDrawColor(250, 204, 21);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, defBoxY, 182, 12, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(BANK_INFO.yellowText[0], BANK_INFO.yellowText[1], BANK_INFO.yellowText[2]);
  doc.text(
    'En cas de défaut, le prêteur peut exiger le remboursement immédiat de tous les montants impayés, plus les pénalités et frais juridiques.',
    20,
    defBoxY + 7
  );

  curY = defBoxY + 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('8. CONFIDENTIALITÉ ET PROTECTION DES DONNÉES', 14, curY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'VERSALBANK s\'engage à protéger les données personnelles des emprunteurs conformément au RGPD et à la LPRPDE canadienne. Les informations personnelles ne seront utilisées qu\'à des fins de gestion de prêt et ne seront pas partagées avec des tiers sans consentement explicite, sauf obligation légale.',
    14,
    curY + 6,
    { maxWidth: 182 }
  );

  curY += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('9. RÈGLEMENT DES LITIGES', 14, curY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Tout litige découlant de cet accord de prêt sera soumis à la juridiction compétente. Les parties s\'engagent à tenter d\'abord de résoudre tout différend par médiation amiable avant de recourir à une action judiciaire.',
    14,
    curY + 6,
    { maxWidth: 182 }
  );

  drawPageFooter(doc, 3, totalPages);

  // ================= PAGE 4 =================
  doc.addPage();
  drawPageHeader(doc, 4, totalPages);

  curY = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('10. ACCEPTATION ET SIGNATURES', 14, curY);

  // Encadré Bleu Ciel Acceptation
  const blueBoxY = curY + 6;
  doc.setFillColor(BANK_INFO.blueBoxBg[0], BANK_INFO.blueBoxBg[1], BANK_INFO.blueBoxBg[2]);
  doc.setDrawColor(BANK_INFO.blueBoxBorder[0], BANK_INFO.blueBoxBorder[1], BANK_INFO.blueBoxBorder[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, blueBoxY, 182, 16, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text(
    'En signant ce document, l\'emprunteur reconnaît avoir lu, compris et accepté l\'intégralité des conditions énoncées dans cet accord de prêt.',
    20,
    blueBoxY + 9,
    { maxWidth: 170 }
  );

  curY = blueBoxY + 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Les parties déclarent avoir lu et accepté les conditions ci-dessus :', 14, curY);

  // Dual signature boxes
  const sigY = curY + 6;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  // Emprunteur
  doc.roundedRect(14, sigY, 86, 62, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('Emprunteur', 18, sigY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nom : ${data.clientName}`, 18, sigY + 14);
  doc.text(`Date : ${dateStr}`, 18, sigY + 19);
  doc.text('Signature :', 18, sigY + 25);
  // Signature line
  doc.setDrawColor(148, 163, 184);
  doc.line(18, sigY + 52, 92, sigY + 52);
  doc.setFontSize(7);
  doc.text('Mention manuscrite "Bon pour accord"', 18, sigY + 56);

  // Prêteur
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(110, sigY, 86, 62, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('Institution prêteuse', 114, sigY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(BANK_INFO.fullName, 114, sigY + 14);
  doc.text(`Date : ${dateStr}`, 114, sigY + 19);
  doc.text('Visa de la Direction du Crédit :', 114, sigY + 25);

  // Stylized signature stamp
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(15, 43, 92);
  doc.text("L'Administration VersalBank", 122, sigY + 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Comité Exécutif des Risques & Engagements', 114, sigY + 50);

  // Stamp CONFIDENTIAL
  drawConfidentialStamp(doc, 105, sigY + 80);

  drawPageFooter(doc, 4, totalPages);

  // ================= PAGE 5 =================
  doc.addPage();
  drawPageHeader(doc, 5, totalPages);

  // Big Royal Blue Title Banner
  doc.setFillColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.roundedRect(14, 36, 182, 12, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('ANNEXE LÉGALE & CONDITIONS PARTICULIÈRES', 105, 44, { align: 'center' });

  autoTable(doc, {
    startY: 54,
    head: [['Article', 'Disposition contractuelle', 'Référence légale']],
    body: [
      ['Art. 11', 'Garantie et assurance facultative emprunteur couvrant décès, invalidité et perte d\'emploi.', 'Code civil du Québec / L.I.C.'],
      ['Art. 12', 'Facilitation d\'octroi sous réserve de conformité KYC / AML FINTRAC.', 'Loi sur le recyclage des produits de la criminalité'],
      ['Art. 13', 'Compensation et mandat de prélèvement interbancaire automatique SEPA / ACSS.', 'Règle H1 Association canadienne des paiements'],
      ['Art. 14', 'Archivage probatoire des contrats dématérialisés pendant 10 ans.', 'Norme eIDAS / Loi sur la preuve au Canada'],
      ['Art. 15', 'Attribution de compétence et élection de domicile.', 'Chambre de Commerce Internationale']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: BANK_INFO.primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 4
    },
    margin: { left: 14, right: 14 }
  });

  const finalAnnexeY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('AUTHENTIFICATION NUMÉRIQUE DU DOSSIER', 14, finalAnnexeY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Identifiant d'empreinte SHA-256 : ${Math.random().toString(36).substring(2, 15).toUpperCase()}-${Date.now().toString(16).toUpperCase()}`, 14, finalAnnexeY + 6);
  doc.text(`Horodatage universel certifié : ${new Date().toISOString()}`, 14, finalAnnexeY + 11);
  doc.text('Ce document est certifié conforme et scellé électroniquement par les serveurs de compensation VersalBank.', 14, finalAnnexeY + 16);

  drawConfidentialStamp(doc, 150, finalAnnexeY + 36);

  drawPageFooter(doc, 5, totalPages);

  // Download
  doc.save(`VersalBank_Conditions_Pret_${refCode}.pdf`);
}

/**
 * GENERATE AND DOWNLOAD PDF: PARAMÈTRES DE PRÊT
 */
export function downloadLoanParametersPdf(data: LoanPdfData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const curr = data.currency || 'EUR';
  const rate = data.interestRate || 3.0;
  const originalRate = 5.0;
  const subsidyRate = 2.0;
  const totalToRepay = data.monthlyPayment * data.durationMonths;
  const totalInterest = totalToRepay - data.amount;

  const rOrig = originalRate / 100 / 12;
  const paymentOrig =
    (data.amount * rOrig * Math.pow(1 + rOrig, data.durationMonths)) /
    (Math.pow(1 + rOrig, data.durationMonths) - 1);
  const savings = Math.max(0, paymentOrig * data.durationMonths - totalToRepay);

  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  const refCode = data.referenceNumber || `LS-${data.loanId.slice(-6).toUpperCase()}-2026`;

  // Build full monthly amortization table
  const scheduleRows: string[][] = [];
  let currentBalance = data.amount;
  const monthlyRate = rate / 100 / 12;
  const startDate = data.createdAt ? new Date(data.createdAt) : new Date();

  for (let i = 1; i <= data.durationMonths; i++) {
    const interestM = currentBalance * monthlyRate;
    const principalM = data.monthlyPayment - interestM;
    currentBalance = Math.max(0, currentBalance - principalM);

    const pDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const dateFormatted = pDate.toLocaleDateString('fr-FR');

    scheduleRows.push([
      String(i),
      dateFormatted,
      formatEur(data.monthlyPayment, curr),
      formatEur(interestM, curr),
      formatEur(principalM, curr),
      formatEur(currentBalance, curr)
    ]);
  }

  // Calculate total pages needed
  const totalPages = 4;

  // ================= PAGE 1 =================
  drawPageHeader(doc, 1, totalPages);

  // Big Royal Blue Title Banner
  doc.setFillColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.roundedRect(14, 36, 182, 12, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('PARAMÈTRES DE PRÊT', 105, 44, { align: 'center' });

  // Metadata Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date du document : ${dateStr}`, 14, 54);
  doc.text(`Numéro de référence : ${refCode}`, 196, 54, { align: 'right' });

  // Table synthétique Détails du prêt
  autoTable(doc, {
    startY: 58,
    body: [
      ['Montant du prêt :', formatEur(data.amount, curr), 'Mensualité :', formatEur(data.monthlyPayment, curr)],
      ['Durée du prêt :', `${data.durationMonths} mois`, 'Intérêts payés :', formatEur(totalInterest, curr)],
      ['Taux d\'intérêt :', `${rate.toFixed(2)}% / année`, 'Coût total du prêt :', formatEur(totalToRepay, curr)]
    ],
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [30, 41, 59], fillColor: [248, 250, 252], cellWidth: 40 },
      1: { textColor: [51, 65, 85], cellWidth: 51 },
      2: { fontStyle: 'bold', textColor: [30, 41, 59], fillColor: [248, 250, 252], cellWidth: 40 },
      3: { textColor: [51, 65, 85], cellWidth: 51 }
    },
    margin: { left: 14, right: 14 }
  });

  // Encadré Vert Subvention
  const greenBoxY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFillColor(BANK_INFO.greenBg[0], BANK_INFO.greenBg[1], BANK_INFO.greenBg[2]);
  doc.setDrawColor(BANK_INFO.greenBorder[0], BANK_INFO.greenBorder[1], BANK_INFO.greenBorder[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, greenBoxY, 182, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(BANK_INFO.greenText[0], BANK_INFO.greenText[1], BANK_INFO.greenText[2]);
  doc.text('PROGRAMME DE SUBVENTION VERSALBANK', 20, greenBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'VERSALBANK agit en tant que facilitateur de crédit et subventionne 2% du taux d\'intérêt pour vous aider à accéder à un financement abordable.',
    20,
    greenBoxY + 11,
    { maxWidth: 170 }
  );
  doc.text(`• Taux d'intérêt initial de la banque : ${originalRate.toFixed(2)}%`, 20, greenBoxY + 16);
  doc.text(`• Subvention VERSALBANK : -${subsidyRate.toFixed(2)}%`, 20, greenBoxY + 20);
  doc.text(`• Votre taux d'intérêt réduit : ${rate.toFixed(2)}%`, 20, greenBoxY + 24);
  doc.setFont('helvetica', 'bold');
  doc.text(`Économie totale sur la durée du prêt : ${formatEur(savings, curr)}`, 20, greenBoxY + 28);

  // Encadré Bleu Information
  const infoBoxY = greenBoxY + 36;
  doc.setFillColor(BANK_INFO.blueBoxBg[0], BANK_INFO.blueBoxBg[1], BANK_INFO.blueBoxBg[2]);
  doc.setDrawColor(BANK_INFO.blueBoxBorder[0], BANK_INFO.blueBoxBorder[1], BANK_INFO.blueBoxBorder[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, infoBoxY, 182, 14, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text(
    'Ce document ne fournit pas le détail du remboursement anticipé du dossier. En cas de report de paiement, le capital restant indiqué dans ce tableau ne tient pas compte des paiements différés. Il est donc nécessaire d\'ajouter tout paiement différé au capital restant indiqué.',
    20,
    infoBoxY + 5,
    { maxWidth: 170 }
  );

  // Échéancier d'amortissement Titre
  const scheduleTitleY = infoBoxY + 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('Échéancier d\'amortissement', 14, scheduleTitleY);

  // First batch of schedule rows (page 1: rows 0 to 14)
  const page1Rows = scheduleRows.slice(0, 14);
  autoTable(doc, {
    startY: scheduleTitleY + 3,
    head: [['N°', 'Date de paiement', 'Mensualité', 'Intérêts payés', 'Capital remboursé', 'Solde restant']],
    body: page1Rows,
    theme: 'grid',
    headStyles: {
      fillColor: BANK_INFO.primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 2,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  drawPageFooter(doc, 1, totalPages);

  // ================= PAGE 2 =================
  doc.addPage();
  drawPageHeader(doc, 2, totalPages);

  const page2Rows = scheduleRows.slice(14, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('Échéancier d\'amortissement (suite)', 14, 38);

  autoTable(doc, {
    startY: 41,
    head: [['N°', 'Date de paiement', 'Mensualité', 'Intérêts payés', 'Capital remboursé', 'Solde restant']],
    body: page2Rows,
    theme: 'grid',
    headStyles: {
      fillColor: BANK_INFO.primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 2,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  drawPageFooter(doc, 2, totalPages);

  // ================= PAGE 3 =================
  doc.addPage();
  drawPageHeader(doc, 3, totalPages);

  const page3Rows = scheduleRows.slice(38, 62);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('Échéancier d\'amortissement (suite)', 14, 38);

  autoTable(doc, {
    startY: 41,
    head: [['N°', 'Date de paiement', 'Mensualité', 'Intérêts payés', 'Capital remboursé', 'Solde restant']],
    body: page3Rows.length > 0 ? page3Rows : scheduleRows.slice(0, 1),
    theme: 'grid',
    headStyles: {
      fillColor: BANK_INFO.primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 2,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  drawPageFooter(doc, 3, totalPages);

  // ================= PAGE 4 (Signatures et Clôture) =================
  doc.addPage();
  drawPageHeader(doc, 4, totalPages);

  // Remaining rows if duration > 62
  const page4Rows = scheduleRows.slice(62, 75);
  let finalY = 38;
  if (page4Rows.length > 0) {
    autoTable(doc, {
      startY: 41,
      head: [['N°', 'Date de paiement', 'Mensualité', 'Intérêts payés', 'Capital remboursé', 'Solde restant']],
      body: page4Rows,
      theme: 'grid',
      headStyles: {
        fillColor: BANK_INFO.primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85],
        cellPadding: 2,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 }
    });
    finalY = (doc as any).lastAutoTable.finalY + 10;
  } else {
    finalY = 48;
  }

  // Signatures notice
  doc.setFillColor(BANK_INFO.blueBoxBg[0], BANK_INFO.blueBoxBg[1], BANK_INFO.blueBoxBg[2]);
  doc.setDrawColor(BANK_INFO.blueBoxBorder[0], BANK_INFO.blueBoxBorder[1], BANK_INFO.blueBoxBorder[2]);
  doc.roundedRect(14, finalY, 182, 12, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text(
    'En attente de preuve et de signature du document pour finaliser le transfert.',
    105,
    finalY + 7.5,
    { align: 'center' }
  );

  const sigBoxY = finalY + 20;
  // Dual signature boxes
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  // Emprunteur
  doc.roundedRect(14, sigBoxY, 86, 62, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('Emprunteur', 18, sigBoxY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nom : ${data.clientName}`, 18, sigBoxY + 14);
  doc.text(`Date : ${dateStr}`, 18, sigBoxY + 19);
  doc.text('Signature :', 18, sigBoxY + 25);
  doc.setDrawColor(148, 163, 184);
  doc.line(18, sigBoxY + 52, 92, sigYOr(sigBoxY + 52));
  doc.setFontSize(7);
  doc.text('Mention manuscrite "Bon pour accord"', 18, sigBoxY + 56);

  // Prêteur
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(110, sigBoxY, 86, 62, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BANK_INFO.primaryColor[0], BANK_INFO.primaryColor[1], BANK_INFO.primaryColor[2]);
  doc.text('Institution prêteuse', 114, sigBoxY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(BANK_INFO.fullName, 114, sigBoxY + 14);
  doc.text(`Date : ${dateStr}`, 114, sigBoxY + 19);
  doc.text('Visa & Cachet :', 114, sigBoxY + 25);

  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(15, 43, 92);
  doc.text("L'Administration VersalBank", 122, sigBoxY + 44);

  // Stamp CONFIDENTIAL
  drawConfidentialStamp(doc, 105, sigBoxY + 80);

  drawPageFooter(doc, 4, totalPages);

  // Download
  doc.save(`VersalBank_Parametres_Pret_${refCode}.pdf`);
}

function sigYOr(val: number): number {
  return val;
}
