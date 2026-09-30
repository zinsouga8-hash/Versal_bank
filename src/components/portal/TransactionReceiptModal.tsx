import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Download, Printer, CheckCircle2, ShieldCheck } from 'lucide-react';
import BankMonogram from '../public/BankMonogram';
import { Movement } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TransactionReceiptModalProps {
  movement: Movement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TransactionReceiptModal({ movement, open, onOpenChange }: TransactionReceiptModalProps) {
  if (!movement) return null;

  const handlePrint = () => {
    window.print();
  };

  const isCredit = movement.direction === 'credit';
  const formattedDate = format(new Date(movement.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border border-[#eee8dd] bg-white">
        {/* Receipt Header */}
        <div className="bg-[#131720] text-white p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BankMonogram className="w-9 h-9" />
              <div>
                <h3 className="font-heading font-serif font-bold text-lg text-white">VersalBank</h3>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#60a5fa]">Banque Canadienne</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              {movement.status === 'completed' ? 'Opération Exécutée' : 'En Traitement'}
            </span>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs uppercase tracking-wider text-white/60">Avis d'Opération Bancaire</p>
            <p className={`text-3xl font-heading font-bold mt-1 ${isCredit ? 'text-emerald-400' : 'text-blue-300'}`}>
              {isCredit ? '+' : '-'}
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: movement.currency || 'CAD' }).format(movement.amount)}
            </p>
            <p className="text-xs text-white/50 mt-1 font-mono">{movement.reference}</p>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-4 text-sm text-[#1a1a1a]">
          <div className="divide-y divide-[#eee8dd] border-y border-[#eee8dd]">
            <div className="py-2.5 flex justify-between">
              <span className="text-xs text-[#8a857e]">Type d'opération</span>
              <span className="font-medium capitalize">{movement.motif || movement.kind}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-xs text-[#8a857e]">Moyen / Canal</span>
              <span className="font-medium">{movement.method}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-xs text-[#8a857e]">Date d'exécution</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
            {movement.beneficiary_name && (
              <div className="py-2.5 flex justify-between">
                <span className="text-xs text-[#8a857e]">Bénéficiaire / Émetteur</span>
                <span className="font-medium">{movement.beneficiary_name}</span>
              </div>
            )}
            <div className="py-2.5 flex justify-between">
              <span className="text-xs text-[#8a857e]">Compte Débit/Crédit</span>
              <span className="font-mono text-xs">{movement.client_id}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-xs text-[#8a857e]">Chiffrement & Sécurité</span>
              <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Certifié SHA-256
              </span>
            </div>
          </div>

          <div className="p-3 bg-[#faf7f0] rounded-2xl border border-[#eee8dd] text-[11px] text-[#666] leading-relaxed">
            Ce document tient lieu de justificatif comptable officiel d'opération bancaire émis par VersalBank Corporation conformément aux règlements de l'Agence de la consommation en matière financière du Canada (ACFC).
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex-1 rounded-xl border-[#eee8dd] text-[#1a1a1a] hover:bg-[#faf7f0] gap-2 text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer le reçu
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl bg-[#0f2b5c] hover:bg-[#0a1e40] text-white text-xs"
            >
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
