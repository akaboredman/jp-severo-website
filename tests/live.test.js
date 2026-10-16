import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { hashToken } from '../api/_lib/http.js';
import live from '../api/live.js';

const TOKEN = 'b'.repeat(43);
let calls;
let object;
beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  calls = [];
  object = null;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (!object) return new Response('{"statusCode":"404","error":"not_found"}', { status: 400 });
    return new Response(JSON.stringify(object), { status: 200 });
  };
});

const req = (token = TOKEN, method = 'GET') =>
  ({ method, url: '/api/live', headers: token ? { authorization: `Bearer ${token}` } : {} });
const res = () => ({ statusCode: 0, headers: {}, body: null,
  setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = JSON.parse(b); } });
const lesson = (hours) => ({ title: 'Aula 22', html: '<html></html>', channel: 'ch1',
  supabase_url: 'https://example.supabase.co', publishable_key: 'sb_publishable_x',
  names: { teacher: 'JP', student: 'Andressa' }, expires_at: new Date(Date.now() + hours * 3600e3).toISOString() });

test('malformed token never reaches storage', async () => {
  const r = res();
  await live(req('short'), r);
  assert.equal(r.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('deck is looked up by token hash in the private bucket', async () => {
  object = lesson(2);
  const r = res();
  await live(req(), r);
  assert.equal(r.statusCode, 200);
  assert.equal(calls[0].url, `https://example.supabase.co/storage/v1/object/live-lessons/${hashToken(TOKEN)}.json`);
  assert.ok(!calls[0].url.includes(TOKEN));
  assert.equal(r.body.role, 'student');
  assert.equal(r.body.channel, 'ch1');
  assert.equal(r.body.expires_at, undefined);
  assert.equal(r.headers['Cache-Control'], 'no-store');
});

test('unknown link is 401 and expired class is 410', async () => {
  let r = res();
  await live(req(), r);
  assert.equal(r.statusCode, 401);
  object = lesson(-1);
  r = res();
  await live(req(), r);
  assert.equal(r.statusCode, 410);
});

test('only GET', async () => {
  const r = res();
  await live(req(TOKEN, 'POST'), r);
  assert.equal(r.statusCode, 405);
});
