import { createHash } from 'node:crypto';
import { DbError, select } from './db.js';

// Personal-link tokens are 32 random bytes in base64url (43 chars). Guessing one
// is infeasible, so a malformed token is rejected before touching the database.
const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

export async function authenticate(req) {
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!TOKEN_RE.test(token)) return null;
  const rows = await select('students',
    `select=id,first_name,is_minor,referral_code`
    + `&token_hash=eq.${hashToken(token)}&active=is.true&limit=1`);
  return rows[0] || null;
}

// Wraps a handler: method check, auth, and generic errors (never leak details).
export function studentRoute(method, handler) {
  return async (req, res) => {
    if (req.method !== method) return send(res, 405, { error: 'method_not_allowed' });
    try {
      const student = await authenticate(req);
      if (!student) return send(res, 401, { error: 'invalid_link' });
      return await handler(req, res, student);
    } catch (error) {
      console.error(error instanceof DbError ? `${error.message} ${JSON.stringify(error.body)}` : error);
      return send(res, 500, { error: 'server_error' });
    }
  };
}

export const isUuid = (value) =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
