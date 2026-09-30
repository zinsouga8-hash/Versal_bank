import React, { useEffect, useState } from 'react';
import { fetchBankSettings, saveBankSettings } from '../../lib/supabaseBankService';
import { BankSetting } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { Loader2, Save, Percent, Sparkles, SlidersHorizontal, ShieldCheck } from 'lucide-react';

interface ProjectRateConfig {
  key: string;
  name: string;
  description: string;
  rate: number;
  minAmount: number;
  maxAmount: number;
  minMonths: number;
  maxMonths: number;
}

const DEFAULT_PROJECT_RATES: ProjectRateConfig[] = [
  { key: 'immobilier', name: 'Prêt Immobilier & Résidence', description: 'Acquisition résidence principale ou locative', rate: 2.45, minAmount: 50000, maxAmount: 1500000, minMonths: 60, maxMonths: 360 },
  { key: 'automobile', name: 'Prêt Automobile & Véhicule', description: 'Voiture neuve, occasion ou hybride/électrique', rate: 3.80, minAmount: 5000, maxAmount: 85000, minMonths: 12, maxMonths: 84 },
  { key: 'travaux', name: 'Prêt Travaux & Rénovation', description: 'Éco-rénovation, agrandissement et aménagement', rate: 2.90, minAmount: 3000, maxAmount: 120000, minMonths: 12, maxMonths: 120 },
  { key: 'entreprise', name: 'Financement Professionnel & PME', description: 'Investissement matériel, création ou trésorerie pro', rate: 3.20, minAmount: 10000, maxAmount: 750000, minMonths: 12, maxMonths: 180 },
  { key: 'etudes', name: 'Prêt Études & Formation', description: 'Frais de scolarité universitaire et installation', rate: 1.90, minAmount: 2000, maxAmount: 60000, minMonths: 12, maxMonths: 120 },
  { key: 'tresorerie', name: 'Prêt Personnel & Trésorerie', description: 'Projets personnels libres, voyage ou imprévus', rate: 4.50, minAmount: 1000, maxAmount: 50000, minMonths: 6, maxMonths: 84 },
  { key: 'autres', name: 'Autres Financements Spéciaux', description: 'Dossiers sur mesure ou restructuration', rate: 3.50, minAmount: 2000, maxAmount: 200000, minMonths: 12, maxMonths: 120 },
];

export default function AdminLoanRates() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultRate, setDefaultRate] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('versalbank_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.loan_rate_default !== undefined) return parsed.loan_rate_default;
      }
    } catch {}
    return 3.00;
  });
  const [projectRates, setProjectRates] = useState<ProjectRateConfig[]>(() => {
    try {
      const raw = localStorage.getItem('versalbank_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.detailed_loan_rates && Array.isArray(parsed.detailed_loan_rates)) return parsed.detailed_loan_rates;
      }
    } catch {}
    return DEFAULT_PROJECT_RATES;
  });

  useEffect(() => {
    const fetchRates = async () => {
      setLoading(true);
      try {
        const data = await fetchBankSettings();
        if (data) {
          if (data.loan_rate_default !== undefined) {
            setDefaultRate(data.loan_rate_default);
          }
          if (data.detailed_loan_rates && Array.isArray(data.detailed_loan_rates) && data.detailed_loan_rates.length > 0) {
            setProjectRates(data.detailed_loan_rates);
          } else if (data.loan_rates) {
            setProjectRates(prev => prev.map(p => ({
              ...p,
              rate: data.loan_rates?.[p.key] ?? p.rate
            })));
          }
        }
      } catch (e) {
        console.error(e);
        toast.error("Impossible de charger les taux configurés.");
      } finally {
        setLoading(false);
      }
    };
    fetchRates();
  }, []);

  const handleRateChange = (key: string, field: keyof ProjectRateConfig, val: number) => {
    setProjectRates(prev => prev.map(item => item.key === key ? { ...item, [field]: val } : item));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ratesMap: Record<string, number> = {};
      projectRates.forEach(p => {
        ratesMap[p.key] = p.rate;
      });

      const current = await fetchBankSettings();
      await saveBankSettings({
        ...current,
        loan_rate_default: defaultRate,
        loan_rates: ratesMap,
        detailed_loan_rates: projectRates,
      });

      toast.success("Barème des taux d'intérêt et plafonds enregistré avec succès.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement des taux.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="p-6 md:p-8 space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Percent className="w-6 h-6 text-amber-600" />
            Barème des Taux de Financement & Crédits
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Configurez le taux annuel effectif global (TAEG) appliqué automatiquement aux simulateurs et dossiers de prêt des clients.
          </p>
        </div>
        <Button 
          type="submit" 
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer le barème
        </Button>
      </div>

      {/* Global Default Rate Card */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">Taux de base par défaut</span>
          </div>
          <h3 className="text-lg font-medium text-slate-900">Taux standard applicable aux nouveaux dossiers</h3>
          <p className="text-xs text-slate-600">Appliqué lorsqu'aucun taux spécifique au projet n'est renseigné.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-36">
            <Input
              type="number"
              step="0.01"
              min="0.1"
              max="25"
              value={defaultRate}
              onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 0)}
              className="pr-8 text-right font-mono font-bold text-lg text-slate-900 bg-white"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">%</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">TAEG fixe</span>
        </div>
      </div>

      {/* Project Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            Taux par Catégorie de Projet & Plafonds
          </h3>
          <span className="text-xs text-slate-500">{projectRates.length} catégories actives</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projectRates.map((proj) => (
            <div key={proj.key} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-amber-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{proj.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{proj.description}</p>
                </div>
                <div className="relative w-28 shrink-0">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="30"
                    value={proj.rate}
                    onChange={(e) => handleRateChange(proj.key, 'rate', parseFloat(e.target.value) || 0)}
                    className="pr-7 text-right font-mono font-bold text-amber-700 bg-slate-50"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-semibold">%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <Label className="text-[11px] text-slate-500">Montant Min / Max (CAD)</Label>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Input
                      type="number"
                      value={proj.minAmount}
                      onChange={(e) => handleRateChange(proj.key, 'minAmount', parseInt(e.target.value) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                    <span className="text-slate-400">-</span>
                    <Input
                      type="number"
                      value={proj.maxAmount}
                      onChange={(e) => handleRateChange(proj.key, 'maxAmount', parseInt(e.target.value) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] text-slate-500">Durée Min / Max (Mois)</Label>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Input
                      type="number"
                      value={proj.minMonths}
                      onChange={(e) => handleRateChange(proj.key, 'minMonths', parseInt(e.target.value) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                    <span className="text-slate-400">-</span>
                    <Input
                      type="number"
                      value={proj.maxMonths}
                      onChange={(e) => handleRateChange(proj.key, 'maxMonths', parseInt(e.target.value) || 0)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Les modifications sont répercutées instantanément sur les simulations du portail client et les nouveaux contrats émis.</span>
      </div>
    </form>
  );
}
