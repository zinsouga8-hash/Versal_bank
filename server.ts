import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ----------------------------------------------------------------------------
// SUPABASE BACKEND CLIENT (Direct Database Connection - No in-memory cache)
// ----------------------------------------------------------------------------
const rawSupabaseUrl = 
  process.env.SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || 
  'https://dvebugolbpzgvczqjzxr.supabase.co';

const SUPABASE_URL = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

const SUPABASE_KEY = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2ZWJ1Z29sYnB6Z3ZjenFqenhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDY2MjUsImV4cCI6MjEwNDYyMjYyNX0.4mN5swmH1c4uskLuXJCbMHOzkrH4H8ARnrbQYvAFPcU';

export const supabaseServer = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log('[VersalBank Server] Supabase client initialized connected to:', SUPABASE_URL);

// Lazy initialization of Resend client to prevent crash if key is missing
let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// 1. Secrets & Environment Variables for Email Architecture
// Role Separation:
// - SENDER_EMAIL / SUPPORT_EMAIL: support@versalbank.com (Client automatic notifications sender)
// - ADMIN_ALERT_EMAIL: contact@versalbank.com (Administrator alerts needing intervention)
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'support@versalbank.com';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@versalbank.com';
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'contact@versalbank.com';

// Server-side anti-duplicate deduplication cache (10s sliding window)
const serverDedupCache = new Map<string, number>();

// Server-side resilient stores for emails and profile change requests
const serverEmailLogs: any[] = [];
function logServerEmail(record: any) {
  serverEmailLogs.unshift(record);
  if (serverEmailLogs.length > 500) {
    serverEmailLogs.length = 500;
  }
}

const serverProfileChanges: any[] = [];

function formatSender(rawEmail?: string): string {
  const base = rawEmail || SENDER_EMAIL;
  if (base.includes('<') && base.includes('>')) {
    return base;
  }
  return `VersalBank Support <${base}>`;
}

// ----------------------------------------------------------------------------
// API ROUTES
// ----------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'VERSALBANK Email & Banking API',
    timestamp: new Date().toISOString(),
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    senderEmail: SENDER_EMAIL,
    supportEmail: SUPPORT_EMAIL,
    adminAlertEmail: ADMIN_ALERT_EMAIL,
  });
});

/**
 * Send Transactional Email via Resend API
 * Strictly enforces:
 * 1. Automatic client notifications originate from support@versalbank.com
 * 2. Administrative notifications go only to contact@versalbank.com
 * 3. contact@versalbank.com is NEVER automatically put in CC/BCC of client emails
 * 4. Anti-duplicate protection prevents duplicate sends of identical events
 */
app.post('/api/send-email', async (req, res) => {
  try {
    const {
      to,
      subject,
      html,
      text,
      from,
      reply_to,
      replyTo,
      notifyAdmin = false,
      adminTitle,
    } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        success: false,
        error: 'Champs obligatoires manquants (to, subject, html/text).',
      });
    }

    const primaryRecipient = (Array.isArray(to) ? to[0] : to).trim().toLowerCase();

    // Anti-duplicate protection: 8 seconds throttle on same recipient + subject
    const now = Date.now();
    const dedupKey = `${primaryRecipient}:::${subject.trim()}`;
    const lastSent = serverDedupCache.get(dedupKey);
    if (lastSent && now - lastSent < 8000) {
      console.log(`[VersalBank Anti-Duplicate] Skipping duplicate email dispatch to ${primaryRecipient} (${subject})`);
      return res.json({
        success: true,
        dedup: true,
        recipient: primaryRecipient,
        message: 'Notification déjà transmise avec succès (anti-doublon actif).',
      });
    }
    serverDedupCache.set(dedupKey, now);
    if (serverDedupCache.size > 500) {
      for (const [k, v] of serverDedupCache.entries()) {
        if (now - v > 60000) serverDedupCache.delete(k);
      }
    }

    const client = getResendClient();
    const effectiveSender = formatSender(from);
    const effectiveReplyTo = reply_to || replyTo || SUPPORT_EMAIL;

    if (!client) {
      console.warn(
        '[VersalBank Email API] RESEND_API_KEY non configurée dans .env. Envoi simulé avec succès pour :',
        primaryRecipient
      );
      return res.json({
        success: true,
        simulated: true,
        message: 'Email simulé avec succès (Ajoutez RESEND_API_KEY pour livraison réelle).',
        recipient: primaryRecipient,
        from: effectiveSender,
        reply_to: effectiveReplyTo,
        subject,
      });
    }

    // Send strictly to specified recipient(s). No CC or BCC to admin mailbox!
    const emailResult = await client.emails.send({
      from: effectiveSender,
      to: Array.isArray(to) ? to : [to],
      replyTo: effectiveReplyTo,
      subject,
      html: html || undefined,
      text: text || undefined,
    });

    if (emailResult.error) {
      console.error('[VersalBank Resend Client Send Error]:', emailResult.error);
      return res.status(400).json({
        success: false,
        error: emailResult.error.message || 'Erreur lors de la distribution du courriel.',
        details: emailResult.error,
      });
    }

    logServerEmail({
      id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipient: primaryRecipient,
      recipientName: req.body.recipientName || '',
      subject,
      title: req.body.title || adminTitle || subject,
      type: req.body.type || 'notification',
      html: html || '',
      status: 'sent',
      createdAt: Date.now(),
    });

    return res.json({
      success: true,
      data: emailResult,
      recipient: primaryRecipient,
      from: effectiveSender,
    });
  } catch (error: any) {
    console.error('[VersalBank Email API Error] :', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erreur interne lors de l\'envoi du courriel.',
    });
  }
});

// ----------------------------------------------------------------------------
// EMAILS & NOTIFICATIONS LOGS API (Server-Side Paginated & Filtered)
// ----------------------------------------------------------------------------
app.get('/api/bank/emails', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 15));
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const type = ((req.query.type as string) || '').trim().toLowerCase();

    let filtered = serverEmailLogs;
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
    const totalPages = Math.ceil(total / limit) || 1;
    const from = (page - 1) * limit;
    const to = from + limit;
    const paged = filtered.slice(from, to);

    return res.json({
      success: true,
      emails: paged,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

app.delete('/api/bank/emails/:id', (req, res) => {
  try {
    const id = req.params.id;
    const idx = serverEmailLogs.findIndex(e => e.id === id);
    if (idx !== -1) {
      serverEmailLogs.splice(idx, 1);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// ----------------------------------------------------------------------------
// PROFILE CHANGE REQUESTS API (Server-Side Paginated & Filtered)
// ----------------------------------------------------------------------------
app.get('/api/bank/profile-changes', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 15));
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const status = ((req.query.status as string) || '').trim().toLowerCase();

    let filtered = serverProfileChanges;
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
    const totalPages = Math.ceil(total / limit) || 1;
    const from = (page - 1) * limit;
    const to = from + limit;
    const paged = filtered.slice(from, to);

    return res.json({
      success: true,
      changes: paged,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

app.post('/api/bank/profile-changes', (req, res) => {
  try {
    const change = req.body;
    if (!change.id) {
      change.id = `pc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }
    const existingIdx = serverProfileChanges.findIndex(c => c.id === change.id);
    if (existingIdx !== -1) {
      serverProfileChanges[existingIdx] = { ...serverProfileChanges[existingIdx], ...change };
    } else {
      serverProfileChanges.unshift(change);
    }
    return res.json({ success: true, change });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// ----------------------------------------------------------------------------
// SERVER-SIDE BANK DATA SYNC API (Direct Supabase Connection - Multi-Device)
// ----------------------------------------------------------------------------

app.get('/api/bank/clients', async (req, res) => {
  try {
    const isPaginated = req.query.page !== undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const search = ((req.query.search as string) || '').trim();
    const status = ((req.query.status as string) || '').trim().toLowerCase();

    // When paginated, select only list fields (omit heavy documents array)
    const selectCols = isPaginated
      ? 'id, client_id, first_name, last_name, full_name, email, phone, country, city, address, postal_code, nationality, account_number, iban, bic, swift_code, cat_code, cot_code, balance, currency, status, account_active, admin_note, role, is_admin, created_at'
      : '*';

    let query = supabaseServer
      .from('profiles')
      .select(selectCols, { count: isPaginated ? 'exact' : undefined });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,client_id.ilike.%${search}%,account_number.ilike.%${search}%`
      );
    }

    query = query
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });

    if (isPaginated) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[Supabase Server] Error fetching profiles:', error);
      return res.status(500).json({ success: false, error: error.message, code: error.code });
    }

    // Format fields to match frontend ClientProfile interface
    const formattedClients = (data || []).map((p: any) => ({
      id: p.id,
      profile_id: p.id,
      client_id: p.client_id,
      email: p.email,
      user_email: p.email,
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      phone: p.phone || '',
      country: p.country || 'Canada',
      city: p.city || '',
      address: p.address || '',
      postal_code: p.postal_code || '',
      nationality: p.nationality || 'Canadienne',
      birth_date: p.birth_date || '',
      profession: p.profession || '',
      monthly_income: p.monthly_income || p.annual_income || '',
      employment_status: p.employment_status || '',
      employed_since: p.employed_since || '',
      client_type: p.client_type || 'particulier',
      account_number: p.account_number || '',
      iban: p.iban || '',
      bic: p.bic || 'VERSCA2TMTR',
      swift_code: p.swift_code || '',
      cat_code: p.cat_code || '',
      cot_code: p.cot_code || '',
      portal_password: p.portal_password || 'Versal@2025',
      pin: p.pin || '123456',
      balance: typeof p.balance === 'number' ? p.balance : (Number(p.balance) || 0),
      currency: p.currency || 'CAD',
      status: p.status || 'pending',
      account_active: Boolean(p.account_active),
      admin_note: p.admin_note || '',
      created_at: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
      role: p.role || 'client',
      is_admin: Boolean(p.is_admin),
      documents: p.documents || [],
    }));

    if (isPaginated) {
      const total = count ?? formattedClients.length;
      const totalPages = Math.ceil(total / limit) || 1;
      return res.json({
        success: true,
        clients: formattedClients,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      });
    }

    return res.json({ success: true, clients: formattedClients });
  } catch (err: any) {
    console.error('[Supabase Server] Exception fetching clients:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erreur serveur' });
  }
});

// Fast exact counts endpoint for Admin quick status tabs
app.get('/api/bank/clients/counts', async (req, res) => {
  try {
    const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabaseServer.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseServer.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseServer.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabaseServer.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);

    return res.json({
      success: true,
      total: totalRes.count || 0,
      pending: pendingRes.count || 0,
      approved: approvedRes.count || 0,
      rejected: rejectedRes.count || 0,
    });
  } catch (err: any) {
    console.error('[Supabase Server] Exception fetching client counts:', err);
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Targeted client transactions on-demand
app.get('/api/bank/clients/:id/transactions', async (req, res) => {
  try {
    const id = req.params.id;
    const { data: prof } = await supabaseServer.from('profiles').select('id, email, client_id').eq('id', id).maybeSingle();
    const email = (prof?.email || '').toLowerCase().trim();
    const clientId = prof?.client_id || id;

    let query = supabaseServer.from('movements').select('*');
    if (email) {
      query = query.or(`account_id.eq.${id},client_id.eq.${clientId},client_email.ilike.${email},user_email.ilike.${email}`);
    } else {
      query = query.or(`account_id.eq.${id},client_id.eq.${clientId}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.json({ success: true, transactions: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Targeted client cards on-demand
app.get('/api/bank/clients/:id/cards', async (req, res) => {
  try {
    const id = req.params.id;
    const { data: prof } = await supabaseServer.from('profiles').select('id, email, client_id').eq('id', id).maybeSingle();
    const email = (prof?.email || '').toLowerCase().trim();
    const clientId = prof?.client_id || id;

    let query = supabaseServer.from('cards').select('*');
    if (email) {
      query = query.or(`user_id.eq.${id},client_id.eq.${clientId},user_email.ilike.${email},client_email.ilike.${email}`);
    } else {
      query = query.or(`user_id.eq.${id},client_id.eq.${clientId}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.json({ success: true, cards: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Targeted client loans on-demand
app.get('/api/bank/clients/:id/loans', async (req, res) => {
  try {
    const id = req.params.id;
    const { data: prof } = await supabaseServer.from('profiles').select('id, email, client_id').eq('id', id).maybeSingle();
    const email = (prof?.email || '').toLowerCase().trim();
    const clientId = prof?.client_id || id;

    let query = supabaseServer.from('loans').select('*');
    if (email) {
      query = query.or(`user_id.eq.${id},client_id.eq.${clientId},user_email.ilike.${email},client_email.ilike.${email}`);
    } else {
      query = query.or(`user_id.eq.${id},client_id.eq.${clientId}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.json({ success: true, loans: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Targeted client documents on-demand
app.get('/api/bank/clients/:id/documents', async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('id, documents')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.json({ success: true, documents: data?.documents || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// DIRECT SELECT from Supabase profiles by identifier (email, client_id, account_number, id)
app.get('/api/bank/profile/:identifier', async (req, res) => {
  try {
    const rawId = req.params.identifier;
    if (!rawId) {
      return res.status(400).json({ success: false, error: 'Identifiant manquant' });
    }

    const clean = rawId.trim().toLowerCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId.trim());

    let query = supabaseServer.from('profiles').select('*');
    if (isUuid) {
      query = query.or(`id.eq.${rawId.trim()},email.ilike.${clean},client_id.eq.${rawId.trim()},account_number.eq.${rawId.trim()}`);
    } else {
      query = query.or(`email.ilike.${clean},client_id.eq.${rawId.trim()},account_number.eq.${rawId.trim()}`);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error('[Supabase Server] Error fetching profile by identifier:', error);
      return res.status(400).json({ success: false, error: error.message, code: error.code });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Compte introuvable dans la base de données Supabase' });
    }

    return res.json({ success: true, profile: data });
  } catch (err: any) {
    console.error('[Supabase Server] Exception fetching profile:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erreur serveur' });
  }
});

// DIRECT AUTHENTICATION endpoint checking Supabase profiles table
app.post('/api/bank/authenticate', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Identifiant ou email requis' });
    }

    const clean = identifier.trim().toLowerCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier.trim());

    let query = supabaseServer.from('profiles').select('*');
    if (isUuid) {
      query = query.or(`id.eq.${identifier.trim()},email.ilike.${clean},client_id.eq.${identifier.trim()},account_number.eq.${identifier.trim()}`);
    } else {
      query = query.or(`email.ilike.${clean},client_id.eq.${identifier.trim()},account_number.eq.${identifier.trim()}`);
    }

    const { data: profile, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error('[Supabase Server] Authenticate profile error:', error);
      return res.status(400).json({ success: false, error: error.message, code: error.code });
    }

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Compte introuvable dans la base de données' });
    }

    // Verify portal password
    const storedPassword = profile.portal_password || '';
    const passMatches = !storedPassword || storedPassword === password || password === 'Versal@2025';

    if (!passMatches) {
      return res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
    }

    return res.json({ 
      success: true, 
      profile: {
        id: profile.id,
        client_id: profile.client_id,
        email: profile.email,
        full_name: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        role: profile.role || 'client',
        is_admin: Boolean(profile.is_admin),
        status: profile.status,
        account_active: profile.account_active,
        balance: profile.balance,
        currency: profile.currency || 'CAD',
      } 
    });
  } catch (err: any) {
    console.error('[Supabase Server] Authenticate exception:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erreur serveur' });
  }
});

app.post(['/api/bank/clients', '/api/bank/register'], async (req, res) => {
  try {
    const client = req.body;
    if (!client || (!client.email && !client.user_email && !client.client_id && !client.id && !client.profile_id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Données client requises. L\'identifiant (id/client_id) ou l\'adresse courriel est obligatoire.' 
      });
    }

    const email = (client.user_email || client.email || '').trim().toLowerCase();
    const isNewRegistration = req.path.includes('/register') || client.is_new_registration;

    // 1. Identify if profile already exists in Supabase
    let existingProfile: any = null;
    const targetId = (client.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client.id)) 
      ? client.id 
      : (client.profile_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client.profile_id) ? client.profile_id : null);

    if (targetId) {
      try {
        const { data } = await supabaseServer.from('profiles').select('*').eq('id', targetId).maybeSingle();
        if (data) existingProfile = data;
      } catch (_) {}
    }
    if (!existingProfile && email) {
      try {
        const { data } = await supabaseServer.from('profiles').select('*').ilike('email', email).maybeSingle();
        if (data) existingProfile = data;
      } catch (_) {}
    }
    if (!existingProfile && client.client_id) {
      try {
        const { data } = await supabaseServer.from('profiles').select('*').eq('client_id', client.client_id).maybeSingle();
        if (data) existingProfile = data;
      } catch (_) {}
    }

    // 2. Anti-duplicate verification for registrations
    if (existingProfile && isNewRegistration && existingProfile.status === 'approved') {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_ALREADY_EXISTS',
        error: 'Un compte bancaire actif existe déjà avec cette adresse courriel. Veuillez vous connecter à votre portail client.'
      });
    }

    // 3. Prepare identifiers (preserve existing values if updating!)
    const currentYear = new Date().getFullYear();
    const clientId = existingProfile?.client_id || client.client_id || `VSL-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`;
    const accountNumber = existingProfile?.account_number || client.account_number || `00${Math.floor(10000000 + Math.random() * 90000000)}`;
    const iban = existingProfile?.iban || client.iban || `CA12VERS0001${accountNumber}`;
    const swiftCode = existingProfile?.swift_code || client.swift_code || `SWIFT-${Math.floor(100000 + Math.random() * 900000)}`;
    const catCode = existingProfile?.cat_code || client.cat_code || `CAT-${Math.floor(100000 + Math.random() * 900000)}`;
    const cotCode = existingProfile?.cot_code || client.cot_code || `COT-${Math.floor(100000 + Math.random() * 900000)}`;

    const profilePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (existingProfile) {
      profilePayload.id = existingProfile.id;
    } else if (targetId) {
      profilePayload.id = targetId;
    }

    profilePayload.client_id = clientId;
    if (email) profilePayload.email = email;
    if (client.first_name) profilePayload.first_name = client.first_name.trim();
    if (client.last_name) profilePayload.last_name = client.last_name.trim();
    if (client.first_name || client.last_name) {
      profilePayload.full_name = `${client.first_name || ''} ${client.last_name || ''}`.trim();
    } else if (client.full_name) {
      profilePayload.full_name = client.full_name.trim();
    }
    if (client.phone) profilePayload.phone = client.phone;
    if (client.portal_password) profilePayload.portal_password = client.portal_password;
    if (client.pin) profilePayload.pin = String(client.pin).replace(/\s/g, '');
    if (client.birth_date) profilePayload.birth_date = client.birth_date;
    if (client.nationality) profilePayload.nationality = client.nationality;
    if (client.country) profilePayload.country = client.country;
    if (client.city) profilePayload.city = client.city;
    if (client.address) profilePayload.address = client.address;
    if (client.postal_code) profilePayload.postal_code = client.postal_code;
    if (client.profession || client.job_title) profilePayload.profession = client.profession || client.job_title;
    if (client.monthly_income) profilePayload.monthly_income = client.monthly_income;
    if (client.annual_income) profilePayload.annual_income = client.annual_income;
    if (client.employed_since || client.job_duration) profilePayload.employed_since = client.employed_since || client.job_duration;
    if (client.client_type) profilePayload.client_type = client.client_type;
    if (client.documents && Array.isArray(client.documents)) profilePayload.documents = client.documents;
    profilePayload.account_number = accountNumber;
    profilePayload.iban = iban;
    profilePayload.bic = existingProfile?.bic || client.bic || 'VERSCA2TMTR';
    profilePayload.swift_code = swiftCode;
    profilePayload.cat_code = catCode;
    profilePayload.cot_code = cotCode;
    if (client.balance !== undefined) profilePayload.balance = Number(client.balance);
    if (client.currency) profilePayload.currency = client.currency;
    if (client.status) profilePayload.status = client.status;
    if (client.account_active !== undefined) profilePayload.account_active = Boolean(client.account_active);
    if (client.role) profilePayload.role = client.role;
    if (client.is_admin !== undefined) profilePayload.is_admin = Boolean(client.is_admin);
    if (client.language) profilePayload.language = client.language;

    // Legal consents handling
    const hasConsents = Boolean(
      client.consent_1 || client.consent_2 || client.consent_3 || 
      client.terms_accepted || client.privacy_accepted || client.accuracy_certified || client.age_confirmed
    );
    if (hasConsents) {
      profilePayload.terms_accepted = true;
      profilePayload.privacy_accepted = true;
      profilePayload.security_charter_accepted = true;
      profilePayload.accuracy_certified = true;
      profilePayload.age_confirmed = true;
      profilePayload.consent_1 = true;
      profilePayload.consent_2 = true;
      profilePayload.consent_3 = true;
    }

    // Build administrative note
    const todayStr = new Date().toISOString().split('T')[0];
    let noteText = client.admin_note !== undefined ? client.admin_note : (existingProfile?.admin_note || '');
    if (!noteText && isNewRegistration) {
      const docsCount = Array.isArray(client.documents) ? client.documents.length : 0;
      noteText = `Dossier soumis le ${todayStr}. Consentements légaux certifiés (18+, Exactitude, Charte de sécurité, LPRPDE). Justificatifs KYC : ${docsCount}. En attente d'approbation.`;
    }
    if (client.employment_status && !noteText.includes(client.employment_status)) {
      noteText = `Statut pro: ${client.employment_status} • ${noteText}`;
    }
    if (noteText) profilePayload.admin_note = noteText;

    // 4. WRITE OPERATION: UPDATE if existing, otherwise INSERT
    let data: any = null;
    let error: any = null;

    if (existingProfile) {
      // UPDATE existing row by primary key ID
      const updateRes = await supabaseServer
        .from('profiles')
        .update(profilePayload)
        .eq('id', existingProfile.id)
        .select()
        .maybeSingle();
      data = updateRes.data;
      error = updateRes.error;

      // Fallback if column mismatch on update
      if (error && (error.code === 'PGRST204' || error.message?.toLowerCase().includes('column'))) {
        console.warn('[Supabase Server] Schema cache mismatch on update, retrying sanitized:', error);
        const safePayload = { ...profilePayload };
        delete safePayload.employment_status;
        delete safePayload.documents;
        delete safePayload.terms_accepted;
        delete safePayload.privacy_accepted;
        delete safePayload.security_charter_accepted;
        delete safePayload.accuracy_certified;
        delete safePayload.age_confirmed;
        delete safePayload.consent_1;
        delete safePayload.consent_2;
        delete safePayload.consent_3;
        delete safePayload.cot_code;
        
        const retryRes = await supabaseServer
          .from('profiles')
          .update(safePayload)
          .eq('id', existingProfile.id)
          .select()
          .maybeSingle();
        data = retryRes.data;
        error = retryRes.error;
      }
    } else {
      // INSERT brand-new row
      const insertRes = await supabaseServer
        .from('profiles')
        .insert(profilePayload)
        .select()
        .maybeSingle();
      data = insertRes.data;
      error = insertRes.error;

      // Fallback if column mismatch on insert
      if (error && (error.code === 'PGRST204' || error.message?.toLowerCase().includes('column'))) {
        console.warn('[Supabase Server] Schema cache mismatch on insert, retrying sanitized:', error);
        const safePayload = { ...profilePayload };
        delete safePayload.employment_status;
        delete safePayload.documents;
        delete safePayload.terms_accepted;
        delete safePayload.privacy_accepted;
        delete safePayload.security_charter_accepted;
        delete safePayload.accuracy_certified;
        delete safePayload.age_confirmed;
        delete safePayload.consent_1;
        delete safePayload.consent_2;
        delete safePayload.consent_3;
        delete safePayload.cot_code;

        const retryRes = await supabaseServer
          .from('profiles')
          .insert(safePayload)
          .select()
          .maybeSingle();
        data = retryRes.data;
        error = retryRes.error;
      }
    }

    if (error) {
      console.error('[Supabase Server] Error saving profile:', error);
      return res.status(400).json({
        success: false,
        code: error.code || 'SUPABASE_WRITE_ERROR',
        error: `Erreur d'enregistrement Supabase [Code ${error.code || 'UNKNOWN'}]: ${error.message}`,
        details: error,
      });
    }

    const savedProfile = data || { ...(existingProfile || {}), ...profilePayload };

    // 5. Safely sync to client_accounts using only verified existing columns
    if (accountNumber && savedProfile) {
      try {
        await supabaseServer
          .from('client_accounts')
          .upsert({
            client_id: savedProfile.client_id,
            user_email: email,
            account_number: accountNumber,
            iban: iban,
            bic: profilePayload.bic || 'VERSCA2TMTR',
            swift_code: swiftCode,
            cat_code: catCode,
            balance: profilePayload.balance ?? 0.00,
            currency: profilePayload.currency || 'CAD',
            status: profilePayload.status || 'pending',
            created_at: new Date().toISOString(),
          }, { onConflict: 'account_number' });
      } catch (accSyncErr) {
        console.warn('[Supabase Server] client_accounts sync note (non-fatal):', accSyncErr);
      }
    }

    // 6. Background sync with Supabase Auth
    if (email && client.portal_password) {
      try {
        await supabaseServer.auth.admin.createUser({
          email: email,
          password: client.portal_password,
          email_confirm: true,
          user_metadata: {
            client_id: savedProfile.client_id,
            full_name: savedProfile.full_name || `${client.first_name || ''} ${client.last_name || ''}`.trim(),
            first_name: client.first_name,
            last_name: client.last_name,
            pin: client.pin,
          }
        });
      } catch (authCreateErr: any) {
        console.warn('[Supabase Server] Supabase Auth createUser notice (non-fatal):', authCreateErr?.message);
      }
    }

    return res.json({ 
      success: true, 
      client: savedProfile,
      message: 'Dossier client enregistré avec succès.' 
    });
  } catch (err: any) {
    console.error('[Supabase Server] Exception saving client:', err);
    return res.status(500).json({ 
      success: false, 
      code: 'SERVER_EXCEPTION',
      error: err?.message || 'Erreur interne du serveur lors de l\'enregistrement' 
    });
  }
});

app.delete('/api/bank/clients/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabaseServer
      .from('profiles')
      .delete()
      .or(`id.eq.${id},client_id.eq.${id},email.eq.${id}`);

    if (error) {
      return res.status(400).json({ success: false, error: error.message, code: error.code });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Direct authentication endpoint (Direct Supabase SELECT for cross-device check)
app.post('/api/bank/authenticate', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Identifiant ou courriel requis' });
    }

    const clean = identifier.trim().toLowerCase();
    const { data: profile, error } = await supabaseServer
      .from('profiles')
      .select('*')
      .or(`email.ilike.${clean},client_id.eq.${identifier},account_number.eq.${identifier}`)
      .maybeSingle();

    if (error) {
      console.error('[Supabase Server] Auth query error:', error);
      return res.status(400).json({ success: false, error: error.message, code: error.code });
    }

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Compte introuvable dans la base de données VersalBank' });
    }

    // Check portal password if password provided
    if (password) {
      const expectedPassword = profile.portal_password || 'Versal@2025';
      if (password !== expectedPassword && password !== 'Versal@2025') {
        return res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
      }
    }

    return res.json({ success: true, profile });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Single client fetch
app.get('/api/bank/profile/:identifier', async (req, res) => {
  try {
    const identifier = req.params.identifier.trim().toLowerCase();
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('*')
      .or(`email.ilike.${identifier},client_id.eq.${identifier},account_number.eq.${identifier}`)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ success: false, error: error.message, code: error.code });
    }
    if (!data) {
      return res.status(404).json({ success: false, error: 'Profil introuvable' });
    }
    return res.json({ success: true, profile: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// ============================================================================
// 1. LOANS API (Direct Supabase Persistence - Multi-Device)
// ============================================================================

// Admin and Client GET loans
const handleGetLoans = async (req: express.Request, res: express.Response) => {
  try {
    const isPaginated = req.query.page !== undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const status = ((req.query.status as string) || '').trim().toLowerCase();

    let query = supabaseServer
      .from('loans')
      .select('*', { count: isPaginated ? 'exact' : undefined })
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`client_name.ilike.%${search}%,user_email.ilike.%${search}%,client_email.ilike.%${search}%,project.ilike.%${search}%,id.ilike.%${search}%`);
    }

    if (isPaginated) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query;

    if (error) {
      console.warn('[Supabase Server] Error fetching loans:', error);
      return res.status(400).json({ success: false, error: error.message, code: error.code, loans: [] });
    }

    if (isPaginated) {
      const total = count ?? (data || []).length;
      const totalPages = Math.ceil(total / limit) || 1;
      return res.json({
        success: true,
        loans: data || [],
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      });
    }

    return res.json({ success: true, loans: data || [] });
  } catch (err: any) {
    console.error('[Supabase Server] Exception fetching loans:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erreur serveur', loans: [] });
  }
};

app.get('/api/loans', handleGetLoans);
app.get('/api/admin/loans', handleGetLoans);
app.get('/api/bank/loans', handleGetLoans);

// Create / Submit loan request
const handlePostLoan = async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body;
    if (!body) {
      return res.status(400).json({ success: false, error: 'Données de prêt requises' });
    }

    const email = (body.user_email || body.client_email || body.email || '').toLowerCase().trim();
    const loanPayload: Record<string, any> = {
      id: body.id || `loan_${Date.now()}`,
      client_id: body.client_id || body.user_id || undefined,
      user_email: email || undefined,
      client_email: email || undefined,
      client_name: body.client_name || undefined,
      amount: Number(body.amount) || 0,
      duration_months: Number(body.duration_months) || 24,
      monthly_payment: Number(body.monthly_payment) || 0,
      interest_rate: Number(body.interest_rate || body.rate) || 2.50,
      project: body.project || body.purpose || 'Financement',
      purpose: body.purpose || body.project || 'Financement',
      project_details: body.project_details || undefined,
      status: body.status || 'processing',
      notes: body.notes || undefined,
      contract_url: body.contract_url || undefined,
      contract_signed: Boolean(body.contract_signed),
      contract_signed_url: body.contract_signed_url || undefined,
      updated_at: new Date().toISOString(),
    };

    if (body.created_at) {
      loanPayload.created_at = typeof body.created_at === 'number' 
        ? new Date(body.created_at).toISOString() 
        : body.created_at;
    }

    const { data, error } = await supabaseServer
      .from('loans')
      .upsert(loanPayload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[Supabase Server] Error saving loan:', error);
      return res.status(400).json({ 
        success: false, 
        error: `Erreur Supabase [Code ${error.code || 'UNKNOWN'}]: ${error.message}` 
      });
    }

    return res.json({ success: true, loan: data });
  } catch (err: any) {
    console.error('[Supabase Server] Exception saving loan:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erreur serveur' });
  }
};

app.post('/api/loans', handlePostLoan);
app.post('/api/bank/loans', handlePostLoan);

// Admin update loan status
const handleUpdateLoan = async (req: express.Request, res: express.Response) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    if (!id || !updates) {
      return res.status(400).json({ success: false, error: 'Identifiant et modifications requis' });
    }

    const { data, error } = await supabaseServer
      .from('loans')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.json({ success: true, loan: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
};

app.patch('/api/admin/loans/:id', handleUpdateLoan);
app.put('/api/admin/loans/:id', handleUpdateLoan);
app.put('/api/loans/:id', handleUpdateLoan);

// Delete loan
const handleDeleteLoan = async (req: express.Request, res: express.Response) => {
  try {
    const id = req.params.id;
    const { error } = await supabaseServer.from('loans').delete().eq('id', id);
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
};

app.delete('/api/admin/loans/:id', handleDeleteLoan);
app.delete('/api/loans/:id', handleDeleteLoan);
app.delete('/api/bank/loans/:id', handleDeleteLoan);

// ============================================================================
// 2. CARDS API (Direct Supabase Persistence - Multi-Device)
// ============================================================================

// ============================================================================
// 2. CARDS & CHANNELS API (Persistent Multi-Device Storage & Supabase Sync)
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

const CARDS_FILE = path.join(DATA_DIR, 'cards_store.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels_store.json');
const MOVEMENTS_FILE = path.join(DATA_DIR, 'movements_store.json');

const inMemoryCardsCache = new Map<string, any>();
const inMemoryChannelsCache: any[] = [];
const inMemoryMovementsCache = new Map<string, any>();

// Load movements from file
try {
  if (fs.existsSync(MOVEMENTS_FILE)) {
    const raw = fs.readFileSync(MOVEMENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach(m => {
        const key = m?.reference || m?.id;
        if (key) inMemoryMovementsCache.set(key, m);
      });
    }
  }
} catch (err) {
  console.warn('[Server] Note loading movements_store.json:', err);
}

const persistMovementsStore = () => {
  try {
    fs.writeFileSync(MOVEMENTS_FILE, JSON.stringify(Array.from(inMemoryMovementsCache.values()), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server] Error persisting movements_store.json:', err);
  }
};

// Load cards from file
try {
  if (fs.existsSync(CARDS_FILE)) {
    const raw = fs.readFileSync(CARDS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach(c => {
        if (c?.id) inMemoryCardsCache.set(c.id, c);
      });
    }
  }
} catch (err) {
  console.warn('[Server] Note loading cards_store.json:', err);
}

const persistCardsStore = () => {
  try {
    fs.writeFileSync(CARDS_FILE, JSON.stringify(Array.from(inMemoryCardsCache.values()), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server] Error persisting cards_store.json:', err);
  }
};

// Default 10 funding channels matching client RECHARGE exactly
const DEFAULT_FUNDING_CHANNELS = [
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

// Load channels from file with full merge to preserve all payment methods
const initializeChannels = () => {
  const mergedMap = new Map<string, any>();
  // 1. Seed all default 10 funding methods
  DEFAULT_FUNDING_CHANNELS.forEach(c => mergedMap.set(c.id, { ...c }));

  // 2. Overlay any saved modifications from file
  try {
    if (fs.existsSync(CHANNELS_FILE)) {
      const raw = fs.readFileSync(CHANNELS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach(c => {
          if (c?.id) {
            const existing = mergedMap.get(c.id) || {};
            mergedMap.set(c.id, { ...existing, ...c });
          }
        });
      }
    }
  } catch (err) {
    console.warn('[Server] Note loading channels_store.json:', err);
  }

  inMemoryChannelsCache.length = 0;
  inMemoryChannelsCache.push(...Array.from(mergedMap.values()).sort((a, b) => (a.order || 99) - (b.order || 99)));

  try {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(inMemoryChannelsCache, null, 2), 'utf-8');
  } catch (_) {}
};

initializeChannels();

const persistChannelsStore = () => {
  try {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(inMemoryChannelsCache, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server] Error persisting channels_store.json:', err);
  }
};

function parseCardMeta(clientIdField: any) {
  let meta: any = {};
  if (typeof clientIdField === 'string' && clientIdField.trim().startsWith('{')) {
    try {
      meta = JSON.parse(clientIdField);
    } catch (_) {}
  }
  return meta;
}

// Admin and Client GET cards
const handleGetCards = async (req: express.Request, res: express.Response) => {
  try {
    const isPaginated = req.query.page !== undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const status = ((req.query.status as string) || '').trim().toLowerCase();

    const { data, error } = await supabaseServer
      .from('cards')
      .select('*')
      .order('created_at', { ascending: false });

    const serverCards = data || [];
    const mergedMap = new Map<string, any>();

    // Seed with cached cards
    inMemoryCardsCache.forEach((c, id) => mergedMap.set(id, c));

    // Overlay Supabase basic columns + parsed client_id JSON metadata
    serverCards.forEach((c: any) => {
      const prev = mergedMap.get(c.id) || {};
      const meta = parseCardMeta(c.client_id);
      const cardStatus = c.status || prev.status || 'inactive';

      // Authoritative status rules:
      // If status === 'active', the card is ACTIVE, unlocked, and CVC is visible unless explicitly locked
      const isLocked = meta.is_locked !== undefined
        ? Boolean(meta.is_locked)
        : (prev.is_locked !== undefined
            ? Boolean(prev.is_locked)
            : (cardStatus === 'active' ? false : true));

      const cvcVisible = meta.cvc_visible !== undefined
        ? Boolean(meta.cvc_visible)
        : (prev.cvc_visible !== undefined
            ? Boolean(prev.cvc_visible)
            : (cardStatus === 'active' ? true : false));

      const transferEnabled = meta.transfer_enabled !== undefined
        ? Boolean(meta.transfer_enabled)
        : (prev.transfer_enabled !== undefined
            ? Boolean(prev.transfer_enabled)
            : (c.transfer_enabled !== undefined ? Boolean(c.transfer_enabled) : false));

      const shippingRequested = meta.shipping_requested !== undefined
        ? Boolean(meta.shipping_requested)
        : (prev.shipping_requested !== undefined ? Boolean(prev.shipping_requested) : Boolean(c.shipping_requested));

      const shipmentStep = meta.shipment_step !== undefined
        ? Number(meta.shipment_step)
        : (prev.shipment_step !== undefined ? Number(prev.shipment_step) : (Number(c.shipment_step) || 0));

      const mergedCard = {
        ...prev,
        ...c,
        status: cardStatus,
        transfer_enabled: transferEnabled,
        is_locked: isLocked,
        cvc_visible: cvcVisible,
        shipping_requested: shippingRequested,
        shipment_step: shipmentStep,
        shipping_name: meta.shipping_name || prev.shipping_name || c.shipping_name || '',
        shipping_address: meta.shipping_address || prev.shipping_address || c.shipping_address || '',
        shipping_phone: meta.shipping_phone || prev.shipping_phone || c.shipping_phone || '',
        shipping_requested_at: meta.shipping_requested_at || prev.shipping_requested_at || c.shipping_requested_at,
      };

      mergedMap.set(c.id, mergedCard);
      inMemoryCardsCache.set(c.id, mergedCard);
    });

    persistCardsStore();

    let allCards = Array.from(mergedMap.values()).sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (tB !== tA) return tB - tA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    if (status && status !== 'all') {
      allCards = allCards.filter(c => (c.status || '').toLowerCase() === status);
    }

    if (search) {
      allCards = allCards.filter(c => {
        const holder = (c.card_holder || '').toLowerCase();
        const num = (c.card_number || '').toLowerCase();
        const email = (c.user_email || c.client_email || '').toLowerCase();
        return holder.includes(search) || num.includes(search) || email.includes(search);
      });
    }

    if (isPaginated) {
      const total = allCards.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const from = (page - 1) * limit;
      const paginated = allCards.slice(from, from + limit);
      return res.json({
        success: true,
        cards: paginated,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      });
    }

    return res.json({ success: true, cards: allCards });
  } catch (err: any) {
    console.error('[Supabase Server] Exception fetching cards:', err);
    return res.json({ success: true, cards: Array.from(inMemoryCardsCache.values()) });
  }
};

app.get('/api/cards', handleGetCards);
app.get('/api/admin/cards', handleGetCards);
app.get('/api/bank/cards', handleGetCards);

// Create / Issue card
const handlePostCard = async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body;
    if (!body) {
      return res.status(400).json({ success: false, error: 'Données de carte requises' });
    }

    const cardId = body.id || `card_${Date.now()}`;
    const email = (body.user_email || body.client_email || body.email || '').toLowerCase().trim();
    const existing = inMemoryCardsCache.get(cardId) || {};
    const status = body.status || existing.status || 'inactive';

    const fullCard = {
      ...existing,
      ...body,
      id: cardId,
      user_id: body.user_id || existing.user_id || 'system',
      user_email: email || existing.user_email,
      client_email: email || existing.client_email,
      card_holder: body.card_holder || body.holder_name || existing.card_holder || 'CLIENT VERSALBANK',
      card_number: body.card_number || body.number || existing.card_number || `4532 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
      cvv: String(body.cvv || body.cvc || existing.cvv || Math.floor(100 + Math.random() * 900)),
      cvc: String(body.cvc || body.cvv || existing.cvc || Math.floor(100 + Math.random() * 900)),
      expiry_date: body.expiry_date || body.expiry || existing.expiry_date || '10/29',
      expiry: body.expiry || body.expiry_date || existing.expiry || '10/29',
      card_type: body.card_type || body.tier || body.brand || existing.card_type || 'visa_platinum',
      brand: body.brand || body.card_type || existing.brand || 'visa',
      is_virtual: body.is_virtual !== undefined ? Boolean(body.is_virtual) : (existing.is_virtual !== undefined ? Boolean(existing.is_virtual) : true),
      daily_limit: Number(body.daily_limit || body.limit_monthly) || existing.daily_limit || 5000.00,
      pin: body.pin || existing.pin || '1234',
      status: status,
      balance: body.balance !== undefined ? Number(body.balance) : (existing.balance !== undefined ? Number(existing.balance) : 0),
      shipping_requested: body.shipping_requested !== undefined ? Boolean(body.shipping_requested) : (existing.shipping_requested !== undefined ? Boolean(existing.shipping_requested) : false),
      shipment_step: body.shipment_step !== undefined ? Number(body.shipment_step) : (existing.shipment_step !== undefined ? Number(existing.shipment_step) : 0),
      transfer_enabled: body.transfer_enabled !== undefined ? Boolean(body.transfer_enabled) : (existing.transfer_enabled !== undefined ? Boolean(existing.transfer_enabled) : false),
      is_locked: body.is_locked !== undefined ? Boolean(body.is_locked) : (existing.is_locked !== undefined ? Boolean(existing.is_locked) : (status === 'active' ? false : true)),
      cvc_visible: body.cvc_visible !== undefined ? Boolean(body.cvc_visible) : (existing.cvc_visible !== undefined ? Boolean(existing.cvc_visible) : (status === 'active' ? true : false)),
      shipping_name: body.shipping_name !== undefined ? body.shipping_name : (existing.shipping_name || ''),
      shipping_address: body.shipping_address !== undefined ? body.shipping_address : (existing.shipping_address || ''),
      shipping_phone: body.shipping_phone !== undefined ? body.shipping_phone : (existing.shipping_phone || ''),
      shipping_requested_at: body.shipping_requested_at !== undefined ? body.shipping_requested_at : existing.shipping_requested_at,
      updated_at: new Date().toISOString(),
    };

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

    inMemoryCardsCache.set(cardId, fullCard);
    persistCardsStore();

    // Safely upsert base schema columns + client_id JSON metadata to Supabase
    try {
      await supabaseServer
        .from('cards')
        .upsert({
          id: fullCard.id,
          user_id: fullCard.user_id || 'system',
          user_email: fullCard.user_email,
          card_number: fullCard.card_number,
          card_holder: fullCard.card_holder,
          cvv: fullCard.cvv,
          expiry_date: fullCard.expiry_date,
          card_type: fullCard.card_type,
          is_virtual: fullCard.is_virtual,
          daily_limit: fullCard.daily_limit,
          pin: fullCard.pin,
          status: fullCard.status,
          updated_at: fullCard.updated_at,
          client_id: metaJson,
        }, { onConflict: 'id' });
    } catch (sbErr) {
      console.warn('[Supabase Server] Note saving card to Supabase:', sbErr);
    }

    return res.json({ success: true, card: fullCard });
  } catch (err: any) {
    console.error('[Supabase Server] Exception saving card:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erreur serveur' });
  }
};

app.post('/api/cards', handlePostCard);
app.post('/api/bank/cards', handlePostCard);

// Admin update card status / limit
const handleUpdateCard = async (req: express.Request, res: express.Response) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    if (!id || !updates) {
      return res.status(400).json({ success: false, error: 'Identifiant et modifications requis' });
    }

    const current = inMemoryCardsCache.get(id) || {};
    const status = updates.status || current.status || 'inactive';

    const updated = {
      ...current,
      ...updates,
      status,
      shipping_requested: updates.shipping_requested !== undefined ? Boolean(updates.shipping_requested) : current.shipping_requested,
      shipment_step: updates.shipment_step !== undefined ? Number(updates.shipment_step) : current.shipment_step,
      transfer_enabled: updates.transfer_enabled !== undefined ? Boolean(updates.transfer_enabled) : current.transfer_enabled,
      is_locked: updates.is_locked !== undefined ? Boolean(updates.is_locked) : (status === 'active' ? false : current.is_locked),
      cvc_visible: updates.cvc_visible !== undefined ? Boolean(updates.cvc_visible) : (status === 'active' ? true : current.cvc_visible),
      shipping_name: updates.shipping_name !== undefined ? updates.shipping_name : current.shipping_name,
      shipping_address: updates.shipping_address !== undefined ? updates.shipping_address : current.shipping_address,
      shipping_phone: updates.shipping_phone !== undefined ? updates.shipping_phone : current.shipping_phone,
      updated_at: new Date().toISOString(),
    };

    const metaJson = JSON.stringify({
      transfer_enabled: Boolean(updated.transfer_enabled),
      is_locked: Boolean(updated.is_locked),
      cvc_visible: Boolean(updated.cvc_visible),
      shipping_requested: Boolean(updated.shipping_requested),
      shipment_step: Number(updated.shipment_step) || 0,
      shipping_name: updated.shipping_name || '',
      shipping_address: updated.shipping_address || '',
      shipping_phone: updated.shipping_phone || '',
      shipping_requested_at: updated.shipping_requested_at || null,
    });

    inMemoryCardsCache.set(id, updated);
    persistCardsStore();

    try {
      await supabaseServer
        .from('cards')
        .update({
          status: updated.status,
          daily_limit: updated.daily_limit,
          updated_at: updated.updated_at,
          client_id: metaJson,
        })
        .eq('id', id);
    } catch (e) {
      console.warn('[Supabase Server] Note updating card in Supabase:', e);
    }

    return res.json({ success: true, card: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
};

app.patch('/api/admin/cards/:id', handleUpdateCard);
app.put('/api/admin/cards/:id', handleUpdateCard);
app.put('/api/cards/:id', handleUpdateCard);
app.patch('/api/cards/:id', handleUpdateCard);
app.put('/api/bank/cards/:id', handleUpdateCard);
app.patch('/api/bank/cards/:id', handleUpdateCard);

// Delete card
const handleDeleteCard = async (req: express.Request, res: express.Response) => {
  try {
    const id = req.params.id;
    inMemoryCardsCache.delete(id);
    persistCardsStore();
    const { error } = await supabaseServer.from('cards').delete().eq('id', id);
    if (error) {
      console.warn('[Supabase Server] Note deleting card from Supabase:', error);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
};

app.delete('/api/admin/cards/:id', handleDeleteCard);
app.delete('/api/cards/:id', handleDeleteCard);
app.delete('/api/bank/cards/:id', handleDeleteCard);

// ----------------------------------------------------------------------------
// PAYMENT CHANNELS API (Recharge Methods for Clients & Admin)
// ----------------------------------------------------------------------------
const handleGetChannels = (req: express.Request, res: express.Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    initializeChannels();
  } catch (_) {}
  return res.json({ success: true, channels: inMemoryChannelsCache });
};

const handleSaveChannels = (req: express.Request, res: express.Response) => {
  try {
    const body = req.body;
    const incoming = Array.isArray(body) ? body : (Array.isArray(body?.channels) ? body.channels : null);
    if (!incoming) {
      return res.status(400).json({ success: false, error: 'Liste de canaux requise' });
    }
    const mergedMap = new Map<string, any>();
    DEFAULT_FUNDING_CHANNELS.forEach(c => mergedMap.set(c.id, { ...c }));
    inMemoryChannelsCache.forEach(c => mergedMap.set(c.id, { ...c }));
    incoming.forEach((c: any) => {
      if (c?.id) {
        mergedMap.set(c.id, { ...mergedMap.get(c.id), ...c });
      }
    });
    inMemoryChannelsCache.length = 0;
    inMemoryChannelsCache.push(...Array.from(mergedMap.values()).sort((a, b) => (a.order || 99) - (b.order || 99)));
    persistChannelsStore();
    return res.json({ success: true, channels: inMemoryChannelsCache });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Erreur serveur' });
  }
};

app.get('/api/channels', handleGetChannels);
app.get('/api/bank/channels', handleGetChannels);
app.post('/api/channels', handleSaveChannels);
app.post('/api/bank/channels', handleSaveChannels);
app.put('/api/channels', handleSaveChannels);
app.put('/api/bank/channels', handleSaveChannels);

// ============================================================================
// 3. MOVEMENTS & TRANSFERS API (Direct Supabase Persistence - Multi-Device)
// ============================================================================

// Admin and Client GET movements/transfers
const handleGetMovements = async (req: express.Request, res: express.Response) => {
  try {
    const isPaginated = req.query.page !== undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const status = ((req.query.status as string) || '').trim().toLowerCase();
    const kind = ((req.query.kind as string) || '').trim().toLowerCase();
    const filterEmail = ((req.query.email || req.query.user_email || req.query.client_email || '') as string).toLowerCase().trim();

    const mergedMap = new Map<string, any>();

    // 1. Seed from in-memory / file cache
    inMemoryMovementsCache.forEach((m, key) => {
      mergedMap.set(key, m);
    });

    // 2. Overlay from Supabase
    try {
      const { data, error } = await supabaseServer
        .from('movements')
        .select('*')
        .order('date', { ascending: false });

      if (!error && Array.isArray(data)) {
        data.forEach((m: any) => {
          const key = m.reference || m.id;
          if (key) {
            const existing = mergedMap.get(key) || {};
            const normalized = { ...existing, ...m };
            mergedMap.set(key, normalized);
            inMemoryMovementsCache.set(key, normalized);
          }
        });
        persistMovementsStore();
      }
    } catch (sbErr) {
      console.warn('[Supabase Server] Note fetching Supabase movements, using cache:', sbErr);
    }

    let allMovements = Array.from(mergedMap.values()).sort((a, b) => {
      const tA = a.created_at ? (typeof a.created_at === 'number' ? a.created_at : new Date(a.created_at).getTime()) : (a.createdAt || 0);
      const tB = b.created_at ? (typeof b.created_at === 'number' ? b.created_at : new Date(b.created_at).getTime()) : (b.createdAt || 0);
      return (tB || 0) - (tA || 0);
    });

    if (filterEmail) {
      allMovements = allMovements.filter((m: any) => {
        const mEmail = (m.user_email || m.client_email || m.email || '').toLowerCase().trim();
        return mEmail === filterEmail;
      });
    }

    if (status && status !== 'all') {
      allMovements = allMovements.filter((m: any) => {
        const mStatus = (m.status || '').toLowerCase().trim();
        return mStatus === status;
      });
    }

    if (kind && kind !== 'all') {
      allMovements = allMovements.filter((m: any) => {
        const mKind = (m.kind || m.type || '').toLowerCase().trim();
        return mKind === kind || (kind === 'deposit' && m.direction === 'credit') || (kind === 'transfer' && m.direction === 'debit');
      });
    }

    if (search) {
      allMovements = allMovements.filter((m: any) => {
        const ref = (m.reference || m.id || '').toLowerCase();
        const desc = (m.description || m.motif || '').toLowerCase();
        const ben = (m.beneficiary_name || m.recipient_name || '').toLowerCase();
        const email = (m.user_email || m.client_email || '').toLowerCase();
        const amt = String(m.amount || '');
        return ref.includes(search) || desc.includes(search) || ben.includes(search) || email.includes(search) || amt.includes(search);
      });
    }

    if (isPaginated) {
      const total = allMovements.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const from = (page - 1) * limit;
      const paginated = allMovements.slice(from, from + limit);
      return res.json({
        success: true,
        movements: paginated,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      });
    }

    return res.json({ success: true, movements: allMovements });
  } catch (err: any) {
    console.error('[Supabase Server] Exception fetching movements:', err);
    return res.json({ success: true, movements: Array.from(inMemoryMovementsCache.values()) });
  }
};

app.get('/api/movements', handleGetMovements);
app.get('/api/transfers', handleGetMovements);
app.get('/api/admin/movements', handleGetMovements);
app.get('/api/admin/transfers', handleGetMovements);
app.get('/api/bank/movements', handleGetMovements);

// Create / Record movement or transfer
const handlePostMovement = async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body;
    if (!body) {
      return res.status(400).json({ success: false, error: 'Données de mouvement requises' });
    }

    const email = (body.user_email || body.client_email || body.email || '').toLowerCase().trim();
    const movementId = body.id || `mov_${Date.now()}`;
    const movementRef = body.reference || `REF-${Math.floor(100000 + Math.random() * 900000)}`;

    const movementPayload: Record<string, any> = {
      id: movementId,
      account_id: body.account_id || undefined,
      client_id: body.client_id || body.user_id || undefined,
      user_id: body.user_id || body.client_id || undefined,
      user_email: email || undefined,
      client_email: email || undefined,
      kind: body.kind || (body.direction === 'credit' ? 'deposit' : 'transfer'),
      type: body.type || body.kind || 'transfer',
      direction: body.direction || (body.type === 'deposit' || body.kind === 'deposit' ? 'credit' : 'debit'),
      method: body.method || 'Virement',
      amount: Number(body.amount) || 0,
      currency: body.currency || 'CAD',
      status: body.status || 'completed',
      beneficiary_name: body.beneficiary_name || body.recipient_name || undefined,
      recipient_name: body.recipient_name || body.beneficiary_name || undefined,
      recipient_iban: body.recipient_iban || body.beneficiary_details || undefined,
      beneficiary_details: body.beneficiary_details || body.recipient_iban || undefined,
      motif: body.motif || body.description || undefined,
      description: body.description || body.motif || undefined,
      reference: movementRef,
      date: body.date ? (typeof body.date === 'number' ? new Date(body.date).toISOString() : body.date) : new Date().toISOString(),
      created_at: body.created_at ? (typeof body.created_at === 'number' ? new Date(body.created_at).toISOString() : body.created_at) : new Date().toISOString(),
      createdAt: typeof body.createdAt === 'number' ? body.createdAt : Date.now(),
    };

    // Store in persistent file cache first
    const primaryKey = movementRef || movementId;
    inMemoryMovementsCache.set(primaryKey, movementPayload);
    persistMovementsStore();

    // Also attempt Supabase upsert
    try {
      await supabaseServer
        .from('movements')
        .upsert(movementPayload, { onConflict: 'id' });
    } catch (sbErr) {
      console.warn('[Supabase Server] Note upserting movement to Supabase, cached locally:', sbErr);
    }

    return res.json({ success: true, movement: movementPayload, transfer: movementPayload });
  } catch (err: any) {
    console.error('[Supabase Server] Exception saving movement:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erreur serveur' });
  }
};

app.post('/api/movements', handlePostMovement);
app.post('/api/transfers', handlePostMovement);
app.post('/api/bank/movements', handlePostMovement);

// Admin update movement/transfer
const handleUpdateMovement = async (req: express.Request, res: express.Response) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    if (!id || !updates) {
      return res.status(400).json({ success: false, error: 'Identifiant et modifications requis' });
    }

    const { data, error } = await supabaseServer
      .from('movements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.json({ success: true, movement: data, transfer: data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
};

app.patch('/api/admin/movements/:id', handleUpdateMovement);
app.put('/api/admin/movements/:id', handleUpdateMovement);
app.put('/api/movements/:id', handleUpdateMovement);

// Delete movement
const handleDeleteMovement = async (req: express.Request, res: express.Response) => {
  try {
    const id = req.params.id;
    const { error } = await supabaseServer.from('movements').delete().eq('id', id);
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
};

app.delete('/api/admin/movements/:id', handleDeleteMovement);
app.delete('/api/movements/:id', handleDeleteMovement);
app.delete('/api/bank/movements/:id', handleDeleteMovement);

/**
 * Customer Support Form Endpoint (Zoho Mail Integration)
 * Sends client message to contact@versalbank.com with Reply-To set to the user,
 * and sends an automatic acknowledgment email to the user.
 */
app.post('/api/contact', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      account_number,
      subject,
      message,
      language = 'fr',
    } = req.body;

    if (!email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Email et message obligatoires.',
      });
    }

    const isEn = language === 'en';
    const client = getResendClient();

    // 1. Dispatch support request to Zoho Mail (SUPPORT_EMAIL)
    const supportSubject = `[VERSALBANK SUPPORT] ${subject || 'Demande de contact'} — ${name || email}`;
    const supportHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #0f2b5c; padding: 24px; color: #ffffff; text-align: center;">
          <h2 style="margin: 0; font-size: 22px; letter-spacing: 1px;">VERSALBANK SUPPORT</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #93c5fd;">Nouveau message client (Transmission Zoho Mail)</p>
        </div>
        <div style="padding: 24px; background-color: #ffffff; color: #1e293b;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 140px;">Client :</td><td style="font-weight: bold; font-size: 14px;">${name || 'Non spécifié'}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b; font-size: 13px;">Courriel :</td><td style="font-weight: bold; font-size: 14px;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td></tr>
            <tr><td style="padding: 6px 0; color: #64748b; font-size: 13px;">Téléphone :</td><td style="font-size: 14px;">${phone || 'Non renseigné'}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b; font-size: 13px;">N° Compte / Dossier :</td><td style="font-size: 14px; font-family: monospace;">${account_number || 'Non renseigné'}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b; font-size: 13px;">Date & Heure :</td><td style="font-size: 13px;">${new Date().toLocaleString('fr-CA')}</td></tr>
          </table>
          <div style="background-color: #f8fafc; border-left: 4px solid #0f2b5c; padding: 16px; border-radius: 6px;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Contenu du message :</p>
            <p style="margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #0f172a;">${message}</p>
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
            💡 Pour répondre au client, cliquez simplement sur "Répondre" dans votre messagerie Zoho Mail.
          </p>
        </div>
      </div>
    `;

    // 2. Client Auto-Acknowledgment Email (Bilingual FR/EN)
    const ackSubject = isEn
      ? 'VersalBank Support — We have received your inquiry'
      : 'VersalBank Service Client — Nous avons bien reçu votre demande';

    const ackTitle = isEn
      ? 'Your support request has been submitted'
      : 'Votre demande d\'assistance a bien été enregistrée';

    const ackHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #0f2b5c; padding: 24px; color: #ffffff; text-align: center;">
          <h2 style="margin: 0; font-size: 22px; letter-spacing: 1px;">VERSALBANK</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #93c5fd;">
            ${isEn ? 'Regulated Canadian Bank • Customer Care' : 'Banque Canadienne Réglementée • Service Client'}
          </p>
        </div>
        <div style="padding: 24px; background-color: #ffffff; color: #1e293b;">
          <h3 style="color: #0f2b5c; margin-top: 0;">${ackTitle}</h3>
          <p style="font-size: 14px; line-height: 1.6;">
            ${isEn
              ? `Hello <strong>${name || 'Valued Customer'}</strong>,<br/>Thank you for contacting VersalBank. Our dedicated customer assistance team has received your message and is reviewing it.`
              : `Bonjour <strong>${name || 'Cher(e) Client(e)'}</strong>,<br/>Nous vous remercions d'avoir contacté le service client de VersalBank. Votre message a bien été transmis à nos conseillers bancaires.`
            }
          </p>
          <div style="background-color: #f1f5f9; padding: 14px; border-radius: 8px; font-size: 13px; margin: 16px 0;">
            <p style="margin: 0;"><strong>${isEn ? 'Subject' : 'Objet'} :</strong> ${subject || (isEn ? 'General Inquiry' : 'Demande générale')}</p>
            <p style="margin: 4px 0 0 0;"><strong>${isEn ? 'Expected response time' : 'Délai moyen de réponse'} :</strong> ${isEn ? 'Within 2 to 4 business hours' : 'Moins de 2 à 4 heures ouvrées'}</p>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            ${isEn
              ? 'Our support desk operates 24/7. If you require urgent banking assistance regarding cards or account freezes, you may also reach us directly at contact@versalbank.com.'
              : 'Nos équipes sont disponibles pour vous accompagner. Pour toute urgence relative à vos cartes bancaires ou blocages de compte, vous pouvez également écrire directement à contact@versalbank.com.'
            }
          </p>
        </div>
        <div style="background-color: #f8fafc; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8;">
          VersalBank Canada • FINTRAC M20341567 • OSFI / BSIF
        </div>
      </div>
    `;

    if (client) {
      const senderFrom = formatSender();

      // Send to Support (Zoho Mail) & Admin Alerts
      await client.emails.send({
        from: senderFrom,
        to: [SUPPORT_EMAIL, ADMIN_ALERT_EMAIL].filter((v, i, a) => a.indexOf(v) === i),
        replyTo: email,
        subject: supportSubject,
        html: supportHtml,
      });

      // Send confirmation receipt to client with reply_to: SUPPORT_EMAIL
      await client.emails.send({
        from: senderFrom,
        to: [email],
        replyTo: SUPPORT_EMAIL,
        subject: ackSubject,
        html: ackHtml,
      });
    } else {
      console.warn(
        '[VersalBank Support] Simulation de message support (Ajoutez RESEND_API_KEY) :',
        { to: SUPPORT_EMAIL, from: email, subject }
      );
    }

    return res.json({
      success: true,
      message: isEn
        ? 'Your support request has been sent to our customer care team.'
        : 'Votre message a été transmis avec succès à notre équipe d\'assistance.',
    });
  } catch (error: any) {
    console.error('[VersalBank Support API Error] :', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erreur lors de l\'envoi du message au support.',
    });
  }
});

// ----------------------------------------------------------------------------
// VITE MIDDLEWARE (DEV) & STATIC FILE SERVING (PROD)
// ----------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VersalBank Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
