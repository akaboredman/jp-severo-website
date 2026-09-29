import { insert, select } from './_lib/db.js';
import { gradeDeck } from '../scripts/practice-grading.js';
import { isUuid, send, studentRoute } from './_lib/http.js';
import { progressFor } from './_lib/progress.js';

const MAX_BODY_CHARS = 50_000;

// POST /api/complete { deckId, answers: { [itemId]: value } }
export default studentRoute('POST', async (req, res, student) => {
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body || JSON.stringify(body).length > MAX_BODY_CHARS) {
    return send(res, 400, { error: 'invalid_body' });
  }
  if (!isUuid(body.deckId)) return send(res, 400, { error: 'invalid_deck' });

  const rows = await select('decks',
    `select=id,version,content&id=eq.${body.deckId}&student_id=eq.${student.id}&limit=1`);
  if (!rows[0]) return send(res, 404, { error: 'deck_not_found' });

  const grade = gradeDeck(rows[0].content, body.answers);
  if (!grade.complete) return send(res, 422, { error: 'incomplete', missing: grade.missing });

  const previous = await select('attempts',
    `select=deck_id&student_id=eq.${student.id}&completed_at=not.is.null`);
  const first = !previous.some((attempt) => attempt.deck_id === body.deckId);
  await insert('attempts', {
    student_id: student.id,
    deck_id: body.deckId,
    deck_version: rows[0].version,
    is_redo: !first,
    answers: grade.answers,
    correct: grade.correct,
    total: grade.total,
    completed_at: new Date().toISOString(),
  });

  return send(res, 200, {
    correct: grade.correct,
    total: grade.total,
    results: grade.results,
    first,
    completedDecks: new Set([...previous.map((a) => a.deck_id), body.deckId]).size,
    progress: await progressFor(student.id),
  });
});

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}
