import { select } from './_lib/db.js';
import { send, studentRoute } from './_lib/http.js';

// GET /api/decks: the student's decks, newest lesson first, with completion status.
export default studentRoute('GET', async (req, res, student) => {
  const [decks, attempts] = await Promise.all([
    select('decks', `select=id,lesson_number,lesson_date,first_opened_at,title:content->lesson->>title`
      + `&student_id=eq.${student.id}&order=lesson_number.desc`),
    select('attempts', `select=deck_id,correct,total,completed_at`
      + `&student_id=eq.${student.id}&completed_at=not.is.null`),
  ]);
  const best = new Map();
  for (const attempt of attempts) {
    const current = best.get(attempt.deck_id);
    if (!current || attempt.correct / attempt.total > current.correct / current.total) {
      best.set(attempt.deck_id, attempt);
    }
  }
  return send(res, 200, decks.map((deck) => ({
    id: deck.id,
    lessonNumber: deck.lesson_number,
    lessonDate: deck.lesson_date,
    title: deck.title,
    done: best.has(deck.id),
    opened: Boolean(deck.first_opened_at),
    best: best.has(deck.id)
      ? { correct: best.get(deck.id).correct, total: best.get(deck.id).total } : null,
  })));
});
