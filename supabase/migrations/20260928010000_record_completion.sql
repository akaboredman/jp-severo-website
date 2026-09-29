-- Records a finished deck and awards points atomically (ticket 02).
-- Grading happens in the Vercel function; this function owns the point rules:
--   first completion 10, +5 within 3 days of the lesson, redo 3 (once per deck
--   per week), +2 per practice day. Unique indexes make every award idempotent.

create or replace function public.record_completion(
  p_student uuid, p_deck uuid, p_answers jsonb, p_correct integer, p_total integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_deck    public.decks;
  v_day     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_week    date := public.current_week_start();
  v_attempt uuid;
  v_first   boolean;
  v_points  integer := 0;
  v_rows    integer;
begin
  -- Serialize completions per student so concurrent requests cannot race.
  perform 1 from public.students where id = p_student and active for update;
  if not found then
    raise exception 'student_inactive' using errcode = 'P0001';
  end if;

  select * into v_deck from public.decks where id = p_deck and student_id = p_student;
  if not found then
    raise exception 'deck_not_found' using errcode = 'P0002';
  end if;

  v_first := not exists (
    select 1 from public.attempts
     where student_id = p_student and deck_id = p_deck and completed_at is not null);

  insert into public.attempts
    (student_id, deck_id, deck_version, is_redo, answers, correct, total, completed_at)
  values (p_student, p_deck, v_deck.version, not v_first, p_answers, p_correct, p_total, now())
  returning id into v_attempt;

  if v_first then
    insert into public.point_events (student_id, deck_id, attempt_id, kind, points, day, week_start)
    values (p_student, p_deck, v_attempt, 'first_completion', 10, v_day, v_week)
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    v_points := v_points + 10 * v_rows;

    if v_day - v_deck.lesson_date between 0 and 3 then
      insert into public.point_events (student_id, deck_id, attempt_id, kind, points, day, week_start)
      values (p_student, p_deck, v_attempt, 'early_bonus', 5, v_day, v_week)
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      v_points := v_points + 5 * v_rows;
    end if;
  else
    insert into public.point_events (student_id, deck_id, attempt_id, kind, points, day, week_start)
    values (p_student, p_deck, v_attempt, 'redo', 3, v_day, v_week)
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    v_points := v_points + 3 * v_rows;
  end if;

  insert into public.point_events (student_id, attempt_id, kind, points, day, week_start)
  values (p_student, v_attempt, 'practice_day', 2, v_day, v_week)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_points := v_points + 2 * v_rows;

  return jsonb_build_object('attempt_id', v_attempt, 'first', v_first, 'points', v_points);
end $$;

revoke all on function public.record_completion(uuid, uuid, jsonb, integer, integer)
  from public, anon, authenticated;
grant execute on function public.record_completion(uuid, uuid, jsonb, integer, integer)
  to service_role;
