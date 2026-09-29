import { rpc, select } from './_lib/db.js';
import { gradeDeck } from '../scripts/practice-grading.js';
import { isUuid, send, studentRoute } from './_lib/http.js';

const MAX_BODY_CHARS = 50_000;

// POST /api/complete { deckId, answers: { [itemId]: value } }
export default studentRoute('POST', async (req, res, student) => {
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body || JSON.stringify(body).length > MAX_BODY_CHARS) {
    return send(res, 400, { error: 'invalid_body' });
  }
  if (!isUuid(body.deckId)) return send(res, 400, { error: 'invalid_deck' });

  const rows = await select('decks',
    `select=id,content&id=eq.${body.deckId}&student_id=eq.${student.id}&limit=1`);
  if (!rows[0]) return send(res, 404, { error: 'deck_not_found' });

  const grade = gradeDeck(rows[0].content, body.answers);
  if (!grade.complete) return send(res, 422, { error: 'incomplete', missing: grade.missing });

  const recorded = await rpc('record_completion', {
    p_student: student.id,
    p_deck: body.deckId,
    p_answers: grade.answers,
    p_correct: grade.correct,
    p_total: grade.total,
  });
  const completions = await select('attempts',
    `select=id&student_id=eq.${student.id}&completed_at=not.is.null&is_redo=is.false`);

  return send(res, 200, {
    correct: grade.correct,
    total: grade.total,
    results: grade.results,
    first: recorded.first,
    pointsAwarded: recorded.points,
    completedDecks: completions.length,
  });
});

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}
