-- ═══════════════════════════════════════
-- AgriScan Monetization Schema — Add-on
-- Run this AFTER schema.sql in Supabase SQL Editor
-- ═══════════════════════════════════════

-- SUBSCRIPTION PLANS
create table if not exists subscription_plans (
  id text primary key,
  name text not null,
  price_usd numeric not null,
  billing text check (billing in ('monthly','yearly')),
  features jsonb default '[]',
  is_active boolean default true
);

insert into subscription_plans (id, name, price_usd, billing, features) values
('free',    'Basic',   0.00, 'monthly', '["Basic disease scan","Crop library","Weather alerts","3 scans/day"]'),
('premium', 'Premium', 2.00, 'monthly', '["Unlimited scans","Detailed AI analysis","Advanced disease detection","7-day weather forecast","Scan history","Priority support"]'),
('pro',     'Pro',     5.00, 'monthly', '["Everything in Premium","Offline mode","Export reports","Multi-farm management","SMS alerts","API access"]');

-- FARMER SUBSCRIPTIONS
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(id) on delete cascade,
  plan_id text references subscription_plans(id),
  status text check (status in ('active','cancelled','expired','trial')) default 'trial',
  started_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days'),
  payment_ref text,
  amount_paid numeric default 0,
  created_at timestamptz default now()
);

-- SHOP ADVERTISING PACKAGES
create table if not exists ad_packages (
  id text primary key,
  name text not null,
  price_usd numeric not null,
  duration_days integer not null,
  features jsonb default '[]'
);

insert into ad_packages (id, name, price_usd, duration_days, features) values
('basic_ad',    'Basic Listing',    10.00,  30,  '["Listed in nearby shops","Distance shown","Phone number visible"]'),
('featured_ad', 'Featured Listing', 25.00,  30,  '["Top of search results","Sponsored badge","Custom ad message","Product tags"]'),
('premium_ad',  'Premium Ad',       50.00,  30,  '["Homepage banner","Push notification to nearby farmers","Analytics dashboard","Priority placement"]');

-- SHOP AD PURCHASES
create table if not exists shop_ads (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade,
  package_id text references ad_packages(id),
  ad_message text,
  status text check (status in ('pending','active','expired')) default 'pending',
  started_at timestamptz,
  expires_at timestamptz,
  payment_ref text,
  amount_paid numeric default 0,
  impressions integer default 0,
  clicks integer default 0,
  created_at timestamptz default now()
);

-- PAYMENTS LOG
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(id),
  shop_id uuid references shops(id),
  type text check (type in ('subscription','shop_ad')),
  plan_id text,
  amount_usd numeric not null,
  currency text default 'USD',
  status text check (status in ('pending','completed','failed','refunded')) default 'pending',
  payment_method text,
  payment_ref text,
  created_at timestamptz default now()
);

-- OFFLINE CACHE TABLE (tracks what data was cached)
create table if not exists offline_cache_log (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(id),
  cached_at timestamptz default now(),
  crops_cached boolean default false,
  shops_cached boolean default false,
  scans_count integer default 0
);

-- RLS policies for new tables
alter table subscriptions enable row level security;
alter table shop_ads enable row level security;
alter table payments enable row level security;
alter table subscription_plans enable row level security;
alter table ad_packages enable row level security;

create policy "Public read plans" on subscription_plans for select using (true);
create policy "Public read packages" on ad_packages for select using (true);
create policy "Public read subscriptions" on subscriptions for select using (true);
create policy "Public insert subscriptions" on subscriptions for insert with check (true);
create policy "Public update subscriptions" on subscriptions for update using (true);
create policy "Public read shop ads" on shop_ads for select using (true);
create policy "Public insert shop ads" on shop_ads for insert with check (true);
create policy "Public insert payments" on payments for insert with check (true);

-- Update shops table to add ad_message column
alter table shops add column if not exists ad_message text;
alter table shops add column if not exists ad_package text;
