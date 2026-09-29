-- Student Practice Area: schema and access model.
-- Spec: Class Planner/.scratch/student-practice-area/PRD.md (ticket 01).
--
-- Access model: nobody reaches these tables from the browser. RLS is on with
-- no policies, and anon/authenticated lose every grant. Only the service role
-- (Vercel /api functions and the Mesa de Aulas publisher) reads and writes.
-- Minimal data: first name + nickname. No surname, birth date or contact.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- students
create table public.students (
  id                  uuid primary key default gen_random_uuid(),
  first_name          text not null check (length(first_name) between 1 and 40),
  nickname            text check (length(nickname) between 1 and 24),
  token_hash          text not null unique,          -- sha256 of the personal link token
  referral_code       text not null unique check (referral_code ~ '^[a-z0-9]{4,12}$'),
  is_minor            boolean not null default false,
  guardian_consent_at date,                          -- guardian authorized the ranking
  ranking_opt_in      boolean not null default false,
  active              boolean not null default true,
  deactivated_at      timestamptz,
  created_at          timestamptz not null default now(),
  -- A minor only enters the ranking after the guardian's authorization.
  constraint minor_ranking_needs_consent
    check (not (is_minor and ranking_opt_in) or guardian_consent_at is not null),
  -- The ranking shows nicknames only.
  constraint ranking_needs_nickname
    check (not ranking_opt_in or nickname is not null),
  constraint deactivation_consistent
    check (active = (deactivated_at is null))
);

-- ------------------------------------------------------------------ decks
-- One row per student lesson; republishing bumps version and replaces content.
create table public.decks (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id) on delete cascade,
  lesson_number integer not null check (lesson_number > 0),
  lesson_date   date not null,
  version       integer not null default 1 check (version > 0),
  content       jsonb not null,
  published_at  timestamptz not null default now(),
  unique (student_id, lesson_number)
);

-- --------------------------------------------------------------- attempts
create table public.attempts (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  deck_id      uuid not null references public.decks (id) on delete cascade,
  deck_version integer not null,
  is_redo      boolean not null default false,
  answers      jsonb not null default '[]'::jsonb,
  correct      integer not null default 0 check (correct >= 0),
  total        integer not null default 0 check (total >= 0 and correct <= total),
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index attempts_student_idx on public.attempts (student_id, completed_at);
create index attempts_deck_idx on public.attempts (deck_id);

-- ----------------------------------------------------------- point_events
-- Every point is an event. Unique indexes below make each rule idempotent, so
-- a retried or forged request can never award the same points twice.
create table public.point_events (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  deck_id    uuid references public.decks (id) on delete cascade,
  attempt_id uuid references public.attempts (id) on delete cascade,
  kind       text not null check (kind in ('first_completion', 'early_bonus', 'practice_day', 'redo')),
  points     integer not null check (points > 0),
  day        date not null,        -- America/Sao_Paulo calendar day
  week_start date not null,        -- Monday of that week
  created_at timestamptz not null default now(),
  check ((kind = 'practice_day') = (deck_id is null))
);
create unique index point_events_first_completion_uq
  on public.point_events (student_id, deck_id) where kind = 'first_completion';
create unique index point_events_early_bonus_uq
  on public.point_events (student_id, deck_id) where kind = 'early_bonus';
create unique index point_events_practice_day_uq
  on public.point_events (student_id, day) where kind = 'practice_day';
create unique index point_events_redo_uq
  on public.point_events (student_id, deck_id, week_start) where kind = 'redo';
create index point_events_week_idx on public.point_events (week_start, student_id);

-- ------------------------------------------------------- referral_bonuses
-- No data about the referred person is stored here.
create table public.referral_bonuses (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.students (id) on delete cascade,
  granted_on  date not null default (now() at time zone 'America/Sao_Paulo')::date,
  used_on     date,
  created_at  timestamptz not null default now()
);
create index referral_bonuses_referrer_idx on public.referral_bonuses (referrer_id);

-- ---------------------------------------------------------------- ranking
create or replace function public.current_week_start()
returns date language sql stable as $$
  select date_trunc('week', now() at time zone 'America/Sao_Paulo')::date
$$;

-- security_invoker keeps RLS/grants in force for whoever queries the view.
create view public.weekly_ranking with (security_invoker = true) as
select s.id as student_id,
       s.nickname,
       coalesce(sum(p.points), 0)::integer as points
from public.students s
join public.point_events p
  on p.student_id = s.id and p.week_start = public.current_week_start()
where s.active
  and s.ranking_opt_in
  and (not s.is_minor or s.guardian_consent_at is not null)
group by s.id, s.nickname;

-- -------------------------------------------------------------- retention
-- Deactivated students are purged 90 days later (cascade removes everything).
create or replace function public.purge_deactivated_students()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  delete from public.students
   where not active and deactivated_at < now() - interval '90 days';
  get diagnostics removed = row_count;
  return removed;
end $$;

-- --------------------------------------------------------------- lockdown
alter table public.students         enable row level security;
alter table public.decks            enable row level security;
alter table public.attempts         enable row level security;
alter table public.point_events     enable row level security;
alter table public.referral_bonuses enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
grant execute on function public.current_week_start() to service_role;
grant execute on function public.purge_deactivated_students() to service_role;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- Daily purge at 06:00 UTC (03:00 in São Paulo).
create extension if not exists pg_cron;
select cron.schedule('purge-deactivated-students', '0 6 * * *',
                     $$select public.purge_deactivated_students()$$);
