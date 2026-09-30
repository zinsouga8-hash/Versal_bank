import React, { useEffect, useState } from 'react';
import { fetchBankSettings, saveBankSettings } from '../../lib/supabaseBankService';
import { BankSetting, AdminRecord } from '../../types';
import { useAuth, SUPER_ADMINS } from '../../lib/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { 
  Loader2, Save, ShieldAlert, ShieldCheck, UserPlus, 
  Trash2, KeyRound, Building2, Phone, Mail, Globe, Lock, Landmark
} from 'lucide-react';

export default function AdminSettings() {
  const { grantAdmin, revokeAdmin, listAdmins, adminRole, isSuperAdmin } = useAuth();
  const [settings, setSettings] = useState<Partial<BankSetting>>(() => {
    try {
      const raw = localStorage.getItem('versalbank_settings');
      return raw ? JSON.parse(raw) : {
        legal_name: 'VersalBank Banque Canadienne Inc.',
        head_office: '100 King Street West, Suite 5600, Toronto, ON M5X 1C9, Canada',
        bank_name: 'VersalBank',
        bank_suffix: 'Banque Canadienne',
        support_email: 'support@versalpac.com',
        sender_email: 'support@versalpac.com',
        service_email: 'support@versalpac.com',
        admin_email: 'contact@versalpac.com',
        phone: '+1 (416) 880-9281',
        whatsapp: '+1 (416) 880-9281',
        opening_hours: 'Lundi - Vendredi : 08h30 - 18h00 (EST) / Service VIP 24/7',
        bic: 'VERSCA2TMTR',
      };
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isModerator = adminRole === 'moderator' && !isSuperAdmin;

  // Admin access management state
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'moderator'>('admin');
  const [newAdminNotes, setNewAdminNotes] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  const fetchAdminList = async () => {
    setLoadingAdmins(true);
    try {
      const list = await listAdmins();
      setAdmins(list);
    } catch (e) {
      console.error('Error fetching admin list:', e);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const data = await fetchBankSettings();
        setSettings(data || {
          legal_name: 'VersalBank Banque Canadienne Inc.',
          head_office: '100 King Street West, Suite 5600, Toronto, ON M5X 1C9, Canada',
          bank_name: 'VersalBank',
          bank_suffix: 'Banque Canadienne',
          support_email: 'support@versalpac.com',
          sender_email: 'support@versalpac.com',
          service_email: 'support@versalpac.com',
          admin_email: 'contact@versalpac.com',
          phone: '+1 (416) 880-9281',
          whatsapp: '+1 (416) 880-9281',
          opening_hours: 'Lundi - Vendredi : 08h30 - 18h00 (EST) / Service VIP 24/7',
          bic: 'VERSCA2TMTR',
          registration_info: 'Agrément OSFI / BSI N° CA-90218-B • Licence Bancaire Fédérale',
          admin_pin: '2025',
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
    fetchAdminList();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setSettings({ 
      ...settings, 
      [name]: type === 'number' ? parseFloat(value) : value 
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveBankSettings(settings);
      toast.success("Paramètres institutionnels et coordonnées mis à jour.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement des paramètres.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminEmail.includes('@')) {
      toast.error("Veuillez renseigner une adresse courriel valide.");
      return;
    }

    setAddingAdmin(true);
    try {
      const success = await grantAdmin(newAdminEmail, newAdminRole, newAdminNotes);
      if (success) {
        setNewAdminEmail('');
        setNewAdminNotes('');
        await fetchAdminList();
      }
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRevoke = async (email: string) => {
    if (SUPER_ADMINS.includes(email.toLowerCase())) {
      toast.error("Le Super-Administrateur principal ne peut pas être révoqué.");
      return;
    }
    if (!confirm(`Confirmez-vous le retrait des accès administrateur pour ${email} ?`)) return;

    try {
      const ok = await revokeAdmin(email);
      if (ok) {
        setAdmins(admins.filter(a => a.email.toLowerCase() !== email.toLowerCase()));
      }
    } catch (e) {
      console.error(e);
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
    <div className="p-6 md:p-8 space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Landmark className="w-6 h-6 text-amber-600" />
            Identité Bancaire & Paramètres Généraux
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Dénomination légale, adresses de contact du service client, code BIC, sécurité administrateur et habilitations.
          </p>
        </div>

        {!isModerator && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer tous les paramètres
          </Button>
        )}
      </div>

      {isModerator && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-4 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <p className="font-semibold">Rôle Modérateur — Mode Consultation Seule</p>
            <p className="text-blue-700 mt-0.5">
              En tant que modérateur, vous avez accès à l'examen des dossiers clients, des mouvements financiers et des demandes de prêt. La modification des paramètres institutionnels globaux et l'habilitation d'administrateurs sont réservées aux Administrateurs et au Super-Administrateur.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Section 1: Identité de la Banque */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-amber-600" />
            Identité Institutionnelle & Enregistrement
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Nom Commercial de la Banque</Label>
              <Input
                name="bank_name"
                value={settings.bank_name || ''}
                onChange={handleChange}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Sous-titre / Suffixe</Label>
              <Input
                name="bank_suffix"
                value={settings.bank_suffix || ''}
                onChange={handleChange}
                placeholder="ex: BANQUE CANADIENNE"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Dénomination Sociale Légale</Label>
              <Input
                name="legal_name"
                value={settings.legal_name || ''}
                onChange={handleChange}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Agrément & Licence Bancaire</Label>
              <Input
                name="registration_info"
                value={settings.registration_info || ''}
                onChange={handleChange}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs text-slate-700 font-medium">Adresse du Siège Social</Label>
              <Input
                name="head_office"
                value={settings.head_office || ''}
                onChange={handleChange}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Service Client */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Mail className="w-4 h-4 text-amber-600" />
            Coordonnées du Service Clientèle & Messagerie
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Courriel du Service Client (Support)</Label>
              <Input
                type="email"
                name="support_email"
                value={settings.support_email || ''}
                onChange={handleChange}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Courriel d'Envoi Automatique (Expéditeur)</Label>
              <Input
                type="email"
                name="sender_email"
                value={settings.sender_email || ''}
                onChange={handleChange}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Téléphone du Standard</Label>
              <Input
                name="phone"
                value={settings.phone || ''}
                onChange={handleChange}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">WhatsApp Professionnel</Label>
              <Input
                name="whatsapp"
                value={settings.whatsapp || ''}
                onChange={handleChange}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs text-slate-700 font-medium">Plages Horaires d'Ouverture</Label>
              <Input
                name="opening_hours"
                value={settings.opening_hours || ''}
                onChange={handleChange}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Codes Monétiques & Sécurité */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-amber-600" />
            Paramètres Monétiques & Sécurité Admin
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Code BIC / Identifiant Institutionnel</Label>
              <Input
                name="bic"
                value={settings.bic || ''}
                onChange={handleChange}
                className="text-xs font-mono font-bold text-slate-800"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-medium">Code PIN Secret Administrateur</Label>
              <Input
                type="password"
                name="admin_pin"
                value={settings.admin_pin || ''}
                onChange={handleChange}
                className="text-xs font-mono font-bold"
                maxLength={6}
              />
            </div>
          </div>
        </div>
      </form>

      {/* Section 4: RBAC / Admin Team */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div>
          <h3 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            Gestion des Accès & Équipe Administrateur
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Habilitez des collaborateurs avec des rôles Administrateur ou Modérateur.
          </p>
        </div>

        {!isModerator && (
          <form onSubmit={handleAddAdmin} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-semibold text-slate-700">Habiliter un nouvel administrateur</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="Courriel du compte..."
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="text-xs bg-white"
                required
              />
              <Select value={newAdminRole} onValueChange={(val: any) => setNewAdminRole(val)}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur Complet</SelectItem>
                  <SelectItem value="moderator">Modérateur (Consultation)</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={addingAdmin} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                {addingAdmin ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
                Accorder l'accès
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-700">Administrateurs Actifs</h4>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {SUPER_ADMINS.map(email => (
              <div key={email} className="flex items-center justify-between p-3 bg-amber-50/40 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-slate-900">{email}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900">
                    SUPER-ADMIN PROPRIÉTAIRE
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 italic">Accès permanent</span>
              </div>
            ))}

            {admins.map(adm => {
              if (SUPER_ADMINS.includes(adm.email.toLowerCase())) return null;
              return (
                <div key={adm.email} className="flex items-center justify-between p-3 bg-white text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-800">{adm.email}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 uppercase">
                      {adm.role}
                    </span>
                  </div>
                  {!isModerator && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevoke(adm.email)}
                      className="text-xs h-7 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Révoquer
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
