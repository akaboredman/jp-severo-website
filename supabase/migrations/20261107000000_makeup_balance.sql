-- Aulas a repor: a Mesa de Aulas grava o saldo (desmarcadas - reposições, lido do
-- site da escola) e o link da agenda; /pratica mostra o aviso enquanto houver saldo.
-- Additive and nullable: run BEFORE the site version that reads these columns.

alter table public.students add column if not exists makeup_pending smallint;
alter table public.students add column if not exists makeup_agenda_url text;
