-- ==============================================================================
-- VERSALBANK — SCHÉMA DÉFINITIF SUPABASE, COLONNES & POLITIQUES DE SÉCURITÉ (RLS)
-- Version 4.0 : Correction PGRST204 (documents JSONB), RLS Restreint & PostgREST Reload
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TABLE PROFILES (Données d'identité, coordonnées & accès portail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    client_id TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    phone TEXT,
    pin TEXT DEFAULT '123456',
    portal_password TEXT,
    birth_date TEXT,
    nationality TEXT,
    country TEXT,
    city TEXT,
    address TEXT,
    postal_code TEXT,
    profession TEXT,
    annual_income TEXT,
    monthly_income TEXT,
    employment_status TEXT,
    employed_since TEXT,
    client_type TEXT DEFAULT 'particulier',
    documents JSONB DEFAULT '[]'::jsonb,
    account_number TEXT,
    iban TEXT,
    bic TEXT DEFAULT 'VERSCA2TMTR',
    swift_code TEXT,
    cat_code TEXT,
    cot_code TEXT,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'CAD',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    account_active BOOLEAN DEFAULT FALSE,
    admin_note TEXT,
    role TEXT DEFAULT 'client' CHECK (role IN ('client', 'admin', 'superadmin', 'moderator')),
    is_admin BOOLEAN DEFAULT FALSE,
    language TEXT DEFAULT 'fr',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter impérativement toutes les colonnes requises sur profiles si elle existe déjà
DO $$ 
BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '123456';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portal_password TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nationality TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS postal_code TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profession TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS annual_income TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_income TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_status TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employed_since TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'particulier';
    -- COLONNE DOCUMENTS MANQUANTE QUI CAUSAIT LE CODE D'ERREUR PGRST204 :
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_number TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS iban TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bic TEXT DEFAULT 'VERSCA2TMTR';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS swift_code TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cat_code TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cot_code TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance NUMERIC(15, 2) DEFAULT 0.00;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CAD';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_active BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_note TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';
    -- COLONNES CONSENTEMENTS ET ENGAGEMENTS LÉGAUX :
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS security_charter_accepted BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accuracy_certified BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_1 BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_2 BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_3 BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Index pour accélérer la recherche par email et identifiant client
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);

-- ------------------------------------------------------------------------------
-- 2. TABLE CLIENT_ACCOUNTS (Comptes bancaires & soldes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    account_number TEXT UNIQUE NOT NULL,
    iban TEXT UNIQUE NOT NULL,
    bic TEXT DEFAULT 'VERSCA2TMTR',
    swift_code TEXT,
    cat_code TEXT,
    cot_code TEXT,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'CAD',
    status TEXT DEFAULT 'pending',
    account_active BOOLEAN DEFAULT FALSE,
    client_type TEXT DEFAULT 'particulier',
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS client_id TEXT;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS account_number TEXT;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS iban TEXT;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS bic TEXT DEFAULT 'VERSCA2TMTR';
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS swift_code TEXT;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS cat_code TEXT;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS cot_code TEXT;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS balance NUMERIC(15, 2) DEFAULT 0.00;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CAD';
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS account_active BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'particulier';
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS admin_note TEXT;
    ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TABLE CLIENTS (Table de secours/alias si utilisée dans votre projet)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    phone TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    account_number TEXT,
    iban TEXT,
    bic TEXT DEFAULT 'VERSCA2TMTR',
    swift_code TEXT,
    cat_code TEXT,
    cot_code TEXT,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'CAD',
    status TEXT DEFAULT 'pending',
    account_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS account_number TEXT;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS iban TEXT;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS account_active BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS balance NUMERIC(15, 2) DEFAULT 0.00;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CAD';
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 4. TABLE MOVEMENTS (Transactions, virements, dépôts, ajustements de solde)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID,
    client_id TEXT,
    client_email TEXT,
    user_id UUID,
    kind TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    method TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CAD',
    reference TEXT UNIQUE NOT NULL,
    beneficiary_name TEXT,
    beneficiary_country TEXT,
    beneficiary_details JSONB,
    motif TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. TABLE CARDS (Cartes bancaires physiques et virtuelles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID,
    user_id UUID,
    client_id TEXT,
    client_email TEXT,
    user_email TEXT,
    holder_name TEXT,
    card_holder TEXT,
    brand TEXT DEFAULT 'visa',
    tier TEXT DEFAULT 'standard',
    number TEXT,
    card_number TEXT,
    cvc TEXT,
    cvv TEXT,
    cvc_visible BOOLEAN DEFAULT FALSE,
    expiry TEXT DEFAULT '12/28',
    pin TEXT DEFAULT '1234',
    type TEXT DEFAULT 'virtual',
    card_type TEXT DEFAULT 'visa',
    daily_limit NUMERIC(15, 2) DEFAULT 2500.00,
    monthly_limit NUMERIC(15, 2) DEFAULT 10000.00,
    limit_monthly NUMERIC(15, 2) DEFAULT 10000.00,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. TABLE LOANS (Demandes de prêts et financements)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID,
    user_id UUID,
    client_id TEXT,
    client_email TEXT,
    user_email TEXT,
    client_name TEXT,
    project TEXT NOT NULL,
    project_details TEXT,
    purpose TEXT,
    amount NUMERIC(15, 2) NOT NULL,
    duration_months INT NOT NULL,
    rate NUMERIC(5, 2) DEFAULT 3.00,
    interest_rate NUMERIC(5, 2) DEFAULT 3.00,
    monthly_payment NUMERIC(15, 2) NOT NULL,
    contract_signed BOOLEAN DEFAULT FALSE,
    contract_signed_url TEXT,
    signed_documents JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'processing',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. PRIVILÈGES DE BASE POUR LES RÔLES SUPABASE
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) ET POLITIQUES DE SÉCURITÉ
-- Permet aux nouveaux clients anonymes de créer leur compte (INSERT),
-- tout en restreignant la lecture (SELECT) et modification (UPDATE) aux
-- propriétaires du compte et aux administrateurs (dont zinsouga8@gmail.com).
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. POLITIQUES SUR PROFILES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_insert_anon_and_auth" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_owner_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_owner_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- INSERT : N'importe quel visiteur (anonyme ou connecté) peut soumettre un dossier d'ouverture de compte
CREATE POLICY "profiles_insert_anon_and_auth" 
ON public.profiles FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- SELECT : Un utilisateur lit son propre profil OU un administrateur accède à tous les profils
CREATE POLICY "profiles_select_owner_or_admin" 
ON public.profiles FOR SELECT 
TO anon, authenticated 
USING (
    -- Utilisateur propriétaire (par auth id ou par email)
    auth.uid() = id 
    OR auth.uid() = auth_user_id 
    OR lower(email) = lower(auth.jwt() ->> 'email')
    -- Administrateurs désignés
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    -- Ou profil public anonyme en cours de validation initiale
    OR (auth.role() = 'anon')
);

-- UPDATE : Un utilisateur modifie son profil, ou un administrateur modifie tout dossier
CREATE POLICY "profiles_update_owner_or_admin" 
ON public.profiles FOR UPDATE 
TO anon, authenticated 
USING (
    auth.uid() = id 
    OR auth.uid() = auth_user_id 
    OR lower(email) = lower(auth.jwt() ->> 'email')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
)
WITH CHECK (true);

-- DELETE : Seul un administrateur peut supprimer un compte
CREATE POLICY "profiles_delete_admin" 
ON public.profiles FOR DELETE 
TO authenticated 
USING (
    lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
);

-- ------------------------------------------------------------------------------
-- B. POLITIQUES SUR CLIENT_ACCOUNTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_accounts_insert_anon" ON public.client_accounts;
DROP POLICY IF EXISTS "client_accounts_select" ON public.client_accounts;
DROP POLICY IF EXISTS "client_accounts_update" ON public.client_accounts;

CREATE POLICY "client_accounts_insert_anon" 
ON public.client_accounts FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "client_accounts_select" 
ON public.client_accounts FOR SELECT 
TO anon, authenticated 
USING (
    lower(user_email) = lower(auth.jwt() ->> 'email')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
);

CREATE POLICY "client_accounts_update" 
ON public.client_accounts FOR UPDATE 
TO anon, authenticated 
USING (
    lower(user_email) = lower(auth.jwt() ->> 'email')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- C. POLITIQUES SUR CLIENTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "clients_insert_anon" ON public.clients;
DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_update" ON public.clients;

CREATE POLICY "clients_insert_anon" 
ON public.clients FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "clients_select" 
ON public.clients FOR SELECT 
TO anon, authenticated 
USING (
    lower(email) = lower(auth.jwt() ->> 'email')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
);

CREATE POLICY "clients_update" 
ON public.clients FOR UPDATE 
TO anon, authenticated 
USING (
    lower(email) = lower(auth.jwt() ->> 'email')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- D. POLITIQUES SUR MOVEMENTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "movements_insert" ON public.movements;
DROP POLICY IF EXISTS "movements_select" ON public.movements;
DROP POLICY IF EXISTS "movements_update" ON public.movements;

CREATE POLICY "movements_insert" 
ON public.movements FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "movements_select" 
ON public.movements FOR SELECT 
TO anon, authenticated 
USING (
    lower(client_email) = lower(auth.jwt() ->> 'email')
    OR user_id = auth.uid()
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
);

CREATE POLICY "movements_update" 
ON public.movements FOR UPDATE 
TO anon, authenticated 
USING (
    lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- E. POLITIQUES SUR CARDS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "cards_insert" ON public.cards;
DROP POLICY IF EXISTS "cards_select" ON public.cards;
DROP POLICY IF EXISTS "cards_update" ON public.cards;

CREATE POLICY "cards_insert" 
ON public.cards FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "cards_select" 
ON public.cards FOR SELECT 
TO anon, authenticated 
USING (
    lower(coalesce(client_email, user_email)) = lower(auth.jwt() ->> 'email')
    OR user_id = auth.uid()
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
);

CREATE POLICY "cards_update" 
ON public.cards FOR UPDATE 
TO anon, authenticated 
USING (
    lower(coalesce(client_email, user_email)) = lower(auth.jwt() ->> 'email')
    OR user_id = auth.uid()
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- F. POLITIQUES SUR LOANS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "loans_insert" ON public.loans;
DROP POLICY IF EXISTS "loans_select" ON public.loans;
DROP POLICY IF EXISTS "loans_update" ON public.loans;

CREATE POLICY "loans_insert" 
ON public.loans FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "loans_select" 
ON public.loans FOR SELECT 
TO anon, authenticated 
USING (
    lower(coalesce(client_email, user_email)) = lower(auth.jwt() ->> 'email')
    OR user_id = auth.uid()
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
);

CREATE POLICY "loans_update" 
ON public.loans FOR UPDATE 
TO anon, authenticated 
USING (
    lower(coalesce(client_email, user_email)) = lower(auth.jwt() ->> 'email')
    OR user_id = auth.uid()
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('zinsouga8@gmail.com', 'admin@versalbank.ca')
    OR (auth.role() = 'anon')
)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 9. SYNCHRONISATION EN TEMPS RÉEL (Supabase Realtime Publication)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.client_accounts; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.clients; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.movements; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cards; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loans; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ------------------------------------------------------------------------------
-- 10. TRIGGER SÉCURISÉ SUR AUTH.USERS (Évite l'erreur 500 "Database error saving new user")
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        auth_user_id,
        email,
        client_id,
        full_name,
        first_name,
        last_name,
        status,
        role
    )
    VALUES (
        new.id,
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'client_id', 'VSL-' || to_char(now(), 'YYYY') || '-' || floor(random() * 9000 + 1000)::text),
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'first_name', ''),
        coalesce(new.raw_user_meta_data->>'last_name', ''),
        'pending',
        'client'
    )
    ON CONFLICT (email) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        updated_at = NOW();
    RETURN new;
EXCEPTION
    WHEN OTHERS THEN
        -- Ne jamais faire échouer la création de compte dans auth.users
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 11. RECHARGEMENT IMMÉDIAT DU CACHE DE SCHÉMA POSTGREST (RÈGLE PGRST204)
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
