-- Access tracking for the teacher's "Prática" dashboard in the Mesa de Aulas.
-- Additive and nullable: run BEFORE the site version that writes these columns.
-- Only dates are stored, never what the student looked at or for how long.

alter table public.students add column if not exists last_seen_at timestamptz;
alter table public.decks add column if not exists first_opened_at timestamptz;
