-- ==============================================================================
-- Zerops Canonical PostgreSQL 18 DDL Schema (Synced 1:1 with schema.ts)
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Auth Tables (Better Auth Compatible)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Clients
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    birth_date TEXT DEFAULT '',
    birth_time TEXT DEFAULT '',
    birth_city TEXT DEFAULT '',
    birth_country TEXT DEFAULT '',
    latitude TEXT,
    longitude TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Client Dumps (15 Canonical Bronze JSONB Shards)
CREATE TABLE IF NOT EXISTS client_dumps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    birth_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_western_tropical JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_western_sidereal JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_vedic_jyotish JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_vedic_dashas JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_bazi_metaphysics JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_ziwei_fengshui JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_kabbalah_gematria JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_hebrew_zmanim JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_human_design JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_cosmobiology_midpoints JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_nasa_ephemerides JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_astrocartography_acg JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_business_penta_org JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_partner_synastry JSONB NOT NULL DEFAULT '{}'::jsonb,
    shard_predictive_electional JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS client_dumps_client_id_idx ON client_dumps (client_id);

-- 5. Client Feeds (Tier 2 Gold Feeds)
CREATE TABLE IF NOT EXISTS client_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    feed_type TEXT NOT NULL,
    xml_payload TEXT NOT NULL,
    token_estimate INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS client_feeds_client_id_feed_type_idx ON client_feeds (client_id, feed_type);

-- 6. Analyses
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    chart_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    archetype TEXT,
    strategic_summary TEXT,
    branding_recommendations JSONB,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS analyses_client_id_idx ON analyses (client_id);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'analyses' AND indexname = 'analyses_embedding_hnsw_idx'
    ) THEN
        CREATE INDEX analyses_embedding_hnsw_idx ON analyses USING hnsw (embedding vector_cosine_ops);
    END IF;
END $$;

-- 7. Leads (Opt-In, WhatsApp OTP & Bifurcated Funnel State)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    email TEXT,
    name TEXT,
    otp_code TEXT,
    otp_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'unverified',
    crm_lead_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone);

-- 8. Products & Product Variants
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    base_price INTEGER NOT NULL,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_slug_idx ON products (slug);
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_active_unique ON products (slug) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL UNIQUE,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Services & Bookings
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    price INTEGER NOT NULL,
    deposit_required INTEGER NOT NULL DEFAULT 0,
    deposit_amount INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    price_range TEXT,
    badge TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS services_slug_idx ON services (slug);
CREATE UNIQUE INDEX IF NOT EXISTS services_slug_active_unique ON services (slug) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    service_name TEXT NOT NULL,
    appointment_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_type TEXT NOT NULL DEFAULT 'full',
    deposit_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    google_calendar_event_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Orders & Order Items
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL DEFAULT 'Guest',
    customer_email TEXT,
    customer_phone TEXT NOT NULL DEFAULT '',
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_department TEXT,
    dane_code TEXT,
    amount TEXT,
    total_amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'COP',
    payment_method TEXT NOT NULL DEFAULT 'wompi',
    payment_ref TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    dian_cufe TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Inventory Locks
CREATE TABLE IF NOT EXISTS inventory_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Task Outbox (Transactional Outbox Pattern)
CREATE TABLE IF NOT EXISTS task_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    dedupe_key TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_token TEXT,
    processed_at TIMESTAMPTZ,
    redacted_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS task_outbox_type_dedupe_key_idx ON task_outbox (type, dedupe_key);
CREATE INDEX IF NOT EXISTS task_outbox_status_scheduled_for_idx ON task_outbox (status, scheduled_for);

-- 13. Admin Users (Stealth Admin & Telegram Gateway RBAC)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    phone TEXT,
    telegram_user_id BIGINT UNIQUE,
    role TEXT NOT NULL DEFAULT 'merchant',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_users_telegram_idx ON admin_users (telegram_user_id);
CREATE INDEX IF NOT EXISTS admin_users_username_idx ON admin_users (username);
CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (email);
CREATE INDEX IF NOT EXISTS admin_users_phone_idx ON admin_users (phone);

-- 14. Admin OTPs
CREATE TABLE IF NOT EXISTS admin_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_otps_user_expires_idx ON admin_otps (user_id, expires_at);

-- 15. Admin Sessions (7-day HTTP-Only Cookie Sessions)
CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_sessions_token_hash_idx ON admin_sessions (session_token_hash);
CREATE INDEX IF NOT EXISTS admin_sessions_user_id_idx ON admin_sessions (user_id);

-- 16. Site Settings
CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
