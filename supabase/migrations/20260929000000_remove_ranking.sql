-- Remove the ranking (decision 2026-09-29): personal progress replaces it.
-- Run AFTER the site version without ranking is live (it no longer reads these).
-- Drops points, the weekly ranking, nicknames, ranking opt-in and the guardian
-- authorization that existed only for the ranking. Minors keep `is_minor`
-- (referral CTA stays hidden for them).

drop view if exists public.weekly_ranking;
drop function if exists public.record_completion(uuid, uuid, jsonb, integer, integer);
drop function if exists public.current_week_start();
drop table if exists public.point_events;

alter table public.students drop constraint if exists minor_ranking_needs_consent;
alter table public.students drop constraint if exists ranking_needs_nickname;
alter table public.students drop column if exists ranking_opt_in;
alter table public.students drop column if exists nickname;
alter table public.students drop column if exists guardian_consent_at;
