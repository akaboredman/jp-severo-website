import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spDay, streakWeeks, weekStart } from '../api/_lib/progress.js';

test('weeks start on Monday in São Paulo time', () => {
  assert.equal(weekStart('2026-09-28'), '2026-09-28'); // Monday
  assert.equal(weekStart('2026-10-04'), '2026-09-28'); // Sunday
  assert.equal(weekStart('2026-10-05'), '2026-10-05');
  // Sunday 23:30 in São Paulo is already Monday in UTC.
  assert.equal(spDay('2026-10-05T02:30:00Z'), '2026-10-04');
});

test('streak counts consecutive practice weeks', () => {
  const now = Date.parse('2026-10-07T15:00:00Z'); // Wednesday
  const done = ['2026-10-06T12:00:00Z', '2026-09-30T12:00:00Z', '2026-09-22T12:00:00Z'];
  assert.equal(streakWeeks(done, now), 3);
});

test('streak survives until the student practises this week', () => {
  const monday = Date.parse('2026-10-05T12:00:00Z');
  assert.equal(streakWeeks(['2026-10-01T12:00:00Z', '2026-09-24T12:00:00Z'], monday), 2);
});

test('a skipped week breaks the streak', () => {
  const now = Date.parse('2026-10-07T15:00:00Z');
  assert.equal(streakWeeks(['2026-10-06T12:00:00Z', '2026-09-22T12:00:00Z'], now), 1);
  assert.equal(streakWeeks([], now), 0);
});
