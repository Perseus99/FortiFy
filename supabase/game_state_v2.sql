-- Game state v2 migration
-- Run in Supabase SQL Editor after schema.sql

ALTER TABLE public.game_state
  ADD COLUMN IF NOT EXISTS week_start_points integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS week_start_health  integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS best_points_week   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_health_week   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plays_this_week    integer DEFAULT 0;
