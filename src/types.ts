export type ClientType = 'particulier' | 'professionnel';
export type EmploymentStatus = 'salarie' | 'independant' | 'fonctionnaire' | 'retraite' | 'sans_emploi' | 'etudiant' | 'autres';
export type Document = { label: string; file_url: string };
export type AccountStatus = 'pending' | 'approved' | 'rejected';
export type Currency = 'CAD' | 'USD' | 'EUR';

export interface ClientAccount {
  id?: string;
  profile_id?: string;
  user_email: string;
  client_id: string;
  portal_password?: string;
  pin: string;
  first_name: string;
  last_name: string;
  birth_date: string; // ISO date string
  nationality: string;
  country: string;
  city: string;
  address: string;
  postal_code: string;
  phone: string;
  language: 'fr' | 'en';
  client_type: ClientType;
  employment_status: EmploymentStatus;
  profession: string;
  monthly_income: string;
  employed_since: string;
  documents: Document[];
  terms_accepted: boolean;
  age_confirmed: boolean;
  status: AccountStatus;
  account_active: boolean;
  account_number?: string;
  iban?: string;
  bic?: string;
  swift_code?: string;
  cat_code?: string;
  cot_code?: string;
  balance: number;
  currency: Currency;
  admin_note?: string;
  is_admin?: boolean;
  role?: 'client' | 'admin' | 'moderator';
}

export interface AdminRecord {
  email: string;
  role: 'superadmin' | 'admin' | 'moderator';
  addedAt: number;
  addedBy?: string;
  notes?: string;
}

export type MovementKind = 'deposit' | 'withdrawal' | 'transfer' | 'loan_credit' | 'card_load' | 'admin_credit';
export type MovementDirection = 'credit' | 'debit';
export type MovementStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed' | 'rejected';

export interface Movement {
  id?: string;
  account_id?: string;
  client_id?: string;
  client_email?: string;
  user_id?: string;
  user_email?: string;
  kind?: MovementKind;
  type?: string;
  direction?: MovementDirection;
  method?: string;
  payment_method?: string;
  amount: number;
  currency: string;
  beneficiary_name?: string;
  beneficiary_country?: string;
  beneficiary_details?: string;
  motif?: string;
  description?: string;
  reference?: string;
  status: MovementStatus;
  date?: string;
  createdAt?: number;
  created_at?: string | number;
}

export type Transaction = Movement;

export type CardBrand = 'visa' | 'mastercard';
export type CardTier = 'standard' | 'gold' | 'platinum';
export type CardStatus = 'inactive' | 'approved' | 'active' | 'blocked';

export interface VirtualCard {
  account_id: string;
  client_id: string;
  client_email: string;
  user_email?: string;
  holder_name: string;
  client_name?: string;
  card_holder?: string;
  brand: CardBrand;
  tier: CardTier;
  number: string;
  card_number?: string;
  cvc: string;
  cvv?: string;
  cvc_visible: boolean;
  is_locked?: boolean;
  is_frozen?: boolean;
  expiry: string;
  daily_limit: number;
  monthly_limit: number;
  balance: number;
  status: CardStatus;
  transfer_enabled: boolean;
  shipping_requested: boolean;
  shipping_name?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_postal_code?: string;
  shipping_country?: string;
  shipping_phone?: string;
  shipping_requested_at?: number;
  ship_country?: string;
  ship_city?: string;
  ship_address?: string;
  ship_postal_code?: string;
  shipment_step?: number;
  createdAt: number;
  created_at?: string | number;
}

export type LoanProject = 'immobilier' | 'automobile' | 'travaux' | 'entreprise' | 'etudes' | 'tresorerie' | 'autres';
export type LoanStatus = 'pending' | 'processing' | 'approved' | 'funded' | 'rejected';

export interface LoanApplication {
  account_id: string;
  client_id: string;
  client_email: string;
  project: LoanProject;
  project_details?: string;
  amount: number;
  duration_months: number;
  rate: number;
  monthly_payment: number;
  contract_signed_url?: string;
  contract_signed: boolean;
  status: LoanStatus;
  createdAt: number;
}

export type ProfileChangeStatus = 'pending' | 'approved' | 'rejected';

export interface ProfileChangeRequest {
  account_id: string;
  client_id: string;
  client_email: string;
  changes: { field: string; old_value: string; new_value: string }[];
  status: ProfileChangeStatus;
  createdAt: number;
}

export interface BankSetting {
  legal_name: string;
  head_office: string;
  support_email: string;
  sender_email: string;
  service_email: string;
  admin_notify_email: string;
  admin_pin: string;
  phone: string;
  whatsapp: string;
  opening_hours: string;
  registration_info: string;
  bank_name: string;
  bank_suffix: string;
  logo_url: string;
  bic: string;
  usdt_card_address: string;
  loan_rate_default: number;
  loan_rates: Record<string, number>;
  loan_contract_template: string;
  loan_contract_template_url?: string;
  tpl_account_received: string;
  tpl_account_created: string;
  tpl_account_approved: string;
  tpl_account_activated: string;
  tpl_card_activated: string;
  tpl_movement_update: string;
  tpl_loan_received: string;
  footer_about: string;
  footer_rights: string;
  footer_links: { label: string; url: string }[];
}

export type PaymentCategory = 'cash_transfer' | 'wallet' | 'crypto' | 'bank';
export type PaymentUsage = 'deposit' | 'withdrawal' | 'both';

export interface PaymentChannel {
  name: string;
  category: PaymentCategory;
  coordinates: string;
  instructions: string;
  usage: PaymentUsage;
  active: boolean;
}

export interface BlockedIp {
  ip: string;
  reason: string;
  active: boolean;
}

export interface ClientMessage {
  client_email: string;
  client_id: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: number;
}
