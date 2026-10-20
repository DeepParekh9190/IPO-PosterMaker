-- Minimal production schema for IPO Poster Studio (Supabase / PostgreSQL).
-- Run once in the Supabase SQL editor. No IPO table: IPO records are cached
-- transiently in the API and are not persisted per user.

create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  role text not null default 'client',
  status text not null default 'active',
  business_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists plans (
  id text primary key,
  name text not null,
  price_inr integer not null default 0,
  period text not null default 'month',
  description text not null default '',
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table if not exists subscriptions (
  user_id text primary key references users(id) on delete cascade,
  plan_id text not null default 'free',
  status text not null default 'active',
  provider text,
  provider_ref text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists brand_profiles (
  user_id text primary key references users(id) on delete cascade,
  business_name text not null default '',
  logo_data_url text,
  logo_mime text,
  template_key text not null default 'clean-white',
  color_theme text not null default 'finance-green',
  footer_text text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigserial primary key,
  actor_id text,
  action text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create table if not exists usage_counters (
  id bigserial primary key,
  user_id text not null,
  counter_key text not null,
  value integer not null default 0,
  unique (user_id, counter_key)
);

-- Admin-entered or corrected IPO records. Automatic imports never overwrite
-- these rows: manual edits win on merge.
create table if not exists ipo_overrides (
  ipo_id text primary key,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  id integer primary key check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists payment_events (
  event_id text primary key,
  data jsonb not null,
  at timestamptz not null default now()
);

create index if not exists idx_audit_at on audit_events (at desc);
create index if not exists idx_users_email on users (email);
