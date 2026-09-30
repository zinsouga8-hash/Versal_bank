import { supabase, isSupabaseConfigured } from './supabase';
import { ClientAccount, Transaction, VirtualCard, Currency, Movement } from '../types';

// Storage keys for resilient local synchronization
const STORAGE_KEYS = {
  CLIENTS: 'versalbank_clients_store',
  TRANSACTIONS: 'versalbank_tx_store',
  MOVEMENTS: 'versalbank_movements_store',
  CARDS: 'versalbank_cards_store',
  LOANS: 'versalbank_loans_store',
  CHANNELS: 'versalbank_channels_store',
  SETTINGS: 'versalbank_settings_store',
  LOAN_RATES: 'versalbank_loan_rates_store',
  LOAN_CONTRACT: 'versalbank_loan_contract_store',
  EMAILS: 'versalbank_emails_store',
  IP_RULES: 'versalbank_ip_rules_store',
  ADMINS: 'versalbank_admins_store',
};

// Listeners for reactive updates
type Listener = () => void;
const changeListeners = new Set<Listener>();

export function subscribeToBankData(listener: Listener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

let notifyTimer: any = null;
export function notifyDataChanged() {
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    changeListeners.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.warn('Listener error:', e);
      }
    });
  }, 200);
}

// Global Supabase Realtime Channel (Event-driven only, no continuous polling loops)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('versalbank_')) {
      notifyDataChanged();
    }
  });
  window.addEventListener('versalbank_update', () => {
    notifyDataChanged();
  });

  if (isSupabaseConfigured) {
    try {
      supabase
        .channel('versalbank_realtime_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          notifyDataChanged();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'client_accounts' }, () => {
          notifyDataChanged();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, () => {
          notifyDataChanged();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => {
          notifyDataChanged();
        })
        .subscribe();
    } catch (rtErr) {
      console.warn('[SupabaseBankService] Realtime channel init notice:', rtErr);
    }
  }
}

function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function setLocal<T>(key: string, val: T, notify: boolean = true): void {
  try {
    const serialized = JSON.stringify(val);
    const existing = localStorage.getItem(key);
    if (existing === serialized) {
      return; // Identical content, do not write or re-notify
    }
    localStorage.setItem(key, serialized);
    if (notify) {
      notifyDataChanged();
    }
  } catch (e) {
    console.warn(`Local storage write error for ${key}:`, e);
  }
}

// Helper to run promises with a safe timeout fallback so UI never freezes
export async function withTimeout<T>(promise: Promise<T>, timeoutMs = 3500, fallbackValue: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch {
    clearTimeout(timer);
    return fallbackValue;
  }
}

// Helper to sync seamlessly with the backend API for multi-device cross-synchronization
async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiBase}${path}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (_) {}
  return null;
}

async function apiPost(path: string, body: any): Promise<boolean> {
  try {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function apiPostJson<T = any>(path: string, body: any): Promise<{
  success: boolean;
  client?: any;
  data?: T;
  error?: string;
  code?: string;
  status?: number;
}> {
  try {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        success: false,
        error: json?.error || `Erreur serveur HTTP ${res.status}`,
        code: json?.code || `HTTP_${res.status}`,
        status: res.status,
        data: json,
      };
    }
    return {
      success: json?.success ?? true,
      client: json?.client,
      data: json,
      error: json?.error,
      code: json?.code,
      status: res.status,
    };
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || err?.message?.includes('timeout') || err?.message?.includes('aborted');
    return {
      success: false,
      error: isAbort ? 'Délai d\'attente dépassé lors de la communication avec le serveur.' : (err?.message || 'Erreur de connexion réseau'),
      code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
      status: 0,
    };
  }
}

async function apiDelete(path: string): Promise<boolean> {
  try {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiBase}${path}`, { 
      method: 'DELETE',
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// Initial seed data if completely blank

// ----------------------------------------------------------------------------
// CLIENTS & PROFILES (Centralized 'profiles' table)
// ----------------------------------------------------------------------------

export interface PaginatedClientsResult {
  clients: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore?: boolean;
}

export async function fetchClientsPaginatedFromSupabase(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}): Promise<PaginatedClientsResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 10));
  const search = (params.search || '').trim();
  const status = (params.status || 'all').trim().toLowerCase();

  // 1. Try server-side paginated API
  try {
    const url = `/api/bank/clients?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
    const res: any = await apiGet(url);
    if (res?.success && Array.isArray(res.clients)) {
      return {
        clients: res.clients,
        total: res.total ?? res.clients.length,
        page: res.page ?? page,
        limit: res.limit ?? limit,
        totalPages: res.totalPages ?? (Math.ceil((res.total ?? res.clients.length) / limit) || 1),
        hasMore: res.hasMore ?? (page < (res.totalPages || 1)),
      };
    }
  } catch (err) {
    console.warn('[SupabaseBankService] Server paginated clients note, trying Supabase direct:', err);
  }

  // 2. Fallback: Direct Supabase query with range() (omits heavy documents field)
  if (isSupabaseConfigured) {
    try {
      const selectCols = 'id, client_id, first_name, last_name, full_name, email, phone, country, city, address, postal_code, nationality, birth_date, profession, monthly_income, employed_since, client_type, account_number, iban, bic, swift_code, cat_code, cot_code, balance, currency, status, account_active, admin_note, role, is_admin, created_at';
      let query = supabase
        .from('profiles')
        .select(selectCols, { count: 'exact' });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,client_id.ilike.%${search}%,account_number.ilike.%${search}%`
        );
      }

      // Explicit deterministic sort: newest first, tie-break on id to prevent random jitter
      query = query
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (!error && Array.isArray(data)) {
        const total = count ?? data.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const formatted = data.map((p: any) => ({
          id: p.id,
          profile_id: p.id,
          client_id: p.client_id || `VSL-${Math.floor(100000 + Math.random() * 900000)}`,
          first_name: p.first_name || (p.full_name ? p.full_name.split(' ')[0] : ''),
          last_name: p.last_name || (p.full_name ? p.full_name.split(' ').slice(1).join(' ') : ''),
          full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          user_email: p.email || p.user_email || '',
          email: p.email || p.user_email || '',
          phone: p.phone || '',
          country: p.country || 'Canada',
          city: p.city || '',
          address: p.address || '',
          postal_code: p.postal_code || '',
          nationality: p.nationality || 'Canadienne',
          birth_date: p.birth_date || '',
          profession: p.profession || '',
          monthly_income: p.monthly_income || '',
          employed_since: p.employed_since || '',
          client_type: p.client_type || 'particulier',
          account_number: p.account_number || '',
          iban: p.iban || '',
          bic: p.bic || 'VERSCA2TMTR',
          swift_code: p.swift_code || '',
          cat_code: p.cat_code || '',
          cot_code: p.cot_code || '',
          portal_password: p.portal_password || '',
          pin: p.pin || '1234',
          balance: typeof p.balance === 'number' ? p.balance : (Number(p.balance) || 0),
          currency: (p.currency as Currency) || 'CAD',
          status: p.status || 'pending',
          account_active: Boolean(p.account_active),
          admin_note: p.admin_note || '',
          created_at: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
          role: p.role || 'client',
          is_admin: Boolean(p.is_admin),
        }));

        return {
          clients: formatted,
          total,
          page,
          limit,
          totalPages,
          hasMore: page < totalPages,
        };
      }
    } catch (sbErr) {
      console.warn('[SupabaseBankService] Supabase direct paginated clients note:', sbErr);
    }
  }

  // 3. Final fallback: local storage list paginated in memory
  const localList = getLocal<any[]>(STORAGE_KEYS.CLIENTS, []);
  let filtered = localList;
  if (status && status !== 'all') {
    filtered = filtered.filter(c => (c.status || '').toLowerCase() === status);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(c => {
      const fn = (c.first_name || '').toLowerCase();
      const ln = (c.last_name || '').toLowerCase();
      const em = (c.user_email || c.email || '').toLowerCase();
      const cid = (c.client_id || '').toLowerCase();
      const an = (c.account_number || '').toLowerCase();
      return fn.includes(s) || ln.includes(s) || em.includes(s) || cid.includes(s) || an.includes(s);
    });
  }
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const from = (page - 1) * limit;
  const paginated = filtered.slice(from, from + limit);
  return {
    clients: paginated,
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * On-demand full dossier fetch for a single client (when admin clicks "Gérer")
 */
export async function fetchClientDetailedProfile(clientIdOrIdentifier: string): Promise<any | null> {
  if (!clientIdOrIdentifier) return null;
  const clean = clientIdOrIdentifier.trim();

  // 1. Try server-side endpoint
  try {
    const res: any = await apiGet(`/api/bank/profile/${encodeURIComponent(clean)}`);
    if (res?.success && res.profile) {
      return res.profile;
    }
  } catch (_) {}

  // 2. Direct Supabase query
  if (isSupabaseConfigured) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      let query = supabase.from('profiles').select('*');
      if (isUuid) {
        query = query.or(`id.eq.${clean},email.ilike.${clean},client_id.eq.${clean},account_number.eq.${clean}`);
      } else {
        query = query.or(`email.ilike.${clean},client_id.eq.${clean},account_number.eq.${clean}`);
      }
      const { data, error } = await query.limit(1).maybeSingle();
      if (!error && data) {
        return data;
      }
    } catch (_) {}
  }

  // 3. Fallback to localStorage
  const localList = getLocal<any[]>(STORAGE_KEYS.CLIENTS, []);
  return localList.find(c => c.id === clean || c.client_id === clean || c.user_email?.toLowerCase() === clean.toLowerCase() || c.email?.toLowerCase() === clean.toLowerCase()) || null;
}

/**
 * On-demand documents fetch for a single client (ONLY loaded when admin opens "Documents" tab)
 */
export async function fetchClientDocumentsOnDemand(clientId: string): Promise<any[]> {
  if (!clientId) return [];
  try {
    const res: any = await apiGet(`/api/bank/clients/${encodeURIComponent(clientId)}/documents`);
    if (res?.success && Array.isArray(res.documents)) {
      return res.documents;
    }
  } catch (_) {}

  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, documents, id_card_url, proof_of_address_url')
        .eq('id', clientId)
        .maybeSingle();

      if (data) {
        const list: any[] = [];
        if (Array.isArray(data.documents)) {
          list.push(...data.documents);
        } else if (data.documents && typeof data.documents === 'object') {
          list.push(data.documents);
        }
        if (data.id_card_url && !list.some(d => d.url === data.id_card_url)) {
          list.push({ label: "Pièce d'identité (Passeport / CNI)", url: data.id_card_url });
        }
        if (data.proof_of_address_url && !list.some(d => d.url === data.proof_of_address_url)) {
          list.push({ label: "Justificatif de domicile", url: data.proof_of_address_url });
        }
        return list;
      }
    } catch (_) {}
  }
  return [];
}

/**
 * On-demand transactions fetch for a single client (ONLY loaded when admin opens "Transactions" tab)
 */
export async function fetchClientTransactionsOnDemand(clientId: string): Promise<any[]> {
  if (!clientId) return [];
  try {
    const res: any = await apiGet(`/api/bank/clients/${encodeURIComponent(clientId)}/transactions`);
    if (res?.success && Array.isArray(res.transactions)) {
      return res.transactions;
    }
  } catch (_) {}

  return fetchTransactionsFromSupabase(clientId);
}

/**
 * On-demand cards fetch for a single client (ONLY loaded when admin opens "Cartes" tab)
 */
export async function fetchClientCardsOnDemand(clientId: string): Promise<any[]> {
  if (!clientId) return [];
  try {
    const res: any = await apiGet(`/api/bank/clients/${encodeURIComponent(clientId)}/cards`);
    if (res?.success && Array.isArray(res.cards)) {
      return res.cards;
    }
  } catch (_) {}

  const allCards = await fetchCardsFromSupabase();
  return allCards.filter((c: any) => c.user_id === clientId || c.client_id === clientId);
}

/**
 * On-demand loans fetch for a single client (ONLY loaded when admin opens "Prêts" tab)
 */
export async function fetchClientLoansOnDemand(clientId: string): Promise<any[]> {
  if (!clientId) return [];
  try {
    const res: any = await apiGet(`/api/bank/clients/${encodeURIComponent(clientId)}/loans`);
    if (res?.success && Array.isArray(res.loans)) {
      return res.loans;
    }
  } catch (_) {}

  const allLoans = await fetchLoansFromSupabase();
  return allLoans.filter((l: any) => l.user_id === clientId || l.client_id === clientId || l.account_id === clientId);
}

/**
 * Server-side paginated movements fetch for Admin Movements tab
 */
export async function fetchMovementsPaginatedFromSupabase(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  kind?: string;
}): Promise<{
  movements: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore?: boolean;
}> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 10));
  const search = (params.search || '').trim();
  const status = (params.status || 'all').trim().toLowerCase();
  const kind = (params.kind || 'all').trim().toLowerCase();

  try {
    const url = `/api/bank/movements?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&kind=${encodeURIComponent(kind)}`;
    const res: any = await apiGet(url);
    if (res?.success && Array.isArray(res.movements)) {
      return {
        movements: res.movements,
        total: res.total ?? res.movements.length,
        page: res.page ?? page,
        limit: res.limit ?? limit,
        totalPages: res.totalPages ?? (Math.ceil((res.total ?? res.movements.length) / limit) || 1),
        hasMore: res.hasMore ?? (page < (res.totalPages || 1)),
      };
    }
  } catch (err) {
    console.warn('[SupabaseBankService] Server paginated movements note:', err);
  }

  // Fallback to fetchTransactionsFromSupabase() with local slicing
  const allTx = await fetchTransactionsFromSupabase();
  let filtered = allTx;
  if (status && status !== 'all') {
    filtered = filtered.filter(m => (m.status || '').toLowerCase() === status);
  }
  if (kind && kind !== 'all') {
    filtered = filtered.filter(m => (m.type || '').toLowerCase() === kind || (kind === 'deposit' && m.direction === 'credit'));
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(m => {
      const ref = (m.reference || m.id || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      const email = (m.user_email || '').toLowerCase();
      return ref.includes(s) || desc.includes(s) || email.includes(s);
    });
  }
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const from = (page - 1) * limit;
  return {
    movements: filtered.slice(from, from + limit),
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}

export async function fetchClientsFromSupabase(): Promise<any[]> {
  const localList = getLocal<any[]>(STORAGE_KEYS.CLIENTS, []);

  if (isSupabaseConfigured) {
    try {
      // 1. Primary: Direct query on central Supabase 'profiles' table
      const { data: profs, error: profsErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!profsErr && Array.isArray(profs) && profs.length > 0) {
        // Also check if any balance or code overrides exist in client_accounts
        let accMap = new Map<string, any>();
        try {
          const { data: accs } = await supabase.from('client_accounts').select('*');
          if (Array.isArray(accs)) {
            accs.forEach(a => {
              if (a.profile_id) accMap.set(a.profile_id, a);
              if (a.user_email) accMap.set(a.user_email.toLowerCase(), a);
              if (a.client_id) accMap.set(a.client_id, a);
            });
          }
        } catch (_) {}

        const formatted = profs.map((p: any) => {
          const acc = accMap.get(p.id) || accMap.get(p.email?.toLowerCase()) || accMap.get(p.client_id) || {};
          const status = p.status || acc.status || 'pending';
          const isActive = p.account_active !== undefined && p.account_active !== null
            ? Boolean(p.account_active)
            : (acc.account_active !== undefined && acc.account_active !== null ? Boolean(acc.account_active) : false);

          return {
            id: p.id,
            account_id: acc.id || p.id,
            profile_id: p.id,
            client_id: p.client_id || acc.client_id || `VSL-${Math.floor(100000 + Math.random() * 900000)}`,
            first_name: p.first_name || (p.full_name ? p.full_name.split(' ')[0] : ''),
            last_name: p.last_name || (p.full_name ? p.full_name.split(' ').slice(1).join(' ') : ''),
            full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
            user_email: p.email || p.user_email || acc.user_email || '',
            phone: p.phone || '',
            country: p.country || 'Canada',
            city: p.city || '',
            address: p.address || '',
            postal_code: p.postal_code || '',
            nationality: p.nationality || 'Canadienne',
            birth_date: p.birth_date || '',
            profession: p.profession || '',
            monthly_income: p.monthly_income || p.annual_income || '',
            employed_since: p.employed_since || '',
            client_type: p.client_type || acc.client_type || 'particulier',
            documents: p.documents || [],
            account_number: p.account_number || acc.account_number || `CA${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            iban: p.iban || acc.iban || `CA98VERSAL00${p.client_id || '9921'}01`,
            bic: p.bic || acc.bic || 'VERSCA2TMTR',
            swift_code: p.swift_code || acc.swift_code || '',
            cat_code: p.cat_code || acc.cat_code || '',
            cot_code: p.cot_code || acc.cot_code || '',
            portal_password: p.portal_password || '',
            pin: p.pin || '1234',
            balance: typeof p.balance === 'number' ? p.balance : (typeof acc.balance === 'number' ? acc.balance : (Number(p.balance) || Number(acc.balance) || 0)),
            currency: (p.currency as Currency) || (acc.currency as Currency) || 'CAD',
            status: status,
            account_active: isActive,
            admin_note: p.admin_note || acc.admin_note || '',
            created_at: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
            role: p.role || 'client',
            is_admin: p.is_admin || false,
          };
        });

        setLocal(STORAGE_KEYS.CLIENTS, formatted, false);
        return formatted;
      }

      // 2. Secondary: If profiles query was empty, check client_accounts joined with profiles
      const { data: accountsData, error: accountsErr } = await supabase
        .from('client_accounts')
        .select(`
          *,
          profiles (*)
        `)
        .order('created_at', { ascending: false });

      if (!accountsErr && Array.isArray(accountsData) && accountsData.length > 0) {
        const formattedFromAccounts = accountsData.map((acc: any) => {
          const p = Array.isArray(acc.profiles) ? (acc.profiles[0] || {}) : (acc.profiles || {});
          return {
            id: acc.id,
            account_id: acc.id,
            profile_id: acc.profile_id || p.id,
            client_id: acc.client_id || p.client_id || `VSL-${Math.floor(100000 + Math.random() * 900000)}`,
            first_name: p.first_name || (p.full_name ? p.full_name.split(' ')[0] : ''),
            last_name: p.last_name || (p.full_name ? p.full_name.split(' ').slice(1).join(' ') : ''),
            full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
            user_email: acc.user_email || p.email || '',
            phone: p.phone || '',
            country: p.country || 'Canada',
            city: p.city || '',
            address: p.address || '',
            postal_code: p.postal_code || '',
            nationality: p.nationality || 'Canadienne',
            birth_date: p.birth_date || '',
            profession: p.profession || '',
            monthly_income: p.monthly_income || p.annual_income || '',
            employed_since: p.employed_since || '',
            client_type: acc.client_type || p.client_type || 'particulier',
            documents: p.documents || [],
            account_number: acc.account_number || `CA${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            iban: acc.iban || `CA98VERSAL00${acc.client_id || '9921'}01`,
            bic: acc.bic || 'VERSCA2TMTR',
            swift_code: acc.swift_code || '',
            cat_code: acc.cat_code || '',
            cot_code: acc.cot_code || '',
            portal_password: p.portal_password || '',
            pin: p.pin || '1234',
            balance: typeof acc.balance === 'number' ? acc.balance : (Number(acc.balance) || 0),
            currency: (acc.currency as Currency) || 'CAD',
            status: acc.status || p.status || 'pending',
            account_active: acc.account_active !== undefined && acc.account_active !== null
              ? Boolean(acc.account_active)
              : (p.account_active !== undefined && p.account_active !== null ? Boolean(p.account_active) : false),
            admin_note: acc.admin_note || p.admin_note || '',
            created_at: acc.created_at ? new Date(acc.created_at).getTime() : Date.now(),
            role: p.role || 'client',
            is_admin: p.is_admin || false,
          };
        });

        setLocal(STORAGE_KEYS.CLIENTS, formattedFromAccounts, false);
        return formattedFromAccounts;
      }
    } catch (err) {
      console.warn('[SupabaseBankService] Supabase profiles select notice:', err);
    }
  }

  // 3. Server API fallback for cross-device synchronization
  try {
    const serverRes: any = await apiGet('/api/bank/clients');
    if (serverRes?.success && Array.isArray(serverRes.clients) && serverRes.clients.length > 0) {
      setLocal(STORAGE_KEYS.CLIENTS, serverRes.clients, false);
      return serverRes.clients;
    }
  } catch (err) {
    console.warn('[SupabaseBankService] Server fallback sync note:', err);
  }

  return localList;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ClientListFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export interface ClientCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

/**
 * 1. HIGH-PERFORMANCE PAGINATED CLIENT LIST
 * Fetches lightweight rows without the heavy documents payload.
 * Server-side pagination via Supabase range() or Render API.
 */
export async function fetchClientsPaginated(filters: ClientListFilters = {}): Promise<PaginatedResult<any>> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 15));
  const status = (filters.status || 'all').trim().toLowerCase();
  const search = (filters.search || '').trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 1. Primary: Direct query on Supabase profiles with count: 'exact'
  if (isSupabaseConfigured) {
    try {
      const selectFields = 'id, client_id, first_name, last_name, full_name, email, phone, country, city, address, postal_code, nationality, account_number, iban, bic, swift_code, cat_code, cot_code, balance, currency, status, account_active, admin_note, role, is_admin, created_at';
      
      let query = supabase
        .from('profiles')
        .select(selectFields, { count: 'exact' });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,client_id.ilike.%${search}%,account_number.ilike.%${search}%`
        );
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;

      if (!error && Array.isArray(data)) {
        const total = count ?? data.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const formatted = data.map((p: any) => ({
          id: p.id,
          profile_id: p.id,
          client_id: p.client_id || `VSL-${p.id.slice(0, 6)}`,
          first_name: p.first_name || (p.full_name ? p.full_name.split(' ')[0] : ''),
          last_name: p.last_name || (p.full_name ? p.full_name.split(' ').slice(1).join(' ') : ''),
          full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          user_email: p.email || '',
          phone: p.phone || '',
          country: p.country || 'Canada',
          city: p.city || '',
          address: p.address || '',
          postal_code: p.postal_code || '',
          nationality: p.nationality || 'Canadienne',
          account_number: p.account_number || 'CA8904127893',
          balance: typeof p.balance === 'number' ? p.balance : (Number(p.balance) || 0),
          currency: (p.currency as Currency) || 'CAD',
          status: p.status || 'pending',
          account_active: p.account_active !== undefined ? Boolean(p.account_active) : false,
          admin_note: p.admin_note || '',
          role: p.role || 'client',
          is_admin: p.is_admin || false,
          created_at: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
        }));

        return {
          data: formatted,
          total,
          page,
          pageSize,
          totalPages,
          hasMore: page < totalPages,
        };
      }
    } catch (err) {
      console.warn('[SupabaseBankService] Paginated profiles query note:', err);
    }
  }

  // 2. Server API fallback
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      status,
      ...(search ? { search } : {})
    });
    const res: any = await apiGet(`/api/bank/clients?${params.toString()}`);
    if (res?.success && Array.isArray(res.clients)) {
      return {
        data: res.clients,
        total: res.total ?? res.clients.length,
        page: res.page ?? page,
        pageSize: res.limit ?? pageSize,
        totalPages: res.totalPages ?? Math.ceil((res.total || res.clients.length) / pageSize),
        hasMore: Boolean(res.hasMore),
      };
    }
  } catch (_) {}

  // 3. Fallback to local storage
  const localList = getLocal<any[]>(STORAGE_KEYS.CLIENTS, []);
  let filtered = localList;
  if (status && status !== 'all') {
    filtered = filtered.filter(c => c.status === status);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(c =>
      (c.first_name || '').toLowerCase().includes(s) ||
      (c.last_name || '').toLowerCase().includes(s) ||
      (c.user_email || '').toLowerCase().includes(s) ||
      (c.client_id || '').toLowerCase().includes(s)
    );
  }
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const paged = filtered.slice(from, to + 1);

  return {
    data: paged,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Fast client counts for quick status tabs (head: true, transfers 0 row data)
 */
export async function fetchClientCounts(): Promise<ClientCounts> {
  if (isSupabaseConfigured) {
    try {
      const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);

      return {
        total: totalRes.count || 0,
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0,
      };
    } catch (_) {}
  }

  try {
    const res: any = await apiGet('/api/bank/clients/counts');
    if (res?.success) {
      return {
        total: res.total || 0,
        pending: res.pending || 0,
        approved: res.approved || 0,
        rejected: res.rejected || 0,
      };
    }
  } catch (_) {}

  const localList = getLocal<any[]>(STORAGE_KEYS.CLIENTS, []);
  return {
    total: localList.length,
    pending: localList.filter(c => c.status === 'pending').length,
    approved: localList.filter(c => c.status === 'approved').length,
    rejected: localList.filter(c => c.status === 'rejected').length,
  };
}

/**
 * On-demand sub-resources for a single client (Zero global overhead)
 */
export async function fetchClientTransactions(clientIdOrEmail: string): Promise<Movement[]> {
  if (!clientIdOrEmail) return [];
  const clean = clientIdOrEmail.trim().toLowerCase();

  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('movements')
        .select('*')
        .or(`account_id.eq.${clean},client_id.eq.${clean},user_email.ilike.${clean},client_email.ilike.${clean}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (Array.isArray(data) && data.length > 0) {
        return data.map((m: any) => ({
          id: m.id || m.reference,
          account_id: m.account_id || '',
          client_id: m.client_id || '',
          client_email: m.client_email || m.user_email || '',
          user_email: m.user_email || m.client_email || '',
          kind: m.kind || 'transfer',
          direction: m.direction || (m.kind === 'deposit' ? 'credit' : 'debit'),
          method: m.method || 'Virement',
          amount: Number(m.amount) || 0,
          currency: m.currency || 'CAD',
          motif: m.motif || m.description || '',
          description: m.description || m.motif || '',
          reference: m.reference || m.id,
          status: m.status || 'completed',
          recipient_name: m.recipient_name || m.beneficiary_name || '',
          created_at: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
        }));
      }
    } catch (_) {}
  }

  const allMoves = getLocal<Movement[]>(STORAGE_KEYS.MOVEMENTS, []);
  return allMoves.filter(m => 
    m.user_email?.toLowerCase() === clean || 
    m.client_email?.toLowerCase() === clean || 
    m.client_id === clientIdOrEmail || 
    m.account_id === clientIdOrEmail
  );
}

export async function fetchClientCards(clientIdOrEmail: string): Promise<any[]> {
  if (!clientIdOrEmail) return [];
  const clean = clientIdOrEmail.trim().toLowerCase();

  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('cards')
        .select('*')
        .or(`user_id.eq.${clean},client_id.eq.${clean},user_email.ilike.${clean},client_email.ilike.${clean}`)
        .order('created_at', { ascending: false });

      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (_) {}
  }

  const allCards = getLocal<any[]>(STORAGE_KEYS.CARDS, []);
  return allCards.filter(c => 
    c.user_email?.toLowerCase() === clean || 
    c.client_email?.toLowerCase() === clean || 
    c.client_id === clientIdOrEmail || 
    c.user_id === clientIdOrEmail
  );
}

export async function fetchClientLoans(clientIdOrEmail: string): Promise<any[]> {
  if (!clientIdOrEmail) return [];
  const clean = clientIdOrEmail.trim().toLowerCase();

  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('loans')
        .select('*')
        .or(`user_id.eq.${clean},client_id.eq.${clean},user_email.ilike.${clean},client_email.ilike.${clean}`)
        .order('created_at', { ascending: false });

      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (_) {}
  }

  const allLoans = getLocal<any[]>(STORAGE_KEYS.LOANS, []);
  return allLoans.filter(l => 
    l.user_email?.toLowerCase() === clean || 
    l.client_email?.toLowerCase() === clean || 
    l.client_id === clientIdOrEmail || 
    l.user_id === clientIdOrEmail
  );
}

export async function saveClientToSupabase(client: any): Promise<boolean> {
  const email = (client.user_email || client.email || '').toLowerCase().trim();
  const isUUID = (str?: string) => str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  let supaWriteSucceeded = false;
  let lastError: any = null;

  // 1. Direct update / upsert into Supabase centralized table 'profiles'
  if (isSupabaseConfigured) {
    try {
      const profileUpdates: any = {
        updated_at: new Date().toISOString()
      };
      if (client.status !== undefined) profileUpdates.status = client.status;
      if (client.account_active !== undefined) {
        profileUpdates.account_active = client.account_active;
      }
      if (client.balance !== undefined) profileUpdates.balance = client.balance;
      if (client.currency !== undefined) profileUpdates.currency = client.currency;
      if (client.account_number) profileUpdates.account_number = client.account_number;
      if (client.iban) profileUpdates.iban = client.iban;
      if (client.bic) profileUpdates.bic = client.bic;
      if (client.swift_code) profileUpdates.swift_code = client.swift_code;
      if (client.cat_code) profileUpdates.cat_code = client.cat_code;
      if (client.cot_code) profileUpdates.cot_code = client.cot_code;
      if (client.first_name) profileUpdates.first_name = client.first_name;
      if (client.last_name) profileUpdates.last_name = client.last_name;
      if (client.first_name || client.last_name) {
        profileUpdates.full_name = `${client.first_name || ''} ${client.last_name || ''}`.trim();
      }
      if (client.phone) profileUpdates.phone = client.phone;
      if (client.address) profileUpdates.address = client.address;
      if (client.city) profileUpdates.city = client.city;
      if (client.country) profileUpdates.country = client.country;
      if (client.postal_code) profileUpdates.postal_code = client.postal_code;
      if (client.nationality) profileUpdates.nationality = client.nationality;
      if (client.birth_date) profileUpdates.birth_date = client.birth_date;
      if (client.profession) profileUpdates.profession = client.profession;
      if (client.monthly_income) profileUpdates.monthly_income = client.monthly_income;
      if (client.employed_since) profileUpdates.employed_since = client.employed_since;
      if (client.client_type) profileUpdates.client_type = client.client_type;
      if (client.documents) {
        profileUpdates.documents = Array.isArray(client.documents)
          ? client.documents.map((d: any) => ({
              name: d.name || d.label || 'Document',
              label: d.label || d.name || 'Document',
              type: d.type || 'identity',
              url: d.url || d.file_url || '',
              file_url: d.file_url || d.url || '',
              size: typeof d.size === 'number' ? d.size : 0,
            }))
          : [];
      }
      if (client.portal_password) profileUpdates.portal_password = client.portal_password;
      if (client.pin) profileUpdates.pin = client.pin;
      if (client.admin_note !== undefined) profileUpdates.admin_note = client.admin_note;
      if (client.role) profileUpdates.role = client.role;
      if (client.is_admin !== undefined) profileUpdates.is_admin = client.is_admin;

      const targetProfileId = isUUID(client.profile_id) ? client.profile_id : (isUUID(client.id) ? client.id : undefined);

      let { error: upsertErr } = await supabase.from('profiles').upsert(
        {
          id: targetProfileId || undefined,
          client_id: client.client_id || `VSL-${Math.floor(100000 + Math.random() * 900000)}`,
          email: email || undefined,
          ...profileUpdates,
        },
        { onConflict: email ? 'email' : 'client_id' }
      );

      // If missing column in schema cache (PGRST204)
      if (upsertErr && (upsertErr.code === 'PGRST204' || upsertErr.message?.toLowerCase().includes('column') || upsertErr.message?.toLowerCase().includes('documents'))) {
        console.warn('[SupabaseBankService] Schema column mismatch on profiles upsert, retrying without documents:', upsertErr);
        const retryUpdates = { ...profileUpdates };
        delete retryUpdates.documents;
        const retryRes = await supabase.from('profiles').upsert(
          {
            id: targetProfileId || undefined,
            client_id: client.client_id || `VSL-${Math.floor(100000 + Math.random() * 900000)}`,
            email: email || undefined,
            ...retryUpdates,
          },
          { onConflict: email ? 'email' : 'client_id' }
        );
        upsertErr = retryRes.error;
      }

      if (upsertErr) {
        console.error('[SupabaseBankService] Supabase profiles upsert error:', upsertErr);
        lastError = upsertErr;
      } else {
        supaWriteSucceeded = true;
      }

      // Also update client_accounts if it exists
      try {
        const accountUpdates: any = {
          updated_at: new Date().toISOString()
        };
        if (client.status !== undefined) accountUpdates.status = client.status;
        if (client.account_active !== undefined) accountUpdates.account_active = client.account_active;
        if (client.balance !== undefined) accountUpdates.balance = client.balance;
        if (client.currency !== undefined) accountUpdates.currency = client.currency;
        if (client.account_number) accountUpdates.account_number = client.account_number;
        if (client.iban) accountUpdates.iban = client.iban;
        if (client.bic) accountUpdates.bic = client.bic;
        if (client.swift_code) accountUpdates.swift_code = client.swift_code;
        if (client.cat_code) accountUpdates.cat_code = client.cat_code;
        if (client.cot_code) accountUpdates.cot_code = client.cot_code;
        if (client.admin_note !== undefined) accountUpdates.admin_note = client.admin_note;

        if (isUUID(client.id) || isUUID(client.account_id)) {
          const targetAccId = isUUID(client.account_id) ? client.account_id : client.id;
          await supabase.from('client_accounts').update(accountUpdates).eq('id', targetAccId);
        } else if (client.client_id) {
          await supabase.from('client_accounts').update(accountUpdates).eq('client_id', client.client_id);
        } else if (email) {
          await supabase.from('client_accounts').update(accountUpdates).eq('user_email', email);
        }
      } catch (_) {}
    } catch (supaErr) {
      console.warn('[SupabaseBankService] Supabase profiles update error:', supaErr);
      lastError = supaErr;
    }
  }

  // 2. Synchronize to central server backend for cross-device sync and Render persistence
  try {
    const serverRes = await apiPostJson('/api/bank/clients', client);
    if (serverRes.success) {
      supaWriteSucceeded = true;
    } else if (!supaWriteSucceeded) {
      lastError = new Error(serverRes.error || 'Erreur serveur backend');
      if (serverRes.code) (lastError as any).code = serverRes.code;
    }
  } catch (syncErr: any) {
    console.warn('[SupabaseBankService] Backend sync error:', syncErr);
    if (!supaWriteSucceeded) {
      lastError = syncErr;
    }
  }

  // 3. Strict failure check: Do NOT validate registration in memory if Supabase writes failed
  if (!supaWriteSucceeded) {
    const msg = lastError?.message || 'Échec de connexion ou de permission dans la base de données Supabase.';
    const code = lastError?.code || '42501';
    throw new Error(`Erreur Supabase [Code ${code}]: ${msg}. Inscription rejetée.`);
  }

  // Update local cache only if write succeeded
  const localList = getLocal<any[]>(STORAGE_KEYS.CLIENTS, []);
  const index = localList.findIndex(c => 
    (client.id && c.id === client.id) || 
    (client.user_email && c.user_email?.toLowerCase() === email) ||
    (client.client_id && c.client_id === client.client_id)
  );

  if (index >= 0) {
    localList[index] = { ...localList[index], ...client };
  } else {
    localList.unshift({
      id: client.id || `client_${Date.now()}`,
      status: client.status || 'pending',
      balance: client.balance || 0,
      currency: client.currency || 'CAD',
      ...client,
    });
  }
  setLocal(STORAGE_KEYS.CLIENTS, localList, false);

  return true;
}

/**
 * Dedicated, resilient account registration function
 * Guarantees zero data loss, duplicate prevention, and clean error messages.
 */
export async function registerClientApplication(clientData: any): Promise<{
  success: boolean;
  client?: any;
  error?: string;
  code?: string;
  alreadyPending?: boolean;
}> {
  // 1. Primary: Submit through server backend running direct Supabase service client
  const serverRes = await apiPostJson('/api/bank/register', {
    ...clientData,
    is_new_registration: true,
  });

  if (serverRes.success && serverRes.client) {
    // Also update local list for instantaneous UI responsiveness
    const localList = getLocal<any[]>(STORAGE_KEYS.CLIENTS, []);
    const idx = localList.findIndex(c => c.email === serverRes.client.email || c.client_id === serverRes.client.client_id);
    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...serverRes.client };
    } else {
      localList.unshift(serverRes.client);
    }
    setLocal(STORAGE_KEYS.CLIENTS, localList, false);

    return {
      success: true,
      client: serverRes.client,
      alreadyPending: (serverRes.data as any)?.alreadyPending,
    };
  }

  // If server returned an explicit rejection (like email already exists), bubble it up immediately
  if (serverRes.code === 'EMAIL_ALREADY_EXISTS' || serverRes.status === 409) {
    return {
      success: false,
      error: serverRes.error || 'Un compte bancaire actif existe déjà avec cette adresse courriel. Veuillez vous connecter.',
      code: 'EMAIL_ALREADY_EXISTS',
    };
  }

  // 2. Direct fallback only if server endpoint was unreachable (status 0 / offline dev)
  if (isSupabaseConfigured && (serverRes.status === 0 || !serverRes.status)) {
    try {
      const email = (clientData.user_email || clientData.email || '').trim().toLowerCase();
      const profilePayload: any = {
        id: clientData.id || clientData.profile_id,
        client_id: clientData.client_id,
        email: email,
        first_name: clientData.first_name,
        last_name: clientData.last_name,
        full_name: `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim(),
        phone: clientData.phone,
        portal_password: clientData.portal_password,
        pin: clientData.pin,
        account_number: clientData.account_number,
        iban: clientData.iban,
        bic: clientData.bic || 'VERSCA2TMTR',
        status: 'pending',
        account_active: false,
        balance: 0.00,
        currency: clientData.currency || 'CAD',
        admin_note: 'Demande soumise en ligne (en attente de révision)',
        role: 'client',
        is_admin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'email' }).select().single();
      if (!error && data) {
        return { success: true, client: data };
      }
    } catch (_) {}
  }

  return {
    success: false,
    error: serverRes.error || 'Impossible d\'enregistrer votre demande pour le moment. Veuillez réessayer.',
    code: serverRes.code || 'REGISTRATION_FAILED',
  };
}

export async function deleteClientFromSupabase(id: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('profiles').delete().or(`id.eq.${id},client_id.eq.${id}`);
      await supabase.from('client_accounts').delete().or(`id.eq.${id},client_id.eq.${id}`);
    } catch (e) {
      console.warn('[SupabaseBankService] Supabase delete client error:', e);
    }
  }
  apiDelete(`/api/bank/clients/${id}`);
  const localList = getLocal<any[]>(STORAGE_KEYS.CLIENTS, []);
  const filtered = localList.filter(c => c.id !== id && c.client_id !== id);
  setLocal(STORAGE_KEYS.CLIENTS, filtered, false);
  return true;
}

export async function getClientProfileByEmailOrId(identifier: string): Promise<(any) | null> {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  if (isSupabaseConfigured) {
    try {
      // 1. Primary: Direct query on Supabase 'profiles' table
      let query = supabase.from('profiles').select('*');
      if (isUUID) {
        query = query.or(`id.eq.${identifier},email.ilike.${clean},client_id.eq.${identifier}`);
      } else {
        query = query.or(`email.ilike.${clean},client_id.eq.${identifier}`);
      }
      const { data: profData } = await query.maybeSingle();

      if (profData) {
        return {
          id: profData.id,
          account_id: profData.id,
          profile_id: profData.id,
          client_id: profData.client_id || identifier,
          first_name: profData.first_name || (profData.full_name ? profData.full_name.split(' ')[0] : ''),
          last_name: profData.last_name || (profData.full_name ? profData.full_name.split(' ').slice(1).join(' ') : ''),
          full_name: profData.full_name || `${profData.first_name || ''} ${profData.last_name || ''}`.trim(),
          user_email: profData.email || clean,
          phone: profData.phone || '',
          country: profData.country || 'Canada',
          city: profData.city || '',
          address: profData.address || '',
          postal_code: profData.postal_code || '',
          nationality: profData.nationality || 'Canadienne',
          birth_date: profData.birth_date || '',
          profession: profData.profession || '',
          monthly_income: profData.monthly_income || '',
          employed_since: profData.employed_since || '',
          client_type: profData.client_type || 'particulier',
          account_number: profData.account_number || `CA8904127893`,
          iban: profData.iban || `CA98VERSAL0083730001`,
          bic: profData.bic || 'VERSCA2TMTR',
          swift_code: profData.swift_code || '',
          cat_code: profData.cat_code || '',
          cot_code: profData.cot_code || '',
          portal_password: profData.portal_password || '',
          pin: profData.pin || '1234',
          balance: typeof profData.balance === 'number' ? profData.balance : (Number(profData.balance) || 0),
          currency: (profData.currency as Currency) || 'CAD',
          status: profData.status || 'pending',
          account_active: profData.account_active !== undefined && profData.account_active !== null
            ? Boolean(profData.account_active)
            : false,
          admin_note: profData.admin_note || '',
          created_at: profData.created_at ? new Date(profData.created_at).getTime() : Date.now(),
          role: profData.role || 'client',
          is_admin: profData.is_admin || false,
          documents: profData.documents || [],
        };
      }

      // 2. Secondary fallback: client_accounts joined with profiles
      let accQuery = supabase.from('client_accounts').select('*, profiles(*)');
      if (isUUID) {
        accQuery = accQuery.or(`id.eq.${identifier},user_email.ilike.${clean},client_id.eq.${identifier}`);
      } else {
        accQuery = accQuery.or(`user_email.ilike.${clean},client_id.eq.${identifier}`);
      }
      const { data: accData } = await accQuery.maybeSingle();

      if (accData) {
        const p = Array.isArray(accData.profiles) ? (accData.profiles[0] || {}) : (accData.profiles || {});
        return {
          id: accData.id,
          account_id: accData.id,
          profile_id: accData.profile_id || p.id,
          client_id: accData.client_id || p.client_id || identifier,
          first_name: p.first_name || (p.full_name ? p.full_name.split(' ')[0] : ''),
          last_name: p.last_name || (p.full_name ? p.full_name.split(' ').slice(1).join(' ') : ''),
          full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          user_email: accData.user_email || p.email || clean,
          phone: p.phone || '',
          country: p.country || 'Canada',
          city: p.city || '',
          address: p.address || '',
          postal_code: p.postal_code || '',
          nationality: p.nationality || 'Canadienne',
          birth_date: p.birth_date || '',
          profession: p.profession || '',
          monthly_income: p.monthly_income || p.annual_income || '',
          employed_since: p.employed_since || '',
          client_type: accData.client_type || p.client_type || 'particulier',
          account_number: accData.account_number,
          iban: accData.iban,
          bic: accData.bic || 'VERSCA2TMTR',
          swift_code: accData.swift_code || '',
          cat_code: accData.cat_code || '',
          cot_code: accData.cot_code || '',
          portal_password: p.portal_password || '',
          pin: p.pin || '1234',
          balance: typeof accData.balance === 'number' ? accData.balance : (Number(accData.balance) || 0),
          currency: (accData.currency as Currency) || 'CAD',
          status: accData.status || p.status || 'pending',
          account_active: accData.account_active !== undefined && accData.account_active !== null
            ? Boolean(accData.account_active)
            : (p.account_active !== undefined && p.account_active !== null ? Boolean(p.account_active) : false),
          admin_note: accData.admin_note || p.admin_note || '',
          created_at: accData.created_at ? new Date(accData.created_at).getTime() : Date.now(),
          role: p.role || 'client',
          is_admin: p.is_admin || false,
          documents: p.documents || [],
        };
      }
    } catch (e) {
      console.warn('[SupabaseBankService] getClientProfile error:', e);
    }
  }

  // 3. Fallback to server API /api/bank/profile/:identifier (uses SERVICE_ROLE_KEY to bypass RLS)
  try {
    const serverRes: any = await apiGet(`/api/bank/profile/${encodeURIComponent(identifier)}`);
    if (serverRes?.success && serverRes.profile) {
      const p = serverRes.profile;
      return {
        id: p.id,
        account_id: p.id,
        profile_id: p.id,
        client_id: p.client_id || identifier,
        first_name: p.first_name || (p.full_name ? p.full_name.split(' ')[0] : ''),
        last_name: p.last_name || (p.full_name ? p.full_name.split(' ').slice(1).join(' ') : ''),
        full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        user_email: p.email || clean,
        phone: p.phone || '',
        country: p.country || 'Canada',
        city: p.city || '',
        address: p.address || '',
        postal_code: p.postal_code || '',
        nationality: p.nationality || 'Canadienne',
        birth_date: p.birth_date || '',
        profession: p.profession || '',
        monthly_income: p.monthly_income || '',
        employed_since: p.employed_since || '',
        client_type: p.client_type || 'particulier',
        account_number: p.account_number || `CA8904127893`,
        iban: p.iban || `CA98VERSAL0083730001`,
        bic: p.bic || 'VERSCA2TMTR',
        swift_code: p.swift_code || '',
        cat_code: p.cat_code || '',
        cot_code: p.cot_code || '',
        portal_password: p.portal_password || '',
        pin: p.pin || '1234',
        balance: typeof p.balance === 'number' ? p.balance : (Number(p.balance) || 0),
        currency: (p.currency as Currency) || 'CAD',
        status: p.status || 'pending',
        account_active: p.account_active !== undefined && p.account_active !== null
          ? Boolean(p.account_active)
          : false,
        admin_note: p.admin_note || '',
        created_at: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
        role: p.role || 'client',
        is_admin: p.is_admin || false,
        documents: p.documents || [],
      };
    }
  } catch (_) {}

  return null;
}

// ----------------------------------------------------------------------------
// TRANSACTIONS / MOVEMENTS
// ----------------------------------------------------------------------------

const INITIAL_DEMO_TRANSACTIONS: (Transaction & { id: string })[] = [];

export async function fetchTransactionsFromSupabase(userIdOrEmail?: string): Promise<(Transaction & { id: string })[]> {
  const localList = getLocal<(Transaction & { id: string })[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_DEMO_TRANSACTIONS);

  // 1. Try server API /api/admin/movements first for direct persistent store
  try {
    const serverRes: any = await apiGet('/api/admin/movements');
    if (serverRes?.success && Array.isArray(serverRes.movements) && serverRes.movements.length > 0) {
      const serverTx = serverRes.movements.map((t: any) => ({
        id: t.id || t.reference,
        user_id: t.user_id || t.client_id || 'system',
        user_email: t.user_email || t.client_email || '',
        account_id: t.account_id,
        type: t.type || t.kind || (t.direction === 'credit' ? 'deposit' : 'transfer'),
        direction: t.direction || (t.type === 'deposit' ? 'credit' : 'debit'),
        amount: Number(t.amount) || 0,
        currency: t.currency || 'CAD',
        description: t.description || t.motif || 'Mouvement bancaire',
        reference: t.reference || t.id,
        status: t.status || 'completed',
        date: t.date || t.created_at || new Date().toISOString(),
        created_at: t.created_at ? (typeof t.created_at === 'number' ? t.created_at : new Date(t.created_at).getTime()) : Date.now(),
      }));

      const mergedMap = new Map<string, Transaction & { id: string }>();
      localList.forEach(item => mergedMap.set(item.id, item));
      serverTx.forEach((item: any) => mergedMap.set(item.id, item));
      const merged = Array.from(mergedMap.values()).sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0));
      setLocal(STORAGE_KEYS.TRANSACTIONS, merged, false);
      return userIdOrEmail 
        ? merged.filter(x => x.user_email?.toLowerCase() === userIdOrEmail.toLowerCase() || x.user_id === userIdOrEmail)
        : merged;
    }
  } catch (_) {}

  // 2. Direct Supabase query on table 'movements' (with fallback to 'transactions')
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('movements').select('*').order('date', { ascending: false });
      if (userIdOrEmail) {
        query = query.or(`user_email.ilike.${userIdOrEmail},client_email.ilike.${userIdOrEmail},user_id.eq.${userIdOrEmail}`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const remoteTx = data.map((t: any) => ({
          id: t.id || t.reference,
          user_id: t.user_id || t.client_id,
          user_email: t.user_email || t.client_email || t.email,
          account_id: t.account_id,
          type: t.type || t.kind || (t.direction === 'credit' ? 'deposit' : 'transfer'),
          direction: t.direction || (t.type === 'deposit' ? 'credit' : 'debit'),
          amount: Number(t.amount) || 0,
          currency: t.currency || 'CAD',
          description: t.description || t.motif || 'Mouvement bancaire',
          reference: t.reference || t.id,
          status: t.status || 'completed',
          date: t.date || new Date(t.created_at || Date.now()).toISOString(),
          created_at: t.created_at ? (typeof t.created_at === 'number' ? t.created_at : new Date(t.created_at).getTime()) : Date.now(),
        }));

        const mergedMap = new Map<string, Transaction & { id: string }>();
        localList.forEach(item => mergedMap.set(item.id, item));
        remoteTx.forEach(item => mergedMap.set(item.id, item));
        const merged = Array.from(mergedMap.values()).sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0));
        setLocal(STORAGE_KEYS.TRANSACTIONS, merged, false);
        return userIdOrEmail 
          ? merged.filter(x => x.user_email?.toLowerCase() === userIdOrEmail.toLowerCase() || x.user_id === userIdOrEmail)
          : merged;
      }
    } catch (e) {
      console.warn('[SupabaseBankService] Transactions/Movements fetch note:', e);
    }
  }

  return userIdOrEmail 
    ? localList.filter(x => x.user_email?.toLowerCase() === userIdOrEmail.toLowerCase() || x.user_id === userIdOrEmail)
    : localList;
}

export async function saveTransactionToSupabase(tx: Partial<Transaction> & { id?: string }): Promise<boolean> {
  const localList = getLocal<(Transaction & { id: string })[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_DEMO_TRANSACTIONS);
  const fullTx: Transaction & { id: string } = {
    id: tx.id || `tx_${Date.now()}`,
    user_id: tx.user_id || 'system',
    user_email: tx.user_email || '',
    type: tx.type || 'deposit',
    amount: Number(tx.amount) || 0,
    currency: tx.currency || 'CAD',
    description: tx.description || 'Transaction VersalBank',
    reference: tx.reference || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
    status: tx.status || 'completed',
    date: tx.date || new Date().toISOString(),
    created_at: tx.created_at || Date.now(),
  };

  const idx = localList.findIndex(t => t.id === fullTx.id);
  if (idx >= 0) {
    localList[idx] = fullTx;
  } else {
    localList.unshift(fullTx);
  }
  setLocal(STORAGE_KEYS.TRANSACTIONS, localList);
  window.dispatchEvent(new CustomEvent('versalbank_movements_updated', { detail: localList }));
  window.dispatchEvent(new Event('versalbank_update'));
  notifyDataChanged();

  if (isSupabaseConfigured) {
    try {
      await supabase.from('transactions').upsert({
        id: fullTx.id,
        user_id: fullTx.user_id,
        user_email: fullTx.user_email,
        type: fullTx.type,
        amount: fullTx.amount,
        currency: fullTx.currency,
        description: fullTx.description,
        reference: fullTx.reference,
        status: fullTx.status,
        date: fullTx.date,
      });
    } catch (e) {
      console.warn('[SupabaseBankService] Transactions upsert note:', e);
    }
  }

  return true;
}

export async function deleteTransactionFromSupabase(id: string): Promise<boolean> {
  const localList = getLocal<(Transaction & { id: string })[]>(STORAGE_KEYS.TRANSACTIONS, []);
  const filtered = localList.filter(t => t.id !== id);
  setLocal(STORAGE_KEYS.TRANSACTIONS, filtered);

  if (isSupabaseConfigured) {
    try {
      await supabase.from('transactions').delete().eq('id', id);
    } catch (e) {
      console.warn('[SupabaseBankService] Delete transaction note:', e);
    }
  }
  return true;
}

// ----------------------------------------------------------------------------
// MOVEMENTS (PORTAL TRANSFERS & DEPOSITS)
// ----------------------------------------------------------------------------

export async function fetchMovementsFromSupabase(clientEmail?: string): Promise<Movement[]> {
  const localList = getLocal<Movement[]>(STORAGE_KEYS.MOVEMENTS, []);

  try {
    const url = clientEmail 
      ? `/api/bank/movements?email=${encodeURIComponent(clientEmail.trim().toLowerCase())}` 
      : '/api/bank/movements';
    const serverRes: any = await apiGet(url);
    if (serverRes?.success && Array.isArray(serverRes.movements) && serverRes.movements.length > 0) {
      const serverMap = new Map<string, Movement>();
      localList.forEach(item => serverMap.set(item.reference || item.id || '', item));
      serverRes.movements.forEach((item: any) => {
        const key = item.reference || item.id || '';
        serverMap.set(key, { ...serverMap.get(key), ...item });
      });
      const merged = Array.from(serverMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLocal(STORAGE_KEYS.MOVEMENTS, merged, false);
      if (clientEmail) {
        const target = clientEmail.trim().toLowerCase();
        return merged.filter(x => 
          (x.client_email && x.client_email.trim().toLowerCase() === target) ||
          (x.user_email && x.user_email.trim().toLowerCase() === target)
        );
      }
    }
  } catch (_) {}

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('movements').select('*').order('created_at', { ascending: false });
      if (clientEmail) {
        const clean = clientEmail.trim();
        query = query.or(`client_email.ilike.${clean},user_email.ilike.${clean}`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const remoteMoves: Movement[] = data.map((m: any) => ({
          id: m.id || m.reference,
          account_id: m.account_id || '',
          client_id: m.client_id || '',
          client_email: m.client_email || m.user_email || '',
          user_email: m.user_email || m.client_email || '',
          kind: m.kind || 'transfer',
          direction: m.direction || (m.kind === 'deposit' || m.kind === 'loan_credit' || m.kind === 'admin_credit' ? 'credit' : 'debit'),
          method: m.method || (m.kind === 'loan_credit' ? 'Prêt bancaire' : 'Virement'),
          amount: Number(m.amount) || 0,
          currency: m.currency || 'CAD',
          beneficiary_name: m.beneficiary_name,
          beneficiary_country: m.beneficiary_country,
          beneficiary_details: m.beneficiary_details,
          motif: m.motif || m.description,
          description: m.description || m.motif,
          reference: m.reference || `REF-${Date.now()}`,
          status: m.status || 'completed',
          createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
        }));

        const mergedMap = new Map<string, Movement>();
        localList.forEach(item => mergedMap.set(item.reference || item.id || '', item));
        remoteMoves.forEach(item => mergedMap.set(item.reference || item.id || '', item));
        const merged = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setLocal(STORAGE_KEYS.MOVEMENTS, merged, false);
        if (clientEmail) {
          const target = clientEmail.trim().toLowerCase();
          return merged.filter(x => 
            (x.client_email && x.client_email.trim().toLowerCase() === target) ||
            (x.user_email && x.user_email.trim().toLowerCase() === target)
          );
        }
        return merged;
      }
    } catch (e) {
      console.warn('[SupabaseBankService] Movements fetch note:', e);
    }
  }

  if (clientEmail) {
    const target = clientEmail.trim().toLowerCase();
    return localList.filter(x => 
      (x.client_email && x.client_email.trim().toLowerCase() === target) ||
      (x.user_email && x.user_email.trim().toLowerCase() === target)
    );
  }
  return localList;
}

export async function saveMovementToSupabase(movement: Movement): Promise<boolean> {
  const normMovement: Movement = {
    ...movement,
    client_email: movement.client_email || movement.user_email || '',
    user_email: movement.user_email || movement.client_email || '',
    createdAt: movement.createdAt || (movement.created_at ? (typeof movement.created_at === 'number' ? movement.created_at : new Date(movement.created_at).getTime()) : Date.now()),
  };

  const localList = getLocal<Movement[]>(STORAGE_KEYS.MOVEMENTS, []);
  const idx = localList.findIndex(m => 
    (normMovement.reference && m.reference === normMovement.reference) || 
    (normMovement.id && m.id === normMovement.id)
  );
  if (idx >= 0) {
    localList[idx] = { ...localList[idx], ...normMovement };
  } else {
    localList.unshift(normMovement);
  }
  setLocal(STORAGE_KEYS.MOVEMENTS, localList);
  if (normMovement.client_email) {
    const userEmailKey = `versalbank_cached_movements_${normMovement.client_email.trim().toLowerCase()}`;
    const userMoves = localList.filter(x => 
      (x.client_email && x.client_email.trim().toLowerCase() === normMovement.client_email.trim().toLowerCase()) ||
      (x.user_email && x.user_email.trim().toLowerCase() === normMovement.client_email.trim().toLowerCase())
    );
    try {
      localStorage.setItem(userEmailKey, JSON.stringify(userMoves));
      localStorage.setItem('versalbank_dashboard_movements', JSON.stringify(userMoves));
    } catch (_) {}
  }
  window.dispatchEvent(new CustomEvent('versalbank_movements_updated', { detail: localList }));
  window.dispatchEvent(new Event('versalbank_update'));
  try {
    const bc = new BroadcastChannel('versalbank_sync');
    bc.postMessage({ type: 'movements_updated', movement: normMovement, timestamp: Date.now() });
    bc.close();
  } catch (_) {}
  notifyDataChanged();

  try {
    await Promise.allSettled([
      apiPost('/api/bank/movements', normMovement),
      apiPost('/api/movements', normMovement)
    ]);
  } catch (e) {
    console.warn('[SupabaseBankService] Note saving movement to server:', e);
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.from('movements').upsert({
        account_id: normMovement.account_id,
        client_id: normMovement.client_id,
        client_email: normMovement.client_email,
        user_email: normMovement.user_email,
        kind: normMovement.kind,
        direction: normMovement.direction,
        method: normMovement.method,
        amount: normMovement.amount,
        currency: normMovement.currency,
        beneficiary_name: normMovement.beneficiary_name,
        beneficiary_country: normMovement.beneficiary_country,
        beneficiary_details: normMovement.beneficiary_details,
        motif: normMovement.motif || normMovement.description,
        description: normMovement.description || normMovement.motif,
        reference: normMovement.reference,
        status: normMovement.status,
      });
    } catch (e) {
      console.warn('[SupabaseBankService] Movement upsert note:', e);
    }
  }

  return true;
}

export interface MovementListFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  search?: string;
  clientEmail?: string;
}

export async function fetchMovementsPaginated(filters: MovementListFilters = {}): Promise<PaginatedResult<Movement>> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 15));
  const status = (filters.status || 'all').trim().toLowerCase();
  const type = (filters.type || 'all').trim().toLowerCase();
  const search = (filters.search || '').trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('movements').select('*', { count: 'exact' });

      if (filters.clientEmail) {
        const clean = filters.clientEmail.trim();
        query = query.or(`client_email.ilike.${clean},user_email.ilike.${clean}`);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (type && type !== 'all') {
        if (type === 'deposit') {
          query = query.or('kind.eq.deposit,type.eq.deposit,direction.eq.credit');
        } else if (type === 'transfer') {
          query = query.or('kind.eq.transfer,type.eq.transfer,direction.eq.debit');
        }
      }
      if (search) {
        query = query.or(`reference.ilike.%${search}%,recipient_name.ilike.%${search}%,beneficiary_name.ilike.%${search}%,user_email.ilike.%${search}%,motif.ilike.%${search}%`);
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (!error && Array.isArray(data)) {
        const total = count ?? data.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const formatted: Movement[] = data.map((m: any) => ({
          id: m.id || m.reference,
          account_id: m.account_id || '',
          client_id: m.client_id || '',
          client_email: m.client_email || m.user_email || '',
          user_email: m.user_email || m.client_email || '',
          kind: m.kind || 'transfer',
          direction: m.direction || (m.kind === 'deposit' ? 'credit' : 'debit'),
          method: m.method || (m.kind === 'deposit' ? 'Dépôt' : 'Virement'),
          amount: Number(m.amount) || 0,
          currency: m.currency || 'CAD',
          beneficiary_name: m.beneficiary_name || m.recipient_name,
          beneficiary_country: m.beneficiary_country,
          beneficiary_details: m.beneficiary_details,
          motif: m.motif || m.description,
          description: m.description || m.motif,
          reference: m.reference || m.id,
          status: m.status || 'completed',
          createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
        }));

        return {
          data: formatted,
          total,
          page,
          pageSize,
          totalPages,
          hasMore: page < totalPages,
        };
      }
    } catch (err) {
      console.warn('[SupabaseBankService] Paginated movements query note:', err);
    }
  }

  // Fallback to local storage
  const localList = getLocal<Movement[]>(STORAGE_KEYS.MOVEMENTS, []);
  let filtered = localList;
  if (status && status !== 'all') filtered = filtered.filter(m => m.status === status);
  if (type && type !== 'all') {
    filtered = filtered.filter(m => (type === 'deposit' ? m.kind === 'deposit' || m.direction === 'credit' : m.kind === 'transfer' || m.direction === 'debit'));
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(m => (m.reference || '').toLowerCase().includes(s) || (m.user_email || '').toLowerCase().includes(s));
  }
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const paged = filtered.slice(from, to + 1);

  return {
    data: paged,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}
// ----------------------------------------------------------------------------

const INITIAL_DEMO_CARDS: any[] = [];

export async function fetchCardsFromSupabase(userIdOrEmail?: string): Promise<any[]> {
  let localList = getLocal<any[]>(STORAGE_KEYS.CARDS, INITIAL_DEMO_CARDS);

  try {
    const serverRes: any = await apiGet('/api/bank/cards');
    if (serverRes?.success && Array.isArray(serverRes.cards) && serverRes.cards.length > 0) {
      const serverMap = new Map<string, any>();
      localList.forEach(item => serverMap.set(item.id, item));
      serverRes.cards.forEach((item: any) => {
        const prev = serverMap.get(item.id) || {};
        serverMap.set(item.id, {
          ...prev,
          ...item,
          number: item.number || item.card_number || prev.number,
          card_number: item.card_number || item.number || prev.card_number,
          holder_name: item.holder_name || item.card_holder || prev.holder_name,
          card_holder: item.card_holder || item.holder_name || prev.card_holder,
          cvc: item.cvc || item.cvv || prev.cvc,
          cvv: item.cvv || item.cvc || prev.cvv,
          client_email: item.client_email || item.user_email || prev.client_email,
          user_email: item.user_email || item.client_email || prev.user_email,
          status: item.status || prev.status || 'inactive',
          balance: typeof item.balance === 'number' ? item.balance : (prev.balance || 0),
          transfer_enabled: item.transfer_enabled !== undefined ? Boolean(item.transfer_enabled) : (prev.transfer_enabled !== undefined ? Boolean(prev.transfer_enabled) : false),
          is_locked: item.is_locked !== undefined ? Boolean(item.is_locked) : (prev.is_locked !== undefined ? Boolean(prev.is_locked) : false),
          cvc_visible: item.cvc_visible !== undefined ? Boolean(item.cvc_visible) : (prev.cvc_visible !== undefined ? Boolean(prev.cvc_visible) : true),
          shipping_requested: item.shipping_requested !== undefined ? Boolean(item.shipping_requested) : (prev.shipping_requested !== undefined ? Boolean(prev.shipping_requested) : false),
          shipment_step: item.shipment_step !== undefined ? Number(item.shipment_step) : (prev.shipment_step !== undefined ? Number(prev.shipment_step) : 0),
          shipping_name: item.shipping_name || prev.shipping_name || '',
          shipping_address: item.shipping_address || prev.shipping_address || '',
          shipping_phone: item.shipping_phone || prev.shipping_phone || '',
          shipping_requested_at: item.shipping_requested_at || prev.shipping_requested_at,
        });
      });
      const merged = Array.from(serverMap.values());
      setLocal(STORAGE_KEYS.CARDS, merged, false);
      localList = merged;
      if (userIdOrEmail) {
        const clean = userIdOrEmail.toLowerCase().trim();
        return merged.filter(x => 
          (x.user_email && x.user_email.toLowerCase().trim() === clean) || 
          (x.client_email && x.client_email.toLowerCase().trim() === clean) ||
          x.user_id === userIdOrEmail ||
          x.account_id === userIdOrEmail
        );
      }
    }
  } catch (_) {}

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('cards').select('*');
      if (userIdOrEmail) {
        const clean = userIdOrEmail.trim();
        query = query.or(`user_email.ilike.${clean},client_email.ilike.${clean},user_id.eq.${clean},account_id.eq.${clean}`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const remoteCards: any[] = data.map((c: any) => {
          let meta: any = {};
          if (typeof c.client_id === 'string' && c.client_id.trim().startsWith('{')) {
            try {
              meta = JSON.parse(c.client_id);
            } catch (_) {}
          }
          const status = c.status || 'inactive';
          const isLocked = meta.is_locked !== undefined
            ? Boolean(meta.is_locked)
            : (status === 'active' ? false : (c.is_locked !== undefined ? Boolean(c.is_locked) : undefined));
          const cvcVisible = meta.cvc_visible !== undefined
            ? Boolean(meta.cvc_visible)
            : (status === 'active' ? true : (c.cvc_visible !== undefined ? Boolean(c.cvc_visible) : undefined));
          const transferEnabled = meta.transfer_enabled !== undefined
            ? Boolean(meta.transfer_enabled)
            : (c.transfer_enabled !== undefined ? Boolean(c.transfer_enabled) : undefined);

          return {
            id: c.id,
            account_id: c.account_id || c.user_id,
            client_id: c.client_id || c.user_id,
            user_id: c.user_id || c.account_id,
            user_email: c.user_email || c.client_email || c.email,
            client_email: c.client_email || c.user_email || c.email,
            card_number: c.card_number || c.number,
            number: c.number || c.card_number,
            card_holder: c.card_holder || c.holder_name,
            holder_name: c.holder_name || c.card_holder,
            expiry: c.expiry || c.expiry_date || '12/28',
            cvv: c.cvv || c.cvc || '123',
            cvc: c.cvc || c.cvv || '123',
            pin: c.pin || '1234',
            type: c.type || 'virtual',
            brand: c.brand || c.card_type || 'visa',
            card_type: c.card_type || c.brand || 'visa',
            tier: c.tier || 'standard',
            status: status,
            balance: typeof c.balance === 'number' ? c.balance : (Number(c.balance) || 0),
            daily_limit: Number(c.daily_limit) || 2500,
            monthly_limit: Number(c.monthly_limit || c.limit_monthly) || 25000,
            limit_monthly: Number(c.limit_monthly || c.monthly_limit) || 25000,
            transfer_enabled: transferEnabled,
            is_locked: isLocked,
            cvc_visible: cvcVisible,
            shipping_requested: meta.shipping_requested !== undefined ? Boolean(meta.shipping_requested) : (c.shipping_requested !== undefined ? Boolean(c.shipping_requested) : false),
            shipment_step: meta.shipment_step !== undefined ? Number(meta.shipment_step) : (c.shipment_step !== undefined ? Number(c.shipment_step) : 0),
            shipping_name: meta.shipping_name || c.shipping_name || '',
            shipping_address: meta.shipping_address || c.shipping_address || '',
            shipping_phone: meta.shipping_phone || c.shipping_phone || '',
            shipping_requested_at: meta.shipping_requested_at || c.shipping_requested_at,
            created_at: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
            createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
          };
        });

        const freshStored = getLocal<any[]>(STORAGE_KEYS.CARDS, localList);
        const mergedMap = new Map<string, any>();
        freshStored.forEach(item => mergedMap.set(item.id, item));
        remoteCards.forEach(item => {
          const prev = mergedMap.get(item.id) || {};
          const status = item.status || prev.status || 'inactive';
          // Ensure that if status is active, is_locked stays false and cvc_visible stays true
          const isLocked = item.is_locked !== undefined
            ? Boolean(item.is_locked)
            : (prev.is_locked !== undefined ? Boolean(prev.is_locked) : (status !== 'active'));
          const cvcVisible = item.cvc_visible !== undefined
            ? Boolean(item.cvc_visible)
            : (prev.cvc_visible !== undefined ? Boolean(prev.cvc_visible) : (status === 'active'));
          const transferEnabled = item.transfer_enabled !== undefined
            ? Boolean(item.transfer_enabled)
            : (prev.transfer_enabled !== undefined ? Boolean(prev.transfer_enabled) : false);

          // Preserve local/server authoritative fields!
          mergedMap.set(item.id, {
            ...prev,
            ...item,
            status,
            transfer_enabled: transferEnabled,
            is_locked: isLocked,
            cvc_visible: cvcVisible,
            shipping_requested: prev.shipping_requested !== undefined ? Boolean(prev.shipping_requested) : (item.shipping_requested !== undefined ? Boolean(item.shipping_requested) : false),
            shipment_step: prev.shipment_step !== undefined ? Number(prev.shipment_step) : (item.shipment_step !== undefined ? Number(item.shipment_step) : 0),
            shipping_name: prev.shipping_name || item.shipping_name || '',
            shipping_address: prev.shipping_address || item.shipping_address || '',
            shipping_phone: prev.shipping_phone || item.shipping_phone || '',
            shipping_requested_at: prev.shipping_requested_at || item.shipping_requested_at,
          });
        });
        const merged = Array.from(mergedMap.values());
        setLocal(STORAGE_KEYS.CARDS, merged, false);
        if (userIdOrEmail) {
          const clean = userIdOrEmail.toLowerCase().trim();
          return merged.filter(x => 
            (x.user_email && x.user_email.toLowerCase().trim() === clean) || 
            (x.client_email && x.client_email.toLowerCase().trim() === clean) ||
            x.user_id === userIdOrEmail ||
            x.account_id === userIdOrEmail
          );
        }
        return merged;
      }
    } catch (e) {
      console.warn('[SupabaseBankService] Cards fetch note:', e);
    }
  }

  if (userIdOrEmail) {
    const clean = userIdOrEmail.toLowerCase().trim();
    return localList.filter(x => 
      (x.user_email && x.user_email.toLowerCase().trim() === clean) || 
      (x.client_email && x.client_email.toLowerCase().trim() === clean) ||
      x.user_id === userIdOrEmail ||
      x.account_id === userIdOrEmail
    );
  }
  return localList;
}

export async function saveCardToSupabase(card: any): Promise<boolean> {
  const localList = getLocal<any[]>(STORAGE_KEYS.CARDS, INITIAL_DEMO_CARDS);
  const existing = localList.find(c => c.id === card.id) || {};

  const cardNum = card.number || card.card_number || existing.number || existing.card_number || `4532 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
  const holder = card.holder_name || card.card_holder || existing.holder_name || existing.card_holder || 'CLIENT VERSALBANK';
  const cvcCode = card.cvc || card.cvv || existing.cvc || existing.cvv || `${Math.floor(100 + Math.random() * 900)}`;
  const userEmail = card.client_email || card.user_email || existing.client_email || existing.user_email || '';

  const fullCard: any = {
    ...existing,
    ...card,
    id: card.id || existing.id || `card_${Date.now()}`,
    user_id: card.user_id || card.account_id || existing.user_id || existing.account_id || 'system',
    account_id: card.account_id || card.user_id || existing.account_id || existing.user_id || 'system',
    client_id: card.client_id || existing.client_id || '',
    user_email: userEmail,
    client_email: userEmail,
    card_number: cardNum,
    number: cardNum,
    card_holder: holder,
    holder_name: holder,
    expiry: card.expiry || existing.expiry || '10/29',
    cvv: cvcCode,
    cvc: cvcCode,
    pin: card.pin || existing.pin || '1234',
    type: card.type || existing.type || 'virtual',
    brand: card.brand || card.card_type || existing.brand || existing.card_type || 'visa',
    card_type: card.card_type || card.brand || existing.card_type || existing.brand || 'visa',
    tier: card.tier || existing.tier || 'standard',
    status: card.status || existing.status || 'inactive',
    balance: card.balance !== undefined ? Number(card.balance) : (existing.balance !== undefined ? Number(existing.balance) : 0),
    transfer_enabled: card.transfer_enabled !== undefined ? Boolean(card.transfer_enabled) : (existing.transfer_enabled !== undefined ? Boolean(existing.transfer_enabled) : false),
    is_locked: card.is_locked !== undefined ? Boolean(card.is_locked) : (card.status === 'active' ? false : (existing.is_locked !== undefined ? Boolean(existing.is_locked) : true)),
    cvc_visible: card.cvc_visible !== undefined ? Boolean(card.cvc_visible) : (card.status === 'active' ? true : (existing.cvc_visible !== undefined ? Boolean(existing.cvc_visible) : false)),
    daily_limit: card.daily_limit || existing.daily_limit || 2500,
    monthly_limit: card.monthly_limit || card.limit_monthly || existing.monthly_limit || existing.limit_monthly || 25000,
    limit_monthly: card.monthly_limit || card.limit_monthly || existing.monthly_limit || existing.limit_monthly || 25000,
    shipping_requested: card.shipping_requested !== undefined ? Boolean(card.shipping_requested) : (existing.shipping_requested !== undefined ? Boolean(existing.shipping_requested) : false),
    shipment_step: card.shipment_step !== undefined ? Number(card.shipment_step) : (existing.shipment_step !== undefined ? Number(existing.shipment_step) : 0),
    shipping_name: card.shipping_name !== undefined ? card.shipping_name : (existing.shipping_name || ''),
    shipping_address: card.shipping_address !== undefined ? card.shipping_address : (existing.shipping_address || ''),
    shipping_phone: card.shipping_phone !== undefined ? card.shipping_phone : (existing.shipping_phone || ''),
    shipping_requested_at: card.shipping_requested_at !== undefined ? card.shipping_requested_at : existing.shipping_requested_at,
    created_at: card.created_at || card.createdAt || existing.created_at || existing.createdAt || Date.now(),
    createdAt: card.createdAt || card.created_at || existing.createdAt || existing.created_at || Date.now(),
  };

  const idx = localList.findIndex(c => c.id === fullCard.id);
  if (idx >= 0) {
    localList[idx] = fullCard;
  } else {
    localList.unshift(fullCard);
  }
  setLocal(STORAGE_KEYS.CARDS, localList);
  window.dispatchEvent(new Event('versalbank_update'));

  // Await server persistence so inMemoryCardsCache & cards_store.json are guaranteed updated!
  await apiPost('/api/bank/cards', fullCard);

  if (isSupabaseConfigured) {
    try {
      const metaJson = JSON.stringify({
        transfer_enabled: Boolean(fullCard.transfer_enabled),
        is_locked: Boolean(fullCard.is_locked),
        cvc_visible: Boolean(fullCard.cvc_visible),
        shipping_requested: Boolean(fullCard.shipping_requested),
        shipment_step: Number(fullCard.shipment_step) || 0,
        shipping_name: fullCard.shipping_name || '',
        shipping_address: fullCard.shipping_address || '',
        shipping_phone: fullCard.shipping_phone || '',
        shipping_requested_at: fullCard.shipping_requested_at || null,
      });

      await supabase.from('cards').upsert({
        id: fullCard.id,
        user_id: fullCard.user_id,
        user_email: fullCard.user_email,
        card_number: fullCard.card_number,
        card_holder: fullCard.card_holder,
        expiry: fullCard.expiry,
        cvv: fullCard.cvv,
        pin: fullCard.pin,
        type: fullCard.type,
        card_type: fullCard.card_type,
        status: fullCard.status,
        limit_monthly: fullCard.limit_monthly,
        client_id: metaJson,
      });
    } catch (e) {
      console.warn('[SupabaseBankService] Cards upsert note:', e);
    }
  }

  return true;
}

export async function deleteCardFromSupabase(id: string): Promise<boolean> {
  const localList = getLocal<any[]>(STORAGE_KEYS.CARDS, []);
  const filtered = localList.filter(c => c.id !== id);
  setLocal(STORAGE_KEYS.CARDS, filtered);

  if (isSupabaseConfigured) {
    try {
      await supabase.from('cards').delete().eq('id', id);
    } catch (e) {
      console.warn('[SupabaseBankService] Delete card note:', e);
    }
  }
  return true;
}

export interface CardListFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export async function fetchCardsPaginated(filters: CardListFilters = {}): Promise<PaginatedResult<any>> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 10));
  const status = (filters.status || 'all').trim().toLowerCase();
  const search = (filters.search || '').trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 1. Try server paginated API
  try {
    const url = `/api/bank/cards?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
    const res: any = await apiGet(url);
    if (res?.success && Array.isArray(res.cards)) {
      return {
        data: res.cards,
        total: res.total ?? res.cards.length,
        page: res.page ?? page,
        pageSize: res.limit ?? pageSize,
        totalPages: res.totalPages ?? (Math.ceil((res.total ?? res.cards.length) / pageSize) || 1),
        hasMore: res.hasMore ?? (page < (res.totalPages || 1)),
      };
    }
  } catch (err) {
    console.warn('[SupabaseBankService] Server paginated cards query note:', err);
  }

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('cards').select('*', { count: 'exact' });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`card_holder.ilike.%${search}%,user_email.ilike.%${search}%,client_email.ilike.%${search}%,client_id.ilike.%${search}%,card_number.ilike.%${search}%`);
      }

      query = query
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .range(from, to);

      const { data, count, error } = await query;
      if (!error && Array.isArray(data)) {
        const total = count ?? data.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const formatted = data.map((c: any) => ({
          ...c,
          number: c.number || c.card_number || '••••',
          card_number: c.card_number || c.number || '••••',
          holder_name: c.holder_name || c.card_holder || 'Client VersalBank',
          card_holder: c.card_holder || c.holder_name || 'Client VersalBank',
          tier: c.tier || c.card_type || c.type || 'gold',
          card_type: c.card_type || c.tier || c.type || 'gold',
          balance: typeof c.balance === 'number' ? c.balance : 0,
          status: c.status || 'inactive',
          transfer_enabled: Boolean(c.transfer_enabled),
          is_locked: c.is_locked !== undefined ? Boolean(c.is_locked) : false,
          cvc_visible: c.cvc_visible !== undefined ? Boolean(c.cvc_visible) : true,
          shipping_requested: Boolean(c.shipping_requested),
          shipment_step: Number(c.shipment_step) || 0,
          createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
        }));

        return {
          data: formatted,
          total,
          page,
          pageSize,
          totalPages,
          hasMore: page < totalPages,
        };
      }
    } catch (err) {
      console.warn('[SupabaseBankService] Paginated cards query note:', err);
    }
  }

  // Fallback to local
  const localList = getLocal<any[]>(STORAGE_KEYS.CARDS, []);
  let filtered = localList;
  if (status && status !== 'all') filtered = filtered.filter(c => c.status === status);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(c => (c.holder_name || c.card_holder || '').toLowerCase().includes(s) || (c.user_email || '').toLowerCase().includes(s));
  }
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const paged = filtered.slice(from, to + 1);

  return {
    data: paged,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}
// ----------------------------------------------------------------------------

const INITIAL_DEMO_LOANS: (any & { id: string })[] = [];

export async function fetchLoansFromSupabase(userIdOrEmail?: string): Promise<(any & { id: string })[]> {
  const localList = getLocal<(any & { id: string })[]>(STORAGE_KEYS.LOANS, INITIAL_DEMO_LOANS);

  try {
    const serverRes: any = await apiGet('/api/bank/loans');
    if (serverRes?.success && Array.isArray(serverRes.loans) && serverRes.loans.length > 0) {
      const serverMap = new Map<string, any & { id: string }>();
      localList.forEach(item => serverMap.set(item.id, item));
      serverRes.loans.forEach((item: any) => serverMap.set(item.id, { ...serverMap.get(item.id), ...item }));
      const merged = Array.from(serverMap.values());
      setLocal(STORAGE_KEYS.LOANS, merged, false);
      if (userIdOrEmail) {
        const needle = userIdOrEmail.toLowerCase();
        return merged.filter(x => 
          (x.user_email && x.user_email.toLowerCase() === needle) ||
          (x.client_email && x.client_email.toLowerCase() === needle) ||
          x.user_id === userIdOrEmail ||
          x.userId === userIdOrEmail ||
          x.client_id === userIdOrEmail
        );
      }
    }
  } catch (_) {}

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('loans').select('*');
      if (userIdOrEmail) {
        query = query.or(`user_email.eq.${userIdOrEmail},user_id.eq.${userIdOrEmail},client_email.eq.${userIdOrEmail},client_id.eq.${userIdOrEmail}`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const remoteLoans: (any & { id: string })[] = data.map((l: any) => ({
          ...l,
          id: l.id,
          user_id: l.user_id || l.client_id,
          user_email: l.user_email || l.client_email || l.email,
          client_email: l.client_email || l.user_email || l.email,
          client_id: l.client_id || l.user_id,
          client_name: l.client_name || 'Client',
          amount: Number(l.amount) || 0,
          duration_months: Number(l.duration_months) || 24,
          monthly_payment: Number(l.monthly_payment) || 0,
          interest_rate: Number(l.interest_rate || l.rate) || 3.0,
          rate: Number(l.rate || l.interest_rate) || 3.0,
          purpose: l.purpose || l.project || 'Projet personnel',
          project: l.project || l.purpose || 'immobilier',
          contract_signed: Boolean(l.contract_signed),
          contract_signed_url: l.contract_signed_url || '',
          signed_documents: l.signed_documents || (l.contract_signed_url ? [l.contract_signed_url] : []),
          status: l.status || 'processing',
          created_at: l.created_at ? new Date(l.created_at).getTime() : Date.now(),
        }));

        const mergedMap = new Map<string, any & { id: string }>();
        localList.forEach(item => mergedMap.set(item.id, item));
        remoteLoans.forEach(item => mergedMap.set(item.id, { ...mergedMap.get(item.id), ...item }));
        const merged = Array.from(mergedMap.values());
        setLocal(STORAGE_KEYS.LOANS, merged, false);
        if (userIdOrEmail) {
          const needle = userIdOrEmail.toLowerCase();
          return merged.filter(x => 
            (x.user_email && x.user_email.toLowerCase() === needle) ||
            (x.client_email && x.client_email.toLowerCase() === needle) ||
            x.user_id === userIdOrEmail ||
            x.userId === userIdOrEmail ||
            x.client_id === userIdOrEmail
          );
        }
        return merged;
      }
    } catch (e) {
      console.warn('[SupabaseBankService] Loans fetch note:', e);
    }
  }

  if (userIdOrEmail) {
    const needle = userIdOrEmail.toLowerCase();
    return localList.filter(x => 
      (x.user_email && x.user_email.toLowerCase() === needle) ||
      (x.client_email && x.client_email.toLowerCase() === needle) ||
      x.user_id === userIdOrEmail ||
      x.userId === userIdOrEmail ||
      x.client_id === userIdOrEmail
    );
  }
  return localList;
}

export async function saveLoanToSupabase(loan: Partial<any> & { id?: string }): Promise<boolean> {
  const localList = getLocal<(any & { id: string })[]>(STORAGE_KEYS.LOANS, INITIAL_DEMO_LOANS);
  const fullLoan: any & { id: string } = {
    ...loan,
    id: loan.id || `loan_${Date.now()}`,
    user_id: loan.user_id || loan.userId || loan.client_id || 'system',
    user_email: loan.user_email || loan.client_email || '',
    client_email: loan.client_email || loan.user_email || '',
    client_id: loan.client_id || loan.user_id || '',
    client_name: loan.client_name || 'Client VersalBank',
    amount: Number(loan.amount) || 10000,
    duration_months: Number(loan.duration_months) || 24,
    monthly_payment: Number(loan.monthly_payment) || 450,
    interest_rate: Number(loan.interest_rate || loan.rate) || 3.0,
    rate: Number(loan.rate || loan.interest_rate) || 3.0,
    purpose: loan.purpose || loan.project || 'Financement professionnel',
    project: loan.project || loan.purpose || 'immobilier',
    project_details: loan.project_details || '',
    contract_signed: Boolean(loan.contract_signed),
    contract_signed_url: loan.contract_signed_url || '',
    signed_documents: loan.signed_documents || (loan.contract_signed_url ? [loan.contract_signed_url] : []),
    status: loan.status || 'processing',
    created_at: loan.created_at || loan.createdAt || Date.now(),
  };

  const idx = localList.findIndex(l => l.id === fullLoan.id);
  if (idx >= 0) {
    localList[idx] = { ...localList[idx], ...fullLoan };
  } else {
    localList.unshift(fullLoan);
  }
  setLocal(STORAGE_KEYS.LOANS, localList);
  apiPost('/api/bank/loans', fullLoan);

  if (isSupabaseConfigured) {
    try {
      await supabase.from('loans').upsert({
        id: fullLoan.id,
        user_id: fullLoan.user_id,
        user_email: fullLoan.user_email,
        client_id: fullLoan.client_id,
        client_email: fullLoan.client_email,
        client_name: fullLoan.client_name,
        amount: fullLoan.amount,
        duration_months: fullLoan.duration_months,
        monthly_payment: fullLoan.monthly_payment,
        interest_rate: fullLoan.interest_rate,
        rate: fullLoan.rate,
        purpose: fullLoan.purpose,
        project: fullLoan.project,
        project_details: fullLoan.project_details,
        contract_signed: fullLoan.contract_signed,
        contract_signed_url: fullLoan.contract_signed_url,
        status: fullLoan.status,
      });
    } catch (e) {
      console.warn('[SupabaseBankService] Loans upsert note:', e);
    }
  }

  return true;
}

export async function deleteLoanFromSupabase(id: string): Promise<boolean> {
  const localList = getLocal<(any & { id: string })[]>(STORAGE_KEYS.LOANS, []);
  const filtered = localList.filter(l => l.id !== id);
  setLocal(STORAGE_KEYS.LOANS, filtered);

  if (isSupabaseConfigured) {
    try {
      await supabase.from('loans').delete().eq('id', id);
    } catch (e) {
      console.warn('[SupabaseBankService] Delete loan note:', e);
    }
  }
  return true;
}

export interface LoanListFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export async function fetchLoansPaginated(filters: LoanListFilters = {}): Promise<PaginatedResult<any>> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 10));
  const status = (filters.status || 'all').trim().toLowerCase();
  const search = (filters.search || '').trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 1. Try server paginated API
  try {
    const url = `/api/bank/loans?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
    const res: any = await apiGet(url);
    if (res?.success && Array.isArray(res.loans)) {
      return {
        data: res.loans,
        total: res.total ?? res.loans.length,
        page: res.page ?? page,
        pageSize: res.limit ?? pageSize,
        totalPages: res.totalPages ?? (Math.ceil((res.total ?? res.loans.length) / pageSize) || 1),
        hasMore: res.hasMore ?? (page < (res.totalPages || 1)),
      };
    }
  } catch (err) {
    console.warn('[SupabaseBankService] Server paginated loans query note:', err);
  }

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('loans').select('*', { count: 'exact' });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`client_name.ilike.%${search}%,user_email.ilike.%${search}%,client_email.ilike.%${search}%,id.ilike.%${search}%`);
      }

      query = query
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .range(from, to);

      const { data, count, error } = await query;
      if (!error && Array.isArray(data)) {
        const total = count ?? data.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const formatted = data.map((l: any) => ({
          ...l,
          id: l.id,
          user_id: l.user_id || l.client_id,
          user_email: l.user_email || l.client_email || l.email,
          client_email: l.client_email || l.user_email || l.email,
          client_id: l.client_id || l.user_id,
          client_name: l.client_name || 'Client',
          amount: Number(l.amount) || 0,
          duration_months: Number(l.duration_months) || 24,
          monthly_payment: Number(l.monthly_payment) || 0,
          interest_rate: Number(l.interest_rate || l.rate) || 3.0,
          purpose: l.purpose || l.project || 'Projet personnel',
          project: l.project || l.purpose || 'immobilier',
          contract_signed: Boolean(l.contract_signed),
          contract_signed_url: l.contract_signed_url || '',
          signed_documents: l.signed_documents || (l.contract_signed_url ? [l.contract_signed_url] : []),
          status: l.status || 'processing',
          created_at: l.created_at ? new Date(l.created_at).getTime() : Date.now(),
        }));

        return {
          data: formatted,
          total,
          page,
          pageSize,
          totalPages,
          hasMore: page < totalPages,
        };
      }
    } catch (err) {
      console.warn('[SupabaseBankService] Paginated loans query note:', err);
    }
  }

  // Fallback to local
  const localList = getLocal<any[]>(STORAGE_KEYS.LOANS, []);
  let filtered = localList;
  if (status && status !== 'all') filtered = filtered.filter(l => l.status === status);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(l => (l.client_name || '').toLowerCase().includes(s) || (l.user_email || '').toLowerCase().includes(s));
  }
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const paged = filtered.slice(from, to + 1);

  return {
    data: paged,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}
// ----------------------------------------------------------------------------

export function getBankSupportEmail(): string {
  const settings = getLocal(STORAGE_KEYS.SETTINGS, { support_email: 'support@versalbank.com' });
  return settings.support_email || 'support@versalbank.com';
}

export function getBankAdminEmail(): string {
  const settings = getLocal(STORAGE_KEYS.SETTINGS, { admin_email: 'contact@versalbank.com' });
  return settings.admin_email || 'contact@versalbank.com';
}

export async function fetchBankSettings(): Promise<any> {
  const def = {
    bank_name: 'VersalBank',
    support_email: 'support@versalbank.com',
    admin_email: 'contact@versalbank.com',
    default_currency: 'CAD',
    maintenance_mode: false,
    fintrac_reg_number: 'M20849201',
  };
  const local = getLocal(STORAGE_KEYS.SETTINGS, def);
  return local;
}

export async function saveBankSettings(settings: any): Promise<boolean> {
  setLocal(STORAGE_KEYS.SETTINGS, settings);
  return true;
}

export const DEFAULT_FUNDING_CHANNELS = [
  {
    id: 'revolut',
    name: 'Revolut',
    title: 'Revolut',
    category: 'Fintech & Portefeuilles',
    description: 'Transfert instantané entre comptes Revolut.',
    badge: 'Instantané',
    addressLabel: 'Revtag officiel VersalBank',
    addressValue: '@versalbank-ca',
    notes: 'Ouvrez votre application Revolut et effectuez un transfert interne instantané vers notre compte trésorerie.',
    active: true,
    isCrypto: false,
    order: 1,
  },
  {
    id: 'wise',
    name: 'Wise',
    title: 'Wise',
    category: 'Fintech & Portefeuilles',
    description: 'Transferts multidevises.',
    badge: 'Taux Réel',
    addressLabel: 'Compte Wise / Courriel récepteur',
    addressValue: 'contact@versalbank.com',
    notes: 'Effectuez votre virement Wise en mentionnant impérativement votre nom et votre numéro de compte client dans la note de transfert.',
    active: true,
    isCrypto: false,
    order: 2,
  },
  {
    id: 'sepa-swift',
    name: 'Virement SEPA / International',
    title: 'Virement SEPA / International (SWIFT)',
    category: 'Virements Bancaires',
    description: 'Délai de règlement : 1 à 3 jours ouvrés.',
    badge: 'Bancaire',
    addressLabel: 'IBAN Trésorerie Centrale (SEPA / Virement)',
    addressValue: 'FR76 3000 4818 4706 52099 300',
    notes: 'Banque: VersalBank Canada\nBIC / SWIFT: VERSCA2TMTR\nBénéficiaire: VersalBank Trésorerie Centrale\nVeuillez indiquer votre identifiant client en référence.',
    active: true,
    isCrypto: false,
    order: 3,
  },
  {
    id: 'usdt-trc20',
    name: 'Tether (USDT - TRC20)',
    title: 'Tether (USDT - TRC20)',
    category: 'Cryptomonnaies',
    description: 'Réseau TRON (TRC20) uniquement.',
    badge: 'TRC20',
    addressLabel: 'Adresse de dépôt USDT (Réseau TRON TRC20)',
    addressValue: 'TLx8jD8ZqM2z9Vp7f3k4mB1wQe5rTy6uXa',
    notes: 'Transférez le montant souhaité à l’adresse ci-dessous sur le réseau TRON (TRC20). Toute transaction sur un autre réseau sera définitivement perdue.',
    active: true,
    isCrypto: true,
    order: 4,
  },
  {
    id: 'bitcoin',
    name: 'Bitcoin (BTC)',
    title: 'Bitcoin (BTC)',
    category: 'Cryptomonnaies',
    description: 'Réseau Bitcoin (BTC). 2 confirmations requises.',
    badge: 'BTC',
    addressLabel: 'Adresse de dépôt Bitcoin (BTC)',
    addressValue: 'bc1q9x3d8y2m7v5f4k1w8e6r0t3u9p2a7s6d5f',
    notes: 'Envoyez vos BTC directement à cette adresse de réserve. 2 confirmations réseau sont requises pour le crédit automatique.',
    active: true,
    isCrypto: true,
    order: 5,
  },
  {
    id: 'western-union',
    name: 'Western Union',
    title: 'Western Union',
    category: 'Agences & Espèces',
    description: 'Transfert en espèces disponible dans tous les pays desservis par Western Union.',
    badge: 'Cash',
    addressLabel: 'Code guichet / Bénéficiaire',
    addressValue: 'VersalBank Agence Centrale — Service Financement',
    notes: 'Conservez précieusement votre reçu d’envoi avec le numéro de référence ou MTCN.',
    active: true,
    isCrypto: false,
    order: 6,
  },
  {
    id: 'ria',
    name: 'Ria Money Transfer',
    title: 'Ria Money Transfer',
    category: 'Agences & Espèces',
    description: 'Conservez votre reçu Ria : il peut être demandé par la conformité.',
    badge: 'Cash / Agence',
    addressLabel: 'Bénéficiaire Agence Ria',
    addressValue: 'VersalBank Agence Centrale — Trésorerie',
    notes: 'Conservez votre reçu Ria : le numéro de contrôle d\'envoi sera requis pour valider le crédit.',
    active: true,
    isCrypto: false,
    order: 7,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    title: 'PayPal',
    category: 'Fintech & Portefeuilles',
    description: 'Envoi en « Biens et services » exclusivement.',
    badge: 'Portefeuille',
    addressLabel: 'Adresse PayPal de réception',
    addressValue: 'contact@versalbank.com',
    notes: 'Envoi en option « Biens et services » exclusivement pour permettre la traçabilité bancaire.',
    active: true,
    isCrypto: false,
    order: 8,
  },
  {
    id: 'skrill',
    name: 'Skrill',
    title: 'Skrill',
    category: 'Fintech & Portefeuilles',
    description: 'Portefeuille électronique international.',
    badge: 'Wallet',
    addressLabel: 'Identifiant Skrill',
    addressValue: 'contact@versalbank.com',
    notes: 'Transfert de portefeuille à portefeuille Skrill. Crédit sous 1 heure après déclaration.',
    active: true,
    isCrypto: false,
    order: 9,
  },
  {
    id: 'moneygram',
    name: 'MoneyGram',
    title: 'MoneyGram',
    category: 'Agences & Espèces',
    description: 'Indiquez le numéro de référence à 8 chiffres après l’envoi.',
    badge: 'Référence 8',
    addressLabel: 'Bénéficiaire MoneyGram',
    addressValue: 'VersalBank Agence Centrale — Trésorerie',
    notes: 'Indiquez le numéro de référence à 8 chiffres après l’envoi.',
    active: true,
    isCrypto: false,
    order: 10,
  },
];

export async function fetchChannels(): Promise<any[]> {
  try {
    const serverRes = await apiGet<{ success: boolean; channels: any[] }>(`/api/bank/channels?t=${Date.now()}`);
    if (serverRes && serverRes.success && Array.isArray(serverRes.channels) && serverRes.channels.length > 0) {
      setLocal(STORAGE_KEYS.CHANNELS, serverRes.channels, true);
      window.dispatchEvent(new CustomEvent('versalbank_channels_updated', { detail: serverRes.channels }));
      return serverRes.channels;
    }
  } catch (_) {}

  const local = getLocal<any[]>(STORAGE_KEYS.CHANNELS, []);
  if (Array.isArray(local) && local.length > 0) {
    return local;
  }

  // Seed default 10 channels
  setLocal(STORAGE_KEYS.CHANNELS, DEFAULT_FUNDING_CHANNELS, false);
  return DEFAULT_FUNDING_CHANNELS;
}

export async function saveChannels(channels: any[]): Promise<boolean> {
  setLocal(STORAGE_KEYS.CHANNELS, channels, true);
  window.dispatchEvent(new CustomEvent('versalbank_channels_updated', { detail: channels }));
  window.dispatchEvent(new Event('versalbank_update'));
  try {
    const bc = new BroadcastChannel('versalbank_sync');
    bc.postMessage({ type: 'channels_updated', channels, timestamp: Date.now() });
    bc.close();
  } catch (_) {}
  notifyDataChanged();
  try {
    await Promise.allSettled([
      apiPost('/api/bank/channels', { channels }),
      apiPost('/api/channels', { channels })
    ]);
  } catch (e) {
    console.warn('[SupabaseBankService] Note saving channels:', e);
  }
  return true;
}

export const fetchFundingChannels = fetchChannels;
export const saveFundingChannels = saveChannels;

export async function fetchIpRules(): Promise<any[]> {
  return getLocal(STORAGE_KEYS.IP_RULES, []);
}

export async function saveIpRules(rules: any[]): Promise<boolean> {
  setLocal(STORAGE_KEYS.IP_RULES, rules);
  return true;
}

export async function fetchLoanRates(): Promise<any[]> {
  const def = [
    { id: 'rate_perso', name: 'Prêt Personnel Garanti', minAmount: 5000, maxAmount: 100000, rate: 2.9, minMonths: 12, maxMonths: 84 },
    { id: 'rate_immo', name: 'Crédit Immobilier & Foncier', minAmount: 100000, maxAmount: 2500000, rate: 1.95, minMonths: 60, maxMonths: 360 },
    { id: 'rate_pro', name: 'Investissement Entreprise & Trésorerie', minAmount: 25000, maxAmount: 1000000, rate: 2.45, minMonths: 24, maxMonths: 120 },
  ];
  return getLocal(STORAGE_KEYS.LOAN_RATES, def);
}

export async function saveLoanRates(rates: any[]): Promise<boolean> {
  setLocal(STORAGE_KEYS.LOAN_RATES, rates);
  return true;
}

export async function fetchLoanContractTemplate(): Promise<string> {
  const def = `CONTRAT DE PRÊT ET FINANCEMENT BANCAIRE INTERNATIONAL
Entre l'Institution VERSALBANK BANQUE CANADIENNE PRIVÉE et l'Emprunteur désigné.
Réglementé sous l'égide du Centre d'analyse des opérations et déclarations financières du Canada (CANAFE).`;
  return getLocal(STORAGE_KEYS.LOAN_CONTRACT, def);
}

export async function saveLoanContractTemplate(text: string): Promise<boolean> {
  setLocal(STORAGE_KEYS.LOAN_CONTRACT, text);
  return true;
}

export interface EmailListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
}

export async function fetchEmailLogsPaginated(filters: EmailListFilters = {}): Promise<PaginatedResult<any>> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 15));
  const search = (filters.search || '').trim().toLowerCase();
  const type = (filters.type || 'all').trim().toLowerCase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 1. Try server API
  try {
    const url = `/api/bank/emails?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}`;
    const res: any = await apiGet(url);
    if (res?.success && Array.isArray(res.emails)) {
      return {
        data: res.emails,
        total: res.total ?? res.emails.length,
        page: res.page ?? page,
        pageSize: res.limit ?? pageSize,
        totalPages: res.totalPages ?? (Math.ceil((res.total ?? res.emails.length) / pageSize) || 1),
        hasMore: res.hasMore ?? (page < (res.totalPages || 1)),
      };
    }
  } catch (_) {}

  // 2. Fallback to local storage
  const localList = getLocal<any[]>(STORAGE_KEYS.EMAILS, []);
  let filtered = localList;
  if (type && type !== 'all') {
    filtered = filtered.filter(e => (e.type || '').toLowerCase() === type);
  }
  if (search) {
    filtered = filtered.filter(e =>
      (e.recipient || '').toLowerCase().includes(search) ||
      (e.recipientName || '').toLowerCase().includes(search) ||
      (e.subject || '').toLowerCase().includes(search) ||
      (e.title || '').toLowerCase().includes(search)
    );
  }
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const paged = filtered.slice(from, to + 1);

  return {
    data: paged,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

export async function fetchEmailLogs(): Promise<any[]> {
  const res = await fetchEmailLogsPaginated({ pageSize: 50 });
  return res.data;
}

export async function logSentEmail(log: any): Promise<boolean> {
  const list = getLocal<any[]>(STORAGE_KEYS.EMAILS, []);
  list.unshift({ ...log, id: log.id || `email_${Date.now()}`, timestamp: Date.now() });
  setLocal(STORAGE_KEYS.EMAILS, list.slice(0, 200));
  return true;
}

export async function deleteEmailLog(id: string): Promise<boolean> {
  const list = getLocal<any[]>(STORAGE_KEYS.EMAILS, []);
  const filtered = list.filter(e => e.id !== id);
  setLocal(STORAGE_KEYS.EMAILS, filtered);
  try {
    await apiDelete(`/api/bank/emails/${id}`);
  } catch (_) {}
  return true;
}

export interface ProfileChangeFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export async function fetchProfileChangesPaginated(filters: ProfileChangeFilters = {}): Promise<PaginatedResult<any>> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 15));
  const search = (filters.search || '').trim().toLowerCase();
  const status = (filters.status || 'all').trim().toLowerCase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 1. Try server API
  try {
    const url = `/api/bank/profile-changes?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
    const res: any = await apiGet(url);
    if (res?.success && Array.isArray(res.changes)) {
      return {
        data: res.changes,
        total: res.total ?? res.changes.length,
        page: res.page ?? page,
        pageSize: res.limit ?? pageSize,
        totalPages: res.totalPages ?? (Math.ceil((res.total ?? res.changes.length) / pageSize) || 1),
        hasMore: res.hasMore ?? (page < (res.totalPages || 1)),
      };
    }
  } catch (_) {}

  // 2. Fallback to local storage
  const localList = getLocal<any[]>('versalbank_profile_changes_store', []);
  let filtered = localList;
  if (status && status !== 'all') {
    filtered = filtered.filter(r => (r.status || 'pending').toLowerCase() === status);
  }
  if (search) {
    filtered = filtered.filter(r =>
      (r.client_name || '').toLowerCase().includes(search) ||
      (r.client_email || '').toLowerCase().includes(search) ||
      (r.account_id || '').toLowerCase().includes(search)
    );
  }
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const paged = filtered.slice(from, to + 1);

  return {
    data: paged,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

export async function fetchProfileChanges(): Promise<any[]> {
  const res = await fetchProfileChangesPaginated({ pageSize: 50 });
  return res.data;
}

export async function saveProfileChange(id: string, decision: 'approved' | 'rejected'): Promise<boolean> {
  const list = getLocal<any[]>('versalbank_profile_changes_store', []);
  const updated = list.map(item => item.id === id ? { ...item, status: decision, reviewedAt: Date.now() } : item);
  setLocal('versalbank_profile_changes_store', updated);
  try {
    await apiPost('/api/bank/profile-changes', { id, status: decision, reviewedAt: Date.now() });
  } catch (_) {}
  return true;
}



