// Personal progress (no ranking): weekly streak, this week's goal, and an
// anonymous count of everyone's decks this week. Weeks run Monday–Sunday in
// São Paulo time (UTC−3, no daylight saving since 2019).
import { select } from './db.js';

const TZ_OFFSET = '-03:00';
const DAY = 864e5;

// Calendar day in São Paulo for an instant, as YYYY-MM-DD.
export function spDay(instant) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(instant));
}

// Monday (YYYY-MM-DD) of the São Paulo week containing a calendar day.
export function weekStart(day) {
  const date = new Date(`${day}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - offset * DAY).toISOString().slice(0, 10);
}

// Consecutive weeks with at least one completed deck, ending this week — or last
// week, so the streak is not lost on Monday morning before the student practises.
export function streakWeeks(completedAt, now = Date.now()) {
  const weeks = new Set(completedAt.map((instant) => weekStart(spDay(instant))));
  let cursor = weekStart(spDay(now));
  if (!weeks.has(cursor)) cursor = shiftWeek(cursor, -1);
  let streak = 0;
  while (weeks.has(cursor)) { streak += 1; cursor = shiftWeek(cursor, -1); }
  return streak;
}

function shiftWeek(monday, weeks) {
  return new Date(new Date(`${monday}T12:00:00Z`).getTime() + weeks * 7 * DAY).toISOString().slice(0, 10);
}

export async function progressFor(studentId, now = Date.now()) {
  const monday = weekStart(spDay(now));
  const since = `${monday}T00:00:00${TZ_OFFSET}`;
  const [attempts, weekDecks, community] = await Promise.all([
    select('attempts', `select=deck_id,completed_at&student_id=eq.${studentId}&completed_at=not.is.null`),
    select('decks', `select=id&student_id=eq.${studentId}&lesson_date=gte.${monday}`),
    select('attempts', `select=id&completed_at=gte.${encodeURIComponent(since)}`),
  ]);
  const done = new Set(attempts.map((a) => a.deck_id));
  return {
    streakWeeks: streakWeeks(attempts.map((a) => a.completed_at), now),
    practicedThisWeek: attempts.some((a) => weekStart(spDay(a.completed_at)) === monday),
    weekGoal: { done: weekDecks.filter((d) => done.has(d.id)).length, total: weekDecks.length },
    communityThisWeek: community.length,
  };
}
