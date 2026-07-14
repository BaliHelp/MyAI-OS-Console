-- SQL Migration File for Supabase
-- Created for MyAI OS Console Setup

-- 1. Create client_apps table
create table if not exists public.client_apps (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- e.g. "Indonesian Visas"
  slug text unique not null,        -- e.g. "indonesian-visas"
  tier text not null default 'internal', -- 'internal' | 'community'
  status text not null default 'active',
  created_at timestamptz default now()
);

-- 2. Create api_keys table
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  client_app_id uuid references public.client_apps(id) on delete cascade,
  key_prefix text not null,         -- visible part shown in UI, e.g. "sk_visas_a8f3"
  key_hash text not null,           -- hashed full key, never shown again after creation
  provider_scope text[] default '{claude,gpt,gemini}', -- which providers this key can route to
  rate_limit_per_day int,           -- null = unlimited (internal), set for community tier
  status text not null default 'active', -- active | revoked
  created_at timestamptz default now(),
  last_used_at timestamptz
);

-- 3. Create usage_logs table
create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references public.api_keys(id) on delete set null,
  provider text not null,           -- 'claude' | 'gpt' | 'gemini'
  task_type text not null,          -- 'text' | 'image' | 'audio' | 'embeddings'
  tokens_used int not null,
  created_at timestamptz default now()
);

-- 4. Create business_profile table
create table if not exists public.business_profile (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  updated_at timestamptz default now()
);

-- 5. Create knowledge_documents table
create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  client_app_id uuid references public.client_apps(id) on delete cascade, -- null = global/shared knowledge
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS) on all tables
alter table public.client_apps enable row level security;
alter table public.api_keys enable row level security;
alter table public.usage_logs enable row level security;
alter table public.business_profile enable row level security;
alter table public.knowledge_documents enable row level security;

-- Create Policies for Authenticated Admin Users
-- This assume simple multi-user or single administrative login via Supabase Auth
create policy "Allow all actions for authenticated admin on client_apps"
  on public.client_apps for all
  to authenticated
  using (true)
  with check (true);

create policy "Allow all actions for authenticated admin on api_keys"
  on public.api_keys for all
  to authenticated
  using (true)
  with check (true);

create policy "Allow all actions for authenticated admin on usage_logs"
  on public.usage_logs for all
  to authenticated
  using (true)
  with check (true);

create policy "Allow all actions for authenticated admin on business_profile"
  on public.business_profile for all
  to authenticated
  using (true)
  with check (true);

create policy "Allow all actions for authenticated admin on knowledge_documents"
  on public.knowledge_documents for all
  to authenticated
  using (true)
  with check (true);

-- Optional: Seed initial profile
insert into public.business_profile (title, content)
values (
  'MyBusiness Ecosystem Core',
  'MyBusiness is a multi-product ecosystem serving domestic and international clients. Our products include Indonesian Visas, Tropic Tech, and the MyBusiness Suite.'
) on conflict do nothing;
