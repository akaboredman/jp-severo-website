import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradeDeck, gradeItem, gradedItems, normalizeTyped } from '../scripts/practice-grading.js';

const deck = JSON.parse(readFileSync(new URL('./fixtures/example-deck.json', import.meta.url)));

function perfectAnswers() {
  const answers = {};
  for (const item of gradedItems(deck)) {
    if (item.type === 'match') answers[item.id] = Object.fromEntries(item.pairs.map((p) => [p.left, p.right]));
    else if (item.type === 'reorder') answers[item.id] = [...item.tokens];
    else answers[item.id] = item.answer;
  }
  return answers;
}

test('graded ids match the Python contract', () => {
  assert.deepEqual(gradedItems(deck).map((i) => i.id),
    ['vx1', 'vx2', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'c1', 'c2']);
});

test('perfect answers score full marks', () => {
  const grade = gradeDeck(deck, perfectAnswers());
  assert.equal(grade.complete, true);
  assert.equal(grade.correct, 10);
  assert.equal(grade.total, 10);
});

test('wrong answers are counted, not rejected', () => {
  const answers = perfectAnswers();
  answers.g1 = 2;
  answers.g4 = ['have', 'I', 'never', 'pitched', 'to', 'investors'];
  answers.vx2 = { ...answers.vx2, pitch: 'contact again later' };
  const grade = gradeDeck(deck, answers);
  assert.equal(grade.complete, true);
  assert.equal(grade.correct, 7);
  assert.equal(grade.results.g1, false);
});

test('missing answers make the attempt incomplete', () => {
  const answers = perfectAnswers();
  delete answers.c2;
  const grade = gradeDeck(deck, answers);
  assert.equal(grade.complete, false);
  assert.deepEqual(grade.missing, ['c2']);
});

test('type confusion never counts as correct', () => {
  const answers = perfectAnswers();
  answers.g1 = '0';
  answers.g4 = 'I have never pitched to investors';
  answers.vx2 = [];
  const grade = gradeDeck(deck, answers);
  assert.equal(grade.correct, 7);
});

test('extra and unknown keys are dropped before storage', () => {
  const grade = gradeDeck(deck, { ...perfectAnswers(), injected: 'x', v1: 'card' });
  assert.equal('injected' in grade.answers, false);
  assert.equal('v1' in grade.answers, false);
});

test('garbage input is handled', () => {
  assert.equal(gradeDeck(deck, null).complete, false);
  assert.equal(gradeDeck(deck, [1, 2]).complete, false);
  assert.equal(gradeDeck({}, {}).complete, false);
});

const v2 = JSON.parse(readFileSync(new URL('./fixtures/example-deck-v2.json', import.meta.url)));
const c1 = JSON.parse(readFileSync(new URL('./fixtures/example-deck-c1.json', import.meta.url)));
const item = (deck, id) => deck.blocks.flatMap((b) => b.items).find((i) => i.id === id);

test('flashcards are never graded', () => {
  assert.ok(!gradedItems(v2).some((i) => i.type === 'card'));
  assert.ok(gradedItems(v2).some((i) => i.id === 'g6'));
});

test('typed answers ignore case, spacing, curly quotes and final punctuation', () => {
  assert.equal(gradeItem(item(v2, 'g6'), '  AT '), true);
  assert.equal(gradeItem(item(v2, 'g6'), 'in'), false);
  assert.equal(gradeItem(item(c1, 'g1'), 'Are  likely to.'), true);
  assert.equal(gradeItem(item(c1, 'g1'), 'are quite likely to'), true);
  assert.equal(gradeItem(item(c1, 'g1'), 'will likely'), false);
  assert.equal(gradeItem(item(c1, 'g3'), 'upon'), true);
  assert.equal(normalizeTyped('It’s   LIKELY!'), "it's likely");
});

test('typed answers reject non-strings, blanks and oversized input', () => {
  assert.equal(gradeItem(item(v2, 'g6'), 0), false);
  assert.equal(gradeItem(item(v2, 'g6'), '   '), false);
  assert.equal(gradeItem(item(v2, 'g6'), 'at'.padEnd(500, ' ')), false);
});

test('contractions match their full forms, like the Cambridge answer key', () => {
  assert.equal(normalizeTyped("doesn't earn nearly as"), normalizeTyped('does not earn nearly as'));
  assert.equal(normalizeTyped("can't"), normalizeTyped('cannot'));
  assert.equal(normalizeTyped("won't"), normalizeTyped('will not'));
  assert.notEqual(normalizeTyped("it's"), normalizeTyped('it is'));
  const kwt = { type: 'type_in', accepted: ['does not earn nearly as'] };
  assert.equal(gradeItem(kwt, "DOESN'T EARN NEARLY AS"), true);
});
