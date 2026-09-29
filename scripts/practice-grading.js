// Grading for practice decks, shared by the browser (instant feedback) and
// /api/complete (authoritative regrade).
// Mirrors the contract in Class Planner planner/practice_deck.py (ticket 03).

const CHOICE = new Set(['multiple_choice', 'gap_fill', 'error_correction']);
const GRADED = new Set([...CHOICE, 'match', 'reorder', 'type_in']);
const MAX_TYPED = 200;

// Unambiguous contractions only ("it's", "he'd" stay as typed). Order matters.
const CONTRACTIONS = [["can't", 'can not'], ['cannot', 'can not'], ["won't", 'will not'],
  ["shan't", 'shall not'], ["n't", ' not'], ["'re", ' are'], ["'ve", ' have'], ["'m", ' am'], ["'ll", ' will']];

// Must match normalize_typed in planner/practice_deck.py.
export function normalizeTyped(value) {
  let text = String(value).replace(/[\u2018\u2019]/g, "'").toLowerCase();
  for (const [short, full] of CONTRACTIONS) text = text.split(short).join(full);
  return text.split(/\s+/).filter(Boolean).join(' ').replace(/[.!?]+$/, '').trim();
}

export function gradedItems(deck) {
  const blocks = Array.isArray(deck?.blocks) ? deck.blocks : [];
  return blocks.flatMap((block) => (Array.isArray(block?.items) ? block.items : []))
    .filter((item) => item && GRADED.has(item.type));
}

export function gradeItem(item, answer) {
  if (CHOICE.has(item.type)) {
    return Number.isInteger(answer) && answer === item.answer;
  }
  if (item.type === 'match') {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return false;
    return Object.keys(answer).length === item.pairs.length
      && item.pairs.every((pair) => answer[pair.left] === pair.right);
  }
  if (item.type === 'type_in') {
    if (typeof answer !== 'string' || !answer.trim() || answer.length > MAX_TYPED) return false;
    const typed = normalizeTyped(answer);
    return (item.accepted || []).some((accepted) => normalizeTyped(accepted) === typed);
  }
  if (item.type === 'reorder') {
    return Array.isArray(answer) && answer.length === item.tokens.length
      && item.tokens.every((token, i) => answer[i] === token);
  }
  return false;
}

// answers: { [itemId]: value }. Only graded ids are kept, so nothing else is stored.
export function gradeDeck(deck, answers) {
  const source = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const items = gradedItems(deck);
  const missing = items.filter((item) => !Object.hasOwn(source, item.id)).map((item) => item.id);
  const kept = {};
  const results = {};
  for (const item of items) {
    if (!Object.hasOwn(source, item.id)) continue;
    kept[item.id] = source[item.id];
    results[item.id] = gradeItem(item, source[item.id]);
  }
  return {
    complete: missing.length === 0 && items.length > 0,
    missing,
    correct: Object.values(results).filter(Boolean).length,
    total: items.length,
    results,
    answers: kept,
  };
}
