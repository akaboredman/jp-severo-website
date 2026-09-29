import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradeDeck, gradedItems } from '../scripts/practice-grading.js';

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
