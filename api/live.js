import { DbError, storageGet } from './_lib/db.js';
import { hashToken, send } from './_lib/http.js';

// GET /api/live (Bearer <token>): the deck of a live class. The Mesa uploads it to
// the private "live-lessons" bucket under sha256(token); the realtime channel is
// random and only reaches the browser through this response.
const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

export default async function live(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!TOKEN_RE.test(token)) return send(res, 401, { error: 'invalid_link' });
  try {
    const lesson = await storageGet('live-lessons', `${hashToken(token)}.json`);
    if (!lesson) return send(res, 401, { error: 'invalid_link' });
    if (!(Date.parse(lesson.expires_at) > Date.now())) return send(res, 410, { error: 'expired' });
    const { title, html, channel, supabase_url, publishable_key, names } = lesson;
    return send(res, 200, { title, html, channel, supabase_url, publishable_key, names, role: 'student' });
  } catch (error) {
    console.error(error instanceof DbError ? `${error.message} ${JSON.stringify(error.body)}` : error);
    return send(res, 500, { error: 'server_error' });
  }
}
