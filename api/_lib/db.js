// Minimal Supabase REST client for the service role. Server-only: never import
// from browser scripts.

export class DbError extends Error {
  constructor(status, body) {
    super(`supabase ${status}`);
    this.status = status;
    this.body = body;
  }
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not configured');
  return { url: url.replace(/\/$/, ''), key };
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const { url, key } = config();
  const auth = { apikey: key };
  // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys must not.
  if (key.startsWith('eyJ')) auth.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { ...auth, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new DbError(response.status, data);
  return data;
}

export const select = (table, query) => request(`${table}?${query}`);
export const rpc = (fn, args) => request(`rpc/${fn}`, { method: 'POST', body: args });
