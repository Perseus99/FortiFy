-- NPC conversation memory
-- Run in Supabase SQL Editor

create table if not exists public.npc_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  npc_type text not null,
  messages jsonb not null default '[]',
  updated_at timestamptz default now(),
  unique(user_id, npc_type)
);

alter table public.npc_conversations enable row level security;

create policy "Users manage own NPC conversations"
  on public.npc_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
