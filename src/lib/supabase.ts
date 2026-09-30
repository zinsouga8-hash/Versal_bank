import { createClient } from '@supabase/supabase-js';

const rawUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
  'https://dvebugolbpzgvczqjzxr.supabase.co';

// Strip any trailing /rest/v1 or /rest/v1/ or trailing slashes to prevent "Invalid path specified" error
export const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

export const SUPABASE_ANON_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2ZWJ1Z29sYnB6Z3ZjenFqenhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDY2MjUsImV4cCI6MjEwNDYyMjYyNX0.4mN5swmH1c4uskLuXJCbMHOzkrH4H8ARnrbQYvAFPcU';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  !SUPABASE_URL.includes('placeholder')
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

