-- FortiFi Database Schema
-- Run this in Supabase SQL Editor: supabase.com → your project → SQL Editor → New Query
-- After this file, also run: functions.sql, then npc_conversations.sql

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  created_at timestamptz default now()
);

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- GAME STATE
-- ============================================================
create table if not exists public.game_state (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  points integer default 0,
  city_health integer default 100,
  week_number integer default 1,
  level integer default 1,
  towers_placed jsonb default '[]',
  updated_at timestamptz default now()
);

-- ============================================================
-- WEEKLY GOALS
-- ============================================================
create table if not exists public.weekly_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_start_date date not null,
  goal_amount numeric(10,2) not null,
  actual_spent numeric(10,2) default 0,
  score integer default 0,
  completed boolean default false,
  goal_category text,
  goal_label text,
  created_at timestamptz default now()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10,2) not null,
  category text,
  merchant text,
  transaction_date date,
  flagged boolean default false,
  flag_reason text,
  created_at timestamptz default now()
);

-- ============================================================
-- WAVE CONFIG (set by Game Engine Agent each week)
-- ============================================================
create table if not exists public.wave_config (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_number integer not null,
  financial_score integer not null,
  enemy_count integer not null,
  enemy_speed numeric(4,2) not null,
  enemy_hp integer not null,
  spawn_rate numeric(4,2) not null,
  bonus_tower text,
  created_at timestamptz default now()
);

-- ============================================================
-- CATEGORY PREFERENCES (user-dismissed goal categories)
-- ============================================================
create table if not exists public.category_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category text not null,
  dismissed boolean default false,
  reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, category)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.game_state enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.transactions enable row level security;
alter table public.wave_config enable row level security;
alter table public.category_preferences enable row level security;

-- Profiles
create policy "users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Game state
create policy "users can manage own game state" on public.game_state
  for all using (auth.uid() = user_id);

-- Weekly goals
create policy "users can manage own goals" on public.weekly_goals
  for all using (auth.uid() = user_id);

-- Transactions
create policy "users can manage own transactions" on public.transactions
  for all using (auth.uid() = user_id);

-- Wave config
create policy "users can manage own wave config" on public.wave_config
  for all using (auth.uid() = user_id);

-- Category preferences
create policy "users can manage own preferences" on public.category_preferences
  for all using (auth.uid() = user_id);
