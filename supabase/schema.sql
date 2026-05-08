-- ═══════════════════════════════════════
-- AgriScan Database Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════

-- FARMERS TABLE
create table if not exists farmers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique not null,
  location text,
  lat numeric,
  lon numeric,
  created_at timestamptz default now()
);

-- SCANS TABLE
create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(id) on delete cascade,
  image_url text,
  disease_name text not null,
  crop_type text,
  severity text check (severity in ('none','low','medium','high')),
  severity_percent integer,
  cause text,
  symptoms text,
  treatment jsonb,
  prevention jsonb,
  urgency text,
  is_healthy boolean default false,
  location text,
  lat numeric,
  lon numeric,
  created_at timestamptz default now()
);

-- SHOPS TABLE
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  lat numeric not null,
  lon numeric not null,
  products text[] default '{}',
  rating numeric(2,1),
  is_sponsored boolean default false,
  sponsored_until timestamptz,
  ad_package text check (ad_package in ('basic_ad','featured_ad','premium_ad')),
  ad_message text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- CROPS TABLE
create table if not exists crops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  tag text,
  diseases text[] default '{}',
  tips text[] default '{}',
  created_at timestamptz default now()
);

-- ── SEED CROPS ──
insert into crops (name, emoji, tag, diseases, tips) values
('Maize','🌽','Cereal crop',
  array['Gray Leaf Spot','Northern Corn Leaf Blight','Maize Rust','Maize Streak Virus','Ear Rot','Stalk Rot','Smut','Downy Mildew'],
  array['Plant certified disease-resistant seeds','Rotate with legumes every season','Proper spacing (75cm between rows)','Scout fields weekly during vegetative stage']),
('Tomatoes','🍅','Vegetable crop',
  array['Early Blight','Late Blight','Fusarium Wilt','Bacterial Speck','Tomato Mosaic Virus','Leaf Mold','Septoria Leaf Spot','Verticillium Wilt','Root Rot','Blossom End Rot','Damping Off','Anthracnose'],
  array['Stake plants for air circulation','Use drip irrigation — avoid overhead watering','Apply copper-based fungicides preventively','Remove infected leaves immediately']),
('Potatoes','🥔','Root crop',
  array['Late Blight','Early Blight','Blackleg','Scab','Bacterial Wilt','Soft Rot','Virus Y','Rhizoctonia'],
  array['Use certified seed potatoes','Hill up soil around base','Harvest before heavy rains','Store in cool, dry, dark conditions']),
('Beans','🫘','Legume crop',
  array['Bean Rust','Angular Leaf Spot','Anthracnose','Bacterial Blight','Root Rot','Bean Common Mosaic Virus','Powdery Mildew'],
  array['Avoid waterlogged soils','Inoculate seeds with rhizobium','Rotate with cereals or roots','Pick mature pods promptly']),
('Rice','🌾','Cereal crop',
  array['Rice Blast','Bacterial Leaf Blight','Sheath Rot','Brown Spot','Tungro Virus','False Smut','Stem Rot','Narrow Brown Leaf Spot'],
  array['Maintain proper water levels','Use balanced fertilizer — avoid excess nitrogen','Drain fields periodically','Use resistant varieties']);

-- ── SEED SAMPLE SHOPS (Nakuru area) ──
insert into shops (name, address, phone, lat, lon, products, is_sponsored, ad_package, rating) values
('GreenGrow Agro-Vet','Main Market Road, Nakuru','+254712345678',-0.2833,36.0667,array['Fungicides','Pesticides','Seeds','Fertilizers'],true,'featured_ad',4.7),
('FarmCare Supplies','Kenyatta Avenue, Nakuru','+254723456789',-0.2850,36.0700,array['Herbicides','Fungicides','Equipment'],false,null,4.2),
('AgriPlus Kenya','Industrial Area, Nakuru','+254734567890',-0.2900,36.0750,array['Seeds','Soil Tests','Fertilizers','Pesticides'],false,null,4.5),
('Farmers Choice','Bondeni Estate, Nakuru','+254745678901',-0.2780,36.0600,array['All inputs','Consultancy'],false,null,4.0);

-- ── ROW LEVEL SECURITY ──
alter table farmers enable row level security;
alter table scans enable row level security;
alter table shops enable row level security;
alter table crops enable row level security;

create policy "Public read crops"    on crops   for select using (true);
create policy "Public read shops"    on shops   for select using (true);
create policy "Public read scans"    on scans   for select using (true);
create policy "Public insert scans"  on scans   for insert with check (true);
create policy "Public insert farmers" on farmers for insert with check (true);
create policy "Public read farmers"  on farmers for select using (true);
create policy "Public insert shops"  on shops   for insert with check (true);
