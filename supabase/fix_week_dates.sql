-- Fix week_start_date for all existing weekly_goals.
-- Goals are redistributed across consecutive ISO Mondays (most recent = current week).
-- Run once in the Supabase SQL Editor.

WITH ranked AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC)  AS rn,
    COUNT(*)       OVER (PARTITION BY user_id)                         AS total
  FROM weekly_goals
)
UPDATE weekly_goals wg
SET week_start_date = (
  date_trunc('week', CURRENT_DATE)::date          -- Monday of this week
  - ((r.total - r.rn) * INTERVAL '1 week')::interval
)::date
FROM ranked r
WHERE wg.id = r.id;
