import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hashToken } from '../api/_lib/http.js';
import complete from '../api/complete.js';
import session from '../api/session.js';
import deckRoute from '../api/deck.js';
import decksRoute from '../api/decks.js';

const deck = JSON.parse(readFileSync(new URL('./fixtures/example-deck.json', import.meta.url)));
const TOKEN = 'a'.repeat(43);
const STUDENT = { id: '11111111-1111-4111-8111-111111111111', first_name: 'Ana',
  is_minor: false, referral_code: 'k7p2' };
const DECK_ID = '22222222-2222-4222-8222-222222222222';

let calls;
let routes;
beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  calls = [];
  routes = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const route = routes.find(([pattern]) => String(url).includes(pattern));
    const body = route ? route[1] : [];
    return new Response(JSON.stringify(body), { status: 200 });
  };
});

function req(method, { token = TOKEN, body, url = '/api/x' } = {}) {
  return { method, url, body, headers: token ? { authorization: `Bearer ${token}` } : {} };
}
function res() {
  return { statusCode: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = JSON.parse(b); } };
}

test('bad or missing token is 401 without touching the database', async () => {
  const r = res();
  await session(req('GET', { token: 'short' }), r);
  assert.equal(r.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('token is looked up by hash, never in clear', async () => {
  routes.push(['students?', [STUDENT]]);
  const r = res();
  await session(req('GET'), r);
  assert.equal(r.statusCode, 200);
  assert.ok(calls[0].url.includes(hashToken(TOKEN)));
  assert.ok(!calls[0].url.includes(TOKEN));
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test('minors never receive a referral code', async () => {
  routes.push(['students?', [{ ...STUDENT, is_minor: true }]]);
  const r = res();
  await session(req('GET'), r);
  assert.equal(r.body.referralCode, null);
});

test('incomplete submissions are rejected before recording', async () => {
  routes.push(['students?', [STUDENT]], ['decks?', [{ id: DECK_ID, content: deck }]]);
  const r = res();
  await complete(req('POST', { body: { deckId: DECK_ID, answers: { g1: 0 } } }), r);
  assert.equal(r.statusCode, 422);
  assert.ok(!calls.some((c) => c.init.method === 'POST'));
});

test('complete submissions are regraded and stored without points', async () => {
  routes.push(['students?', [STUDENT]], ['decks?', [{ id: DECK_ID, version: 2, content: deck }]],
    ['attempts?', []]);
  const answers = Object.fromEntries(deck.blocks.flatMap((b) => b.items)
    .filter((i) => i.type !== 'card')
    .map((i) => [i.id, i.type === 'match' ? Object.fromEntries(i.pairs.map((p) => [p.left, p.right]))
      : i.type === 'reorder' ? i.tokens : 0]));
  const r = res();
  await complete(req('POST', { body: { deckId: DECK_ID, answers } }), r);
  assert.equal(r.statusCode, 200);
  const stored = JSON.parse(calls.find((c) => c.init.method === 'POST').init.body);
  assert.equal(stored.total, 10);
  assert.equal(stored.correct, r.body.correct);
  assert.equal(stored.deck_version, 2);
  assert.equal(stored.is_redo, false);
  assert.equal('pointsAwarded' in r.body, false);
  assert.ok(r.body.progress);
});

test('wrong method is 405', async () => {
  const r = res();
  await complete(req('GET'), r);
  assert.equal(r.statusCode, 405);
});

test('opening the link records the last access without blocking on failure', async () => {
  routes.push(['students?select', [STUDENT]]);
  globalThis.fetch = ((inner) => async (url, init = {}) => {
    if (init.method === 'PATCH') {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ message: 'column does not exist' }), { status: 400 });
    }
    return inner(url, init);
  })(globalThis.fetch);
  const r = res();
  await session(req('GET'), r);
  assert.equal(r.statusCode, 200);
  const patch = calls.find((c) => c.init.method === 'PATCH');
  assert.ok(patch.url.includes(`students?id=eq.${STUDENT.id}`));
  assert.ok(JSON.parse(patch.init.body).last_seen_at);
});

test('opening a deck records only the first opening', async () => {
  routes.push(['students?', [STUDENT]], ['decks?', [{ id: DECK_ID, version: 1, content: deck }]]);
  const r = res();
  await deckRoute(req('GET', { url: `/api/deck?id=${DECK_ID}` }), r);
  assert.equal(r.statusCode, 200);
  const patch = calls.find((c) => c.init.method === 'PATCH');
  assert.ok(patch.url.includes(`decks?id=eq.${DECK_ID}&first_opened_at=is.null`));
});

test('deck list says which decks were opened', async () => {
  routes.push(['students?', [STUDENT]], ['decks?', [
    { id: DECK_ID, lesson_number: 3, lesson_date: '2026-09-28', first_opened_at: null, title: 'X' }]],
  ['attempts?', []]);
  const r = res();
  await decksRoute(req('GET'), r);
  assert.equal(r.body[0].opened, false);
});
