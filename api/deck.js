import { select, track } from './_lib/db.js';
import { isUuid, send, studentRoute } from './_lib/http.js';

// GET /api/deck?id=<uuid>: full content (answers included for instant feedback;
// /api/complete regrades everything server-side).
export default studentRoute('GET', async (req, res, student) => {
  const id = new URL(req.url, 'http://x').searchParams.get('id');
  if (!isUuid(id)) return send(res, 400, { error: 'invalid_deck' });
  const rows = await select('decks',
    `select=id,version,content&id=eq.${id}&student_id=eq.${student.id}&limit=1`);
  if (!rows[0]) return send(res, 404, { error: 'deck_not_found' });
  // First time this deck was opened (the filter keeps the original date).
  await track('decks', `id=eq.${id}&first_opened_at=is.null`, { first_opened_at: new Date().toISOString() });
  return send(res, 200, { id: rows[0].id, version: rows[0].version, deck: rows[0].content });
});
